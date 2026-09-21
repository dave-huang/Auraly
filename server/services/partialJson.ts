// Reading a JSON document that is still being written. Dependency-free on
// purpose: no model client, no network, no keys, so eval/risk.check.ts can
// import it and pin the behaviour without an API call.

/**
 * Pull complete ingredient objects out of a half-finished JSON document.
 *
 * The reader spends most of a scan composing one JSON response, and the
 * ingredient names are in it long before it ends. Streaming the completion
 * means the names can reach the screen as the model writes them, which is the
 * difference between eighteen seconds of nothing and a list filling in.
 *
 * Only whole objects are returned. A half-written name is not shown: the app's
 * claim is that it read the label, and "Wheat Fl" appearing and then changing
 * would undercut that more than a slower list would.
 *
 * Scans with a brace counter rather than a regex, because an ingredient name
 * may contain braces and quotes, and a regex that is right about escaping is
 * longer than this.
 */
export function completeIngredientsInBuffer(
  buffer: string,
): { original: string; english: string }[] {
  const key = buffer.indexOf('"ingredients"');
  if (key === -1) return [];
  const arrayStart = buffer.indexOf('[', key);
  if (arrayStart === -1) return [];

  const out: { original: string; english: string }[] = [];
  let depth = 0;
  let objectStart = -1;
  let inString = false;
  let escaped = false;

  for (let i = arrayStart + 1; i < buffer.length; i++) {
    const c = buffer[i];

    if (escaped) { escaped = false; continue; }
    if (c === '\\') { escaped = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (c === '{') {
      if (depth === 0) objectStart = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0 && objectStart !== -1) {
        try {
          const parsed = JSON.parse(buffer.slice(objectStart, i + 1));
          if (typeof parsed?.english === 'string' && parsed.english.trim()) {
            out.push({
              english: String(parsed.english).trim(),
              original: String(parsed.original ?? parsed.english).trim(),
            });
          }
        } catch {
          // A complete-looking object that will not parse is skipped rather
          // than ending the scan: the next one may be fine.
        }
        objectStart = -1;
      }
    } else if (c === ']' && depth === 0) {
      break;
    }
  }
  return out;
}
