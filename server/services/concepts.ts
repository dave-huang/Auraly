import {
  ALLERGEN_EXCLUSIONS,
  ALLERGEN_KEYWORDS,
  MAJOR_ALLERGENS,
  keywordHitExcluded,
  normalizeIngredientName,
} from './allergenMatcher';
import { getSubstanceRegistry } from './substances/identity';
import { matchesTerm } from './termMatch';

/**
 * Concepts — one definition per thing a person can care about.
 *
 * The personal layer grew as a set of parallel keyword tables: nine allergen
 * lists here, five dietary lists there, a third set of terms inside the
 * condition advisories. Gluten was spelled out in three of them, and they had
 * already drifted — the dietary rule knew about triticale and graham, the
 * allergen list did not, and nothing in the test suite could notice.
 *
 * A concept is that definition, held once. Every axis references concepts
 * rather than restating them, so a fix lands in one place and reaches every
 * caller.
 *
 * This module deliberately does NOT own new vocabulary. Its term lists are the
 * existing ones, read from their existing homes, so this change moves no
 * behaviour on its own — a rewrite that both restructures and re-decides is a
 * rewrite nobody can review.
 *
 * ---------------------------------------------------------------------------
 * Two ways to recognise an ingredient, and why both are needed
 * ---------------------------------------------------------------------------
 *
 * IDENTITY. Resolve the printed name to a substance through the alias graph in
 * substances/identity.ts, then ask whether that substance is one this concept
 * covers. Exact, and indifferent to language: a CAS number reads the same in
 * Chinese. This is the pass that lets a profile entry written once match a name
 * the user has never seen.
 *
 * TERMS. The existing keyword match. Necessary because most of what is printed
 * on a food label is not a registry substance at all — "milk", "peanut" and
 * "oyster" are foods, not chemicals, and no identity graph will ever hold them.
 *
 * Both run. Results union, and each match says which pass produced it, because
 * "resolved to sodium metabisulfite" and "contains the letters s-u-l-f-i-t-e"
 * are not equally strong and the card should not present them as though they
 * were.
 *
 * ---------------------------------------------------------------------------
 * What the identity pass can actually do today
 * ---------------------------------------------------------------------------
 *
 * Measured against the shipped corpus on 2026-08-22, and the answer is a good
 * deal narrower than the architecture suggests. Of 3,903 substances: 3,246
 * carry a CAS, 606 an INCI name, and THREE an E-number. The aliases come from
 * CosIng, Prop65 and IARC — regulatory hazard lists, weighted heavily toward
 * cosmetics.
 *
 * So identity fires well on a skincare label and barely at all on a food one.
 * `methylisothiazolinone` and `CI 16035` resolve; `Red 40`, `Allura Red AC`,
 * `E129`, `tartrazine`, `E102`, `carmine` and `E120` all resolve to null.
 *
 * That is a DATA gap, not a wiring gap, and it is worth being precise about it:
 * seeding food-additive aliases (E-number to common name to CAS) is what turns
 * this pass on for the food half of the product. Until then the term lists are
 * carrying food, exactly as before, and this module's job there is to stop the
 * definitions from drifting rather than to widen them.
 */

/** Bumped when a concept's membership changes. See the note on caching below. */
export const CONCEPTS_VERSION = '2026-09-24.1';

/**
 * NOT part of the analysis cache key, deliberately.
 *
 * `applyProfileToAnalysis` runs AFTER cache retrieval so one cached analysis
 * serves every family member. Concepts only ever affect that post-cache layer,
 * so a concept edit reaches every scan on the next request without retiring
 * anything. Adding this to the key would throw away the entire analysis cache
 * — thousands of paid model calls — to invalidate results it cannot change.
 */

export type ConceptKind = 'allergen' | 'diet';

/** Markets whose declaration rules justify a concept's existence. */
export type Regime = 'US' | 'EU' | 'UK' | 'CA' | 'AU' | 'JP';

/**
 * How a concept's terms are compared against an ingredient name.
 *
 * The two halves of the personal layer genuinely differ here, and the
 * difference is load-bearing rather than accidental:
 *
 *   substring — allergens. Catches "milkfat", "soybean oil" and "wheat starch"
 *     without anyone listing them. Over-matches, and is corrected by explicit
 *     exclusions. Chosen because a missed allergen is the worst outcome we
 *     ship and a spurious one is merely annoying.
 *
 *   word — diets and conditions. `\bsugar\b` does not fire inside "sugar free",
 *     and the dietary vocabulary is exactly the vocabulary packaging prints in
 *     the negative.
 *
 * Making it a field rather than leaving it implicit in which function you
 * happened to call is most of the point of this module.
 */
export type Matching = 'substring' | 'word';

export interface Concept {
  id: string;
  kind: ConceptKind;
  matching: Matching;
  /** Present beyond doubt when one of these hits. */
  definite: string[];
  /** Sourcing-dependent: might be this concept, cannot be settled from a label. */
  verify: string[];
  /** Lookalikes that veto a term hit, e.g. "peanut butter" is not dairy. */
  exclude: RegExp[];
  /**
   * Also veto a hit when the matched keyword is an allergen keyword whose own
   * exclusions fire. The dietary lists borrow terms like "butter", "milk" and
   * "cream" wholesale, so "peanut butter" must be no more dairy here than it is
   * on the allergen axis. Preserved from the `matchesAny` helper this module
   * replaces — dropping it would have re-broken a fixed bug.
   */
  borrowAllergenExclusions: boolean;
  /**
   * Strings the substance registry can resolve, naming substances this concept
   * covers. An empty list turns the identity pass off for this concept, which
   * is the right default: a concept about a food has no chemical identity.
   */
  identifiers: string[];
  /** Why the concept exists. Empty for concepts that are preference, not law. */
  declarableIn: Regime[];
  /**
   * Can an ingredient list answer this concept's question at all?
   *
   *   ingredients   — yes, subject to the usual sourcing hedges. Vegan,
   *                   vegetarian and gluten-free are decided by what is in the
   *                   product, and a clean list is a real answer.
   *
   *   certification — no. Halal and kosher turn on slaughter method and
   *                   rabbinical or halal supervision, neither of which is a
   *                   property of the composition. A product with no pork and
   *                   no alcohol is NOT thereby halal, and telling someone it
   *                   is Cleared is a false statement about their own faith
   *                   practice, not a rounding error.
   *
   * Absent on allergens, where the question is always about composition.
   */
  determinability?: 'ingredients' | 'certification';
}

export interface ConceptMatch {
  conceptId: string;
  certainty: 'definite' | 'verify';
  /** Which pass found it. Callers should present these differently. */
  via: 'identity' | 'term';
  /** The alias, identifier or keyword that actually matched. */
  evidence: string;
}

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

/**
 * Where each allergen must be declared. Sourced from the labelling instruments
 * named in MAJOR_ALLERGENS' own comment; this is the justification for the
 * concept existing, not evidence about a substance.
 */
const ALLERGEN_REGIMES: Record<string, Regime[]> = {
  milk: ['US', 'EU', 'UK', 'CA', 'AU', 'JP'],
  egg: ['US', 'EU', 'UK', 'CA', 'AU', 'JP'],
  fish: ['US', 'EU', 'UK', 'CA', 'AU'],
  shellfish: ['US', 'EU', 'UK', 'CA', 'AU', 'JP'],
  molluscs: ['EU', 'UK', 'CA', 'AU'],
  tree_nuts: ['US', 'EU', 'UK', 'CA', 'AU', 'JP'],
  peanut: ['US', 'EU', 'UK', 'CA', 'AU', 'JP'],
  wheat: ['US', 'EU', 'UK', 'CA', 'AU', 'JP'],
  soy: ['US', 'EU', 'UK', 'CA', 'AU'],
  sesame: ['US', 'EU', 'UK', 'CA', 'AU'],
  sulphites: ['EU', 'UK', 'CA', 'AU'],
  mustard: ['EU', 'UK', 'CA'],
  celery: ['EU', 'UK'],
  lupin: ['EU', 'UK', 'AU'],
  buckwheat: ['JP'],
};

/**
 * Registry names that denote a concept's substances.
 *
 * Sulphites and egg earn entries, each for a name the corpus actually holds —
 * see the coverage note at the top of this file. Egg's is lysozyme, the one egg
 * protein that is also a food additive, so its Chinese and Spanish label names
 * resolve without a keyword for each. Every other allergen is a food, and no
 * amount of curation will give "peanut" a CAS number. Entries here are
 * asserted reachable by eval/risk.check.ts, so a corpus change that drops one
 * fails the build rather than silently turning the pass off.
 */
const CONCEPT_IDENTIFIERS: Record<string, string[]> = {
  sulphites: ['sodium metabisulfite'],
  egg: ['lysozyme'],
};

/** Exposed so eval/risk.check.ts can assert every identifier still resolves. */
export const CONCEPT_IDENTIFIERS_FOR_CHECK = CONCEPT_IDENTIFIERS;

/**
 * Dietary vocabulary, moved verbatim from personalRisk.ts.
 *
 * Deliberately conservative: only unambiguous animal-derived/gluten terms are
 * `definite`; ambiguous ones ("natural flavor", plain "enzymes", "mono- and
 * diglycerides") are `verify`, because sourcing varies and a label cannot
 * settle it.
 */
const CERTIFICATION_RULES = new Set(['halal', 'kosher']);

const DIETARY_TERMS: Record<string, { definite: string[]; verify: string[] }> = {
  vegan: {
    definite: ['gelatin', 'carmine', 'cochineal', 'lard', 'tallow', 'honey', 'beeswax', 'lanolin', 'collagen', 'keratin', 'shellac', 'casein', 'whey', 'albumin', 'milk', 'egg', 'butter', 'cheese', 'cream', 'yogurt', 'fish', 'anchovy', 'meat', 'chicken', 'beef', 'pork', 'bone char', 'isinglass', 'squalene', 'ambergris', 'castoreum', 'silk'],
    verify: ['natural flavor', 'mono and diglycerides', 'enzymes', 'glycerin', 'stearic acid', 'lecithin', 'vitamin d3', 'lactic acid', 'sugar'],
  },
  vegetarian: {
    definite: ['gelatin', 'carmine', 'cochineal', 'lard', 'tallow', 'meat', 'chicken', 'beef', 'pork', 'fish', 'anchovy', 'isinglass', 'rennet', 'bone char'],
    verify: ['natural flavor', 'enzymes', 'mono and diglycerides'],
  },
  gluten_free: {
    definite: ['wheat', 'barley', 'rye', 'malt', 'spelt', 'farro', 'semolina', 'durum', 'triticale', 'seitan', "brewer's yeast", 'farina', 'graham'],
    verify: ['oat', 'starch', 'dextrin', 'maltodextrin', 'soy sauce'],
  },
  halal: {
    definite: ['pork', 'lard', 'bacon', 'ham', 'alcohol', 'wine', 'rum', 'beer', 'ethanol'],
    verify: ['gelatin', 'carmine', 'enzymes', 'rennet', 'vanilla extract', 'glycerin', 'mono and diglycerides'],
  },
  kosher: {
    definite: ['pork', 'lard', 'bacon', 'ham', 'shrimp', 'crab', 'lobster', 'prawn', 'shellfish', 'clam', 'oyster', 'squid', 'octopus'],
    verify: ['gelatin', 'carmine', 'enzymes', 'rennet', 'natural flavor'],
  },
};

function buildRegistry(): Map<string, Concept> {
  const concepts = new Map<string, Concept>();

  for (const allergen of MAJOR_ALLERGENS) {
    concepts.set(allergen, {
      id: allergen,
      kind: 'allergen',
      matching: 'substring',
      definite: ALLERGEN_KEYWORDS[allergen],
      verify: [],
      exclude: ALLERGEN_EXCLUSIONS[allergen] ?? [],
      borrowAllergenExclusions: false,
      identifiers: CONCEPT_IDENTIFIERS[allergen] ?? [],
      declarableIn: ALLERGEN_REGIMES[allergen] ?? [],
    });
  }

  for (const [rule, terms] of Object.entries(DIETARY_TERMS)) {
    concepts.set(rule, {
      id: rule,
      kind: 'diet',
      matching: 'word',
      definite: terms.definite,
      verify: terms.verify,
      exclude: [],
      borrowAllergenExclusions: true,
      identifiers: [],
      declarableIn: [],
      determinability: CERTIFICATION_RULES.has(rule) ? 'certification' : 'ingredients',
    });
  }

  return concepts;
}

let registry: Map<string, Concept> | null = null;

function concepts(): Map<string, Concept> {
  if (!registry) registry = buildRegistry();
  return registry;
}

export function getConcept(id: string): Concept | undefined {
  return concepts().get(id);
}

export function listConcepts(): Concept[] {
  return Array.from(concepts().values());
}

// ---------------------------------------------------------------------------
// Identity pass
// ---------------------------------------------------------------------------

/**
 * The substance ids a concept covers, expanded across CAS-equivalent entries.
 *
 * Built once per concept and held, because resolving is a map lookup but the
 * expansion is not, and this runs against every ingredient of every scan.
 * Keyed by concept id; the corpus does not change within a process.
 */
const identityCache = new Map<string, Set<string>>();

function substanceIdsFor(concept: Concept): Set<string> {
  const cached = identityCache.get(concept.id);
  if (cached) return cached;

  const ids = new Set<string>();
  if (concept.identifiers.length > 0) {
    const registry = getSubstanceRegistry();
    for (const identifier of concept.identifiers) {
      const resolved = registry.resolve(identifier);
      if (!resolved) continue;
      // Expand across entries that share a CAS. The annexes file one chemical
      // under several names, and a concept naming one of them means all of them.
      for (const id of registry.sameSubstanceIds(resolved.substance.id)) ids.add(id);
    }
  }

  identityCache.set(concept.id, ids);
  return ids;
}

/** Test seam: the corpus is loaded lazily, and fixtures may swap it. */
export function __clearConceptIdentityCache(): void {
  identityCache.clear();
}

/**
 * Does this ingredient resolve to a substance the concept covers?
 *
 * Returns the identifier that matched, so the flag can say what it recognised
 * rather than merely that it recognised something.
 */
function identityHit(ingredientName: string, concept: Concept): string | null {
  const ids = substanceIdsFor(concept);
  if (ids.size === 0) return null;

  const registry = getSubstanceRegistry();
  const resolved = registry.resolve(ingredientName);
  if (!resolved) return null;

  for (const id of registry.sameSubstanceIds(resolved.substance.id)) {
    if (ids.has(id)) return resolved.substance.name;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Term pass
// ---------------------------------------------------------------------------

function termHit(ingredientName: string, terms: string[], concept: Concept): string | null {
  if (terms.length === 0) return null;
  const normalized = normalizeIngredientName(ingredientName);
  if (!normalized) return null;

  if (concept.exclude.some(rx => rx.test(normalized))) return null;

  for (const term of terms) {
    if (!term) continue;
    const hit =
      concept.matching === 'word'
        ? matchesTerm(ingredientName, term)
        : normalized.includes(normalizeIngredientName(term));
    if (!hit) continue;
    if (concept.borrowAllergenExclusions &&
        keywordHitExcluded(normalized, normalizeIngredientName(term))) continue;
    return term;
  }
  return null;
}

// ---------------------------------------------------------------------------
// The public match
// ---------------------------------------------------------------------------

/**
 * Match one ingredient against one concept.
 *
 * Order is identity, then definite terms, then verify terms — strongest
 * evidence first, so the returned match is the best available rather than
 * whichever fired first.
 */
export function matchConcept(ingredientName: string, concept: Concept): ConceptMatch | null {
  const byIdentity = identityHit(ingredientName, concept);
  if (byIdentity) {
    return { conceptId: concept.id, certainty: 'definite', via: 'identity', evidence: byIdentity };
  }

  const definite = termHit(ingredientName, concept.definite, concept);
  if (definite) {
    return { conceptId: concept.id, certainty: 'definite', via: 'term', evidence: definite };
  }

  const verify = termHit(ingredientName, concept.verify, concept);
  if (verify) {
    return { conceptId: concept.id, certainty: 'verify', via: 'term', evidence: verify };
  }

  return null;
}

/** Convenience for callers holding an id rather than a concept. */
export function matchConceptById(ingredientName: string, conceptId: string): ConceptMatch | null {
  const concept = concepts().get(conceptId);
  return concept ? matchConcept(ingredientName, concept) : null;
}

/**
 * Match an ingredient against one entry from a profile's allergen list.
 *
 * The entry is either a known concept — the fifteen declarable allergens — or
 * anything at all the person typed. Both paths accept the extra match terms a
 * profile may carry.
 *
 * Semantics for the term half are exactly those of
 * `ingredientMatchesAllergen`, which this replaces at the call sites that had a
 * profile in hand. What it adds is the identity pass, and identity can only
 * ADD matches: it never vetoes a term hit. That is the safe direction for a
 * change to the highest-stakes matcher in the app — recall cannot fall.
 */
export function matchProfileAllergen(
  ingredientName: string,
  allergen: string,
  extraKeywords: string[] = [],
): ConceptMatch | null {
  const canonical = normalizeIngredientName(allergen).replace(/ /g, '_');
  const known = concepts().get(canonical);

  if (known) {
    const widened: Concept =
      extraKeywords.length > 0
        ? { ...known, definite: [...known.definite, ...extraKeywords] }
        : known;
    return matchConcept(ingredientName, widened);
  }

  // A term nobody curated. Identity first — it is the only thing that can see
  // past the exact string the person happened to type.
  const byIdentity = matchCustomEntryByIdentity(ingredientName, allergen);
  if (byIdentity) return byIdentity;

  const custom: Concept = {
    id: allergen,
    kind: 'allergen',
    matching: 'substring',
    definite: [normalizeIngredientName(allergen), ...extraKeywords.map(normalizeIngredientName)],
    verify: [],
    exclude: [],
    borrowAllergenExclusions: false,
    identifiers: [],
    declarableIn: [],
  };
  return matchConcept(ingredientName, custom);
}

/**
 * Match an ingredient against a free-text profile entry — "Red 40",
 * "carrageenan", something a person typed that is not a known concept.
 *
 * This is where the identity pass earns its keep even with today's thin
 * corpus, because it applies to a term nobody curated. The user's own words
 * are resolved through the alias graph exactly as the ingredient is, and two
 * names for one substance match even when the strings share nothing.
 *
 * Returns null rather than falling back to a literal comparison; the caller
 * already does that, and doing it twice would double-report.
 */
export function matchCustomEntryByIdentity(
  ingredientName: string,
  userTerm: string,
): ConceptMatch | null {
  const registry = getSubstanceRegistry();

  const wanted = registry.resolve(userTerm);
  if (!wanted) return null;

  const found = registry.resolve(ingredientName);
  if (!found) return null;

  const wantedIds = new Set(registry.sameSubstanceIds(wanted.substance.id));
  for (const id of registry.sameSubstanceIds(found.substance.id)) {
    if (wantedIds.has(id)) {
      return {
        conceptId: userTerm,
        certainty: 'definite',
        via: 'identity',
        evidence: found.substance.name,
      };
    }
  }
  return null;
}
