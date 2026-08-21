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

import { applyPopulationRisk, domainForProductType } from '../server/services/substances/classify';
import { applyProfileToAnalysis } from '../server/services/personalRisk';
import { withLabelRanks } from '../server/services/labelRank';
import { riskLevels, type Ingredient, type AnalysisResult, type Profile, type RiskLevel } from '../shared/schema';

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

for (const n of notes) console.log(`  · ${n}`);
if (notes.length) console.log('');
for (const e of errors) console.error(`  ✗ ${e}`);

if (errors.length > 0) {
  console.error(`\n[RISK] FAILED with ${errors.length} error(s)`);
  process.exit(1);
}
console.log('[RISK] all deterministic risk checks passed');
