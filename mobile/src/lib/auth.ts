import * as AppleAuthentication from 'expo-apple-authentication';
import { apiFetch, setToken, clearToken } from './api';
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from './config';
import { clearActiveProfileId } from './profiles';
import { clearLastScan } from './scan';

// GoogleSignin is a native module that does not exist in Expo Go — require it
// lazily so the app still runs there (Apple + dev sign-in) without a
// development build.
function getGoogleSignin() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GoogleSignin } = require('@react-native-google-signin/google-signin') as
    typeof import('@react-native-google-signin/google-signin');
  return GoogleSignin;
}

export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName?: string | null;
}

interface AuthResponse {
  token: string;
  expiresAt: number;
  user: AuthUser;
}

let googleConfigured = false;
function configureGoogle() {
  const GoogleSignin = getGoogleSignin();
  if (!googleConfigured) {
    GoogleSignin.configure({
      iosClientId: GOOGLE_IOS_CLIENT_ID,
      webClientId: GOOGLE_WEB_CLIENT_ID,
    });
    googleConfigured = true;
  }
  return GoogleSignin;
}

export async function isAppleAuthAvailable(): Promise<boolean> {
  return AppleAuthentication.isAvailableAsync();
}

export class SignInCancelledError extends Error {
  constructor() {
    super('Sign-in cancelled');
    this.name = 'SignInCancelledError';
  }
}

export async function signInWithApple(): Promise<AuthUser> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (error: any) {
    if (error?.code === 'ERR_REQUEST_CANCELED') throw new SignInCancelledError();
    throw error;
  }

  if (!credential.identityToken) {
    throw new Error('Apple did not return an identity token');
  }

  // Apple returns the user's name only on first authorization, and never
  // inside the identity token — forward it so the server can store it once.
  const data = await apiFetch<AuthResponse>('/api/auth/mobile', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({
      provider: 'apple',
      identityToken: credential.identityToken,
      firstName: credential.fullName?.givenName ?? undefined,
      lastName: credential.fullName?.familyName ?? undefined,
    }),
  });

  await setToken(data.token);
  return data.user;
}

export async function signInWithGoogle(): Promise<AuthUser> {
  const GoogleSignin = configureGoogle();
  await GoogleSignin.hasPlayServices();

  const result = await GoogleSignin.signIn();
  if (result.type === 'cancelled') throw new SignInCancelledError();

  const idToken = result.data?.idToken;
  if (!idToken) {
    throw new Error('Google did not return an ID token');
  }

  const data = await apiFetch<AuthResponse>('/api/auth/mobile', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ provider: 'google', identityToken: idToken }),
  });

  await setToken(data.token);
  return data.user;
}

/** Development-only. Requires ALLOW_DEV_LOGIN=true on the server. */
export async function signInAsDeveloper(): Promise<AuthUser> {
  const data = await apiFetch<AuthResponse>('/api/auth/dev-token', {
    method: 'POST',
    auth: false,
  });
  await setToken(data.token);
  return data.user;
}

export async function signOut(): Promise<void> {
  try {
    const GoogleSignin = configureGoogle();
    await GoogleSignin.signOut();
  } catch {
    // Not signed in with Google, or Google unavailable — the local token
    // clear below is what actually ends the session.
  }
  await clearToken();
  await clearActiveProfileId();
  clearLastScan();
}

/**
 * Permanently delete the account, then sign out locally.
 *
 * The server call comes first and is allowed to throw: clearing the token
 * before knowing the deletion succeeded would leave someone signed out,
 * believing they were deleted, with their data still on the server and no
 * token left to try again with.
 */
export async function deleteAccount(): Promise<void> {
  await apiFetch('/api/account', {
    method: 'DELETE',
    // The server refuses the call without this, as a guard against a stray
    // DELETE reaching an irreversible endpoint.
    body: JSON.stringify({ confirm: 'DELETE' }),
  });
  await signOut();
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  return apiFetch<AuthUser>('/api/auth/user');
}
