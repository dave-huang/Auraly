// Offline checks for the eval harness itself.
//
// `npm run eval` makes one real vision-model call per case, so it is slow and
// costs money. This script checks the parts that need neither: that the scorer
// counts correctly, and that the ground-truth files are internally consistent.
// Run it on every change to scoring.ts or a case.json.
//
// Exit codes: 0 = pass · 1 = a check failed.

import { readdirSync, readFileSync, existsSync } from 'fs';
import path from 'path';

import {
  scoreCase,
  normalizeIngredientName,
  detectAllergens,
  MAJOR_ALLERGENS,
  type MajorAllergen,
} from './scoring';
import { allergensFromDeclaration } from '../server/services/allergenMatcher';

const CASES_DIR = path.join(process.cwd(), 'eval/cases');

interface EvalCase {
  id: string;
  image: string;
  description?: string;
  verified?: boolean;
  crossCheckedAgainstPhoto?: string;
  truth: { ingredients: string[]; majorAllergens: MajorAllergen[] };
}

const errors: string[] = [];
const warnings: string[] = [];

function fail(msg: string) {
  errors.push(msg);
}
function warn(msg: string) {
  warnings.push(msg);
}

const cases: EvalCase[] = readdirSync(CASES_DIR)
  .filter((d) => existsSync(path.join(CASES_DIR, d, 'case.json')))
  .map((d) => ({
    id: d,
    ...JSON.parse(readFileSync(path.join(CASES_DIR, d, 'case.json'), 'utf-8')),
  }));

console.log(`[CHECK] ${cases.length} eval cases\n`);

// ---------------------------------------------------------------------------
// 1. A perfect extraction must score perfectly.
//
// Feeding a case's own truth list back in as the extraction is the one input
// whose answer is known exactly. If this is not 100/100 the scorer is losing
// real matches, and every recall number it has ever printed was too low.
// ---------------------------------------------------------------------------
for (const c of cases) {
  const s = scoreCase(c.truth.ingredients, c.truth.majorAllergens, c.truth.ingredients, []);
  if (s.recall !== 1 || s.precision !== 1) {
    fail(
      `${c.id}: feeding truth back in scores recall ${(s.recall * 100).toFixed(1)}% / ` +
        `precision ${(s.precision * 100).toFixed(1)}%, expected 100/100. ` +
        `missed=[${s.missedIngredients.join(', ')}] extra=[${s.extraIngredients.join(', ')}]`,
    );
  }
}

// ---------------------------------------------------------------------------
// 2. Matching must be one-to-one.
//
// N extracted ingredients can never satisfy more than N truth entries. Without
// this, one generic word ("Garlic") is credited for every truth entry that
// contains it ("Garlic Extract", "Garlic Powder", "Garlic Flake", ...) and
// recall reads far higher than the read deserves.
// ---------------------------------------------------------------------------
for (const c of cases) {
  const generic = ['Sugar', 'Salt', 'Cheese', 'Garlic', 'Onion Powder', 'Water', 'Palm Oil', 'Water'];
  const s = scoreCase(c.truth.ingredients, c.truth.majorAllergens, generic, []);
  if (s.matched > generic.length) {
    fail(
      `${c.id}: ${generic.length} extracted ingredients were credited for ${s.matched} truth ` +
        `entries — matching is not one-to-one, so recall is inflated.`,
    );
  }
}

// ---------------------------------------------------------------------------
// 3. Where does each truth allergen actually come from?
//
// An allergen inferable from an ingredient name is caught even if the reader
// misses the "Contains:" line. One that depends on the declaration is only
// caught if that line is read, which is a strictly weaker guarantee — worth
// knowing per case, since allergen recall is the release blocker.
// ---------------------------------------------------------------------------
for (const c of cases) {
  const fromIngredients = detectAllergens(c.truth.ingredients);
  const declarationOnly = c.truth.majorAllergens.filter((a) => !fromIngredients.has(a));
  if (declarationOnly.length > 0) {
    warn(
      `${c.id}: ${declarationOnly.join(', ')} ${declarationOnly.length === 1 ? 'is' : 'are'} ` +
        `not inferable from the truth ingredient names — detection depends on reading the ` +
        `label's own declaration.`,
    );
  }
  const unknown = c.truth.majorAllergens.filter((a) => !MAJOR_ALLERGENS.includes(a));
  if (unknown.length > 0) fail(`${c.id}: unknown allergen key(s) ${unknown.join(', ')}`);
}

// ---------------------------------------------------------------------------
// 4. Truth lists must not contain entries that normalize identically.
//
// Two entries collapsing to one string means one of them can never be scored
// independently, so the case silently measures one fewer ingredient than it
// claims to.
// ---------------------------------------------------------------------------
for (const c of cases) {
  const byNorm = new Map<string, string[]>();
  for (const name of c.truth.ingredients) {
    const n = normalizeIngredientName(name);
    byNorm.set(n, [...(byNorm.get(n) ?? []), name]);
  }
  for (const [n, names] of byNorm) {
    if (names.length > 1) {
      warn(`${c.id}: ${names.map((x) => `"${x}"`).join(' and ')} both normalize to "${n}"`);
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Images must exist, and unverified truth must stay visible.
// ---------------------------------------------------------------------------
for (const c of cases) {
  if (!existsSync(path.join(process.cwd(), c.image))) {
    fail(`${c.id}: image not found at ${c.image}`);
  }
}

// `crossCheckedAgainstPhoto` and `verified` are NOT the same claim and the
// weaker one must not be allowed to read as the stronger. Cross-checked means
// the transcription was compared against the photo — which catches dropped and
// mistranslated ingredients, and did. Verified means a human held the physical
// packet. Only a human can set `verified`, because a model confirming its own
// transcription from the same image it transcribed proves nothing about the
// cases where the image itself is ambiguous.
const unverified = cases.filter((c) => !c.verified);
const crossChecked = unverified.filter((c) => c.crossCheckedAgainstPhoto);
const unchecked = unverified.filter((c) => !c.crossCheckedAgainstPhoto);
if (crossChecked.length > 0) {
  warn(
    `${crossChecked.length}/${cases.length} cases are cross-checked against the photo but ` +
      `still need a human to confirm against the physical label before verified:true — ` +
      `${crossChecked.map((c) => c.id).join(', ')}`,
  );
}
if (unchecked.length > 0) {
  warn(
    `${unchecked.length}/${cases.length} cases have neither been cross-checked nor verified — ` +
      `their truth is an unreviewed transcription: ${unchecked.map((c) => c.id).join(', ')}`,
  );
}

// Sanity: the declaration parser should agree with itself on a plain input.
if (!allergensFromDeclaration(['milk', 'wheat']).has('milk')) {
  fail('allergensFromDeclaration failed to parse a plain "milk" declaration');
}

// ---------------------------------------------------------------------------

for (const w of warnings) console.log(`  ⚠ ${w}`);
if (warnings.length > 0) console.log('');
for (const e of errors) console.error(`  ✗ ${e}`);

if (errors.length > 0) {
  console.error(`\n[CHECK] FAILED with ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
}
console.log(`[CHECK] passed with ${warnings.length} warning(s)`);
