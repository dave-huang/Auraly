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
 *
 * RANK IS AGAINST THE PRINTED LIST, NOT THE FLATTENED ONE.
 *
 * This used to rank against `canonicalIngredients`, which holds every name on
 * the label including the ones inside brackets. On "Enriched Flour (Wheat
 * Flour, Niacin, Reduced Iron), Sugar, Palm Oil" that made niacin the third
 * ingredient of the product — a trace fortifier inside the first, reported as
 * one of the three heaviest things in the jar. The check that was supposed to
 * catch this could not: the reader and the analyzer agreed on the same
 * flattened list, so the lists lined up perfectly and the rank was confidently
 * wrong.
 *
 * A sub-ingredient now gets NO rank. Not its parent's — a label says how much
 * enriched flour is in a biscuit and says nothing whatsoever about how much of
 * that flour is niacin, and inheriting the parent's position would put a
 * number on something the label never stated. Silence is the true answer.
 */

/**
 * Below this many ingredients there is no list to have a position in.
 *
 * This was 5, tuned when lists still arrived flattened and were therefore
 * systematically longer — a packet printing four ingredients used to reach the
 * reader as twenty-three. Now that the count is the printed one, 5 silenced
 * rank on a large share of ordinary groceries, including a four-ingredient
 * label whose first ingredient is the whole story about the product.
 */
export const MIN_LIST_FOR_RANK = 3;

/**
 * How many leading positions are worth naming, given how long the list is.
 *
 * Third of fourteen is a real statement about a product. Third of four is
 * nearly the end of the list, and saying it out loud implies a prominence the
 * position does not carry — so a short list only speaks for its top two.
 */
export function prominentRankLimit(total: number): number {
  return total >= 5 ? 3 : 2;
}

/**
 * Is this rank worth putting on screen?
 *
 * A rank exists for every lined-up ingredient, but most of them say nothing —
 * "11th of 14" is trivia. The card shows only the positions that change what
 * the product IS.
 */
export function isProminent(labelRank?: { rank: number; total: number }): boolean {
  if (!labelRank) return false;
  return (
    labelRank.total >= MIN_LIST_FOR_RANK &&
    labelRank.rank <= prominentRankLimit(labelRank.total)
  );
}

/**
 * Attach `labelRank` to every ingredient we can place on the printed list.
 *
 * Two strategies, strongest first:
 *  1. Equal lengths — the analyzer returned one ingredient per label entry, so
 *     index i is position i. This is the same weak-but-checkable assumption the
 *     bilingual row display already relies on.
 *  2. Name lookup — the ingredient's name, or the English `sourceName` it was
 *     analysed under, appears verbatim in the reader's canonical list.
 *     Survives reordering and translation.
 *
 * Neither available, or the reader gave us no canonical list: no rank. An
 * absent rank is correct and common; a wrong one puts "2nd ingredient" under
 * something that was fourteenth.
 */
export function withLabelRanks(result: AnalysisResult): AnalysisResult {
  // The printed list where we have it; the flat list only for scans read
  // before composition existed, and for the OCR fallback, which never sees a
  // bracket and so cannot have flattened one.
  const composition = result.composition;
  const printed = composition?.length
    ? composition.map((entry) => entry.name)
    : result.canonicalIngredients ?? [];
  if (printed.length < MIN_LIST_FOR_RANK) return result;

  const total = printed.length;

  const positionByName = new Map<string, number>();
  printed.forEach((name, i) => {
    const key = normalizeIngredientName(name);
    // First occurrence wins. A term printed twice cannot be placed, so it keeps
    // the earlier (higher-weight) position rather than being dropped.
    if (key && !positionByName.has(key)) positionByName.set(key, i + 1);
  });

  // Index alignment is available ONLY without composition.
  //
  // The analyzer works from the flattened list, so once a label has a bracket
  // on it, `result.ingredients` and the printed list describe different things
  // and equal lengths would be a coincidence rather than an alignment — the
  // exact coincidence that produced ranks for sub-ingredients before. With
  // composition in hand, names are the only sound way to place anything, and a
  // name that is not on the printed list is simply not ranked.
  const alignedByIndex = !composition?.length && printed.length === result.ingredients.length;

  let changed = false;
  const ingredients: Ingredient[] = result.ingredients.map((ing, i) => {
    // A sub-ingredient falls out here with no rank: it is not a printed entry,
    // so it has no position in `positionByName`. One that ALSO appears at top
    // level — salt inside the peanut butter and salt on its own — is found and
    // ranked, which is correct; the label really does print it there.
    //
    // By the English name as well as the displayed one: the printed list is
    // the reader's English, so on a Chinese card 糖 found no position while
    // Sugar on the English card of the same label read "#1 of 44".
    const rank = alignedByIndex
      ? i + 1
      : positionByName.get(normalizeIngredientName(ing.name)) ??
        (ing.sourceName ? positionByName.get(normalizeIngredientName(ing.sourceName)) : undefined);
    if (!rank) return ing;
    changed = true;
    return { ...ing, labelRank: { rank, total } };
  });

  return changed ? { ...result, ingredients } : result;
}
