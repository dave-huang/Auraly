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
  ingredientMatchesAllergen,
} from '../server/services/allergenMatcher';
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
import { withLabelRanks } from '../server/services/labelRank';
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

for (const n of notes) console.log(`  · ${n}`);
if (notes.length) console.log('');
for (const e of errors) console.error(`  ✗ ${e}`);

if (errors.length > 0) {
  console.error(`\n[RISK] FAILED with ${errors.length} error(s)`);
  process.exit(1);
}
console.log('[RISK] all deterministic risk checks passed');
