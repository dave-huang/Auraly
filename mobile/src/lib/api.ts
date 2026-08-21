import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './config';

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

export async function setToken(token: string): Promise<void> {
  cachedToken = token;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  cachedToken = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
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

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (response.status === 401) {
    // Token expired or revoked — force a fresh sign-in.
    await clearToken();
    throw new ApiError(401, 'Session expired. Please sign in again.');
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
