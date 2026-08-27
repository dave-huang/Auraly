import type { SubscriptionPlan, SubscriptionStatus } from "@shared/schema";

/**
 * RevenueCat's vocabulary, translated into ours.
 *
 * Split out from the webhook route so it can be exercised without a database
 * or a network — this mapping decides whether a paying person keeps access,
 * and it is the part most worth testing directly. See eval/entitlement.check.ts.
 */

/** Product identifiers, as configured in App Store Connect. */
export const PLAN_BY_PRODUCT: Record<string, SubscriptionPlan> = {
  "revely.plus.monthly": "monthly",
  "revely.plus.annual": "annual",
};

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

