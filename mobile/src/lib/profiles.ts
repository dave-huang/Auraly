import * as SecureStore from 'expo-secure-store';

import { apiFetch } from './api';
import type { Profile, UpsertProfileInput } from './types';

export function listProfiles(): Promise<Profile[]> {
  return apiFetch<Profile[]>('/api/profiles');
}

export function createProfile(input: UpsertProfileInput): Promise<Profile> {
  return apiFetch<Profile>('/api/profiles', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateProfile(
  id: string,
  input: Partial<UpsertProfileInput>,
): Promise<Profile> {
  return apiFetch<Profile>(`/api/profiles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteProfile(id: string): Promise<void> {
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
