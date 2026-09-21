// Checks the risk-rating pipeline. No API calls, no database — deterministic
// and free, so it can run on every change.
//
// The model's own rating is an INPUT here, not something under test: this
// script fixes a model level per fixture and checks what the deterministic
// layers do with it. Those layers are where a regression is silent — a policy
// rule that stops firing, a term matcher that starts matching "sugar free", a
// personal override that quietly lowers a level — because none of it throws.
// Testing the model's judgement needs real calls and lives in eval/run.ts.
//
// Exit codes: 0 = pass · 1 = a check failed.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { applyPopulationRisk, domainForProductType } from '../server/services/substances/classify';
import {
  ALLERGEN_KEYWORDS,
  MAJOR_ALLERGENS,
  allergensFromDeclaration,
  ingredientMatchesAllergen,
} from '../server/services/allergenMatcher';
import { containsStatementsFromText } from '../server/services/declarations';
import {
  CONCEPT_IDENTIFIERS_FOR_CHECK,
  getConcept,
  listConcepts,
  matchConcept,
  matchCustomEntryByIdentity,
  matchProfileAllergen,
} from '../server/services/concepts';
import { getSubstanceRegistry } from '../server/services/substances/identity';
import { applyProfileToAnalysis } from '../server/services/personalRisk';
import { MIN_LIST_FOR_RANK, isProminent, withLabelRanks } from '../server/services/labelRank';
import {
  defaultTracePolicy,
  riskLevels,
  tracePolicyFor,
  type AllergenSeverity,
  type Ingredient,
  type AnalysisResult,
  type Profile,
  type RiskLevel,
} from '../shared/schema';

const errors: string[] = [];
const notes: string[] = [];

function check(label: string, condition: boolean, detail: string) {
  if (!condition) errors.push(`${label}: ${detail}`);
}

/** Minimal ingredient carrying only what the risk layers read. */
function ing(name: string, modelLevel: RiskLevel): Ingredient {
  return {
    name,
    riskLevel: modelLevel,
    modelRiskLevel: modelLevel,
    summary: `fixture for ${name}`,
    details: `fixture for ${name}`,
    category: null,
  };
}

function result(ingredients: Ingredient[], productType: 'food' | 'personal_care' = 'food'): AnalysisResult {
  return {
    productType,
    productName: 'Fixture',
    ingredients,
    overallRisk: 'low',
    analyzedAt: new Date().toISOString(),
    canonicalIngredients: ingredients.map((i) => i.name),
  } as AnalysisResult;
}

function profile(over: Partial<Profile>): Profile {
  return {
    id: 'fixture', userId: 'fixture', name: 'Fixture', isDefault: true,
    allergens: [], dietaryRules: [], conditions: [],
    createdAt: new Date(), updatedAt: new Date(),
    ...over,
  } as Profile;
}

const rank: Record<RiskLevel, number> = { low: 0, moderate: 1, high: 2 } as Record<RiskLevel, number>;
const food = domainForProductType('food');
const cosmetic = domainForProductType('personal_care');

console.log('[RISK] checking the deterministic risk layers\n');

// ---------------------------------------------------------------------------
// 1. The record layer overrides the model in BOTH directions.
//
// This is the whole point of holding a corpus. If records could only raise a
// level, every "no concern at typical exposure" determination we hold would be
// dead weight; if they could only lower it, the trans-fat rule would never
// fire. Each fixture below names the direction it proves.
// ---------------------------------------------------------------------------
const overrideFixtures: Array<{
  name: string; model: RiskLevel; expected: RiskLevel; source: 'record' | 'model'; why: string;
}> = [
  { name: 'Sugar', model: 'low', expected: 'moderate', source: 'record',
    why: 'WHO free-sugars intake guidance should raise a low model rating' },
  { name: 'Partially Hydrogenated Soybean Oil', model: 'moderate', expected: 'high', source: 'record',
    why: 'WHO elimination call should raise it to high' },
  { name: 'Citric Acid', model: 'moderate', expected: 'low', source: 'record',
    why: 'JECFA no-concern determination should LOWER a moderate model rating' },
  { name: 'Cocoa Mass', model: 'low', expected: 'low', source: 'model',
    why: 'no record is held, so the model level passes through untouched' },
  { name: 'Bacon', model: 'high', expected: 'high', source: 'model',
    why: 'the model may assert high with no record behind it' },
];

for (const f of overrideFixtures) {
  const out = applyPopulationRisk(ing(f.name, f.model), food);
  check(`override/${f.name}`, out.riskLevel === f.expected,
    `expected ${f.expected}, got ${out.riskLevel} — ${f.why}`);
  check(`override/${f.name}`, out.riskSource === f.source,
    `expected riskSource=${f.source}, got ${out.riskSource}`);
  check(`override/${f.name}`, out.universalRiskLevel === out.riskLevel,
    `universalRiskLevel (${out.universalRiskLevel}) must equal riskLevel (${out.riskLevel}) before any profile is applied`);
  check(`override/${f.name}`, out.modelRiskLevel === f.model,
    `modelRiskLevel was rewritten from ${f.model} to ${out.modelRiskLevel} — it is the stable input and must survive`);
}

// ---------------------------------------------------------------------------
// 2. Re-deriving is idempotent.
//
// Reopening a stored scan re-runs these layers over their own output. If a
// derived level leaks back in as the input, a scan's verdict drifts every time
// it is opened. This is the bug class that made a personalized "high" come back
// as everyone's universal level.
// ---------------------------------------------------------------------------
for (const f of overrideFixtures) {
  const once = applyPopulationRisk(ing(f.name, f.model), food);
  const twice = applyPopulationRisk(once, food);
  const thrice = applyPopulationRisk(twice, food);
  for (const [pass, out] of [['2nd', twice], ['3rd', thrice]] as const) {
    check(`idempotent/${f.name}`,
      out.riskLevel === once.riskLevel && out.universalRiskLevel === once.universalRiskLevel &&
      out.modelRiskLevel === once.modelRiskLevel && out.riskSource === once.riskSource,
      `${pass} pass drifted: ${JSON.stringify({ risk: out.riskLevel, universal: out.universalRiskLevel, model: out.modelRiskLevel, source: out.riskSource })} != ${JSON.stringify({ risk: once.riskLevel, universal: once.universalRiskLevel, model: once.modelRiskLevel, source: once.riskSource })}`);
  }
}

// ---------------------------------------------------------------------------
// 3. Personal risk raises and NEVER lowers.
//
// Swept over every level against a profile with an allergy to the ingredient.
// A peanut allergy makes peanuts worse for you; it cannot make trans fat
// better. If this ever inverts, the app tells an allergic person that
// something dangerous is fine.
// ---------------------------------------------------------------------------
const allergyProfile = profile({
  allergens: [{ allergen: 'peanut', severity: 'anaphylaxis' }, { allergen: 'sesame', severity: 'allergy' }],
});

for (const level of riskLevels) {
  for (const name of ['Peanut Butter', 'Sesame Seeds', 'Water']) {
    const base = applyPopulationRisk(ing(name, level as RiskLevel), food);
    const universalBefore = base.universalRiskLevel!;
    const out = applyProfileToAnalysis(result([base]), allergyProfile);
    const after = out.ingredients[0];

    check(`personal/${name}@${level}`, rank[after.riskLevel] >= rank[universalBefore],
      `displayed level ${after.riskLevel} is BELOW the universal level ${universalBefore} — personal risk must never lower`);

    check(`personal/${name}@${level}`, after.universalRiskLevel === universalBefore,
      `universalRiskLevel was changed from ${universalBefore} to ${after.universalRiskLevel} by applying a profile — the neutral fact must survive personalization`);

    if (after.personalRiskLevel) {
      check(`personal/${name}@${level}`, rank[after.personalRiskLevel] > rank[universalBefore],
        `personalRiskLevel ${after.personalRiskLevel} is not above universal ${universalBefore}; it should be unset rather than equal`);
      check(`personal/${name}@${level}`, after.riskLevel === after.personalRiskLevel,
        `personal level ${after.personalRiskLevel} set but displayed ${after.riskLevel}`);
    }
  }
}

// A known allergen at a low universal level MUST be raised — the case that
// matters most, and the one a silent matcher regression would break.
{
  const base = applyPopulationRisk(ing('Sesame Seeds', 'low'), food);
  const out = applyProfileToAnalysis(result([base]), allergyProfile);
  const after = out.ingredients[0];
  check('personal/sesame-raises', after.personalRiskLevel !== undefined,
    'sesame is not flagged for a profile that declares a sesame allergy');
  check('personal/sesame-raises', rank[after.riskLevel] > rank['low' as RiskLevel],
    `sesame stayed at ${after.riskLevel} for someone allergic to it`);
  check('personal/sesame-raises', after.universalRiskLevel === 'low',
    `universal level became ${after.universalRiskLevel}; sesame is low risk for most people and storing the raised level shows one person's verdict to everyone`);
}

// ---------------------------------------------------------------------------
// 4. A condition advisory can reach the top level.
//
// Aspartame is approved in every market and sits on no ban list. For someone
// with PKU it causes irreversible harm. If this stops firing, the app reports
// "no concerns found" on the one ingredient that must never read that way.
// ---------------------------------------------------------------------------
{
  const base = applyPopulationRisk(ing('Aspartame', 'low'), food);
  const pku = profile({ conditions: ['pku'] });
  const out = applyProfileToAnalysis(result([base]), pku);
  const after = out.ingredients[0];
  check('advisory/pku-aspartame', after.personalRiskLevel === 'high',
    `expected personal level high for PKU, got ${after.personalRiskLevel ?? 'none'}`);
  check('advisory/pku-aspartame', (out.personalFlags ?? []).length > 0,
    'no personal flag was produced, so the results screen has nothing to explain the level with');

  // ...and must NOT fire for someone without the condition.
  const noCondition = applyProfileToAnalysis(result([base]), profile({}));
  check('advisory/pku-aspartame', noCondition.ingredients[0].personalRiskLevel === undefined,
    `aspartame was personally flagged for a profile with no conditions (${noCondition.ingredients[0].personalRiskLevel})`);
}

// ---------------------------------------------------------------------------
// 4b. The same, for an infant profile and honey.
//
// Honey is the second case of the same shape and a sharper one: there is no
// regulator anywhere that restricts it, so unlike aspartame there is not even a
// labelling duty for the corpus to have missed. A parent scanning a jar for a
// ten-month-old must not read "no concerns found".
// ---------------------------------------------------------------------------
{
  const base = applyPopulationRisk(ing('Honey', 'low'), food);
  const infant = profile({ conditions: ['infant'] });
  const out = applyProfileToAnalysis(result([base]), infant);
  check('advisory/infant-honey', out.ingredients[0].personalRiskLevel === 'high',
    `expected personal level high for an infant profile, got ${out.ingredients[0].personalRiskLevel ?? 'none'}`);
  check('advisory/infant-honey', (out.personalFlags ?? []).length > 0,
    'no personal flag was produced, so the results screen has nothing to explain the level with');

  const adult = applyProfileToAnalysis(result([base]), profile({}));
  check('advisory/infant-honey', adult.ingredients[0].personalRiskLevel === undefined,
    `honey was personally flagged for a profile with no conditions (${adult.ingredients[0].personalRiskLevel})`);

  // Honey is food. An infant profile must not turn a honey-containing lip balm
  // into an Avoid — the botulism route is swallowing it.
  const balm = applyProfileToAnalysis(
    result([applyPopulationRisk(ing('Honey', 'low'), 'personal_care')], 'personal_care'),
    infant,
  );
  check('advisory/infant-honey', balm.ingredients[0].personalRiskLevel === undefined,
    'a food-domain advisory fired on a personal care label');
}

// ---------------------------------------------------------------------------
// 5. Negation. "Sugar free" must not pick up the free-sugars record.
//
// The matcher is word-boundary and negation-aware for exactly this reason: a
// bare substring match would rate a sugar-free product as if it were sugar.
// ---------------------------------------------------------------------------
for (const name of ['Sugar Free Sweetener', 'No Added Sugar Cocoa', 'Salt Substitute']) {
  const out = applyPopulationRisk(ing(name, 'low'), food);
  check(`negation/${name}`, out.riskSource === 'model',
    `matched a record (${out.policyRuleIds?.join(', ')}) and became ${out.riskLevel} — a negated term must not match the substance it negates`);
}

// Positive controls, without which the three checks above would also pass if
// the matcher matched nothing at all. A negation rule that is too greedy fails
// silently in the more dangerous direction: real sugar stops being recognised.
for (const name of ['Brown Sugar', 'Cane Sugar', 'Glucose Syrup']) {
  const out = applyPopulationRisk(ing(name, 'low'), food);
  check(`negation-control/${name}`, out.riskSource === 'record',
    `did NOT match its record — the negation rules have become greedy enough to swallow real matches`);
}

// ---------------------------------------------------------------------------
// 5b. Non-English label forms reach the same records as their English names.
//
// Cross-language reading is the product's reason to exist, and the registry was
// quietly English-first: 白砂糖 resolved to the sugar record while a bare 糖 did
// not, so a Chinese label fell back to the model for substances we hold
// published guidance on.
// ---------------------------------------------------------------------------
const translated: Array<[string, RiskLevel]> = [
  ['糖', 'moderate'],            // sugar
  ['蔗糖', 'moderate'],           // sucrose
  ['糖蜜', 'moderate'],           // molasses
  ['磷脂', 'low'],                // lecithin, as declared on Chinese labels
  ['部分氢化油', 'high'],           // partially hydrogenated oil
  ['azúcar blanca', 'moderate'],
  ['melaza', 'moderate'],
  ['lecitina de soja', 'low'],
  ['aceite parcialmente hidrogenado', 'high'],
];
for (const [name, expected] of translated) {
  const out = applyPopulationRisk(ing(name, 'moderate'), food);
  check(`translated/${name}`, out.riskSource === 'record',
    `did not reach a record, so a non-English label gets the model's guess where an English one gets published guidance`);
  check(`translated/${name}`, out.riskLevel === expected,
    `expected ${expected}, got ${out.riskLevel}`);
}

// ...and lookalikes must NOT resolve. Aliases are exact-match, which is what
// keeps this safe, but the failure would be silent and in the worst direction:
// 乳糖 (lactose) and 焦糖色 (caramel colour) both contain the character 糖, and
// fully hydrogenated oil contains essentially no trans fat — giving it the WHO
// elimination level would invent a high risk that no source supports.
const lookalikes = ['乳糖', '焦糖色', '木糖醇', '麦芽糖', '氢化植物油', '完全氢化油',
                    'aceite totalmente hidrogenado', 'aceite hidrogenado'];
for (const name of lookalikes) {
  const out = applyPopulationRisk(ing(name, 'moderate'), food);
  check(`lookalike/${name}`, out.riskSource === 'model',
    `resolved to a record (${out.policyRuleIds?.join(', ')}) and became ${out.riskLevel} — ` +
      `this ingredient only resembles one we hold a record for`);
}

// ---------------------------------------------------------------------------
// 5c. An authorisation must never outrank a hazard finding.
//
// The EU cosmetic annexes IV–VI are positive lists, imported as `permitted`,
// which is the lowest-precedence signal there is. A substance can appear on an
// allow-list AND carry a carcinogen listing; if `permitted` ever won, the app
// would print "no concerns found" over a published hazard. This is the single
// most dangerous thing the corpus could do, so it is asserted rather than
// assumed from rule ordering.
// ---------------------------------------------------------------------------
for (const name of ['Formaldehyde', 'Hydroquinone']) {
  const out = applyPopulationRisk(ing(name, 'low'), cosmetic);
  check(`authorisation-precedence/${name}`, out.riskSource === 'record',
    `expected a record to decide this, got ${out.riskSource}`);
  check(`authorisation-precedence/${name}`, out.riskLevel !== 'low',
    `rated LOW despite a hazard record — an allow-list entry has outranked a hazard finding (rules fired: ${out.policyRuleIds?.join(', ')})`);
}

// ---------------------------------------------------------------------------
// 6. Domain scoping. A cosmetic record must not decide a food level.
// ---------------------------------------------------------------------------
{
  const asFood = applyPopulationRisk(ing('Methylisothiazolinone', 'moderate'), food);
  const asCosmetic = applyPopulationRisk(ing('Methylisothiazolinone', 'moderate'), cosmetic);
  notes.push(`Methylisothiazolinone — food: ${asFood.riskLevel}/${asFood.riskSource}, cosmetic: ${asCosmetic.riskLevel}/${asCosmetic.riskSource}`);
}

// ---------------------------------------------------------------------------
// 7. overallRisk is the worst DISPLAYED level.
//
// The verdict word on the card comes from this. If it lags the rows, the card
// says Safe over a red row — the single most damaging inconsistency available.
// ---------------------------------------------------------------------------
{
  const ingredients = [
    applyPopulationRisk(ing('Water', 'low'), food),
    applyPopulationRisk(ing('Sesame Seeds', 'low'), food),
    applyPopulationRisk(ing('Cocoa Mass', 'low'), food),
  ];
  const out = applyProfileToAnalysis(result(ingredients), allergyProfile);
  const worst = out.ingredients.reduce<RiskLevel>(
    (acc, i) => (rank[i.riskLevel] > rank[acc] ? i.riskLevel : acc), 'low' as RiskLevel);
  check('overall/worst-displayed', out.overallRisk === worst,
    `overallRisk is ${out.overallRisk} but the worst displayed row is ${worst}`);
}

// ---------------------------------------------------------------------------
// 8. Label rank describes the label, never the risk.
//
// Rank is derived per product and must not move a level. If it ever does, a
// verdict starts depending on where an ingredient sat in a list.
// ---------------------------------------------------------------------------
{
  const names = ['Sugar', 'Wheat Flour', 'Palm Oil', 'Salt', 'Cocoa Powder', 'Lecithin'];
  const before = names.map((n) => applyPopulationRisk(ing(n, 'low'), food));
  const ranked = withLabelRanks(result(before));
  check('rank/does-not-move-levels',
    ranked.ingredients.every((i, idx) => i.riskLevel === before[idx].riskLevel &&
      i.universalRiskLevel === before[idx].universalRiskLevel),
    'assigning label ranks changed a risk level');
  const withRank = ranked.ingredients.filter((i) => i.labelRank);
  notes.push(`label rank assigned to ${withRank.length}/${names.length} ingredients on a ${names.length}-item list`);
}

// ---------------------------------------------------------------------------
// M2. Sub-ingredients are never given a position on the printed list.
//
// A label reading "Enriched Flour (Wheat Flour, Niacin, Reduced Iron), Sugar,
// Palm Oil, Salt, Cocoa" prints FIVE ingredients. The analysis walks into the
// bracket, because that is where allergens hide, and so sees eight.
//
// Ranking against the eight made niacin the third ingredient of the product —
// a trace fortifier inside the first, reported as one of the three heaviest
// things in the jar, on a card whose whole claim is that position means dose.
// Nothing caught it: the reader and the analyzer agreed on the same flattened
// list, so they lined up perfectly and the rank was confidently wrong.
// ---------------------------------------------------------------------------
{
  const printed = ['Enriched Flour', 'Sugar', 'Palm Oil', 'Salt', 'Cocoa'];
  const parts = ['Wheat Flour', 'Niacin', 'Reduced Iron'];
  // The analyser's view: every printed entry plus everything in the bracket.
  const analysed = [printed[0], ...parts, ...printed.slice(1)];

  const flat = result(analysed.map((n) => ing(n, 'low')));
  const nested = withLabelRanks({
    ...flat,
    composition: [
      { name: 'Enriched Flour', parts },
      ...printed.slice(1).map((name) => ({ name, parts: [] })),
    ],
  } as AnalysisResult);

  const rankOf = (name: string) =>
    nested.ingredients.find((i) => i.name === name)?.labelRank;

  check('composition/sub-ingredient-unranked',
    parts.every((name) => rankOf(name) === undefined),
    `a sub-ingredient was given a position on the printed list: ${
      parts.map((n) => `${n}=${JSON.stringify(rankOf(n))}`).join(', ')}`);

  check('composition/parent-keeps-its-rank',
    rankOf('Enriched Flour')?.rank === 1,
    `the bracketed parent lost its own position: ${JSON.stringify(rankOf('Enriched Flour'))}`);

  check('composition/total-is-the-printed-count',
    rankOf('Sugar')?.total === printed.length,
    `rank total counted sub-ingredients: ${JSON.stringify(rankOf('Sugar'))}`);

  check('composition/order-survives-the-bracket',
    rankOf('Sugar')?.rank === 2 && rankOf('Cocoa')?.rank === printed.length,
    `positions shifted around the bracket: sugar=${JSON.stringify(rankOf('Sugar'))} cocoa=${JSON.stringify(rankOf('Cocoa'))}`);

  // The old behaviour, kept as the thing being guarded against: with no
  // composition the flat list is all there is, and niacin lands third.
  const legacy = withLabelRanks(flat);
  const niacin = legacy.ingredients.find((i) => i.name === 'Niacin')?.labelRank;
  notes.push(`without composition, "Niacin" ranks ${niacin ? `${niacin.rank} of ${niacin.total}` : 'unranked'} — the behaviour composition exists to fix`);
}

// ---------------------------------------------------------------------------
// M2b. A real label, transcribed from the packet.
//
// Trader Joe's coffee-glazed pretzels — four printed ingredients, three of
// them compound, one bracket nested two deep. Kept as a fixture because it is
// the shape that broke: flattened, this label is 24 ingredients, and the old
// reader reported it as such.
//
// The composition here is exactly what the reader now returns for it.
// ---------------------------------------------------------------------------
{
  const label = [
    { name: 'White Candy Coating', parts: ['Sugar', 'Palm Kernel Oil', 'Nonfat Milk Powder', 'Whole Milk Powder', 'Whey Powder', 'Palm Oil', 'Soy Lecithin', 'Natural Vanilla Flavor'] },
    { name: 'Pretzels', parts: ['Unbleached Enriched Flour', 'Wheat Flour', 'Niacin', 'Reduced Iron', 'Thiamine Mononitrate', 'Riboflavin', 'Folic Acid', 'Malted Barley Flour', 'Salt', 'Soybean Oil'] },
    { name: 'Dark Chocolatey Drizzle', parts: ['Sugar', 'Palm Kernel Oil', 'Palm Oil', 'Cocoa Powder', 'Cocoa Powder Processed With Alkali', 'Whey Powder', 'Soy Lecithin', 'Natural Vanilla Flavor'] },
    { name: 'Ground Coffee Beans', parts: [] },
  ];

  // Everything analysed: each printed entry plus every name in its bracket,
  // deduplicated the way the reader deduplicates.
  const analysed: string[] = [];
  for (const entry of label) {
    for (const name of [entry.name, ...entry.parts]) {
      if (!analysed.some((n) => n.toLowerCase() === name.toLowerCase())) analysed.push(name);
    }
  }

  const ranked = withLabelRanks({
    ...result(analysed.map((n) => ing(n, 'low'))),
    composition: label,
  } as AnalysisResult);
  const rankOf = (name: string) =>
    ranked.ingredients.find((i) => i.name === name)?.labelRank;

  check('real-label/printed-count',
    label.length === 4,
    `expected 4 printed ingredients, got ${label.length}`);
  check('real-label/analysis-still-sees-every-leaf',
    ['Wheat Flour', 'Soy Lecithin', 'Whey Powder', 'Palm Oil'].every((n) =>
      analysed.some((a) => a.toLowerCase() === n.toLowerCase())),
    'an allergen-bearing sub-ingredient did not reach the analysis');
  check('real-label/no-sub-ingredient-ranked',
    ['Wheat Flour', 'Niacin', 'Folic Acid', 'Soybean Oil'].every((n) => rankOf(n) === undefined),
    'a sub-ingredient was given a position on this label');

  // The drizzle prints "Cocoa Powder, Cocoa Powder Processed With Alkali":
  // natural and dutched cocoa, two ingredients, confirmed against the photo.
  // The reader used to strip the processing note, which made them the same
  // name twice, and deduplication then ate one of them. An ingredient printed
  // on the packet vanished, and the label eval still passed at 23 of 24
  // because its own truth file had been written from that reader's output.
  const cocoas = analysed.filter((n) => n.toLowerCase().startsWith('cocoa powder'));
  check('real-label/treated-form-is-its-own-ingredient',
    cocoas.length === 2 && cocoas.some((n) => /alkali/i.test(n)),
    `the alkali-processed cocoa was folded into plain cocoa powder: ${JSON.stringify(cocoas)}`);

  // Four printed entries, so the top two speak and the rest stay quiet.
  // "White Candy Coating, 1st of 4" is the whole story about this product —
  // there is more coating in the bag than pretzel.
  check('real-label/first-ingredient-speaks',
    isProminent(rankOf('White Candy Coating')) && rankOf('White Candy Coating')?.rank === 1,
    `the first printed ingredient is not shown as prominent: ${JSON.stringify(rankOf('White Candy Coating'))}`);
  check('real-label/third-of-four-stays-quiet',
    rankOf('Dark Chocolatey Drizzle')?.rank === 3 &&
      !isProminent(rankOf('Dark Chocolatey Drizzle')),
    `third of four should carry a rank but not be called prominent: ${JSON.stringify(rankOf('Dark Chocolatey Drizzle'))}`);

  notes.push(`real label: ${label.length} printed ingredients, ${analysed.length} analysed — the old reader called all ${analysed.length} of them ingredients`);
}

// ---------------------------------------------------------------------------
// M2c. Which positions are allowed to speak, as a table.
//
// Two numbers decide it and both were retuned when the count became the
// PRINTED count rather than the flattened one. A short list only speaks for
// its top two: third of fourteen is a statement about a product, third of four
// is nearly the end of the list.
// ---------------------------------------------------------------------------
{
  const cases: [number, number, boolean][] = [
    // [rank, total, shown]
    [1, 2, false],  // no list to have a position in
    [1, 3, true],   // shortest list that says anything
    [2, 3, true],
    [3, 3, false],  // last of three is not prominence
    [1, 4, true],
    [2, 4, true],
    [3, 4, false],  // the case the retune deliberately excludes
    [1, 5, true],
    [3, 5, true],   // third of five and up is worth naming
    [4, 5, false],
    [3, 14, true],
    [11, 14, false],
  ];
  for (const [rank, total, expected] of cases) {
    check('rank/prominence-table',
      isProminent({ rank, total }) === expected,
      `${rank} of ${total} should ${expected ? '' : 'not '}be shown`);
  }
  notes.push(`prominence: lists of ${MIN_LIST_FOR_RANK}+ speak, top 2 on a short list and top 3 from 5 up`);
}

// ---------------------------------------------------------------------------
// M2d. The app's copy of that rule agrees with the server's.
//
// mobile/src/lib/verdict.ts reimplements it, because the app cannot import
// server modules. Two copies of a threshold drift silently and the symptom is
// a rank note appearing on one screen and not another, which nobody reports.
// ---------------------------------------------------------------------------
{
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const client = fs.readFileSync(path.join(root, 'mobile/src/lib/verdict.ts'), 'utf8');
  const body = client.slice(client.indexOf('export function isProminentRank'));
  const fn = body.slice(0, body.indexOf('\n}'));
  check('rank/client-copy-agrees',
    fn.includes(`< ${MIN_LIST_FOR_RANK}`) && fn.includes('>= 5 ? 3 : 2'),
    'mobile/src/lib/verdict.ts no longer matches the server prominence rule');

  // Composition has to survive being stored and read back, and the last step
  // is the one that got missed: the column was added, the API returned it, and
  // scanToAnalysisResult rebuilt the card without it. A reopened scan then
  // counted the flattened list and dropped every "inside X" line, with nothing
  // failing anywhere. The round trip is only proven at the point it reaches
  // the screen.
  const historyLib = fs.readFileSync(path.join(root, 'mobile/src/lib/history.ts'), 'utf8');
  const rebuild = historyLib.slice(historyLib.indexOf('export function scanToAnalysisResult'));
  // Deliberately the RETURNED object, not the function body. Checking the
  // body passes on the local variable that prepares the value, so the one
  // edit that breaks this — dropping it from the return — went undetected the
  // first time this check was written.
  const returned = rebuild.slice(rebuild.indexOf('return {'), rebuild.indexOf('\n}'));
  check('composition/survives-reopening-a-scan',
    /composition/.test(returned),
    'scanToAnalysisResult returns without composition, so a reopened scan loses its brackets');
  check('composition/is-sent-when-saving',
    /composition: result\.composition/.test(historyLib),
    'saveScan no longer sends composition, so nothing reaches the new column');
}

// ---------------------------------------------------------------------------
// M3. A sub-ingredient that is ALSO printed on its own keeps its own rank.
//
// "Peanut Butter (Peanuts, Salt), Sugar, Salt, Cocoa, Oil" prints salt twice:
// once inside the peanut butter and once in its own right. The second is a
// real position on the label and must not be suppressed just because the name
// also appears in a bracket.
// ---------------------------------------------------------------------------
{
  const printed = ['Peanut Butter', 'Sugar', 'Salt', 'Cocoa', 'Oil'];
  const analysed = ['Peanut Butter', 'Peanuts', 'Salt', 'Sugar', 'Cocoa', 'Oil'];
  const ranked = withLabelRanks({
    ...result(analysed.map((n) => ing(n, 'low'))),
    composition: [
      { name: 'Peanut Butter', parts: ['Peanuts', 'Salt'] },
      ...printed.slice(1).map((name) => ({ name, parts: [] })),
    ],
  } as AnalysisResult);

  const rankOf = (name: string) =>
    ranked.ingredients.find((i) => i.name === name)?.labelRank;

  check('composition/shared-name-keeps-printed-rank',
    rankOf('Salt')?.rank === 3,
    `salt is printed third in its own right but ranked ${JSON.stringify(rankOf('Salt'))}`);
  check('composition/bracket-only-name-unranked',
    rankOf('Peanuts') === undefined,
    `peanuts is only inside a bracket but was ranked ${JSON.stringify(rankOf('Peanuts'))}`);
}

// ---------------------------------------------------------------------------
// N. Every personal flag names the row it actually belongs to.
//
// The app pairs a flag to an ingredient row. It used to do that by name, and
// where the name did not match, by POSITION in `canonicalIngredients` —
// guarded only by that list being the same length as `ingredients`. Equal
// length is not alignment: the reader's list is the label's printed order and
// the analyzer's is its own, so a single split or merged entry shifts every
// position after it.
//
// On a real 63-ingredient curry roux that put "Milk" flags on Dextrin,
// Enzymes, Citric Acid and Maltose — each sitting directly beside a genuine
// dairy row. The person reading it has a milk intolerance and four ingredients
// that are fine for them were reported as ones that are not.
//
// The flag now carries the row index the server tagged it with. This asserts
// the pairing survives a deliberately misaligned canonical list, which is the
// exact shape that broke it.
// ---------------------------------------------------------------------------
{
  const milkProfile = profile({ allergens: [{ allergen: 'milk', severity: 'intolerance' }] });
  const names = ['Cheese', 'Dextrin', 'Cheese Cultures', 'Enzymes', 'Whey Powder', 'Maltose'];
  const rows = names.map((n) => ing(n, 'low'));

  const base = result(rows);
  // Same length, deliberately shifted — one entry merged upstream is all it
  // takes for the printed list and the analyzed list to stop corresponding.
  const misaligned = { ...base, canonicalIngredients: ['Milk', ...names.slice(0, names.length - 1)] };

  const out = applyProfileToAnalysis(misaligned as AnalysisResult, milkProfile);
  const dairy = new Set(['Cheese', 'Cheese Cultures', 'Whey Powder']);

  for (const flag of out.personalFlags ?? []) {
    if (flag.type !== 'allergen') continue;
    // A flag that belongs to a row MUST carry its index. Without this the
    // loop below would pass by skipping everything, and the client would fall
    // back to guessing — which is the bug.
    const belongsToRow = out.ingredients.some((r) => r.name === flag.ingredientName);
    check('flag-row/row-flag-carries-index',
      !belongsToRow || flag.ingredientIndex !== undefined,
      `flag for "${flag.ingredientName}" names a row but carries no ingredientIndex`);
    if (flag.ingredientIndex === undefined) continue;
    const row = out.ingredients[flag.ingredientIndex];
    check('flag-row/index-names-its-own-row',
      row?.name === flag.ingredientName,
      `flag for "${flag.ingredientName}" points at index ${flag.ingredientIndex}, which is "${row?.name}"`);
    check('flag-row/no-dairy-free-row-flagged',
      dairy.has(row?.name ?? ''),
      `"${row?.name}" contains no milk but carries a milk flag`);
  }

  const flagged = new Set((out.personalFlags ?? []).map((f) => f.ingredientName));
  for (const clean of ['Dextrin', 'Enzymes', 'Maltose']) {
    check('flag-row/clean-row-unflagged', !flagged.has(clean),
      `"${clean}" was flagged for milk`);
  }
  notes.push(`personal flags pair to rows by index across a misaligned canonical list (${names.length} rows)`);
}

// ---------------------------------------------------------------------------
// Allergen coverage — the guard against a silently inert allergen.
//
// A profile allergen with no keyword list produces no flag AND no error. That
// is how six declarable allergens (molluscs, sulphites, mustard, celery, lupin,
// buckwheat) sat unmatchable behind a picker that offered nine. Three things
// have to agree or the picker lies: the matcher's list, the app's list, and the
// translation catalogue.
// ---------------------------------------------------------------------------
{
  for (const allergen of MAJOR_ALLERGENS) {
    check('allergen-cover/has-keywords',
      (ALLERGEN_KEYWORDS[allergen]?.length ?? 0) > 0,
      `"${allergen}" is offered as a major allergen but has no keyword list`);
  }

  // The app ships its own copy of the list (mobile cannot import from server/).
  // Read it as text rather than importing: this file is CommonJS-land tsx and
  // the app is an Expo module graph, and the only thing worth asserting is that
  // the two literals say the same thing.
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const mobileTypes = fs.readFileSync(path.join(repoRoot, 'mobile/src/lib/types.ts'), 'utf8');
  const block = mobileTypes.match(/export const MAJOR_ALLERGENS = \[([\s\S]*?)\] as const;/);
  const mobileList = (block?.[1] ?? '')
    .split(',')
    .map((entry) => entry.trim().replace(/^['"]|['"]$/g, ''))
    .filter((entry) => entry.length > 0 && !entry.startsWith('//'));

  check('allergen-cover/app-list-found', mobileList.length > 0,
    'could not parse MAJOR_ALLERGENS out of mobile/src/lib/types.ts');
  check('allergen-cover/app-list-matches',
    mobileList.join(',') === MAJOR_ALLERGENS.join(','),
    `mobile list [${mobileList.join(' ')}] != server list [${MAJOR_ALLERGENS.join(' ')}]`);

  // Every allergen needs a label in every language, or the chip renders its
  // raw matcher key — "gluten_wheat" in a picker is how a person picks wrong.
  const i18n = fs.readFileSync(path.join(repoRoot, 'mobile/src/lib/i18n.tsx'), 'utf8');
  for (const allergen of MAJOR_ALLERGENS) {
    const occurrences = i18n.split(`'allergen.${allergen}':`).length - 1;
    check('allergen-cover/translated',
      occurrences === 3,
      `"allergen.${allergen}" appears in ${occurrences} of 3 catalogues`);
  }

  notes.push(`${MAJOR_ALLERGENS.length} declarable allergens, each with keywords and 3 translations`);
}

// ---------------------------------------------------------------------------
// Allergen matching — the additions, and the lookalikes they drag in.
// ---------------------------------------------------------------------------
{
  const hits: Array<[string, string]> = [
    ['Oyster Extract', 'molluscs'],
    ['Snail Secretion Filtrate', 'molluscs'],
    ['Calamari', 'molluscs'],
    ['Potassium Metabisulphite', 'sulphites'],
    ['Sulfur Dioxide', 'sulphites'],
    ['E220', 'sulphites'],
    ['Mustard Flour', 'mustard'],
    ['Celeriac', 'celery'],
    ['Lupin Flour', 'lupin'],
    ['Buckwheat Flour', 'buckwheat'],
    ['Soba Noodles', 'buckwheat'],
  ];
  for (const [name, allergen] of hits) {
    check('allergen-match/detects',
      ingredientMatchesAllergen(name, allergen),
      `"${name}" did not match ${allergen}`);
  }

  const misses: Array<[string, string, string]> = [
    // The reason the wheat exclusion exists: 'wheat' is a bare substring of
    // 'buckwheat', so soba raised a wheat allergy flag on every label.
    ['Buckwheat Flour', 'wheat', 'buckwheat is not wheat'],
    ['Oyster Mushroom', 'molluscs', 'oyster mushroom is a fungus'],
    ['Sulphite Free Wine', 'sulphites', 'a "free" claim is not a hit'],
    ['No Added Sulfites', 'sulphites', 'a "no added" claim is not a hit'],
    // Crustaceans and molluscs are separate concepts now; neither may answer
    // for the other, or the split bought nothing.
    ['Oyster Extract', 'shellfish', 'an oyster is not a crustacean'],
    ['Shrimp Paste', 'molluscs', 'a shrimp is not a mollusc'],
    // Sulfate is not sulfite. SLS is in half the bathroom.
    ['Sodium Lauryl Sulfate', 'sulphites', 'a sulfate is not a sulphite'],
  ];
  for (const [name, allergen, why] of misses) {
    check('allergen-match/no-false-positive',
      !ingredientMatchesAllergen(name, allergen),
      `"${name}" matched ${allergen} — ${why}`);
  }

  notes.push(`${hits.length} allergen detections and ${misses.length} lookalikes hold`);
}

// ---------------------------------------------------------------------------
// Concept layer — equivalence with the matcher it replaced.
//
// `ingredientMatchesAllergen` is still exported and still the old logic, which
// makes it a free oracle: the concept layer must agree with it on every term
// case, or the Phase 1 refactor moved behaviour it promised not to move.
// Identity is allowed to differ in ONE direction — it may add a match the term
// matcher missed, never remove one.
// ---------------------------------------------------------------------------
{
  const names = [
    'Whole Milk', 'Peanut Butter', 'Coconut Milk', 'Soy Lecithin', 'Buckwheat Flour',
    'Oyster Mushroom', 'Oyster Extract', 'Sulphite Free Wine', 'Sodium Metabisulfite',
    'Cream of Tartar', 'Swedish Fish', 'Wheat Starch', 'Almond Butter', 'Water',
    'Sea Salt', 'Celeriac', 'Lupin Flour', 'Mustard Flour', 'Shrimp Paste',
    'Natural Flavour', 'Enzymes', 'Citric Acid', 'Soba Noodles', 'Krill Oil',
  ];

  let agreements = 0;
  let identityAdded = 0;
  for (const name of names) {
    for (const allergen of MAJOR_ALLERGENS) {
      const before = ingredientMatchesAllergen(name, allergen);
      const after = matchProfileAllergen(name, allergen);
      if (before && !after) {
        check('concept/no-lost-match', false,
          `"${name}" matched ${allergen} before the concept layer and does not now`);
      } else if (!before && after) {
        // Only identity may do this. A term-pass difference is a real drift.
        check('concept/only-identity-adds', after.via === 'identity',
          `"${name}" newly matches ${allergen} via ${after.via}, not identity`);
        identityAdded += 1;
      } else {
        agreements += 1;
      }
    }
  }
  notes.push(`concept layer agrees with the old matcher on ${agreements} pairs, ${identityAdded} added by identity`);

  // Custom free-text entries, which is where identity pays off today: these two
  // strings share almost nothing and denote one substance.
  const custom = matchCustomEntryByIdentity('2-Methyl-2H-isothiazol-3-one', 'Methylisothiazolinone');
  check('concept/custom-identity', custom !== null && custom.via === 'identity',
    'a profile entry written as "Methylisothiazolinone" did not match the label\'s INCI spelling');
  check('concept/custom-identity-no-false-positive',
    matchCustomEntryByIdentity('Citric Acid', 'Methylisothiazolinone') === null,
    'citric acid matched a methylisothiazolinone profile entry');
}

// ---------------------------------------------------------------------------
// Concept layer — the identity pass is actually wired, not merely present.
// ---------------------------------------------------------------------------
{
  const registry = getSubstanceRegistry();
  for (const [conceptId, identifiers] of Object.entries(CONCEPT_IDENTIFIERS_FOR_CHECK)) {
    for (const identifier of identifiers) {
      check('concept/identifier-resolves',
        registry.resolve(identifier) !== null,
        `concept "${conceptId}" names "${identifier}", which the corpus no longer resolves — ` +
        'the identity pass for this concept is silently off');
    }
  }

  const byIdentity = matchProfileAllergen('Sodium Metabisulfite', 'sulphites');
  check('concept/identity-pass-fires',
    byIdentity?.via === 'identity',
    `sulphites matched via ${byIdentity?.via ?? 'nothing'} rather than identity`);

  // Provenance has to survive, or the card cannot tell a CAS match from a
  // substring one — which is the whole reason both passes report separately.
  const byTerm = matchProfileAllergen('Potassium Metabisulphite', 'sulphites');
  check('concept/term-pass-reports-term',
    byTerm?.via === 'term',
    `expected a term match for an identifier the corpus lacks, got ${byTerm?.via ?? 'nothing'}`);
}

// ---------------------------------------------------------------------------
// Concept layer — dietary rules kept their two guards through the move.
// ---------------------------------------------------------------------------
{
  const vegan = getConcept('vegan');
  const halal = getConcept('halal');
  check('concept/diet-registered', !!vegan && !!halal, 'dietary concepts missing from the registry');

  if (vegan && halal) {
    // Negation. The dietary vocabulary is what packaging prints in the negative.
    check('concept/diet-negation',
      matchConcept('Sugar Free Syrup', vegan) === null,
      '"Sugar Free Syrup" matched the vegan verify list');
    check('concept/diet-negation-halal',
      matchConcept('Alcohol Free Vanilla', halal) === null,
      '"Alcohol Free Vanilla" matched halal');
    // Borrowed allergen exclusions. "butter" is on the vegan definite list.
    check('concept/diet-borrows-exclusions',
      matchConcept('Peanut Butter', vegan) === null,
      '"Peanut Butter" matched vegan via the dairy keyword "butter"');
    // And the rules still fire on what they should.
    check('concept/diet-still-fires',
      matchConcept('Gelatin', vegan)?.certainty === 'definite',
      'gelatin no longer reads as definitely not vegan');
    check('concept/diet-verify-tier',
      matchConcept('Natural Flavor', vegan)?.certainty === 'verify',
      'natural flavour lost its verify tier');
  }

  check('concept/registry-size', listConcepts().length === MAJOR_ALLERGENS.length + 5,
    `expected ${MAJOR_ALLERGENS.length} allergens + 5 diets, got ${listConcepts().length}`);
  notes.push(`${listConcepts().length} concepts registered, dietary negation and borrowed exclusions intact`);
}

// ---------------------------------------------------------------------------
// Traces — a "may contain" line warns on every entry.
//
// A per-entry `traces` policy existed for one day and shipped in builds 6 and
// 7, so some stored entries carry `traces: 'ignore'`. Those rows are never
// rewritten and there is no UI left to change them, so an ignored policy must
// stay ignored — otherwise an allergen someone set months ago would be silently
// quieter than the identical allergen set today.
// ---------------------------------------------------------------------------
{
  const label = {
    ...result([ing('Rice Flour', 'low'), ing('Sugar', 'low')]),
    declaredAllergens: { contains: [], mayContain: ['milk'] },
  };
  const traceFlags = (allergens: any) =>
    (applyProfileToAnalysis(label, profile({ allergens })).personalFlags ?? [])
      .filter(f => f.reasonKey === 'flag.mayContain');

  // Every severity warns, including the two the removed default kept quiet.
  for (const severity of ['anaphylaxis', 'allergy', 'intolerance', 'avoid'] as const) {
    check('traces/every-severity-warns',
      traceFlags([{ allergen: 'milk', severity }]).length === 1,
      `a ${severity} milk entry was not warned about trace milk`);
  }

  // A stored policy from the removed control cannot make an entry quieter.
  check('traces/stored-policy-ignored',
    traceFlags([{ allergen: 'milk', severity: 'intolerance', traces: 'ignore' }]).length === 1,
    'an entry stored with traces: ignore stayed quiet about trace milk');

  // A trace is still not presence: the flag stays `verify`, so the card can
  // present it as a cross-contamination warning rather than an ingredient.
  check('traces/stay-verify',
    traceFlags([{ allergen: 'milk', severity: 'allergy' }]).every(f => f.certainty === 'verify'),
    'a trace flag was reported as definite');

  notes.push('every allergen entry warns on traces; a stored trace policy is ignored');
}

// ---------------------------------------------------------------------------
// Unsettled rules — a clean ingredient list is not a certificate.
//
// Halal and kosher turn on slaughter method and supervision. Before this, a
// kosher profile scanning a gelatin product got overallRisk 'low', which the
// card renders as "Safe" under a seal reading CLEARED — a false statement about
// someone's own religious practice, not a rounding error.
// ---------------------------------------------------------------------------
{
  const clean = result([ing('Sugar', 'low'), ing('Water', 'low')]);
  const gelatin = result([ing('Sugar', 'low'), ing('Gelatin', 'low')]);
  const pork = result([ing('Sugar', 'low'), ing('Pork Fat', 'low')]);

  const kosher = (r: AnalysisResult) =>
    applyProfileToAnalysis(r, profile({ dietaryRules: ['kosher'] }));

  check('unsettled/clean-list-is-not-a-pass',
    (kosher(clean).unsettled ?? []).includes('kosher'),
    'a kosher profile read a list with no violations as settled');
  check('unsettled/verify-hit-unsettled',
    (kosher(gelatin).unsettled ?? []).includes('kosher'),
    'gelatin did not leave the kosher question unsettled');

  // A definite violation SETTLES the question, in the negative. Pork needs no
  // certificate to be wrong, and reporting it as "we cannot say" would be
  // weaker than the truth.
  const withPork = kosher(pork);
  check('unsettled/definite-violation-settles',
    !(withPork.unsettled ?? []).includes('kosher'),
    'a definite pork violation was reported as merely unsettled');
  check('unsettled/definite-violation-still-raises',
    withPork.overallRisk !== 'low',
    'pork left a kosher verdict at low');

  // Ingredient-determinable rules are unaffected: a clean list really is an
  // answer for vegan, and marking it unsettled would be crying wolf.
  const vegan = applyProfileToAnalysis(clean, profile({ dietaryRules: ['vegan'] }));
  check('unsettled/ingredient-rules-untouched',
    (vegan.unsettled ?? []).length === 0,
    'a clean list left the vegan question unsettled');

  // And a profile with no dietary rules never acquires one.
  check('unsettled/absent-without-rules',
    (applyProfileToAnalysis(clean, profile({})).unsettled ?? []).length === 0,
    'a profile with no dietary rules reported an unsettled rule');

  notes.push('certification rules stay unsettled on a clean list; definite violations still settle them');
}

// ---------------------------------------------------------------------------
// Stored profile shapes — every profile behaves conservatively, whichever way
// it was written.
//
// A per-entry strictness control existed for one day (2026-08-23) and shipped in
// build 6 before being removed. Profiles saved by that build hold
// `{ rule, strictness }` objects. They are never rewritten, so the reader has to
// keep understanding them — and must ignore the strictness, or a profile saved
// as "relaxed" would stay quieter than every other profile forever.
// ---------------------------------------------------------------------------
{
  // "Enzymes" is on the vegetarian VERIFY list — sourcing doubt, the tier the
  // removed control used to suppress. If an entry-shaped profile still honoured
  // it, this is where that would show.
  const sourcingDoubt = result([ing('Sugar', 'low'), ing('Enzymes', 'low')]);

  const flagsFor = (rules: any) =>
    applyProfileToAnalysis(sourcingDoubt, profile({ dietaryRules: rules })).personalFlags ?? [];

  const bare = flagsFor(['vegetarian']);
  check('profile-shape/bare-string-raises-doubt',
    bare.some(f => f.certainty === 'verify'),
    'a rule stored as a bare string stopped raising sourcing doubt');

  for (const stored of [
    [{ rule: 'vegetarian' }],
    [{ rule: 'vegetarian', strictness: 'strict' }],
    [{ rule: 'vegetarian', strictness: 'relaxed' }],
  ]) {
    check('profile-shape/entry-matches-bare',
      flagsFor(stored).length === bare.length,
      `a profile stored as ${JSON.stringify(stored)} behaved differently from a bare rule`);
  }

  // Same for conditions: a stored "relaxed" must not keep a caution advisory
  // from moving the verdict.
  const salty = result([ing('Sodium Chloride', 'low'), ing('Sugar', 'low')]);
  const conditionRisk = (conditions: any) =>
    applyProfileToAnalysis(salty, profile({ conditions })).overallRisk;

  check('profile-shape/condition-bare-raises',
    conditionRisk(['hypertension']) !== 'low',
    'a condition stored as a bare string stopped raising the verdict');
  check('profile-shape/condition-entry-matches',
    conditionRisk([{ condition: 'hypertension', strictness: 'relaxed' }]) ===
      conditionRisk(['hypertension']),
    'a condition stored with strictness: relaxed stayed quieter than a bare one');

  notes.push('bare and entry-shaped profiles behave identically; a stored strictness is ignored');
}

// ---------------------------------------------------------------------------
// M4. A printed "CONTAINS" line survives the model forgetting to structure it.
//
// The reader returns declared allergens as a structured field, and returns
// them most of the time. Reading one chocolate bar five times produced the soy
// declaration four times and nothing the fifth, with no error and no
// difference in the response otherwise. The ingredient list said "lecithin",
// which is exactly the name a soy declaration exists to disambiguate.
//
// So the verbatim transcription is parsed too. These cases are the contract:
// what must be recovered, and what must never be promoted.
// ---------------------------------------------------------------------------
{
  const recovered = (text: string) =>
    [...allergensFromDeclaration(containsStatementsFromText(text))].sort();

  const cases: [string, string, string[]][] = [
    ['english', 'INGREDIENTS: SUGAR, LECITHIN. CONTAINS MILK, SOY, WHEAT.', ['milk', 'soy', 'wheat']],
    ['english-colon', 'Contains: Peanuts and Almonds', ['peanut', 'tree_nuts']],
    ['spanish', 'INGREDIENTES: AZUCAR, LECITINA. CONTIENE LECHE Y SOJA.', ['milk', 'soy']],
    ['chinese', '配料：白砂糖、卵磷脂。含有大豆、小麦。', ['soy', 'wheat']],
    // The sacha tofu label, in traditional characters, with the allergens
    // listed straight after 過敏原資訊 and no 含有 in the line at all. Both
    // halves of that broke: the marker and every term it needed.
    ['chinese-traditional',
      '成分：豆乾、沙茶醬。過敏原資訊：本產品含有大豆、魚類、甲殼類、小麥、堅果類、芝麻。',
      ['fish', 'sesame', 'shellfish', 'soy', 'tree_nuts', 'wheat']],
    ['chinese-traditional-bare-heading',
      '過敏原資訊：大豆、魚類、芝麻',
      ['fish', 'sesame', 'soy']],
    ['japanese', '原材料：砂糖、植物油脂（一部に小麦・乳成分・大豆を含む）', ['milk', 'soy', 'wheat']],
    ['russian', 'СОСТАВ: САХАР, ЛЕЦИТИН. СОДЕРЖИТ МОЛОКО И СОЮ.', ['milk', 'soy']],
  ];
  for (const [name, text, expected] of cases) {
    check(`declaration-backstop/${name}`,
      JSON.stringify(recovered(text)) === JSON.stringify(expected.sort()),
      `expected ${JSON.stringify(expected)}, recovered ${JSON.stringify(recovered(text))} from ${text}`);
  }

  // A hedge is not a declaration. Promoting these would mark most of a
  // supermarket unsafe for anyone with a serious allergy, which is the fastest
  // way to teach someone to ignore the warnings that matter.
  const hedges: [string, string][] = [
    ['english', 'MAY CONTAIN PEANUTS, TREE NUTS.'],
    ['english-traces', 'May contain traces of milk.'],
    ['spanish', 'Puede contener leche.'],
    ['chinese', '可能含有花生。'],
    // The heading is a declaration heading, but what follows it is a hedge.
    // Reading the allergens out regardless would turn every "may contain"
    // block on a Taiwanese label into a statement of presence.
    ['chinese-traditional-heading-then-hedge', '過敏原資訊：本產品可能含有花生、堅果類。'],
    ['japanese', '本品は落花生を含む可能性があります。'],
    ['russian', 'Может содержать молоко.'],
  ];
  for (const [name, text] of hedges) {
    check(`declaration-backstop/hedge-ignored-${name}`,
      recovered(text).length === 0,
      `a "may contain" line was promoted to a declaration: ${text} -> ${JSON.stringify(recovered(text))}`);
  }

  // Both statements on one label: the declaration is taken, the hedge is not.
  const mixed = recovered('CONTAINS MILK. MAY CONTAIN PEANUTS.');
  check('declaration-backstop/declaration-and-hedge-together',
    JSON.stringify(mixed) === JSON.stringify(['milk']),
    `expected ["milk"] only, got ${JSON.stringify(mixed)}`);

  notes.push(`declaration backstop reads ${cases.length} languages out of the raw transcription, and ignores every hedge`);
}

// ---------------------------------------------------------------------------

for (const n of notes) console.log(`  · ${n}`);
if (notes.length) console.log('');
for (const e of errors) console.error(`  ✗ ${e}`);

if (errors.length > 0) {
  console.error(`\n[RISK] FAILED with ${errors.length} error(s)`);
  process.exit(1);
}
console.log('[RISK] all deterministic risk checks passed');
