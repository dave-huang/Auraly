import type { Express, Request, Response } from "express";
import { timingSafeEqual } from "crypto";

import { db } from "./db";
import { users, ENTITLEMENT_ID as DEFAULT_ENTITLEMENT_ID } from "@shared/schema";
import {
  resolveFromSubscriber,
  resolveState,
  type RevenueCatEvent,
} from "./services/revenueCatState";
import { fetchSubscriber } from "./services/revenueCatApi";
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

/**
 * The entitlement, overridable per environment for a staging RevenueCat
 * project. The default lives in shared/schema.ts so the app cannot drift
 * from it — see the note there for what a mismatch costs.
 */
const ENTITLEMENT_ID = process.env.REVENUECAT_ENTITLEMENT_ID || DEFAULT_ENTITLEMENT_ID;

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

    // A transfer names its parties in two arrays and carries no app_user_id at
    // all, so it cannot go through the path below and must be handled first.
    if ((event.type || "").toUpperCase() === "TRANSFER") {
      return handleTransfer(event, res);
    }

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

/**
 * A subscription changing hands.
 *
 * RevenueCat sends TRANSFER when one Apple ID's purchase moves between our
 * accounts — a person signing in as somebody else on a shared phone, or, far
 * more often, the same person signing into a second account of their own. It
 * is the event behind "I paid and the app says I have not".
 *
 * TWO THINGS MAKE IT DIFFERENT FROM EVERY OTHER EVENT.
 *
 * It names its parties in `transferred_from` / `transferred_to` and carries
 * neither `app_user_id` nor `original_app_user_id`, so the ordinary path reads
 * undefined and drops it as unattributable.
 *
 * And it carries no entitlement block — no product, no expiry — so there is
 * nothing to resolve a state FROM. `resolveState` on a transfer would read a
 * missing `expiration_at_ms` as already expired and cancel a live
 * subscription. So we ask RevenueCat what each side holds now, and write that.
 *
 * BOTH SIDES ARE UPDATED. The receiver gains what moved; the sender loses it,
 * and leaving them entitled would hand out a second free subscription per
 * transfer. Neither is inferred — both are whatever RevenueCat reports when
 * asked, which is the only account of this we are entitled to trust.
 */
async function handleTransfer(event: RevenueCatEvent, res: Response) {
  const parties = [...(event.transferred_to ?? []), ...(event.transferred_from ?? [])].filter(
    (id): id is string => typeof id === "string" && !!id && !id.startsWith("$RCAnonymousID:"),
  );

  if (parties.length === 0) {
    console.log("[RC-WEBHOOK] TRANSFER: no named parties, acknowledged");
    return res.status(200).json({ received: true });
  }

  let unreachable = false;

  for (const userId of Array.from(new Set(parties))) {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      // Not ours, or deleted since. A retry cannot conjure the row.
      if (!user) continue;

      const subscriber = await fetchSubscriber(userId);
      const state = resolveFromSubscriber(subscriber, ENTITLEMENT_ID);
      await subscriptionService.applySubscriptionState(userId, {
        ...state,
        revenueCatCustomerId: subscriber?.original_app_user_id,
      });
      console.log(`[RC-WEBHOOK] TRANSFER → ${userId} is ${state.status}`);
    } catch (error: any) {
      // Could not ask. NOTHING is written for this party — a failed lookup is
      // not evidence of anything, and guessing here either revokes a paid
      // subscription or grants a free one.
      unreachable = true;
      console.error(`[RC-WEBHOOK] TRANSFER lookup failed for ${userId}:`, error?.message);
    }
  }

  if (unreachable) {
    // 500 so RevenueCat redelivers. A transfer we could not process leaves
    // somebody holding a receipt the app does not honour, which is worth
    // retrying for.
    return res.status(500).json({ message: "Transfer lookup failed" });
  }
  return res.status(200).json({ received: true });
}

/** Exposed for eval/auth.check.ts, which asserts the endpoint is not public. */
export const REVENUECAT_WEBHOOK_PATH = "/api/webhooks/revenuecat";
