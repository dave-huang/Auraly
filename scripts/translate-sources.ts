/**
 * Translate the evidence, knowledge-base and condition-advisory statements into
 * the app's other languages.
 *
 *     npx tsx scripts/translate-sources.ts
 *
 * Output: server/data/substances/translations/{zh,es}.json, a flat map from the
 * English statement to its translation. The server attaches the translation
 * beside the statement and never in place of it: the app shows the translation
 * marked as one, with the English original a tap away, because these sentences
 * describe what a regulator decided and the original is what can be checked.
 *
 * Incremental. Statements already translated are skipped, so rerunning after an
 * ingest translates only what the ingest added. A statement with no
 * translation is shown in English, which is what every statement did before
 * this existed, so a gap degrades to the old behaviour rather than to nothing.
 *
 * Translated by model, once, here, rather than per request in the app: the
 * same statement then reads the same way every time, the output can be read
 * and corrected in review, and nothing on the scan path waits for it.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { CONDITION_ADVISORIES } from '../server/services/conditionAdvisories';

const ROOT = path.resolve(import.meta.dirname, '..');
const EVIDENCE = path.join(ROOT, 'server/data/substances/evidence');
const KB = path.join(ROOT, 'server/data/knowledge-base.json');
// Overridable for a trial run against a sample, so the committed files are
// only ever written by a full run.
const OUT = process.env.TRANSLATE_OUT || path.join(ROOT, 'server/data/substances/translations');
const LIMIT = Number(process.env.TRANSLATE_LIMIT) || Infinity;

const MODEL = process.env.TRANSLATE_MODEL || 'gpt-6-sol';
const BATCH = 40;
const CONCURRENCY = 6;

const LANGUAGES: Record<string, string> = {
  zh: 'Simplified Chinese (简体中文), as used in mainland China',
  es: 'Spanish, neutral and international rather than regional',
};

function collect(): string[] {
  const all = new Set<string>();
  for (const file of fs.readdirSync(EVIDENCE).filter((f) => f.endsWith('.json'))) {
    const data = JSON.parse(fs.readFileSync(path.join(EVIDENCE, file), 'utf8'));
    const records: any[] = Array.isArray(data) ? data : data.records ?? [];
    for (const r of records) if (typeof r?.statement === 'string' && r.statement.trim()) all.add(r.statement);
  }
  const kb = JSON.parse(fs.readFileSync(KB, 'utf8'));
  for (const entry of kb.entries ?? []) {
    for (const claim of entry.claims ?? []) if (claim.statement?.trim()) all.add(claim.statement);
  }
  // Condition advisories are cited on a flag the same way; their `reason` is
  // the statement shown. See advisoryCitation.
  for (const advisory of CONDITION_ADVISORIES) if (advisory.reason?.trim()) all.add(advisory.reason);
  return [...all].sort();
}

function load(lang: string): Record<string, string> {
  const file = path.join(OUT, `${lang}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
}

function save(lang: string, map: Record<string, string>) {
  fs.mkdirSync(OUT, { recursive: true });
  const sorted = Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(path.join(OUT, `${lang}.json`), JSON.stringify(sorted, null, 1) + '\n');
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function translateBatch(lang: string, batch: string[]): Promise<string[] | null> {
  const prompt = `Translate each numbered statement into ${LANGUAGES[lang]}.

These are statements about food additives and cosmetic ingredients from regulatory sources (FDA, EFSA, EU Cosmetics Regulation annexes, IARC, California Proposition 65, WHO). Readers are consumers checking a product label.

Rules:
- Translate faithfully. Do not add, soften, strengthen or explain anything.
- Keep unchanged: the acronyms FDA, EFSA, IARC and CAS; US regulation references such as 21 CFR 172.841; E-numbers; CAS numbers; numbers, units and dates exactly as written.
- Translate "EU" and "WHO" to the target language's standard form (Chinese 欧盟 and 世界卫生组织; Spanish UE and OMS). Translate "California Proposition 65" (Chinese 加州第65号提案; Spanish Proposición 65 de California).
- EU annex references: translate the words and keep the numerals (Chinese 附件 II 第 405 项; Spanish anexo II, entrada 405).
- Keep the titles of documents that appear inside quotation marks in their original English, inside the same quotation marks.
- Chemical and ingredient names: use the standard name in the target language where one exists; otherwise keep the English.
- Return JSON only: {"t": ["translation 1", "translation 2", ...]} with exactly ${batch.length} strings, in the same order.

${batch.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await client.chat.completions.create({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      } as any);
      const parsed = JSON.parse(res.choices[0]?.message?.content ?? '{}');
      const out = parsed.t;
      if (Array.isArray(out) && out.length === batch.length && out.every((x) => typeof x === 'string' && x.trim())) {
        return out;
      }
      console.warn(`[${lang}] batch returned ${Array.isArray(out) ? out.length : 'no'} of ${batch.length}, retrying`);
    } catch (e: any) {
      console.warn(`[${lang}] attempt ${attempt + 1} failed: ${e?.message}`);
    }
  }
  return null;
}

async function main() {
  // Spread across the corpus rather than the first N alphabetically, so a
  // sample sees every source's phrasing.
  const everything = collect();
  const step = Number.isFinite(LIMIT) ? Math.max(1, Math.floor(everything.length / LIMIT)) : 1;
  const statements = everything.filter((_, i) => i % step === 0).slice(0, LIMIT);
  console.log(`${statements.length} unique statements, model ${MODEL}`);
  for (const lang of Object.keys(LANGUAGES)) {
    const map = load(lang);
    const todo = statements.filter((s) => !map[s]);
    console.log(`[${lang}] ${Object.keys(map).length} already translated, ${todo.length} to go`);
    const batches: string[][] = [];
    for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));
    let next = 0;
    let failed = 0;
    async function worker() {
      while (next < batches.length) {
        const batch = batches[next++];
        const out = await translateBatch(lang, batch);
        if (!out) { failed += batch.length; continue; }
        batch.forEach((s, i) => { map[s] = out[i].trim(); });
        save(lang, map);
        process.stdout.write(`[${lang}] ${Object.keys(map).length}/${statements.length}\r`);
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    save(lang, map);
    console.log(`\n[${lang}] done: ${Object.keys(map).length} translated, ${failed} left in English`);
  }
}

main();
