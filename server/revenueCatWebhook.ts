import type { Express, Request, Response } from "express";
import { timingSafeEqual } from "crypto";

import { db } from "./db";
import { users } from "@shared/schema";
import { resolveState, type RevenueCatEvent } from "./services/revenueCatState";
import { eq } from "drizzle-orm";
import { subscriptionService } from "./services/subscription";

/**
 * RevenueCat → our entitlement state.
 *
 * THIS IS THE ONLY PLACE SUBSCRIPTION STATE IS WRITTEN. The app never tells the
 * server what it has bought. A client that could grant itself a subscription is
 * a client that will, and StoreKit receipts are trivially replayed between
 * devices; RevenueCat validates with Apple and tells us out of band.
 *
 * The mapping we care about is small. RevenueCat has a large event vocabulary,
 * most of which is analytics; what changes entitlement is the entitlement block
 * on the subscriber, which every event carries. So rather than switching on
 * event type and trying to be exhaustive — and being wrong about the one we
 * forgot — every event resolves the same way: read the current entitlement,
 * write what it says, done. An event type we have never seen still leaves the
 * user in the right state.
 *
 * Idempotent by construction: the same event delivered three times (which
 * RevenueCat will do) writes the same row three times.
 */

const ENTITLEMENT_ID = process.env.REVENUECAT_ENTITLEMENT_ID || "plus";

/** Re-exported so the webhook route remains the one public entry point. */
export { resolveState, PLAN_BY_PRODUCT, type RevenueCatEvent } from "./services/revenueCatState";

/**
 * Shared-secret check on the Authorization header.
 *
 * RevenueCat signs nothing; it sends whatever header you configure. So this is
 * a bearer secret compared in constant time, and the endpoint is useless
 * without it — an unauthenticated webhook here would let anyone on the internet
 * grant themselves a subscription by POSTing their own user id.
 */
function authorized(req: Request): boolean {
  const expected = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!expected) return false;
  const header = req.headers.authorization;
  if (typeof header !== "string") return false;
  const provided = header.startsWith("Bearer ") ? header.slice(7) : header;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function setupRevenueCatWebhook(app: Express) {
  app.post("/api/webhooks/revenuecat", async (req: Request, res: Response) => {
    if (!authorized(req)) {
      console.warn("[RC-WEBHOOK] rejected: bad or missing secret");
      return res.status(401).json({ message: "Unauthorized" });
    }

    const event: RevenueCatEvent = (req.body as any)?.event ?? {};
    // app_user_id is set by the client to OUR user id when RevenueCat is
    // configured at sign-in. An anonymous RevenueCat id means a purchase made
    // before sign-in, which we cannot attribute yet; the app re-identifies and
    // RevenueCat re-sends.
    const userId = event.app_user_id || event.original_app_user_id;
    if (!userId || userId.startsWith("$RCAnonymousID:")) {
      console.log(`[RC-WEBHOOK] ${event.type}: no attributable user, acknowledged`);
      return res.status(200).json({ received: true });
    }

    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        // 200, not 404. A retry will not make the user exist, and RevenueCat
        // would keep redelivering for hours.
        console.warn(`[RC-WEBHOOK] ${event.type}: unknown user ${userId}, acknowledged`);
        return res.status(200).json({ received: true });
      }

      const state = resolveState(event);
      await subscriptionService.applySubscriptionState(userId, {
        ...state,
        revenueCatCustomerId: event.original_app_user_id,
      });
      console.log(
        `[RC-WEBHOOK] ${event.type} → ${userId} is ${state.status}` +
          `${state.plan ? ` (${state.plan})` : ""}` +
          `${state.expiresAt ? ` until ${state.expiresAt.toISOString()}` : ""}`,
      );
      res.status(200).json({ received: true });
    } catch (error: any) {
      // 500 so RevenueCat retries — this one IS worth redelivering.
      console.error(`[RC-WEBHOOK] failed for ${userId}:`, error?.message);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });
}

/** Exposed for eval/auth.check.ts, which asserts the endpoint is not public. */
export const REVENUECAT_WEBHOOK_PATH = "/api/webhooks/revenuecat";
