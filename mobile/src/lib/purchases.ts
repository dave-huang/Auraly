import { Linking } from 'react-native';
import Purchases, {
  INTRO_ELIGIBILITY_STATUS,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';

import { activeSubscriptions } from '../../modules/store-status';

import {
  APPLE_SUBSCRIPTIONS_URL,
  ENTITLEMENT_ID,
  PRODUCTS,
  PURCHASES_ENABLED,
  REVENUECAT_IOS_KEY,
} from './config';

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
    return (await withTrialEligibility(offers)).sort((a, b) => (a.plan === 'annual' ? -1 : 1));
  } catch (error) {
    console.warn('[PURCHASES] getOfferings failed', error);
    return [];
  }
}

/**
 * Drop the trial from any plan this Apple ID cannot get it on.
 *
 * `introPrice` says what the PRODUCT offers. Apple gives it only to an Apple
 * ID that has never subscribed in the group, so to anyone who has, the
 * paywall promised "Start your 7-day free trial" and Apple's sheet then
 * charged in full, or queued a paid plan behind a subscription they already
 * held. Found by someone testing an offer code on an Apple ID that had
 * redeemed one already.
 *
 * Silent: Apple answers from the Apple ID without a prompt, and nothing moves
 * between accounts. Only a definite INELIGIBLE removes the trial. UNKNOWN keeps
 * it, because a wrong "no trial" would talk a new customer out of a free week,
 * and Apple's own sheet states the real terms either way.
 */
async function withTrialEligibility(offers: PlanOffer[]): Promise<PlanOffer[]> {
  const withTrial = offers.filter((o) => o.trialDays > 0);
  if (withTrial.length === 0) return offers;
  try {
    const eligibility = await Purchases.checkTrialOrIntroductoryPriceEligibility(
      withTrial.map((o) => o.pkg.product.identifier),
    );
    return offers.map((o) =>
      eligibility[o.pkg.product.identifier]?.status ===
      INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_INELIGIBLE
        ? { ...o, trialDays: 0 }
        : o,
    );
  } catch (error) {
    console.warn('[PURCHASES] trial eligibility check failed', error);
    return offers;
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

/**
 * Apple's subscription controls, as a sheet over the app.
 *
 * Cancelling, upgrading and downgrading are Apple's to perform and always have
 * been; StoreKit offers no API to change a subscription, only one to present
 * the panel that can. That panel is what this opens.
 *
 * IT REPLACED A LINK TO apps.apple.com, AND THE DIFFERENCE MATTERS TWICE.
 *
 * The link left the app — Safari, then the App Store, then find your way back
 * — to reach a page that could have been a sheet. And the web page lists
 * PRODUCTION purchases only, so through TestFlight and sandbox testing it
 * showed nothing at all: a person who had just subscribed tapped "Manage" and
 * was told, in effect, that they had not. The native sheet is the only surface
 * that shows a sandbox subscription, which makes it the only one that can be
 * tested before release.
 *
 * The URL survives as the fallback, for the two cases the sheet cannot serve:
 * a build with no RevenueCat key, and a subscription that did not come from
 * the App Store. Failing to open either is silent on purpose: an alert saying
 * the management panel would not open helps nobody reach it.
 */
export async function openManageSubscriptions(): Promise<void> {
  if (PURCHASES_ENABLED && configured) {
    try {
      await Purchases.showManageSubscriptions();
      return;
    } catch (error) {
      console.warn('[PURCHASES] showManageSubscriptions failed', error);
    }
  }
  await Linking.openURL(APPLE_SUBSCRIPTIONS_URL).catch(() => {});
}

/**
 * Apple's offer code sheet: a code typed into Apple's own UI, redeemed by
 * Apple, for a subscription offer set up in App Store Connect.
 *
 * This is how a free year reaches friends and family without breaking
 * Guideline 3.1.1. The app never sees or checks the code. A field of our own
 * that unlocked access would be exactly the "license key" the guideline bans,
 * and it would be a second way into the app the server knows nothing about.
 *
 * FIRE AND FORGET, BECAUSE STOREKIT IS. The call returns once the sheet is up,
 * not when a code is redeemed, and there is no callback for success. A
 * redemption arrives like any other transaction: StoreKit hands it to
 * RevenueCat, which updates CustomerInfo, which is what `onStoreEntitled`
 * below listens for. Cancelling the sheet produces nothing at all.
 *
 * Returns false when there is no sheet to show, so the caller can say so
 * rather than leave a tap that did nothing.
 */
export async function presentRedeemSheet(): Promise<boolean> {
  if (!PURCHASES_ENABLED || !configured) return false;
  try {
    await Purchases.presentCodeRedemptionSheet();
    return true;
  } catch (error) {
    console.warn('[PURCHASES] presentCodeRedemptionSheet failed', error);
    return false;
  }
}

/**
 * Call `onEntitled` the next time the store reports this person entitled.
 *
 * For purchases that finish somewhere the app did not start them and cannot
 * await: the offer code sheet above, today. Returns the unsubscribe, which the
 * caller must run on unmount.
 */
export function onStoreEntitled(onEntitled: () => void): () => void {
  if (!PURCHASES_ENABLED || !configured) return () => {};
  const listener = (info: CustomerInfo) => {
    if (storeSaysEntitled(info)) onEntitled();
  };
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

/**
 * Ask RevenueCat afresh whether this person is entitled, skipping the SDK's
 * cache. Silent, like storeHasSubscription: no App Store prompt.
 *
 * For the moment Apple's code sheet closes. A redeemed code arrives as a
 * transaction the SDK posts on its own, and the update listener fires when
 * that finishes; asking directly means the paywall finds out as soon as
 * RevenueCat knows, rather than whenever the push reaches it.
 */
export async function fetchStoreEntitled(): Promise<boolean> {
  if (!PURCHASES_ENABLED || !configured) return false;
  try {
    await Purchases.invalidateCustomerInfoCache();
    return storeSaysEntitled(await Purchases.getCustomerInfo());
  } catch {
    return false;
  }
}

/**
 * Whether the STORE already believes this device is subscribed.
 *
 * Cheap and silent — `getCustomerInfo` reads the SDK's cache and never shows
 * an App Store prompt, so it is safe to call on every paywall open. It exists
 * to stop the app selling a plan to somebody who already has one.
 *
 * IT IS NOT COMPLETE, AND IT CANNOT BE.
 *
 * It answers for the store identity this install is currently using. After a
 * fresh install with no account there is a brand-new anonymous id, and the
 * subscription sitting on the Apple ID is invisible to it until a restore or a
 * sign-in attaches the two. Apple gives no silent way to ask "what does this
 * Apple ID own" — restore is user-initiated by design — which is exactly why
 * the paywall also has to ASK, in words, rather than only guess.
 */
export async function storeHasSubscription(): Promise<boolean> {
  if (!PURCHASES_ENABLED || !configured) return false;
  try {
    return storeSaysEntitled(await Purchases.getCustomerInfo());
  } catch {
    // Unknown is not "no subscription", but it is the only safe render: a
    // failed lookup must never hide the paywall from someone trying to buy.
    return false;
  }
}

/**
 * Whether the Apple ID on this phone already pays for Revely, whoever is
 * signed in.
 *
 * The question storeHasSubscription cannot answer. That one asks RevenueCat
 * about the account signed in now, so a subscription bought under a
 * different Revely login is invisible to it, and the paywall sold that
 * person a second plan: Apple queued it to start when the first one ended.
 * An offer code failed the same way, as "code limit reached".
 *
 * Read from StoreKit on the device (modules/store-status), never through a
 * RevenueCat sync, because a sync would transfer the subscription to the
 * account asking. False when this binary cannot tell, which is every build
 * before 1.0.4: then the paywall behaves as it always has.
 */
export async function appleIdHasRevely(): Promise<boolean> {
  if (!PURCHASES_ENABLED) return false;
  const held = await activeSubscriptions();
  if (!held) return false;
  const ours = new Set<string>([PRODUCTS.annual, PRODUCTS.monthly]);
  return held.some((sub) => ours.has(sub.productId));
}

/**
 * Whether this Apple ID can still get the free trial, as far as Apple will
 * say. True unless definitely not, for the reason withTrialEligibility keeps
 * the trial on an unknown answer.
 */
export async function trialAvailable(): Promise<boolean> {
  const plans = await getPlans();
  if (plans.length === 0) return true;
  return plans.some((plan) => plan.trialDays > 0);
}

/** Whether the store currently believes this person is entitled. */
export function storeSaysEntitled(info: CustomerInfo | null): boolean {
  if (!info) return false;
  return Boolean(info.entitlements.active[ENTITLEMENT_ID]);
}
