import type { RequestHandler } from "express";

import { subscriptionService } from "./services/subscription";

/**
 * Scanning before there is an account.
 *
 * Onboarding lets someone build a profile and scan a real label before they are
 * asked to sign in, because asking for an Apple ID before the app has done
 * anything is the single biggest thing that stops people from ever seeing what
 * this app is. The scans are real — same OCR, same corpus, same verdict.
 *
 * It also matters for review. The app has no free tier past its trial, and App
 * Store Review Guideline 5.1.1(v) is unfriendly to a scanner that demands an
 * account and a card before it will do the thing it advertises. A reviewer who
 * installs this app can scan things immediately, without either.
 *
 * WHAT A DEVICE ID IS AND IS NOT
 *
 * It is a random UUID the app generates on first launch and keeps in the
 * keychain. It is not an identifier Apple would call a device identifier: it
 * does not survive an uninstall, it is not derived from hardware, and it is not
 * shared with anyone. It carries no personal data and is never joined to one —
 * the anonymous_devices row holds a count and nothing else.
 *
 * It is also NOT a credential. Anyone can mint one, which is exactly why the
 * grant it unlocks is three scans and why every authenticated route still
 * demands a real token. It caps casual reuse; it does not resist an attacker,
 * and it is not asked to.
 */

export const DEVICE_HEADER = "x-revely-device";

/** A canonical v4 UUID, and nothing else. */
const DEVICE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ScanPrincipal =
  | { kind: "user"; userId: string }
  | { kind: "device"; deviceId: string };

export function readDeviceId(req: any): string | null {
  const raw = req.headers?.[DEVICE_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string" || !DEVICE_ID.test(value)) return null;
  return value.toLowerCase();
}

/**
 * Allow either a signed-in user or a device holding free scans.
 *
 * Order matters: a signed-in user is ALWAYS resolved as a user, even when the
 * request also carries a device header. The app keeps sending the header after
 * sign-in (it is set once, at launch, for every request), and preferring the
 * device would let an account out of its own quota.
 *
 * Sets `req.scanPrincipal`. Quota is not checked here — see `requireScanQuota`,
 * which is a separate step so a route can identify a caller without spending
 * anything.
 */
export const allowAnonymousScan: RequestHandler = (req: any, res, next) => {
  const userId = req.user?.claims?.sub;
  if (userId) {
    req.scanPrincipal = { kind: "user", userId } satisfies ScanPrincipal;
    return next();
  }

  const deviceId = readDeviceId(req);
  if (deviceId) {
    req.scanPrincipal = { kind: "device", deviceId } satisfies ScanPrincipal;
    return next();
  }

  return res.status(401).json({ message: "Unauthorized" });
};

/**
 * Refuse the request when there is nothing left to spend.
 *
 * BEFORE the work, not after. The previous code consumed a scan once the
 * analysis had already run and the history row was written, and swallowed the
 * failure — so the quota was advisory: a user at zero still got their scan, and
 * we still paid OpenAI for it. With no free tier past the trial, that is the
 * difference between a paywall and a suggestion.
 *
 * 402 rather than 403: the client routes on it, and "payment required" is
 * exactly what this is.
 */
export const requireScanQuota: RequestHandler = async (req: any, res, next) => {
  const principal: ScanPrincipal | undefined = req.scanPrincipal;
  if (!principal) return res.status(401).json({ message: "Unauthorized" });

  try {
    if (principal.kind === "user") {
      const quota = await subscriptionService.getUserQuotaStatus(principal.userId);
      if (!quota.canScan) {
        return res.status(402).json({
          error: "no_scans",
          // The mobile client switches on `code`; see ApiError in
          // mobile/src/lib/api.ts. Sending only `error` here meant the app fell
          // through to a generic "Scan failed" alert on a perfectly ordinary
          // paywall hit.
          code: "no_scans",
          message: "No scans remaining",
          subscription: quota.subscription,
        });
      }
      return next();
    }

    const { remaining, claimed } = await subscriptionService.getDeviceQuota(principal.deviceId);
    if (remaining <= 0) {
      const code = claimed ? "sign_in_required" : "no_scans";
      return res.status(402).json({
        // Distinct codes: a device that has been claimed belongs to an account
        // that is simply signed out on this install, and telling that person to
        // sign in is a better answer than offering them a subscription.
        error: code,
        code,
        message: claimed ? "Sign in to keep scanning" : "No free scans remaining",
      });
    }
    return next();
  } catch (error: any) {
    console.error("[QUOTA] check failed:", error?.message);
    // Fail closed. An entitlement check that errors open is not a paywall.
    return res.status(503).json({ error: "quota_unavailable", message: "Try again" });
  }
};

/** Spend one scan against whichever principal made the request. */
export async function consumeForPrincipal(
  principal: ScanPrincipal,
  productType?: string,
): Promise<void> {
  if (principal.kind === "user") {
    await subscriptionService.consumeScan(principal.userId, productType);
  } else {
    await subscriptionService.consumeDeviceScan(principal.deviceId, productType);
  }
}
