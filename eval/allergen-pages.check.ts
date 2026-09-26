/**
 * The allergen pages must say what the scanner does.
 *
 * Each page at /en/allergens lists the names an allergen goes by and promises,
 * in its "In Revely" box, that the app checks labels for them. That promise is
 * only true if the list and ALLERGEN_KEYWORDS agree, in both directions:
 *
 *   1. Every name on a page is one the matcher flags for that allergen.
 *   2. Every keyword the matcher uses shows up in some name on the page, so a
 *      keyword added to the matcher is a page that needs a line.
 *   3. Every look-alike the page says is NOT the allergen, the matcher agrees
 *      is not it: either no keyword hits, or an exclusion vetoes the hit.
 *
 * Run: npm run allergen-pages:check
 */
import { ALLERGEN_PAGES } from '../server/allergenContent';
import { ALLERGENS_ES } from '../server/allergenContent.es';
import { ALLERGENS_ZH } from '../server/allergenContent.zh';
import {
  ALLERGEN_KEYWORDS,
  ingredientMatchesAllergen,
  normalizeIngredientName,
} from '../server/services/allergenMatcher';

const failures: string[] = [];

/** "Casein, caseinate" is two names; quotes and notes are not part of them. */
function namesIn(term: string): string[] {
  return term
    .replace(/[“”"]/g, '')
    .split(/,\s*/)
    .map((t) => t.replace(/\band other .*$/, '').replace(/^and /, '').trim())
    .filter(Boolean);
}

for (const page of ALLERGEN_PAGES) {
  const keywords = ALLERGEN_KEYWORDS[page.id];
  const listed = page.names.flatMap((n) => namesIn(n.term));

  for (const name of listed) {
    if (!ingredientMatchesAllergen(name, page.id)) {
      failures.push(`${page.slug}: "${name}" is listed, but the matcher does not flag it as ${page.id}`);
    }
  }

  // "E 220" is the matcher's spelling of "E-220" after normalization, and the
  // same keyword as "E220"; compare with spaces out so a page lists it once.
  const squash = (s: string) => s.replace(/\s+/g, '');
  const normalized = listed.map((n) => squash(normalizeIngredientName(n)));
  for (const kw of keywords) {
    if (!normalized.some((n) => n.includes(squash(kw)))) {
      failures.push(`${page.slug}: the matcher keyword "${kw}" appears in no name on the page`);
    }
  }

  for (const item of page.notIt ?? []) {
    for (const name of namesIn(item.term)) {
      // Another allergen's page, named as a look-alike ("Peanut" on tree nuts)
      // is checked by the same rule: the matcher must not call it this one.
      if (ingredientMatchesAllergen(name, page.id)) {
        failures.push(`${page.slug}: "${name}" is listed as NOT ${page.id}, but the matcher flags it`);
      }
    }
  }

  const text = JSON.stringify(page);
  if (text.includes('—')) failures.push(`${page.slug}: contains an em dash`);

  // The translations carry one note per English name, in order. A list out of
  // step would pin a Chinese note to the wrong English name.
  for (const [lang, all] of [['zh', ALLERGENS_ZH], ['es', ALLERGENS_ES]] as const) {
    const t = all[page.slug];
    if (!t) { failures.push(`${page.slug}: no ${lang} translation`); continue; }
    if (t.names.length !== page.names.length) failures.push(`${page.slug} (${lang}): ${t.names.length} name notes for ${page.names.length} names`);
    if ((t.notIt?.length ?? 0) !== (page.notIt?.length ?? 0)) failures.push(`${page.slug} (${lang}): look-alike notes out of step`);
    const tt = JSON.stringify(t);
    if (/—/.test(tt)) failures.push(`${page.slug} (${lang}): contains an em dash`);
    for (const key of ['us', 'eu', 'jp'] as const) {
      const cites = (s: string) => (s.match(/\[\[[a-z0-9-]+\]\]/g) ?? []).sort().join();
      if (cites(t.law[key]) !== cites(page.law[key])) failures.push(`${page.slug} (${lang}): law.${key} cites different sources from English`);
    }
  }
}

console.log(`[ALLERGEN PAGES] ${ALLERGEN_PAGES.length} pages checked against the matcher`);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log('  ok   every listed name is flagged, every keyword is listed, every look-alike is cleared');
