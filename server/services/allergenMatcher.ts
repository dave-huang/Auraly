// Single source of truth for deterministic allergen keyword matching.
// Used by the personal-risk engine (production) and the eval harness, so the
// numbers the eval reports are measured against the exact logic that ships.
//
// Matching is intentionally rule-based, not LLM-based: allergen flagging must
// be reproducible, testable, and immune to hallucination.

// Memoized because the same ingredient name is normalized dozens of times in a
// row. Personal-risk matching compares one ingredient against every term it
// knows — the vegan rule alone carries 41 — and each comparison normalized the
// name again from scratch. That made applying a profile cost ~930µs per
// ingredient against ~27µs to classify one, and a 91-scan history took over two
// seconds to derive. Names also repeat heavily across scans (water, sugar,
// salt), so the cache stays warm between requests.
//
// Bounded: ingredient names come from scanned labels, so an unbounded map here
// is user-controlled memory growth. Cleared wholesale rather than evicted by
// age; this is a speed cache, not state, and rebuilding an entry is microseconds.
const NORMALIZE_CACHE_LIMIT = 10_000;
const normalizeCache = new Map<string, string>();

export function normalizeIngredientName(name: string): string {
  const hit = normalizeCache.get(name);
  if (hit !== undefined) return hit;

  const normalized = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')     // strip diacritics
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '') // drop parenthetical/bracket notes
    .replace(/[*†‡.]/g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalizeCache.size >= NORMALIZE_CACHE_LIMIT) normalizeCache.clear();
  normalizeCache.set(name, normalized);
  return normalized;
}

// US FASTER Act big-9 major allergens.
// NOTE: coconut is included under tree_nuts per FDA's historical stance.
export const MAJOR_ALLERGENS = [
  'milk', 'egg', 'fish', 'shellfish', 'tree_nuts', 'peanut', 'wheat', 'soy', 'sesame',
] as const;
export type MajorAllergen = typeof MAJOR_ALLERGENS[number];

export const ALLERGEN_KEYWORDS: Record<MajorAllergen, string[]> = {
  milk: ['milk', 'whey', 'casein', 'lactose', 'butter', 'cream', 'cheese', 'yogurt', 'ghee', 'dairy', 'curd'],
  egg: ['egg', 'albumin', 'albumen', 'ovalbumin', 'mayonnaise', 'meringue'],
  fish: ['fish', 'anchovy', 'cod', 'salmon', 'tuna', 'tilapia', 'flounder', 'haddock', 'pollock', 'sardine', 'herring', 'mackerel', 'trout', 'halibut'],
  shellfish: ['shrimp', 'crab', 'lobster', 'prawn', 'crawfish', 'crayfish', 'krill'],
  tree_nuts: ['almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut', 'filbert', 'macadamia', 'brazil nut', 'pine nut', 'chestnut', 'coconut'],
  peanut: ['peanut', 'arachis', 'groundnut'],
  wheat: ['wheat', 'semolina', 'spelt', 'farina', 'durum', 'seitan'],
  soy: ['soy', 'soya', 'soybean', 'edamame', 'tofu', 'miso', 'tempeh'],
  sesame: ['sesame', 'tahini', 'benne', 'gingelly'],
};

// Keyword hits that do NOT indicate the allergen: plant "butters"/"milks"
// and other lookalikes. Checked before counting a keyword match.
export const ALLERGEN_EXCLUSIONS: Partial<Record<MajorAllergen, RegExp[]>> = {
  milk: [
    /\b(peanut|almond|cashew|cocoa|shea|apple|pumpkin|sunflower|seed|nut|body) butter\b/,
    /\bcream of tartar\b/,
    /\bcoconut (milk|cream)\b/, // coconut milk/cream is not dairy
    /\b(soy|oat|almond|rice) milk\b/,   // plant milks are not dairy
  ],
  fish: [/\bswedish fish\b/],
};

function isMajorAllergen(name: string): name is MajorAllergen {
  return (MAJOR_ALLERGENS as readonly string[]).includes(name);
}

/**
 * Is a hit on `keyword` within `normalizedName` a known lookalike false
 * positive (e.g. "butter" inside "peanut butter")? Lets other keyword-based
 * matchers (dietary rules) reuse the same exclusion knowledge.
 */
export function keywordHitExcluded(normalizedName: string, keyword: string): boolean {
  for (const allergen of MAJOR_ALLERGENS) {
    if (!ALLERGEN_KEYWORDS[allergen].includes(keyword)) continue;
    if ((ALLERGEN_EXCLUSIONS[allergen] ?? []).some(rx => rx.test(normalizedName))) return true;
  }
  return false;
}

/**
 * Does this ingredient indicate the given allergen?
 * `allergen` may be a big-9 name (uses the curated keyword list) or any
 * custom term (matched directly). `extraKeywords` extends either.
 */
export function ingredientMatchesAllergen(
  ingredientName: string,
  allergen: string,
  extraKeywords: string[] = []
): boolean {
  const n = normalizeIngredientName(ingredientName);
  if (!n) return false;

  const canonical = normalizeIngredientName(allergen).replace(/ /g, '_');
  const keywords: string[] = isMajorAllergen(canonical)
    ? [...ALLERGEN_KEYWORDS[canonical], ...extraKeywords]
    : [normalizeIngredientName(allergen), ...extraKeywords.map(normalizeIngredientName)];

  const exclusions = isMajorAllergen(canonical) ? (ALLERGEN_EXCLUSIONS[canonical] ?? []) : [];
  if (exclusions.some(rx => rx.test(n))) return false;

  return keywords.filter(Boolean).some(kw => n.includes(kw));
}

/**
 * The keyword that WOULD have matched, had an exclusion rule not vetoed it.
 *
 * This is the matcher reporting its own near misses. "Peanut Butter" really
 * does trip the milk keyword "butter" before the plant-butter exclusion
 * overrules it, and saying so is what makes a clean verdict credible instead
 * of merely lucky — it shows the check ran and went to the edge.
 *
 * Returns null when the ingredient never came close, or when it actually
 * matched (a real match is a flag, not a near miss).
 */
export function nearMissForAllergen(
  ingredientName: string,
  allergen: string,
  extraKeywords: string[] = []
): string | null {
  const n = normalizeIngredientName(ingredientName);
  if (!n) return null;

  const canonical = normalizeIngredientName(allergen).replace(/ /g, '_');
  if (!isMajorAllergen(canonical)) return null;

  const exclusions = ALLERGEN_EXCLUSIONS[canonical] ?? [];
  if (!exclusions.some(rx => rx.test(n))) return null;

  const keywords = [...ALLERGEN_KEYWORDS[canonical], ...extraKeywords.map(normalizeIngredientName)];
  return keywords.filter(Boolean).find(kw => n.includes(kw)) ?? null;
}

export function detectAllergens(ingredients: string[]): Set<MajorAllergen> {
  const found = new Set<MajorAllergen>();
  for (const ing of ingredients) {
    for (const allergen of MAJOR_ALLERGENS) {
      if (ingredientMatchesAllergen(ing, allergen)) {
        found.add(allergen);
      }
    }
  }
  return found;
}

/**
 * Map a label's own "contains" declaration to canonical allergens.
 *
 * Necessary because ingredient names alone under-report: a label may list
 * "Lecithin" or "Natural Flavoring" while separately declaring "contains
 * soy". Exclusion rules are deliberately NOT applied here — when a label
 * states an allergen is present, we believe it.
 */
export function allergensFromDeclaration(declared: string[]): Set<MajorAllergen> {
  const found = new Set<MajorAllergen>();
  for (const term of declared) {
    const n = normalizeIngredientName(term);
    if (!n) continue;
    for (const allergen of MAJOR_ALLERGENS) {
      const canonical = allergen.replace(/_/g, ' ');
      if (n.includes(canonical) || ALLERGEN_KEYWORDS[allergen].some(kw => n.includes(kw))) {
        found.add(allergen);
      }
    }
  }
  return found;
}
