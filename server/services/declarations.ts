// Reading a label's own allergen declaration out of the verbatim
// transcription. Deliberately dependency-free: no model client, no network, no
// keys, so the deterministic checks in eval/risk.check.ts can import it.

/**
 * Lift "CONTAINS ..." statements out of the verbatim transcription.
 *
 * The model is asked to put these in `declared_allergens.contains`, and
 * usually does. Usually is the problem. Reading the same chocolate bar five
 * times returned the soy declaration four times and dropped it once, and the
 * failure is silent: a label that says CONTAINS SOY comes back declaring
 * nothing, and the only remaining signal is an ingredient list that says
 * "lecithin" and no more. That is exactly the case declarations exist for.
 *
 * So the transcription is read directly as well, and the two are unioned. The
 * model's structured answer is still preferred for anything subtle; this only
 * ensures a printed declaration cannot vanish because one call decided not to
 * structure it.
 *
 * "May contain" is excluded, here as everywhere: traces are not presence, and
 * promoting a hedge to a statement would make half the supermarket unsafe.
 */
export function containsStatementsFromText(rawText: string): string[] {
  if (!rawText) return [];

  // Each marker is the word a label uses to declare presence, paired with the
  // hedges that must disqualify the same sentence. The hedge list is checked
  // against the text BEFORE the marker, because "may contain" and "contains"
  // share the word we are looking for.
  // A hedge pattern that cannot fire. `/$^/` looks like it never matches and
  // in fact matches the empty string, which silently discarded every
  // declaration printed at the very start of a transcription.
  const NEVER = /(?!)/;

  const markers: { pattern: RegExp; hedges: RegExp }[] = [
    { pattern: /contains\s*:?\s*([^.\n;)]{2,120})/gi, hedges: /\b(may|might|could|possible|traces?\s+of)\s*$/i },
    { pattern: /contiene\s*:?\s*([^.\n;)]{2,120})/gi, hedges: /\b(puede|podria|trazas\s+de)\s*$/i },
    { pattern: /содержит\s*:?\s*([^.\n;)]{2,120})/gi, hedges: /\b(может|возможно)\s*$/i },
    // CJK declarations carry no spaces and the hedge sits inline, so the
    // marker itself is written to exclude it: 可能含有 is "may contain".
    { pattern: /(?<!可能)含有\s*[:：]?\s*([^。\n；)）]{1,60})/g, hedges: NEVER },
    // Japanese puts the allergens first: "(一部に小麦・乳成分・大豆を含む)".
    { pattern: /([^。\n；)）]{1,60})を含む/g, hedges: NEVER },
  ];

  const found: string[] = [];
  for (const { pattern, hedges } of markers) {
    for (const match of rawText.matchAll(pattern)) {
      const before = rawText.slice(Math.max(0, match.index - 24), match.index);
      if (hedges.test(before.trim())) continue;
      const statement = match[1].trim();
      if (statement) found.push(statement);
    }
  }
  return found;
}
