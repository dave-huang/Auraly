import { PLAN_BY_PRODUCT, type SubscriptionPlan, type SubscriptionStatus } from "@shared/schema";

/**
 * RevenueCat's vocabulary, translated into ours.
 *
 * Split out from the webhook route so it can be exercised without a database
 * or a network — this mapping decides whether a paying person keeps access,
 * and it is the part most worth testing directly. See eval/entitlement.check.ts.
 */

/**
 * Re-exported so the webhook and its tests have one import for this mapping.
 * The identifiers themselves live in shared/schema.ts, because the app needs
 * the same strings and two hand-maintained copies is how they drift.
 *
 * The 7-day introductory offer is attached to the ANNUAL product only; monthly
 * bills immediately. Nothing here encodes that — `period_type` on the event
 * tells us which one a given purchase was, so a purchase resolves correctly
 * whichever plan carries a trial. The split is a merchandising decision that
 * lives in App Store Connect, and this file must keep following it rather than
 * asserting it.
 */
export { PLAN_BY_PRODUCT };

export interface RevenueCatEvent {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  period_type?: string;
  expiration_at_ms?: number;
  cancel_reason?: string;
  entitlement_ids?: string[];
}

/**
 * Resolve the state a single event implies.
 *
 * `period_type` is how RevenueCat says "this is a trial": TRIAL or INTRO rather
 * than NORMAL. It is the difference between someone who has paid and someone
 * who has agreed to pay in seven days, and the UI must not congratulate the
 * second on their subscription.
 */
export function resolveState(event: RevenueCatEvent): {
  status: SubscriptionStatus;
  plan: SubscriptionPlan | null;
  expiresAt: Date | null;
} {
  const plan = event.product_id ? PLAN_BY_PRODUCT[event.product_id] ?? null : null;
  const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
  const expired = expiresAt ? expiresAt.getTime() <= Date.now() : true;

  const type = (event.type || "").toUpperCase();
  if (type === "EXPIRATION" || expired) {
    return { status: "expired", plan, expiresAt };
  }
  if (type === "BILLING_ISSUE") {
    // Still entitled. Apple retries a failed payment for days, and locking
    // someone out of a health app over a card that needs updating is a
    // punishment for a clerical problem.
    return { status: "grace", plan, expiresAt };
  }

  const periodType = (event.period_type || "").toUpperCase();
  if (periodType === "TRIAL" || periodType === "INTRO") {
    return { status: "trialing", plan, expiresAt };
  }
  // CANCELLATION is deliberately NOT expiry: it means auto-renew is off, and
  // the person keeps what they already paid for until expiration_at_ms.
  return { status: "active", plan, expiresAt };
}


// ---------------------------------------------------------------------------
// The pull path
// ---------------------------------------------------------------------------

/**
 * A subscriber as RevenueCat's REST API returns it.
 *
 * Only the fields we read. The shape differs from a webhook event in ways that
 * matter: entitlements are keyed by name rather than listed, dates are ISO
 * strings rather than epoch milliseconds, and `period_type` is lower case here
 * and upper case there. Normalising is this file's job precisely so the two
 * paths cannot drift into disagreeing about who is subscribed.
 */
export interface RevenueCatSubscriber {
  entitlements?: Record<
    string,
    { expires_date?: string | null; product_identifier?: string } | undefined
  >;
  subscriptions?: Record<
    string,
    {
      expires_date?: string | null;
      period_type?: string;
      billing_issues_detected_at?: string | null;
    } | undefined
  >;
  original_app_user_id?: string;
}

/**
 * Resolve state by ASKING RevenueCat, rather than waiting to be told.
 *
 * Exists because the webhook is a push, and a push that is lost is lost — a
 * bad secret, an outage, a deploy landing at the wrong second, and the person
 * who paid is left unsubscribed with no way back but waiting for some future
 * event. That happened, and the person it happened to was us; with customers
 * it is a refund and a one-star review about being charged for nothing.
 *
 * Deliberately the same vocabulary and the same precedence as resolveState:
 * expiry first, then billing trouble, then trial, then active. If the two ever
 * answer differently for the same subscription, one of them is a bug.
 */
export function resolveFromSubscriber(
  subscriber: RevenueCatSubscriber | undefined,
  entitlementId: string,
): { status: SubscriptionStatus; plan: SubscriptionPlan | null; expiresAt: Date | null } {
  const entitlement = subscriber?.entitlements?.[entitlementId];

  // No record of this entitlement at all: not expired, never held. `none` is
  // the honest answer, and it is what a fresh account already says — so a
  // refresh for someone who never subscribed writes nothing surprising.
  if (!entitlement) return { status: "none", plan: null, expiresAt: null };

  const productId = entitlement.product_identifier;
  const plan = productId ? PLAN_BY_PRODUCT[productId] ?? null : null;
  const expiresAt = entitlement.expires_date ? new Date(entitlement.expires_date) : null;

  // A malformed date must not read as "entitled forever".
  const valid = expiresAt !== null && !Number.isNaN(expiresAt.getTime());
  if (!valid || expiresAt.getTime() <= Date.now()) {
    return { status: "expired", plan, expiresAt: valid ? expiresAt : null };
  }

  const subscription = productId ? subscriber?.subscriptions?.[productId] : undefined;

  if (subscription?.billing_issues_detected_at) {
    return { status: "grace", plan, expiresAt };
  }

  const periodType = (subscription?.period_type || "").toUpperCase();
  if (periodType === "TRIAL" || periodType === "INTRO") {
    return { status: "trialing", plan, expiresAt };
  }
  return { status: "active", plan, expiresAt };
}
