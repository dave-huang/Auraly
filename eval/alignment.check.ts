import type { Ingredient } from '../shared/schema';
import { orderBatchResults } from '../server/services/batchOrder';
import { withLabelRanks } from '../server/services/labelRank';

/**
 * List alignment — the analyzer's ingredients against the label reader's.
 *
 * Three lists travel together through a scan and are lined up by POSITION:
 *
 *   originalIngredients   what is printed on the pack, in its own language
 *   canonicalIngredients  the reader's English names, same order
 *   ingredients           the analyzer's rows
 *
 * Nothing carries an explicit key between them. Every consumer instead checks
 * that the lengths match and then trusts index i, which is a real assumption
 * and is written down as one in labelRank.ts, personalRisk.ts and the app's
 * buildRows. It holds only while the analyzer returns one row per input, in the
 * order it was given them.
 *
 * It stopped holding, quietly, for months. A batch answered partly from cache
 * and partly from the model and returned the cached rows first, which is a
 * rotation: same length, wrong meaning. That printed the wrong Chinese name
 * under three ingredients on an English scan and moved the position-on-label
 * rank with it, and on a scan whose display language matches the label it is
 * the same index that attaches an allergen flag to a row.
 *
 * The length check cannot catch a rotation, so this file checks the ordering
 * itself. Pure: no database, no network, no model.
 */

const errors: string[] = [];
function check(label: string, ok: boolean, detail: string) {
  if (!ok) errors.push(`${label}: ${detail}`);
}

function row(name: string): Ingredient {
  return { name, riskLevel: 'low', summary: '', details: '' } as Ingredient;
}
function names(rows: Ingredient[]): string {
  return rows.map((r) => r.name).join(', ');
}

console.log('[ALIGNMENT] batch order survives the ingredient cache');

// ---------------------------------------------------------------------------
// 1. The exact shape that shipped broken.
//
// A three-ingredient batch off a real label, with the middle and last already
// cached. Returning cache-then-fresh rotated it to [Sugar, Soybean Oil,
// Soybeans], which is what put 黃豆（基因改造）underneath the word "Sugar".
// ---------------------------------------------------------------------------
{
  const batch = ['Soybeans (Genetically Modified)', 'Sugar', 'Soybean Oil'];
  const cached = [
    { name: 'Sugar', data: row('Sugar') },
    { name: 'Soybean Oil', data: row('Soybean Oil') },
  ];
  const missing = ['Soybeans (Genetically Modified)'];
  const produced = [row('Soybeans (Genetically Modified)')];

  const out = orderBatchResults(batch, cached, missing, produced);
  check('order/mixed-cache', names(out) === batch.join(', '),
    `a partly cached batch came back as [${names(out)}]`);
}

// ---------------------------------------------------------------------------
// 2. The two uniform cases, which were never broken and must stay that way.
// ---------------------------------------------------------------------------
{
  const batch = ['Water', 'Salt', 'Citric Acid'];
  const allCached = orderBatchResults(batch, batch.map((n) => ({ name: n, data: row(n) })), [], []);
  check('order/all-cached', names(allCached) === batch.join(', '),
    `a fully cached batch came back as [${names(allCached)}]`);

  const allFresh = orderBatchResults(batch, [], batch, batch.map(row));
  check('order/all-fresh', names(allFresh) === batch.join(', '),
    `a fully uncached batch came back as [${names(allFresh)}]`);
}

// ---------------------------------------------------------------------------
// 3. A localized batch. The model returns names in the user's language, so
//    there is no shared string to match on and position is the only key. This
//    is the case that rules out "just match by name" as the fix.
// ---------------------------------------------------------------------------
{
  const batch = ['Soybean Oil', 'Sugar'];
  const out = orderBatchResults(batch, [{ name: 'Sugar', data: row('砂糖') }], ['Soybean Oil'], [row('大豆油')]);
  check('order/localized-names', names(out) === '大豆油, 砂糖',
    `a Chinese-language batch came back as [${names(out)}]`);
}

// ---------------------------------------------------------------------------
// 4. A batch we cannot order, because the model split one entry into two.
//
// The requirement here is NOT that it guesses well. It is that it keeps every
// row and lets the length go wrong, because a length mismatch is exactly what
// makes every downstream consumer stop trusting position. Silently dropping the
// extra row would restore the length and re-enable a wrong alignment.
// ---------------------------------------------------------------------------
{
  const batch = ['Peanut Butter (Ground Peanuts)', 'Corn Grits'];
  const out = orderBatchResults(
    batch,
    [{ name: 'Corn Grits', data: row('Corn Grits') }],
    ['Peanut Butter (Ground Peanuts)'],
    [row('Peanut Butter'), row('Peanuts')],
  );
  check('order/split-keeps-every-row', out.length === 3,
    `a split entry lost a row: [${names(out)}]`);
}

console.log('[ALIGNMENT] position on the label follows the same list');

// ---------------------------------------------------------------------------
// 5. labelRank reads the same assumption, so the rotation moved ranks too.
//    With the order restored, rank 1 is the first thing on the pack.
// ---------------------------------------------------------------------------
{
  const canonical = ['Soybeans (Genetically Modified)', 'Sugar', 'Soybean Oil', 'Water', 'Salt'];
  const ranked = withLabelRanks({
    productType: 'food',
    productName: null,
    overallRisk: 'low',
    analyzedAt: new Date().toISOString(),
    originalText: '',
    canonicalIngredients: canonical,
    ingredients: canonical.map(row),
  } as any);

  const first = ranked.ingredients.find((i) => i.name === 'Soybeans (Genetically Modified)');
  check('rank/first-on-the-pack', first?.labelRank?.rank === 1,
    `the first printed ingredient ranked ${first?.labelRank?.rank}`);

  const rotated = withLabelRanks({
    productType: 'food',
    productName: null,
    overallRisk: 'low',
    analyzedAt: new Date().toISOString(),
    originalText: '',
    canonicalIngredients: canonical,
    // One row fewer than the reader's list: the analyzer merged two entries.
    // No rank can be placed by position, and none should be invented.
    ingredients: canonical.slice(1).map(row),
  } as any);
  check('rank/refuses-when-lengths-differ',
    rotated.ingredients.every((i) => i.labelRank === undefined || canonical[i.labelRank.rank - 1] === i.name),
    'a rank was assigned to a row that could not be placed on the printed list');
}

if (errors.length > 0) {
  console.log(`\n[ALIGNMENT] ${errors.length} failure(s):`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  process.exit(1);
}
console.log('\n[ALIGNMENT] all list alignment checks passed');
