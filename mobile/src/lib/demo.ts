import { apiFetch } from './api';
import { getActiveProfileId, listProfiles } from './profiles';
import type { AnalysisResult } from './types';

// The example scan at the end of onboarding.
//
// The label is a fixture the server holds; the verdict over it is real matcher
// output against the profile just built. See server/demoScan.ts for why the
// split is that way round — the short version is that a staged verdict would
// be the app's first statement to someone about their own allergies, and it
// has to be true.

export interface DemoScan {
  result: AnalysisResult;
  /** Who it was checked for, for the card's chip. Absent if they skipped every field. */
  profileName?: string;
  profileAllergens?: string[];
}

export async function fetchDemoScan(language: string): Promise<DemoScan> {
  // Works signed in or not: listProfiles returns the server's rows when there
  // is a token and the on-device profile when there is not, which are the only
  // two states anyone can reach this screen in.
  const [profiles, activeId] = await Promise.all([listProfiles(), getActiveProfileId()]);
  const profile = profiles.find((p) => p.id === activeId) ?? profiles[0];

  const result = await apiFetch<AnalysisResult>('/api/demo-scan', {
    method: 'POST',
    body: JSON.stringify({
      language,
      profile: profile
        ? {
            name: profile.name,
            allergens: profile.allergens,
            dietaryRules: profile.dietaryRules,
            conditions: profile.conditions,
          }
        : undefined,
    }),
  });

  return {
    result,
    profileName: profile?.name,
    profileAllergens: (profile?.allergens ?? []).map((entry: any) =>
      typeof entry === 'string' ? entry : entry.allergen,
    ),
  };
}
