import Purchases, {
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';

import { ENTITLEMENT_ID, PRODUCTS, PURCHASES_ENABLED, REVENUECAT_IOS_KEY } from './config';

/**
 * StoreKit, through RevenueCat.
 *
 * WHAT THIS MODULE IS NOT ALLOWED TO DECIDE
 *
 * Whether someone is entitled. That answer comes from our own API, which learns
 * it from RevenueCat's webhook — see server/revenueCatWebhook.ts. This module
 * starts purchases and reports what the store said; it never writes entitlement
 * and the app never trusts it to. A client that can grant itself a subscription
 * is a client that will.
 *
 * The `customerInfo` returned here is used for exactly one thing: knowing when
 * to re-fetch from our API, because the webhook usually lands within a second
 * or two of the purchase completing but is not synchronous with it.
 *
 * EVERY FUNCTION IS SAFE TO CALL WHEN PURCHASING IS NOT CONFIGURED. A dev build
 * with no RevenueCat key must still run — see PURCHASES_ENABLED.
 */

let configured = false;

/**
 * Start the SDK. Idempotent; safe to call on every launch.
 *
 * `appUserID` is OUR user id, so the webhook can attribute a purchase to an
 * account. Passing null lets RevenueCat mint an anonymous id, which is correct
 * before sign-in — the purchase is re-attributed by `identify` afterwards.
 */
export function configurePurchases(appUserId: string | null): void {
  if (!PURCHASES_ENABLED || configured) return;
  try {
    Purchases.configure({ apiKey: REVENUECAT_IOS_KEY!, appUserID: appUserId });
    configured = true;
  } catch (error) {
    // Never fatal. Losing the ability to sell is much better than a crash at
    // launch for everyone, including the people who already paid.
    console.warn('[PURCHASES] configure failed', error);
  }
}

/** Attach purchases made before sign-in to the account that now exists. */
export async function identifyPurchaser(userId: string): Promise<void> {
  if (!PURCHASES_ENABLED || !configured) return;
  try {
    await Purchases.logIn(userId);
  } catch (error) {
    console.warn('[PURCHASES] logIn failed', error);
  }
}

export async function resetPurchaser(): Promise<void> {
  if (!PURCHASES_ENABLED || !configured) return;
  try {
    await Purchases.logOut();
  } catch {
    // Signing out of the store is best-effort; the app's own sign-out is what
    // matters and must not be blocked by it.
  }
}

export interface PlanOffer {
  plan: 'monthly' | 'annual';
  /** Localized, store-formatted price. NEVER a hard-coded "$7.99". */
  price: string;
  /** Localized price divided across the term, for the annual comparison. */
  pricePerMonth: string;
  /** Trial length in days, as the store reports it. 0 when there is none. */
  trialDays: number;
  /**
   * The raw price as a number, in the storefront's currency.
   *
   * Only for comparing the two plans against each other — the annual saving is
   * arithmetic on what the store actually charges, so it stays true in a
   * currency where Apple's tiers do not divide the way they do in dollars.
   * Never render this; render `price`, which the store has formatted.
   */
  amount: number;
  pkg: PurchasesPackage;
}

/**
 * The plans, priced by the store.
 *
 * Prices are read from StoreKit rather than written in the app, because the
 * number a person is charged depends on their storefront, their currency and
 * whatever Apple's tier conversion says today. Printing "$7.99" to someone
 * being charged €8.99 is both a lie and a refund.
 *
 * THE TRIAL IS READ THE SAME WAY, AND ONLY THE ANNUAL PLAN HAS ONE.
 *
 * `trialDays` comes from the product's introductory offer, per plan, and is 0
 * when there is none — the app never assumes a trial exists. That matters more
 * than it sounds: the offer lives in App Store Connect, not here, so if the
 * annual trial is changed to 14 days or added to monthly, every screen follows
 * without a release. Equally, if it is removed, nothing keeps promising it.
 *
 * The paywall is built on that value rather than on a constant, so a plan with
 * no trial shows "billed today" and a Subscribe button instead of a countdown
 * to a charge that has in fact already happened.
 */
export async function getPlans(): Promise<PlanOffer[]> {
  if (!PURCHASES_ENABLED || !configured) return [];
  try {
    const offerings = await Purchases.getOfferings();
    const packages = offerings.current?.availablePackages ?? [];
    const offers: PlanOffer[] = [];

    for (const pkg of packages) {
      const id = pkg.product.identifier;
      const plan =
        id === PRODUCTS.annual ? 'annual' : id === PRODUCTS.monthly ? 'monthly' : null;
      if (!plan) continue;

      const intro = pkg.product.introPrice;
      offers.push({
        plan,
        price: pkg.product.priceString,
        pricePerMonth:
          plan === 'annual'
            ? formatPerMonth(pkg.product.price / 12, pkg.product.currencyCode)
            : pkg.product.priceString,
        trialDays: trialDaysFrom(intro),
        amount: pkg.product.price,
        pkg,
      });
    }
    // Annual first: it is the plan being recommended, and the one whose saving
    // only reads as a saving when the monthly price sits next to it.
    return offers.sort((a, b) => (a.plan === 'annual' ? -1 : 1));
  } catch (error) {
    console.warn('[PURCHASES] getOfferings failed', error);
    return [];
  }
}

function trialDaysFrom(intro: PurchasesPackage['product']['introPrice']): number {
  if (!intro) return 0;
  const n = intro.periodNumberOfUnits;
  switch (intro.periodUnit) {
    case 'DAY': return n;
    case 'WEEK': return n * 7;
    case 'MONTH': return n * 30;
    case 'YEAR': return n * 365;
    default: return 0;
  }
}

function formatPerMonth(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export class PurchaseCancelledError extends Error {}

/**
 * This Apple ID already owns the subscription.
 *
 * Common and not a mistake: a reinstall, a new phone, or someone who
 * subscribed before signing in. StoreKit refuses the second purchase — which
 * is correct, and the reason it must never surface as "Could not complete".
 * The person does not need to buy anything; they need what they bought.
 */
export class AlreadySubscribedError extends Error {}

/**
 * The receipt is attached to a DIFFERENT account of ours.
 *
 * One Apple ID, two Revely accounts. Nothing the app can fix — the answer is
 * to sign in as the account that holds it — but silence here looks like a
 * subscription that vanished.
 */
export class ReceiptInUseError extends Error {}

/**
 * RevenueCat's codes cross the native bridge as strings on one platform and
 * numbers on another, and the published enum disagrees with both depending on
 * version. Comparing as text is not fussiness; a `===` here silently matched
 * nothing and sent every one of these to the generic failure alert.
 */
function isCode(error: any, code: PURCHASES_ERROR_CODE): boolean {
  return String(error?.code) === String(code);
}

/**
 * Buy a plan.
 *
 * A user cancelling out of Apple's sheet is not an error and must never
 * produce an alert — it is the single most common outcome on a paywall, and
 * apologising for it reads as a nag.
 */
export async function purchasePlan(offer: PlanOffer): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(offer.pkg).catch((error: any) => {
    if (error?.userCancelled) throw new PurchaseCancelledError('cancelled');
    if (isCode(error, PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR)) {
      throw new AlreadySubscribedError('already subscribed');
    }
    if (isCode(error, PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR)) {
      throw new ReceiptInUseError('receipt in use');
    }
    throw error;
  });
  return customerInfo;
}

/**
 * Restore purchases.
 *
 * Required by Apple — an app selling a non-consumable or subscription must
 * offer this, and review checks for it. It is also the real fix for the most
 * common support mail there is: same person, new phone.
 */
export async function restorePurchases(): Promise<CustomerInfo | null> {
  if (!PURCHASES_ENABLED || !configured) return null;
  return Purchases.restorePurchases().catch((error: any) => {
    if (isCode(error, PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR)) {
      throw new ReceiptInUseError('receipt in use');
    }
    throw error;
  });
}

/** Whether the store currently believes this person is entitled. */
export function storeSaysEntitled(info: CustomerInfo | null): boolean {
  if (!info) return false;
  return Boolean(info.entitlements.active[ENTITLEMENT_ID]);
}
