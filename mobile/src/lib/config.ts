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
