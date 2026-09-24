import fs from 'fs';
import path from 'path';

/**
 * Translations of evidence and knowledge-base statements, built ahead of time
 * by scripts/translate-sources.ts into server/data/substances/translations/.
 *
 * WHY THESE ARE TRANSLATED AT ALL, WHEN THEY USED NOT TO BE
 *
 * The rule was that a statement is a quotation and a translated quotation is
 * not one. Two things changed that. Most statements are not quotations: they
 * are sentences our own ingest wrote ("Prohibited in cosmetic products in the
 * EU (Annex II, entry 405).") from a register's fields. And a Chinese or
 * Spanish reader shown only English was not reading the evidence at all.
 *
 * So the translation travels BESIDE the statement, never instead of it. The
 * app shows the translation marked as one, with the English a tap away, which
 * keeps the original checkable and the translation honest about what it is.
 *
 * A statement with no entry here, because it was ingested after the last run,
 * simply has no translation and is shown in English, as before.
 */

const DIR = path.resolve(process.cwd(), 'server/data/substances/translations');
const cache = new Map<string, Record<string, string>>();

function table(lang: string): Record<string, string> {
  let map = cache.get(lang);
  if (!map) {
    const file = path.join(DIR, `${lang}.json`);
    try {
      map = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    } catch (error: any) {
      // A corrupt file must not take the evidence screen down with it; the
      // statements are still there in English.
      console.error(`[TRANSLATIONS] could not read ${file}: ${error?.message}`);
      map = {};
    }
    cache.set(lang, map!);
  }
  return map!;
}

/** The statement in `lang`, or undefined for English or when none exists. */
export function translateStatement(statement: string, lang: string | undefined): string | undefined {
  if (!lang || lang === 'en') return undefined;
  const translated = table(lang)[statement];
  return translated && translated !== statement ? translated : undefined;
}
