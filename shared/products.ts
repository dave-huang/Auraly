/**
 * Store identifiers, shared between the server and the app.
 *
 * A SEPARATE FILE FROM schema.ts, AND IT MUST STAY THAT WAY.
 *
 * These constants started life in shared/schema.ts, which reads naturally —
 * they are subscription facts and that is where subscription types live. It
 * does not work. schema.ts imports drizzle-orm and zod, and the app's imports
 * from it had always been `import type`, which TypeScript erases before a
 * bundler ever sees them. Turning one into a value import made Metro follow the
 * module for real and try to bundle Postgres table builders into an iOS app.
 *
 * The failure is invisible to every check that runs before a build: tsc is
 * happy because the types are correct, and lint has no opinion. Only Metro
 * objects, at the end of a twenty-five minute EAS build.
 *
 * So this file has NO IMPORTS AT ALL, deliberately. Nothing here may import
 * from schema.ts — not even a type, because a type-only import is one careless
 * edit away from being a value import again. The plan union is defined here
 * and re-exported by schema.ts, rather than the other way around.
 */

/** Billing periods a subscription can have. */
export const subscriptionPlans = ["monthly", "annual"] as const;
export type SubscriptionPlan = (typeof subscriptionPlans)[number];

/**
 * The App Store product identifiers, defined once for both sides.
 *
 * The server maps an incoming RevenueCat product id to a plan; the app matches
 * the store's offerings against the same strings. Two hand-maintained copies
 * drift, and the drift is silent: the app skips a product it cannot name, so
 * the paywall renders with no plans, no error, and nothing in the logs.
 *
 * These must match App Store Connect exactly. Apple will not rename a product
 * id or reuse a deleted one, so a typo here is permanent over there — the fix
 * is always a new product, never an edit.
 */
export const PRODUCT_IDS = {
  monthly: "revely.monthly",
  annual: "revely.annual",
} as const satisfies Record<SubscriptionPlan, string>;

/** Reverse lookup: which plan a product id means. */
export const PLAN_BY_PRODUCT: Record<string, SubscriptionPlan> = {
  [PRODUCT_IDS.monthly]: "monthly",
  [PRODUCT_IDS.annual]: "annual",
};

/**
 * The entitlement RevenueCat grants on either plan.
 *
 * The app checks for this name in the customer's active entitlements; the
 * server reads it out of the webhook payload. If the two ever disagree the
 * failure is silent and expensive — the purchase succeeds, Apple takes the
 * money, and the person is left unsubscribed holding a receipt.
 *
 * Must match the identifier in the RevenueCat dashboard exactly. Named for the
 * state it describes rather than a tier: Revely sells one subscription and has
 * no free tier, so "plus" implied a "basic" that never existed.
 */
export const ENTITLEMENT_ID = "subscriber";
