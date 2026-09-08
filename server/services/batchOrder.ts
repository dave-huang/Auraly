import type { Ingredient } from '@shared/schema';

/**
 * Put one batch's results back into the order the batch was asked for.
 *
 * THE BUG THIS EXISTS TO PREVENT
 *
 * A batch answers partly from the ingredient cache and partly from the model,
 * and it used to return `[...cached, ...fresh]`. That is not the order it was
 * asked in. Given a batch of [Soybeans, Sugar, Soybean Oil] where Sugar and
 * Soybean Oil were already cached, it returned [Sugar, Soybean Oil, Soybeans]:
 * same three ingredients, rotated.
 *
 * Nothing downstream can survive that, because everything downstream lines the
 * analyzer's list up with the LABEL READER's list by position, and equal
 * lengths are the only evidence it has that the two agree. A rotation keeps the
 * lengths equal and breaks the meaning. On a Chinese label read into English it
 * printed 黃豆（基因改造）under "Sugar" and 砂糖 under "Soybean Oil", and the
 * position-on-the-label rank went with it.
 *
 * The same index is what attaches an allergen flag to a row on a label whose
 * language differs from the reader's, so this was one batch size away from
 * putting a milk warning on the wrong ingredient. Chinese and Spanish scans use
 * a batch size of one and could not shuffle, which is why this only ever showed
 * up in English.
 *
 * HOW THE ORDER IS RECOVERED
 *
 * A cached row is keyed by the exact input name that fetched it, so it can be
 * placed by name. A fresh row cannot: the model is asked to return names in the
 * user's language, so on a Chinese scan there is no shared name left to match
 * on. What it is asked for is a NUMBERED list, returned as an array, so
 * position within `missing` is the key, and it is trustworthy exactly when the
 * counts agree.
 *
 * When they do not agree the model has split or merged something, and there is
 * no honest way to place the extras. They are appended rather than dropped, and
 * the resulting length mismatch is itself the signal: every consumer of this
 * list checks length before trusting position, so a batch we could not order
 * degrades to no rank and no printed original rather than to a wrong one.
 */
export function orderBatchResults(
  batch: string[],
  cached: { name: string; data: Ingredient }[],
  missing: string[],
  produced: Ingredient[],
): Ingredient[] {
  const byInputName = new Map<string, Ingredient>();
  for (const entry of cached) byInputName.set(entry.name, entry.data);

  const positional = produced.length === missing.length;
  if (positional) missing.forEach((name, i) => byInputName.set(name, produced[i]));

  const ordered = batch
    .map((name) => byInputName.get(name))
    .filter((row): row is Ingredient => row !== undefined);

  return positional ? ordered : [...ordered, ...produced];
}
