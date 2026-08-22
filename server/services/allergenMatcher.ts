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

// The union of what must be DECLARED across the markets this app is used in,
// not the US big-9 alone.
//
// The list was the US FASTER Act nine until 2026-08-22. That made six
// allergens unmatchable: a profile entry whose name has no keyword list here
// produces no flag and no error, which is a silent false negative — the exact
// failure class the substance corpus was built to avoid, reproduced in the one
// layer that is actually about the person. The additions are:
//
//   molluscs   EU, UK, Canada, Australia/NZ. `shellfish` below is CRUSTACEANS
//              only, so oyster, mussel, squid and snail matched nothing at all.
//   sulphites  EU, UK, Canada, Australia/NZ above 10 mg/kg. Bronchoconstriction
//              in a share of people with asthma.
//   mustard    EU, UK, Canada. Frequently hidden inside "spices".
//   celery     EU, UK. Hides in stock and "natural flavouring".
//   lupin      EU, UK, Australia/NZ. Common in gluten-free baking.
//   buckwheat  Japan, Korea. Not wheat, and severe.
//
// `shellfish` keeps its id rather than being renamed to `crustaceans`. The id
// is stored verbatim in every existing profile's jsonb, so renaming it would
// orphan real allergy entries to buy a better word. The UI label carries the
// clarification instead.
//
// NOTE: coconut is included under tree_nuts per FDA's historical stance.
export const MAJOR_ALLERGENS = [
  'milk', 'egg', 'fish', 'shellfish', 'molluscs', 'tree_nuts', 'peanut',
  'wheat', 'soy', 'sesame', 'sulphites', 'mustard', 'celery', 'lupin',
  'buckwheat',
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
  // Snail is here deliberately: snail secretion filtrate is a mainstream
  // cosmetic ingredient, and a mollusc allergy does not stop at the plate.
  molluscs: [
    'oyster', 'mussel', 'clam', 'scallop', 'squid', 'calamari', 'octopus',
    'cuttlefish', 'snail', 'escargot', 'abalone', 'whelk', 'cockle',
    'mollusc', 'mollusk', 'helix aspersa',
  ],
  // E-numbers appear in both joined and spaced forms because normalization
  // turns "E-220" into "e 220" but leaves "E220" alone, and labels print both.
  sulphites: [
    'sulfite', 'sulphite', 'sulfur dioxide', 'sulphur dioxide',
    'e220', 'e 220', 'e221', 'e 221', 'e222', 'e 222', 'e223', 'e 223',
    'e224', 'e 224', 'e226', 'e 226', 'e227', 'e 227', 'e228', 'e 228',
  ],
  mustard: ['mustard', 'sinapis', 'brassica juncea', 'brassica nigra'],
  celery: ['celery', 'celeriac', 'apium graveolens'],
  lupin: ['lupin', 'lupinus'],
  buckwheat: ['buckwheat', 'soba', 'fagopyrum'],
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
  // Buckwheat is not wheat, and is not even a grass. This exclusion existed
  // nowhere before buckwheat was matchable, so "buckwheat flour" — the whole
  // point of a soba noodle — raised a wheat allergy flag on every label that
  // carried it, via the bare substring in the `wheat` keyword list.
  wheat: [/\bbuckwheat\b/],
  // Oyster mushroom is a fungus. Sea scallop squash and scalloped names are
  // not molluscs either, but they do not appear on ingredient lists; this one
  // does, constantly, in stock and seasoning.
  molluscs: [/\boyster mushroom\b/],
  // Matching here is substring, not whole-word (see ingredientMatchesAllergen),
  // so a wine advertising "sulphite free" would otherwise be the strongest
  // sulphite hit on the shelf. The dietary layer gets this for free from
  // termMatch; the allergen layer has to say it out loud.
  sulphites: [
    /\b(sulfite|sulphite|sulfur dioxide|sulphur dioxide)s?\s+free\b/,
    /\b(no|zero|without|free of|free from)\s+(added\s+)?(sulfite|sulphite|sulfur dioxide|sulphur dioxide)/,
  ],
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
