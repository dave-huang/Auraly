import fs from 'fs';
import path from 'path';

/**
 * Snapshot the FDA "Substances Added to Food" inventory as CSV.
 *
 * This exists because the FDA publishes this inventory as a paginated web
 * application, not as a file. There is no CSV to download, so the snapshot has
 * to be MADE — and the making has to be as reproducible and reviewable as the
 * downloads behind every other adapter, or the corpus quietly loses the
 * property that makes it defensible.
 *
 * So: this script is the manual download step, written down. It fetches one
 * URL, flattens the inventory table to CSV, and writes it under snapshots/.
 * The CSV it produces is the snapshot of record — committed to git, diffed on
 * every refresh, and the only thing the adapter ever reads. Re-running this
 * script and committing the result is how the inventory is updated; hand-edits
 * to the CSV are not.
 *
 * The adapter itself still never fetches. Keeping the network on this side of
 * the line is what lets `substances:ingest` run offline and produce byte-identical
 * output months later.
 *
 *   npx tsx server/services/substances/ingest/snapshot-fda-saf.ts
 *
 * Then read the git diff before ingesting. A row appearing or disappearing in
 * this file is the FDA changing its mind about a food ingredient, which is
 * exactly the kind of change that should be seen by a person.
 */

const SOURCE_URL =
  'https://www.hfpappexternal.fda.gov/scripts/fdcc/index.cfm' +
  '?set=FoodSubstances&sort=Sortterm_ID&order=ASC&showAll=true&type=basic&search=';

/** Columns, in the order the FDA's own table presents them. */
const COLUMNS = ['CAS Reg. No.', 'Substance', 'Used for (Technical Effect)', '21 CFR'];

/** Strip tags and entities from one table cell, collapsing whitespace. */
function cellText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&dagger;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toCsvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function inventoryToCsv(html: string): { csv: string; rows: number } {
  const rows: string[][] = [];
  for (const [, tr] of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = Array.from(tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi), (m) => cellText(m[1]));
    // The page wraps the inventory in layout tables; only the inventory's own
    // rows carry four data cells, so the shape is the filter.
    if (cells.length >= 4) rows.push(cells.slice(0, 4));
  }
  if (rows.length === 0) {
    throw new Error(
      'No inventory rows found. The FDA has probably changed the page structure — ' +
        'fix this script rather than the snapshot.',
    );
  }
  const lines = [COLUMNS.join(','), ...rows.map((r) => r.map(toCsvField).join(','))];
  return { csv: lines.join('\n') + '\n', rows: rows.length };
}

async function main() {
  const stamp = new Date().toISOString().slice(0, 7); // the FDA does not version it; the fetch month is the edition
  const out = path.join(
    process.cwd(),
    'server/data/substances/snapshots',
    `fda-food-substances-${stamp}.csv`,
  );

  console.log(`[SNAPSHOT] fetching ${SOURCE_URL}`);
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`FDA returned HTTP ${response.status}`);
  const html = await response.text();

  const { csv, rows } = inventoryToCsv(html);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, csv);
  console.log(`[SNAPSHOT] wrote ${rows} rows to ${out}`);
  console.log(`\nNext:\n  npm run substances:ingest -- fda_food_additives ${out} --version ${stamp} --url "${SOURCE_URL}"\n`);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch((error) => {
    console.error(`\n[SNAPSHOT] failed: ${error.message}\n`);
    process.exit(1);
  });
}
