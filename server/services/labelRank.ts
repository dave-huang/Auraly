import type { AnalysisResult, Ingredient } from '@shared/schema';
import { normalizeIngredientName } from './allergenMatcher';

/**
 * Position on the ingredient list — the only dose signal a label gives away
 * for free.
 *
 * Ingredient lists are a legal declaration in DESCENDING ORDER OF WEIGHT in
 * every market this app operates in. That makes rank a real quantitative
 * statement: sugar listed second is a different product from sugar listed
 * fourteenth, and until now the app treated them identically because the
 * substance is the same substance.
 *
 * This is derived per label, so it is never an evidence record and never feeds
 * the policy level. A substance's level is a fact about the substance; rank
 * qualifies how much of it you are holding. Keeping that separation is what
 * lets the corpus stay reproducible while the card still answers "how much".
 *
 * Deliberately refuses to guess. The analyzer is free to split, merge and
 * reorder what the reader gave it — "Peanut Butter (Ground Peanuts), Corn
 * Grits" can come back as three ingredients from two label entries — so a rank
 * assigned by array position would silently misreport. Rank is attached only
 * where the two lists can be lined up, and omitted otherwise.
 */

/** Below this many ingredients, "2nd of 3" is not informative. */
export const MIN_LIST_FOR_RANK = 5;
/** Only the leading positions carry weight worth mentioning. */
export const PROMINENT_RANK = 3;

/**
 * Is this rank worth putting on screen?
 *
 * A rank exists for every lined-up ingredient, but most of them say nothing —
 * "11th of 14" is trivia. The card shows only the positions that change what
 * the product IS.
 */
export function isProminent(labelRank?: { rank: number; total: number }): boolean {
  if (!labelRank) return false;
  return labelRank.total >= MIN_LIST_FOR_RANK && labelRank.rank <= PROMINENT_RANK;
}

/**
 * Attach `labelRank` to every ingredient we can place on the printed list.
 *
 * Two strategies, strongest first:
 *  1. Equal lengths — the analyzer returned one ingredient per label entry, so
 *     index i is position i. This is the same weak-but-checkable assumption the
 *     bilingual row display already relies on.
 *  2. Name lookup — the ingredient's name appears verbatim in the reader's
 *     canonical list. Survives reordering, but not translation, since canonical
 *     names are English and `ingredients[].name` may be localized.
 *
 * Neither available, or the reader gave us no canonical list: no rank. An
 * absent rank is correct and common; a wrong one puts "2nd ingredient" under
 * something that was fourteenth.
 */
export function withLabelRanks(result: AnalysisResult): AnalysisResult {
  const canonical = result.canonicalIngredients ?? [];
  if (canonical.length < MIN_LIST_FOR_RANK) return result;

  const total = canonical.length;
  const alignedByIndex = canonical.length === result.ingredients.length;

  const positionByName = new Map<string, number>();
  canonical.forEach((name, i) => {
    const key = normalizeIngredientName(name);
    // First occurrence wins. A term printed twice cannot be placed, so it keeps
    // the earlier (higher-weight) position rather than being dropped.
    if (key && !positionByName.has(key)) positionByName.set(key, i + 1);
  });

  let changed = false;
  const ingredients: Ingredient[] = result.ingredients.map((ing, i) => {
    const rank = alignedByIndex
      ? i + 1
      : positionByName.get(normalizeIngredientName(ing.name));
    if (!rank) return ing;
    changed = true;
    return { ...ing, labelRank: { rank, total } };
  });

  return changed ? { ...result, ingredients } : result;
}
