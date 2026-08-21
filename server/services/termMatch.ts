import { normalizeIngredientName } from './allergenMatcher';

/**
 * Word-boundary, negation-aware term matching.
 *
 * The personal-risk layer used to match with a bare `name.includes(keyword)`.
 * That is the same defect the substance identity module was written to avoid:
 * "formaldehyde-free" contains "formaldehyde", and a substring matcher reports
 * a hit on a label that is advertising the opposite.
 *
 * It matters far more here than it did for allergens, because the terms this
 * module is asked to find — sugar, salt, gluten — are exactly the terms that
 * labels most often print in the NEGATIVE. "Sugar free", "no added salt" and
 * "gluten free" are among the most common claims in a supermarket, and a
 * matcher that reads them as hits would flag the safest products hardest.
 *
 * Two guards, both deliberately conservative:
 *
 *  1. Matching is on whole words. `\bsalt\b` does not fire inside "unsalted"
 *     or "asphalt", which removes a whole class of lookalike without any
 *     hand-written exclusion.
 *  2. An explicit negation next to the term vetoes the match.
 *
 * What is NOT treated as negation: "low", "reduced", "less". A reduced-sodium
 * soup still contains sodium, and someone managing blood pressure is better
 * served by a flag they can dismiss than by silence.
 */

/** Cache: these regexes are rebuilt on every ingredient of every scan otherwise. */
const termCache = new Map<string, { hit: RegExp; negated: RegExp }>();

function escape(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function patternsFor(term: string): { hit: RegExp; negated: RegExp } {
  const cached = termCache.get(term);
  if (cached) return cached;

  const t = escape(normalizeIngredientName(term));
  const built = {
    hit: new RegExp(`\\b${t}\\b`),
    // Negations, in the two shapes English actually uses on packaging:
    //   trailing  — "sugar free", "salt substitute", "dairy alternative"
    //   leading   — "no sugar", "no added sugar", "without salt", "zero sugar"
    // `free from` and `free of` are handled by the leading form.
    negated: new RegExp(
      `\\b${t}\\s+(free|substitute|replacer|alternative)\\b` +
        `|\\b(no|zero|without|free\\s+of|free\\s+from)\\s+(added\\s+)?${t}\\b`,
    ),
  };
  termCache.set(term, built);
  return built;
}

/**
 * Does `ingredientName` genuinely contain `term`?
 *
 * `ingredientName` may be raw; it is normalized here. Returns false for any
 * negated form, which is the safe direction: a missed flag on a "sugar free"
 * product is the correct outcome, not a near miss.
 */
export function matchesTerm(ingredientName: string, term: string): boolean {
  const n = normalizeIngredientName(ingredientName);
  if (!n) return false;
  const { hit, negated } = patternsFor(term);
  if (negated.test(n)) return false;
  return hit.test(n);
}

/** The first term in `terms` that genuinely matches, or undefined. */
export function firstMatchingTerm(
  ingredientName: string,
  terms: readonly string[],
): string | undefined {
  const n = normalizeIngredientName(ingredientName);
  if (!n) return undefined;
  return terms.find((term) => {
    const { hit, negated } = patternsFor(term);
    return !negated.test(n) && hit.test(n);
  });
}
