import Constants from 'expo-constants';
import { Platform } from 'react-native';

// API base URL resolution.
//
// In development the app runs on a device/simulator, so "localhost" refers to
// the device itself — we derive the dev machine's LAN IP from the Expo host
// that served the bundle. Override with EXPO_PUBLIC_API_URL when pointing at
// a deployed backend.
function resolveApiBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  if (__DEV__) {
    // e.g. "192.168.1.20:8081" from the Metro host
    const hostUri =
      Constants.expoConfig?.hostUri ??
      (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost;
    const host = hostUri?.split(':')[0];
    if (host) return `http://${host}:3000`;
    // iOS simulator can reach the host machine directly
    if (Platform.OS === 'ios') return 'http://localhost:3000';
    // Android emulator loopback alias
    return 'http://10.0.2.2:3000';
  }

  throw new Error('EXPO_PUBLIC_API_URL must be set for production builds');
}

export const API_BASE_URL = resolveApiBaseUrl();

/**
 * The legal pages, served by the API host — see server/legal.ts.
 *
 * Guideline 3.1.2 requires both to be reachable from the purchase screen, and
 * App Store Connect re-fetches the privacy URL at every submission. Derived
 * from API_BASE_URL rather than written out, so a build pointed at staging
 * shows staging's documents instead of silently linking production.
 */
export const PRIVACY_URL = `${API_BASE_URL}/privacy`;
export const TERMS_URL = `${API_BASE_URL}/terms`;

/**
 * The Washington My Health My Data Act policy.
 *
 * A separate document with its own link, because RCW 19.373.020 requires it to
 * be exactly that — linked distinctly rather than folded into the general
 * privacy policy. Keep it a peer of the other two wherever it appears.
 */
export const HEALTH_DATA_URL = `${API_BASE_URL}/health-data-privacy`;

export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

/**
 * Whether Google sign-in can actually complete.
 *
 * Without an iOS client ID, GoogleSignin.configure() still succeeds and the
 * button still renders — the failure only arrives after the user taps it and
 * the native sheet errors out. Offering a button that cannot work is worse
 * than not offering it, so the sign-in screen hides it unless it is
 * configured. Set EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID (build-time, via eas.json)
 * to bring it back, and set the matching GOOGLE_IOS_CLIENT_ID on the server
 * so the token it returns can be verified.
 */
export const GOOGLE_SIGN_IN_ENABLED = !!GOOGLE_IOS_CLIENT_ID;

/** Dev-only sign-in shortcut; requires ALLOW_DEV_LOGIN=true on the server. */
export const ALLOW_DEV_LOGIN = __DEV__;

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

/** RevenueCat public SDK key for iOS. Build-time, via eas.json. */
export const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;

/**
 * Whether purchasing can actually complete.
 *
 * Same reasoning as GOOGLE_SIGN_IN_ENABLED above, and the same failure it
 * avoids: without a key, `Purchases.configure` succeeds and the paywall still
 * renders, and the error only arrives after someone has tapped "Start free
 * trial" and decided to trust us with a card. A paywall that cannot take money
 * must say so before the tap, not after.
 */
export const PURCHASES_ENABLED = !!REVENUECAT_IOS_KEY;

/**
 * The entitlement RevenueCat grants on either plan.
 *
 * Imported rather than declared: the server checks for the same name, and a
 * copy in each package is a copy that can drift.
 */
export { ENTITLEMENT_ID } from '@shared/products';

/**
 * Product identifiers, as configured in App Store Connect.
 *
 * Imported rather than written here: the server maps the same strings the other
 * way, and an id that matches in one place but not the other produces a paywall
 * with no plans on it and no error anywhere.
 */
export { PRODUCT_IDS as PRODUCTS } from '@shared/products';

/**
 * Apple's subscription management page, on the web.
 *
 * THE FALLBACK, NOT THE ROUTE. Both screens call
 * `openManageSubscriptions()` in lib/purchases, which presents Apple's own
 * sheet over the app; this URL is where that lands when there is no
 * RevenueCat key to present it with, or when the subscription did not come
 * from the App Store. Sending somebody out to Safari is the worse answer, and
 * the page is blind to sandbox purchases besides.
 *
 * Still exported from one place rather than written at each use, so the two
 * screens cannot fall back to different URLs.
 */
export const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';
