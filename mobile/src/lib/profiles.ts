import * as SecureStore from 'expo-secure-store';

import { apiFetch, getToken } from './api';
import type { Profile, UpsertProfileInput } from './types';

// ---------------------------------------------------------------------------
// Local-first profiles
//
// Onboarding runs before sign-in, so the profile a person builds has to exist
// somewhere before there is an account to attach it to. It lives here, in the
// keychain, until they sign in — at which point `syncLocalProfile` pushes it up
// and deletes the local copy.
//
// The keychain rather than AsyncStorage because of what this is: somebody's
// allergies, and often a child's. It is health data whether or not it has been
// uploaded yet, and it gets the same storage the auth token does.
//
// A local profile carries a `local:`-prefixed id so nothing can mistake it for
// a server id — most of all the scan request, which sends profileId to an API
// that would otherwise look it up, find nothing, and quietly return a GENERIC
// verdict to someone who believes they configured an allergy.
// ---------------------------------------------------------------------------

const LOCAL_PROFILE_KEY = 'revely.localProfile';
export const LOCAL_PROFILE_ID = 'local:profile';

/**
 * In-memory mirror of the local profile.
 *
 * The keychain can refuse. An unsigned build has no keychain entitlement, and a
 * device locked while the app is backgrounded can deny a read. Without this
 * mirror the app SOFT-LOCKS when that happens: onboarding saves the profile,
 * the write fails, the viewfinder reads the profile list back, gets nothing,
 * and redirects to welcome — which sends the person to onboarding again, for
 * ever, with no error and no way out.
 *
 * With it, a keychain failure costs the profile on next launch and nothing
 * before that. The person finishes onboarding, scans, and gets a personalised
 * verdict; only persistence is lost, which is the smallest honest failure
 * available here.
 */
let memoryProfile: Profile | null = null;

export function isLocalProfileId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith('local:');
}

/** The profile built during onboarding, if there is one and it has not synced. */
export async function getLocalProfile(): Promise<Profile | null> {
  try {
    const raw = await SecureStore.getItemAsync(LOCAL_PROFILE_KEY);
    if (raw) return JSON.parse(raw) as Profile;
  } catch {
    // Fall through to the mirror.
  }
  return memoryProfile;
}

export async function saveLocalProfile(input: UpsertProfileInput): Promise<Profile> {
  const now = new Date().toISOString();
  const profile = {
    id: LOCAL_PROFILE_ID,
    userId: 'local',
    name: input.name,
    isDefault: true,
    allergens: input.allergens ?? [],
    dietaryRules: input.dietaryRules ?? [],
    conditions: input.conditions ?? [],
    createdAt: now,
    updatedAt: now,
  } as unknown as Profile;
  // Set the mirror FIRST, so the profile is readable this session whatever the
  // keychain does next.
  memoryProfile = profile;
  try {
    await SecureStore.setItemAsync(LOCAL_PROFILE_KEY, JSON.stringify(profile));
  } catch (error) {
    // Same reasoning as setToken in ./api. Onboarding has just collected
    // somebody's allergies; failing the whole step because the keychain refused
    // a write throws that away and sends them back to the start. The profile is
    // returned either way, so the session continues and the first scan is still
    // about the right person — it simply will not survive a relaunch.
    console.warn('[PROFILE] Could not persist the local profile', error);
  }
  return profile;
}

export async function clearLocalProfile(): Promise<void> {
  memoryProfile = null;
  try {
    await SecureStore.deleteItemAsync(LOCAL_PROFILE_KEY);
  } catch {
    // A local profile that outlives its upload is harmless: `listProfiles`
    // prefers the server once a token exists, so the stale copy is never read.
  }
}

/**
 * Push the locally-built profile to the account that just signed in.
 *
 * Called once, immediately after sign-in. Returns the server profile so the
 * caller can make it active — the id changes at this moment, and a viewfinder
 * still holding `local:profile` would scan against nothing.
 *
 * The local copy is deleted only after the upload succeeds. A failed sync
 * leaves the person exactly where they were rather than losing the allergies
 * they just entered, and the next sign-in retries.
 */
export async function syncLocalProfile(): Promise<Profile | null> {
  const local = await getLocalProfile();
  if (!local) return null;

  const created = await createProfile({
    name: local.name,
    isDefault: true,
    allergens: local.allergens as UpsertProfileInput['allergens'],
    dietaryRules: local.dietaryRules as UpsertProfileInput['dietaryRules'],
    conditions: local.conditions as UpsertProfileInput['conditions'],
  });
  await clearLocalProfile();
  await setActiveProfileId(created.id);
  return created;
}

/**
 * Every profile the app should show.
 *
 * Signed in: the server's. Signed out: the one built during onboarding, if any.
 * Never both — a merged list would show the same person twice at exactly the
 * moment the profile chip has to name one of them.
 */
export async function listProfiles(): Promise<Profile[]> {
  if (!(await getToken())) {
    const local = await getLocalProfile();
    return local ? [local] : [];
  }
  return apiFetch<Profile[]>('/api/profiles');
}

/** Create a profile — on the server when signed in, on the device when not. */
export async function createProfile(input: UpsertProfileInput): Promise<Profile> {
  if (!(await getToken())) return saveLocalProfile(input);
  return apiFetch<Profile>('/api/profiles', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateProfile(
  id: string,
  input: Partial<UpsertProfileInput>,
): Promise<Profile> {
  // The profile built during onboarding has no server row to PATCH. Editing it
  // before signing in is an ordinary thing to do — the edit screen is one tap
  // from the viewfinder — and routing it at the API would 404 on somebody
  // correcting their child's allergy.
  if (isLocalProfileId(id)) {
    const current = await getLocalProfile();
    return saveLocalProfile({
      name: input.name ?? current?.name ?? '',
      allergens: (input.allergens ?? current?.allergens ?? []) as UpsertProfileInput['allergens'],
      dietaryRules: (input.dietaryRules ?? current?.dietaryRules ?? []) as UpsertProfileInput['dietaryRules'],
      conditions: (input.conditions ?? current?.conditions ?? []) as UpsertProfileInput['conditions'],
    });
  }
  return apiFetch<Profile>(`/api/profiles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteProfile(id: string): Promise<void> {
  if (isLocalProfileId(id)) {
    await clearLocalProfile();
    await clearActiveProfileId();
    return;
  }
  await apiFetch(`/api/profiles/${id}`, { method: 'DELETE' });
  // If the profile that just went away was the active one, the stored id now
  // points at nothing. Clearing it makes the next launch fall back to the
  // default profile rather than to no profile at all.
  if ((await getActiveProfileId()) === id) await clearActiveProfileId();
}

// The active profile drives every verdict, so it has to survive a cold start:
// coming back to the app scanning for the wrong person is the one navigation
// mistake this product cannot afford.
const ACTIVE_PROFILE_KEY = 'revely.activeProfile';

export function getActiveProfileId(): Promise<string | null> {
  return SecureStore.getItemAsync(ACTIVE_PROFILE_KEY).catch(() => null);
}

export async function setActiveProfileId(id: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(ACTIVE_PROFILE_KEY, id);
  } catch {
    // A failed write only costs the choice on next launch; never block the
    // switch the user just made on it.
  }
}

export async function clearActiveProfileId(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(ACTIVE_PROFILE_KEY);
  } catch {
    // Same reasoning as the write: a stale key is corrected on next launch by
    // the switcher, which only trusts an id still present in the list.
  }
}
