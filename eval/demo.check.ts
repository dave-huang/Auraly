import { demoAnalysis, type DemoLanguage } from '../server/demoScan';
import { applyProfileToAnalysis, annotateWithCitations } from '../server/services/personalRisk';
import { withLabelRanks } from '../server/services/labelRank';
import type { AnalysisResult, Profile } from '../shared/schema';

/**
 * The onboarding example scan must keep finding things.
 *
 * The label in server/demoScan.ts is a fixture, but the verdict over it is
 * real matcher output — which is exactly why this file exists. Nothing in the
 * fixture declares "this row is the milk one". The milk flag happens because
 * the string "Sodium Caseinate" contains "casein", and it would stop happening
 * silently if either side were reworded. The demo would go on rendering
 * perfectly, showing a clean verdict to a person with a milk allergy, at the
 * exact moment the app is asking them to trust it.
 *
 * So: assert the finds, not the wording.
 */

const errors: string[] = [];
function check(label: string, ok: boolean, detail: string) {
  if (!ok) errors.push(`${label}: ${detail}`);
}

function scored(profile: Partial<Profile> | null, language: DemoLanguage = 'en'): AnalysisResult {
  const base = withLabelRanks(annotateWithCitations(demoAnalysis(language)));
  if (!profile) return base;
  return applyProfileToAnalysis(base, {
    id: 'inline',
    userId: 'inline',
    name: 'Check',
    isDefault: true,
    allergens: [],
    dietaryRules: [],
    conditions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...profile,
  } as Profile);
}

function flagged(result: AnalysisResult, match: string): boolean {
  return (result.personalFlags ?? []).some((flag) => flag.match === match);
}

// ---- the label itself -------------------------------------------------

for (const language of ['en', 'zh', 'es'] as const) {
  const result = demoAnalysis(language);
  check(`label/${language}/rows`, result.ingredients.length >= 8,
    'the example label got short enough to stop being a convincing ingredient list');
  check(`label/${language}/canonical-aligned`,
    result.canonicalIngredients?.length === result.ingredients.length,
    'canonicalIngredients and ingredients fell out of step — allergen matching runs on the canonical list, so a mismatch mis-attributes every flag after it');
  check(`label/${language}/original-aligned`,
    result.originalIngredients?.length === result.ingredients.length,
    'originalIngredients fell out of step with the displayed list, so the bilingual pairs would be wrong');
  check(`label/${language}/translated`,
    result.ingredients.every((ing) => ing.name && ing.summary && ing.details),
    'an ingredient is missing copy in this language');
  check(`label/${language}/lines`,
    result.lineCount?.total === result.ingredients.length,
    'the line count no longer matches the list, so the confidence meter would report on a read that did not happen');
}

// A language we hold no copy for must still produce an example.
check('label/fallback', demoAnalysis('pt-BR').ingredients.length > 0,
  'an unexpected locale produced no example — it must fall back to English, never to nothing');

// ---- what the matcher must still find ---------------------------------

// Each of these is a specific promise the demo makes. The comment is the
// reason the row is in the label at all.

// Sodium caseinate is milk. The single best thing this label teaches.
check('find/milk',
  flagged(scored({ allergens: [{ allergen: 'milk', severity: 'anaphylaxis' }] }), 'milk'),
  'a milk allergy no longer matches Sodium Caseinate');

check('find/tree_nuts',
  flagged(scored({ allergens: [{ allergen: 'tree_nuts', severity: 'allergy' }] }), 'tree_nuts'),
  'a tree nut allergy no longer matches Almonds');

check('find/sesame',
  flagged(scored({ allergens: [{ allergen: 'sesame', severity: 'allergy' }] }), 'sesame'),
  'a sesame allergy no longer matches Sesame Seeds');

check('find/soy',
  flagged(scored({ allergens: [{ allergen: 'soy', severity: 'allergy' }] }), 'soy'),
  'a soy allergy no longer matches Soy Lecithin');

check('find/wheat',
  flagged(scored({ allergens: [{ allergen: 'wheat', severity: 'allergy' }] }), 'wheat'),
  'a wheat allergy no longer matches Wheat Starch');

check('find/sulphites',
  flagged(scored({ allergens: [{ allergen: 'sulphites', severity: 'intolerance' }] }), 'sulphites'),
  'a sulphite sensitivity no longer matches Sulphur Dioxide');

// Gelatin and carmine, which is what makes the label worth showing to someone
// with no allergies at all.
check('find/vegan',
  flagged(scored({ dietaryRules: ['vegan'] }), 'vegan'),
  'a vegan rule found nothing — Gelatin and Carmine should both violate it');

// The unsettled state, demonstrated rather than described: the label cannot
// settle halal however well it was read, because gelatin never names its
// animal.
const halal = scored({ dietaryRules: ['halal'] });
check('find/halal-unsettled',
  (halal.unsettled ?? []).includes('halal'),
  'halal stopped coming back unsettled — this is the one place the app gets to show that a clean list is not always an answer');

check('find/celiac',
  flagged(scored({ conditions: ['celiac'] }), 'celiac'),
  'coeliac disease no longer matches Wheat Starch');

// ---- the same answer in every language ---------------------------------

// This is the regression that made the fixture worth having.
//
// Dietary rules and condition advisories are English vocabularies. They used
// to be matched against the DISPLAY name only, which is localized — so on this
// Spanish label a vegan profile reading in Spanish came back "vegan: checked,
// not found" over Gelatina and Carmín. Not a silent miss: an affirmative false
// statement, in the cross-language case the whole app exists for.
//
// The verdict must not depend on the language it is read in.
for (const language of ['zh', 'es'] as const) {
  check(`parity/${language}/vegan`,
    flagged(scored({ dietaryRules: ['vegan'] }, language), 'vegan'),
    'a vegan rule found nothing when read in this language, but does in English — dietary matching has stopped reading the canonical English names');

  check(`parity/${language}/celiac`,
    flagged(scored({ conditions: ['celiac'] }, language), 'celiac'),
    'coeliac disease found nothing when read in this language, but does in English — condition advisories have stopped reading the canonical English names');

  check(`parity/${language}/milk`,
    flagged(scored({ allergens: [{ allergen: 'milk', severity: 'anaphylaxis' }] }, language), 'milk'),
    'a milk allergy found nothing when read in this language');

  check(`parity/${language}/overall`,
    scored({ dietaryRules: ['vegan'] }, language).overallRisk ===
      scored({ dietaryRules: ['vegan'] }, 'en').overallRisk,
    'the same profile got a different overall verdict in this language than in English');
}

// ---- what it must NOT do ----------------------------------------------

// Peanut is deliberately absent from the list. Someone with a peanut allergy
// must get the label's own "may contain" hedge and a checked list that says
// we looked — never a definite find the label does not support.
const peanut = scored({ allergens: [{ allergen: 'peanut', severity: 'anaphylaxis' }] });
check('honest/peanut-not-found',
  (peanut.checked ?? []).some((c) => c.term === 'peanut' && !c.found),
  'peanut came back as found — nothing in this label contains peanut, and claiming otherwise in the example teaches people the app cries wolf');
check('honest/peanut-hedged',
  (peanut.personalFlags ?? []).every((f) => f.match !== 'peanut' || f.certainty === 'verify'),
  'a peanut flag hardened from "verify" to "definite" — it comes from a may-contain line, which is not a find');

// No profile at all is a legitimate state (someone who skipped every field).
const bare = scored(null);
check('honest/no-profile',
  (bare.personalFlags ?? []).length === 0 && bare.overallRisk === 'moderate',
  'the unpersonalized example stopped being a plain universal read');

if (errors.length > 0) {
  console.log(`\n[DEMO] ${errors.length} failure(s):`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  process.exit(1);
}
console.log('\n[DEMO] the onboarding example still finds everything it promises');
