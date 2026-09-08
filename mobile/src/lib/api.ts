import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './config';
import { getDeviceId } from './device';

const TOKEN_KEY = 'revely.authToken';

let cachedToken: string | null = null;

/**
 * The stored bearer token.
 *
 * A keychain read can fail outright — an unsigned build has no keychain
 * entitlement, and a locked device can refuse. That must surface as "not
 * signed in", which the app already handles, rather than as an unhandled
 * rejection during startup that leaves a blank screen.
 */
export async function getToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  cachedToken = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
  return cachedToken;
}

/**
 * Store the bearer token.
 *
 * The in-memory copy is set FIRST and a keychain failure is swallowed, because
 * the alternative is worse than it looks: `setItemAsync` throwing meant a
 * successful sign-in — Apple accepted, the server issued a token — was reported
 * to the person as "Sign-in failed", with a raw Swift exception as the body.
 * The keychain can refuse for reasons that have nothing to do with them: a
 * build without the entitlement, a device locked while the app is backgrounded.
 *
 * Swallowing it costs the session on next launch and nothing before that, which
 * is a far better outcome than refusing a sign-in that actually worked. It also
 * keeps the app's rule that a person is never shown the machine's prose.
 */
export async function setToken(token: string): Promise<void> {
  cachedToken = token;
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch (error) {
    console.warn('[AUTH] Could not persist token to the keychain', error);
  }
}

export async function clearToken(): Promise<void> {
  cachedToken = null;
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // Same reasoning as the write. The in-memory token is already gone, which
    // is what signs this session out; a keychain that will not delete must not
    // turn signing out into an error.
  }
}

export class ApiError extends Error {
  /**
   * The server's machine-readable reason, when it sent one.
   *
   * `message` is an English sentence meant for logs. Anything shown to someone
   * must be written from this code in their own language — never by putting the
   * server's prose on screen.
   */
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Authenticated fetch against the Revely API. Attaches the bearer token. */
export async function apiFetch<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, headers, ...rest } = options;
  const token = auth ? await getToken() : null;
  // Sent on every request, signed in or not. The server prefers a real token
  // whenever one is present, so this is inert once someone has an account — it
  // is what makes the pre-sign-in scans possible, and what lets those scans
  // follow the person into the account they eventually create.
  const deviceId = await getDeviceId();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(deviceId ? { 'X-Revely-Device': deviceId } : {}),
      ...headers,
    },
  });

  if (response.status === 401) {
    // Token expired or revoked — force a fresh sign-in.
    //
    // Only when we actually sent one. A 401 on an anonymous request means "this
    // route needs an account", which is an ordinary answer during onboarding
    // and must not be reported as an expired session to someone who has never
    // had one.
    if (token) {
      await clearToken();
      throw new ApiError(401, 'Session expired. Please sign in again.', 'session_expired');
    }
    throw new ApiError(401, 'Sign-in required', 'sign_in_required');
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    let code: string | undefined;
    try {
      const body = await response.json();
      message = body.message || body.error || message;
      code = typeof body.code === 'string' ? body.code : undefined;
    } catch {
      // non-JSON error body; keep the generic message
    }
    throw new ApiError(response.status, message, code);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
