import type { RevenueCatSubscriber } from "./revenueCatState";

/**
 * Asking RevenueCat directly.
 *
 * Kept apart from revenueCatState.ts for the reason that file was split out in
 * the first place: the mapping is pure and testable without a network, and
 * this is the part that needs one.
 *
 * Uses the SECRET key (sk_...), not the public SDK key the app carries. It can
 * read any customer's subscription, so it must never reach the client and must
 * never be added to eas.json.
 */

const BASE = "https://api.revenuecat.com/v1";

/** Long enough for a slow API, short enough that a person is still waiting. */
const TIMEOUT_MS = 8000;

export class RevenueCatNotConfigured extends Error {
  constructor() {
    super("REVENUECAT_SECRET_KEY is not set");
  }
}

/**
 * Fetch one subscriber.
 *
 * Returns undefined for a customer RevenueCat has never heard of — which is
 * not an error, it is the answer for anyone who has never opened the purchase
 * sheet. Throws only when the question could not be asked, because the caller
 * must be able to tell "definitely not subscribed" apart from "we could not
 * find out", and writing `none` on a timeout would cancel a real subscription.
 */
export async function fetchSubscriber(
  appUserId: string,
): Promise<RevenueCatSubscriber | undefined> {
  const key = process.env.REVENUECAT_SECRET_KEY;
  if (!key) throw new RevenueCatNotConfigured();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE}/subscribers/${encodeURIComponent(appUserId)}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      signal: controller.signal,
    });

    // RevenueCat creates the customer on first read, so a 404 means the id is
    // unusable rather than merely unknown. Either way there is nothing to grant.
    if (response.status === 404) return undefined;

    if (!response.ok) {
      throw new Error(`RevenueCat API returned ${response.status}`);
    }

    const body = (await response.json()) as { subscriber?: RevenueCatSubscriber };
    return body.subscriber;
  } finally {
    clearTimeout(timer);
  }
}
