import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readLabelFromImage, type LabelProvider } from '../server/services/labelReader';
import { scoreCase, type CaseScore, type MajorAllergen } from './scoring';

// Label-extraction accuracy eval.
//
//   npm run eval                       # all cases, default provider chain
//   npm run eval -- --provider=openai  # pin one provider (gemini|openai|ocr)
//   npm run eval -- --cases=bamba-peanut,vermont-curry
//   npm run eval -- --threshold=0.85   # ingredient-recall warn threshold
//
// Exit codes: 0 = pass · 1 = ingredient recall below threshold · 2 = MAJOR
// ALLERGEN MISS (always a release blocker, regardless of other scores).
//
// Note: each run makes real vision-model API calls (one per case).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

interface EvalCase {
  id: string;
  image: string;
  description: string;
  productType: string;
  language: string;
  verified: boolean;
  truth: { ingredients: string[]; majorAllergens: MajorAllergen[] };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string) => args.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
  return {
    provider: get('provider') as LabelProvider | undefined,
    cases: get('cases')?.split(','),
    threshold: Number(get('threshold') ?? '0.9'),
  };
}

function loadCases(filter?: string[]): EvalCase[] {
  const casesDir = path.join(__dirname, 'cases');
  const cases = fs.readdirSync(casesDir, { withFileTypes: true })
    // Ignore stray files macOS scatters around (.DS_Store et al)
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(id => !filter || filter.includes(id))
    .map(id => {
      const raw = JSON.parse(fs.readFileSync(path.join(casesDir, id, 'case.json'), 'utf-8'));
      return { id, ...raw } as EvalCase;
    });

  // A case whose image is missing would otherwise fail as if the pipeline
  // were broken. Skip it loudly instead.
  const runnable: EvalCase[] = [];
  for (const c of cases) {
    if (fs.existsSync(path.resolve(repoRoot, c.image))) runnable.push(c);
    else console.warn(`⚠ skipping "${c.id}" — image not found at ${c.image}`);
  }
  return runnable;
}

function imageToDataUrl(relPath: string): string {
  const abs = path.resolve(repoRoot, relPath);
  const ext = path.extname(abs).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${fs.readFileSync(abs).toString('base64')}`;
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

async function main() {
  const { provider, cases: caseFilter, threshold } = parseArgs();
  const cases = loadCases(caseFilter);
  if (cases.length === 0) {
    console.error('No eval cases matched.');
    process.exit(1);
  }

  const unverified = cases.filter(c => !c.verified);
  if (unverified.length > 0) {
    console.warn(`⚠ ${unverified.length}/${cases.length} cases have AI-transcribed ground truth pending human verification (verified: false)\n`);
  }

  const results: Array<{ c: EvalCase; score?: CaseScore; method?: string; seconds?: number; error?: string }> = [];

  for (const c of cases) {
    process.stdout.write(`▶ ${c.id} (${c.language}, ${c.productType}) ... `);
    const start = Date.now();
    try {
      const read = await readLabelFromImage(
        imageToDataUrl(c.image),
        provider ? { providers: [provider] } : undefined,
      );
      const seconds = (Date.now() - start) / 1000;
      const score = scoreCase(
        c.truth.ingredients,
        c.truth.majorAllergens,
        read.ingredients,
        read.declaredAllergens?.contains ?? [],
      );
      results.push({ c, score, method: read.method, seconds });
      console.log(`${read.method} in ${seconds.toFixed(1)}s — recall ${pct(score.recall)}, precision ${pct(score.precision)}${score.missedAllergens.length ? ` — ✗ ALLERGEN MISS: ${score.missedAllergens.join(', ')}` : ''}`);
    } catch (error: any) {
      results.push({ c, error: error.message });
      console.log(`ERROR: ${error.message}`);
    }
  }

  console.log('\n──── Detail ────');
  for (const r of results) {
    if (!r.score) continue;
    console.log(`\n${r.c.id}:`);
    console.log(`  ingredients: ${r.score.matched}/${r.score.truthCount} matched, ${r.score.extraIngredients.length} extra`);
    if (r.score.missedIngredients.length) console.log(`  missed: ${r.score.missedIngredients.join(' | ')}`);
    if (r.score.extraIngredients.length) console.log(`  extra:  ${r.score.extraIngredients.join(' | ')}`);
    console.log(`  allergens: truth [${r.score.truthAllergens.join(', ')}] detected [${r.score.detectedAllergens.join(', ')}]`);
  }

  const scored = results.filter(r => r.score).map(r => r.score!);
  const errors = results.filter(r => r.error);
  const totalTruth = scored.reduce((s, x) => s + x.truthCount, 0);
  const totalMatched = scored.reduce((s, x) => s + x.matched, 0);
  const totalExtracted = scored.reduce((s, x) => s + x.extractedCount, 0);
  const totalExtra = scored.reduce((s, x) => s + x.extraIngredients.length, 0);
  const allergenTruthCount = scored.reduce((s, x) => s + x.truthAllergens.length, 0);
  const allergenMisses = scored.flatMap((x, i) => x.missedAllergens.map(a => `${results.filter(r => r.score)[i].c.id}:${a}`));

  const aggRecall = totalTruth ? totalMatched / totalTruth : 0;
  const aggPrecision = totalExtracted ? (totalExtracted - totalExtra) / totalExtracted : 0;

  console.log('\n──── Summary ────');
  console.log(`cases:              ${scored.length} scored, ${errors.length} errored`);
  console.log(`ingredient recall:  ${pct(aggRecall)} (${totalMatched}/${totalTruth})`);
  console.log(`ingredient precision: ${pct(aggPrecision)}`);
  console.log(`allergen recall:    ${allergenTruthCount ? pct((allergenTruthCount - allergenMisses.length) / allergenTruthCount) : 'n/a'} (${allergenTruthCount - allergenMisses.length}/${allergenTruthCount})`);

  if (allergenMisses.length > 0) {
    console.error(`\n✗ RELEASE BLOCKER — missed major allergens: ${allergenMisses.join(', ')}`);
    process.exit(2);
  }
  if (errors.length > 0 || aggRecall < threshold) {
    console.error(`\n✗ FAIL — ingredient recall ${pct(aggRecall)} below threshold ${pct(threshold)}${errors.length ? ` (+${errors.length} errored cases)` : ''}`);
    process.exit(1);
  }
  console.log('\n✓ PASS');
}

main();
