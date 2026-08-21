// Scoring for label-extraction evals: normalized ingredient matching.
// Allergen detection comes from the PRODUCTION matcher
// (server/services/allergenMatcher.ts) so eval numbers measure the logic
// that actually ships.

import {
  detectAllergens as detectAllergensProd,
  allergensFromDeclaration,
  MAJOR_ALLERGENS,
  type MajorAllergen,
} from '../server/services/allergenMatcher';

export { MAJOR_ALLERGENS };
export type { MajorAllergen };

// Small alias table mapping label synonyms to one canonical form.
// Extend as real-world variants show up in eval failures.
const ALIASES: Record<string, string> = {
  'aqua': 'water',
  'eau': 'water',
  'tocopherol': 'vitamin e',
  'parfum': 'fragrance',
  'perfume': 'fragrance',
  'sodium chloride': 'salt',
  'sucrose': 'sugar',
  'dextrose': 'glucose',
  'anhydrous glucose': 'glucose',
  'msg': 'monosodium glutamate',
  'vitamin b3': 'niacin',
  'vitamin b2': 'riboflavin',
  'vitamin b1': 'thiamine mononitrate',
  'thiamin mononitrate': 'thiamine mononitrate',
  'ascorbic acid': 'vitamin c',
  'bicarbonate of soda': 'baking soda',
  'sodium bicarbonate': 'baking soda',
  // Naming variants seen on non-English labels
  'glycerol': 'glycerin',
  'malt': 'maltose',
  'satay sauce': 'sacha sauce',
  'angelica dahurica': 'angelica root',
  'green onion': 'scallion',
  'spring onion': 'scallion',
  'flavoring': 'spices',
  'flavouring': 'spices',
  'cocoa liquor': 'cocoa mass',
  'cacao mass': 'cocoa mass',
};

// Substring rewrites applied before alias lookup — for chemical names that
// appear both abbreviated and spelled out inside longer ingredient names.
const REWRITES: Array<[RegExp, string]> = [
  [/butylated hydroxytoluene/g, 'bht'],
  [/butylated hydroxyanisole/g, 'bha'],
  [/polyethylene glycol/g, 'peg'],
  // "soybean flakes" vs "soy flakes", "soya oil" vs "soybean oil" — the same
  // ingredient rendered differently, especially in translated labels.
  [/\bsoya\b/g, 'soy'],
  [/\bsoybeans?\b/g, 'soy'],
  [/\bdried\b/g, ''],
];

export function normalizeIngredientName(name: string): string {
  let n = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')     // strip diacritics
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '') // drop parenthetical/bracket notes
    .replace(/[*†‡.]/g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const [pattern, replacement] of REWRITES) {
    n = n.replace(pattern, replacement);
  }
  if (ALIASES[n]) n = ALIASES[n];
  return n.trim();
}

/** Naive singular form for plural-insensitive comparison ("peanuts" ~ "peanut") */
function singular(n: string): string {
  if (n.length > 3 && n.endsWith('es') && !n.endsWith('ses')) return n.slice(0, -2);
  if (n.length > 3 && n.endsWith('s') && !n.endsWith('ss')) return n.slice(0, -1);
  return n;
}

/** Same ingredient by name, ignoring case, plurals and parentheticals. */
export function exactIngredientMatch(a: string, b: string): boolean {
  const na = normalizeIngredientName(a);
  const nb = normalizeIngredientName(b);
  if (!na || !nb) return false;
  return na === nb || singular(na) === singular(nb);
}

export function ingredientsMatch(a: string, b: string): boolean {
  if (exactIngredientMatch(a, b)) return true;
  const na = normalizeIngredientName(a);
  const nb = normalizeIngredientName(b);
  if (!na || !nb) return false;
  // Containment for qualified forms ("tea tree leaf water" vs "melaleuca alternifolia tea tree leaf water")
  if (na.length >= 5 && nb.length >= 5 && (na.includes(nb) || nb.includes(na))) return true;
  return false;
}

export function detectAllergens(ingredients: string[]): Set<MajorAllergen> {
  return detectAllergensProd(ingredients);
}

export interface CaseScore {
  truthCount: number;
  extractedCount: number;
  matched: number;
  missedIngredients: string[];
  extraIngredients: string[];
  recall: number;
  precision: number;
  truthAllergens: MajorAllergen[];
  detectedAllergens: MajorAllergen[];
  missedAllergens: MajorAllergen[];
}

export function scoreCase(
  truthIngredients: string[],
  truthAllergens: MajorAllergen[],
  extracted: string[],
  declaredContains: string[] = [],
): CaseScore {
  // Matching is ONE-TO-ONE: each extracted ingredient can satisfy at most one
  // truth entry.
  //
  // It used to ask, independently per truth entry, "did anything match this?"
  // Combined with the containment rule that let one extracted string credit
  // many truth entries at once, and dense labels are full of families that
  // share a stem. On the Vermont Curry case, an "extraction" of eight generic
  // words — Vegetable Oil, Cheese, Garlic, Onion Powder, Tomato Extract, Sugar,
  // Salt, Milk Powder — scored 19 of 63 ingredients found. The single word
  // "Garlic" was credited for Garlic, Garlic Extract, Garlic Powder, Dried
  // Garlic, Roasted Garlic Powder and Garlic Flake. Recall measured 30% for
  // reading almost nothing, so the release gate was far weaker than its number
  // suggested — exactly the wrong direction for a safety check.
  //
  // Exact matches are assigned first so a loose containment hit cannot consume
  // the extracted ingredient that some other truth entry matches exactly.
  const usedExtracted = new Set<number>();
  const matchedTruth = new Set<number>();
  for (const predicate of [exactIngredientMatch, ingredientsMatch]) {
    truthIngredients.forEach((truth, ti) => {
      if (matchedTruth.has(ti)) return;
      const ei = extracted.findIndex(
        (e, i) => !usedExtracted.has(i) && predicate(truth, e),
      );
      if (ei >= 0) {
        usedExtracted.add(ei);
        matchedTruth.add(ti);
      }
    });
  }

  const matched = matchedTruth.size;
  const missedIngredients = truthIngredients.filter((_, ti) => !matchedTruth.has(ti));
  const extraIngredients = extracted.filter((_, i) => !usedExtracted.has(i));

  // An allergen counts as detected if it is inferable from ingredient names
  // OR stated in the label's own "contains" declaration.
  const detected = detectAllergens(extracted);
  for (const a of Array.from(allergensFromDeclaration(declaredContains))) detected.add(a);
  const missedAllergens = truthAllergens.filter(a => !detected.has(a));

  return {
    truthCount: truthIngredients.length,
    extractedCount: extracted.length,
    matched,
    missedIngredients,
    extraIngredients,
    recall: truthIngredients.length ? matched / truthIngredients.length : 1,
    precision: extracted.length ? (extracted.length - extraIngredients.length) / extracted.length : 0,
    truthAllergens,
    detectedAllergens: Array.from(detected),
    missedAllergens,
  };
}
