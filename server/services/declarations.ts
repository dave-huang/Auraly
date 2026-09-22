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

  // A hedge inside the captured statement, for scripts where the hedge sits
  // after the marker rather than before it: "過敏原資訊：本產品可能含有花生"
  // is a warning about traces, and reading it as a declaration would mark the
  // product unsafe on the strength of the word that says it is not certain.
  const CJK_HEDGE = /可能|微量|或含/;

  // "Made on a line that also makes..." is a warning about the factory, not
  // about what is in the packet, and several languages phrase it with the
  // same word they use to declare presence. A real chocolate bar carries
  // both, one under the other:
  //
  //   敏感提示: 含有大豆制品
  //   本生产线也生产含有乳制品，花生，坚果的产品。
  //
  // The first line is a declaration and the second is not, and both contain
  // 含有. Read the second as a declaration and someone allergic to peanuts is
  // told this bar has peanuts in it.
  const SHARED_LINE = new RegExp([
    '生产线', '生產線', '共线', '共用', '也生产', '也生產', '也加工',
    '同一(设备|設備|车间|車間|工场|工場)',
    '同じ(製造)?ライン', '同一工場',
    'facility', 'equipment', 'production line', 'same line',
    'instalaciones', 'equipo', 'misma linea', 'misma línea',
    'оборудовани', 'производств',
  ].join('|'), 'i');

  // A category is not an allergen, and is not expanded into one. The sacha
  // tofu label declares 含麩質的穀類, "grains containing gluten", which covers
  // wheat, barley and rye: reading wheat out of it would be an inference, and
  // on a barley-only product it would be a wrong one. Wheat on that label is
  // found the ordinary way, from 小麥麩皮 in the ingredient list. The backstop
  // reports what a declaration says, and declines to interpret it.

  const markers: {
    pattern: RegExp;
    /** A hedge in the text BEFORE the marker: "may contains". */
    hedges: RegExp;
    /** A hedge INSIDE the captured statement: "過敏原資訊：本產品可能含有". */
    rejectIn?: RegExp;
    /** A hedge AFTER the marker, which is where Japanese puts it: "を含む可能性があります". */
    rejectAfter?: RegExp;
  }[] = [
    { pattern: /contains\s*:?\s*([^.\n;)]{2,120})/gi, hedges: /\b(may|might|could|possible|traces?\s+of)\s*$/i },
    { pattern: /contiene\s*:?\s*([^.\n;)]{2,120})/gi, hedges: /\b(puede|podria|trazas\s+de)\s*$/i },
    { pattern: /содержит\s*:?\s*([^.\n;)]{2,120})/gi, hedges: /\b(может|возможно)\s*$/i },
    // CJK declarations carry no spaces and the hedge sits inline, so the
    // marker itself is written to exclude it: 可能含有 is "may contain".
    { pattern: /(?<!可能)含有\s*[:：]?\s*([^。\n；)）]{1,60})/g, hedges: NEVER, rejectIn: CJK_HEDGE },
    // Taiwan and Hong Kong head the block with 過敏原資訊 and often list the
    // allergens straight after it, with no 含有 anywhere: the case that broke
    // the sacha tofu label. Simplified 过敏原 is the same shape.
    { pattern: /(?:過敏原|过敏原)(?:資訊|資料|信息)?\s*[:：]\s*([^。\n；)）]{1,60})/g, hedges: NEVER, rejectIn: CJK_HEDGE },
    // Japanese puts the allergens first: "(一部に小麦・乳成分・大豆を含む)".
    { pattern: /([^。\n；)）]{1,60})を含む/g, hedges: NEVER, rejectAfter: /^(?:可能性|場合)/ },
  ];

  const found: string[] = [];
  for (const { pattern, hedges, rejectIn, rejectAfter } of markers) {
    for (const match of rawText.matchAll(pattern)) {
      // The preceding text on THIS line only. A declaration on the line
      // above must not lend its words to the line below, which is exactly
      // how the two-line allergen block reads.
      const window = rawText.slice(Math.max(0, match.index - 60), match.index);
      const before = window.slice(window.lastIndexOf('\n') + 1);
      if (hedges.test(before.trim())) continue;
      if (SHARED_LINE.test(before)) continue;
      const after = rawText.slice(match.index + match[0].length, match.index + match[0].length + 24);
      if (rejectAfter?.test(after.trim())) continue;
      let statement = match[1].trim();
      // The same two sentences, transcribed onto ONE line: "含有大豆制品，本生产线
      // 也生产含有乳制品、花生、坚果的产品". The line check above cannot see the
      // factory clause, because it sits inside the capture, after the marker.
      // Keep the statement up to the clause boundary before it and drop the rest.
      const shared = statement.search(SHARED_LINE);
      if (shared >= 0) {
        const cut = Math.max(...[...'，,；;'].map(sep => statement.lastIndexOf(sep, shared)));
        statement = (cut >= 0 ? statement.slice(0, cut) : '').trim();
      }
      if (!statement) continue;
      if (rejectIn?.test(statement)) continue;
      found.push(statement);
    }
  }
  return found;
}
