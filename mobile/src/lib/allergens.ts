import { apiFetch } from './api';

/**
 * The names an allergen hides under on a label.
 *
 * Fetched rather than bundled: the keyword list IS the matcher, and a copy in
 * the app would eventually explain a flag with words the server no longer
 * matches on — a drill-down that contradicts the verdict above it.
 */
export async function fetchAllergenAliases(allergen: string): Promise<string[]> {
  const { aliases } = await apiFetch<{ allergen: string; aliases: string[] }>(
    `/api/allergens/${encodeURIComponent(allergen.toLowerCase())}/aliases`,
  );
  return aliases;
}
