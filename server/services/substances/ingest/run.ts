import fs from 'fs';
import path from 'path';

import { loadEvidenceStore, type EvidenceFile } from '../evidence';
import type { Substance, SubstanceRegistryFile } from '../identity';
import { applyPolicy, POLICY_VERSION } from '../policy';
import { assertColumns, parseCsv, type SnapshotMeta, type SourceAdapter } from './adapter';
import {
  cosingAnnexIIAdapter,
  cosingAnnexIIIAdapter,
  cosingAnnexIVAdapter,
  cosingAnnexVAdapter,
  cosingAnnexVIAdapter,
} from './cosing';
import { iarcAdapter } from './iarc';
import { prop65Adapter } from './prop65';

/**
 * Ingestion CLI.
 *
 *   npm run substances:ingest -- <source> <snapshot> --version <v> [--url <u>] [--dry-run]
 *
 * Ingests a local snapshot into the identity registry and the evidence corpus,
 * then prints a CLASSIFICATION DIFF: which substances change level as a result.
 * That diff is the point. A regulatory corpus should never move under the app
 * silently — a substance going from moderate to high is a product change and
 * deserves to be read by a person before it ships.
 *
 * Nothing here fetches from the network. Downloading is a deliberate manual step
 * so the snapshot can be committed next to the records it produced, which is
 * what makes an ingestion reproducible months later.
 */

const ADAPTERS: Record<string, SourceAdapter> = {
  prop65: prop65Adapter,
  iarc: iarcAdapter,
  cosing_annex_ii: cosingAnnexIIAdapter,
  cosing_annex_iii: cosingAnnexIIIAdapter,
  cosing_annex_iv: cosingAnnexIVAdapter,
  cosing_annex_v: cosingAnnexVAdapter,
  cosing_annex_vi: cosingAnnexVIAdapter,
};

const DATA_DIR = path.join(process.cwd(), 'server/data/substances');
const REGISTRY_PATH = path.join(DATA_DIR, 'substances.json');
const EVIDENCE_DIR = path.join(DATA_DIR, 'evidence');

interface Args {
  source: string;
  snapshot: string;
  version: string;
  url?: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const [source, snapshot, ...rest] = argv;
  if (!source || !snapshot) {
    throw new Error(
      `Usage: npm run substances:ingest -- <source> <snapshot.csv> --version <v> [--url <u>] [--dry-run]\n` +
        `Sources: ${Object.keys(ADAPTERS).join(', ')}`,
    );
  }
  const flag = (name: string): string | undefined => {
    const i = rest.indexOf(`--${name}`);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  const version = flag('version');
  if (!version) {
    // Without a version an ingestion is not reproducible, so this is fatal
    // rather than defaulted to a timestamp.
    throw new Error('--version is required: use the edition string the publisher labels the file with.');
  }
  return { source, snapshot, version, url: flag('url'), dryRun: rest.includes('--dry-run') };
}

/** Merge incoming substances into the registry without losing curated fields. */
function mergeSubstances(existing: Substance[], incoming: Substance[]): { merged: Substance[]; added: number; enriched: number } {
  const byId = new Map(existing.map((s) => [s.id, structuredClone(s)]));
  let added = 0;
  let enriched = 0;

  for (const next of incoming) {
    const current = byId.get(next.id);
    if (!current) {
      byId.set(next.id, next);
      added += 1;
      continue;
    }

    let touched = false;
    // Identifiers fill in but never overwrite: a curated CAS beats an ingested
    // one, because the curated value may exist precisely to correct a bad join.
    for (const key of ['cas', 'ec', 'eNumber', 'inci', 'category'] as const) {
      if (!current[key] && next[key]) {
        (current as any)[key] = next[key];
        touched = true;
      }
    }
    // Aliases union, deduped on the printable name.
    //
    // An alias already present is refreshed from the incoming one unless it was
    // hand-curated, because re-running an ingest is how an adapter fix reaches
    // the registry. Dedupe-and-skip meant a corrected confidence never landed:
    // the alias existed, so the better version was discarded and the fix looked
    // like it had done nothing. Curated aliases are never overwritten — a human
    // entry outranks anything an adapter produces.
    const byName = new Map(current.aliases.map((a) => [a.name.toLowerCase(), a]));
    for (const alias of next.aliases) {
      const key = alias.name.toLowerCase();
      const existing = byName.get(key);
      if (!existing) {
        current.aliases.push(alias);
        byName.set(key, alias);
        touched = true;
      } else if (existing.source !== 'curated' && existing.confidence !== alias.confidence) {
        existing.confidence = alias.confidence;
        existing.source = alias.source;
        touched = true;
      }
    }
    if (touched) enriched += 1;
  }

  return { merged: Array.from(byId.values()), added, enriched };
}

/**
 * Level for every substance we hold evidence on, under the current policy.
 *
 * Substances with no evidence are all `unknown` and would only add noise, so
 * the snapshot is keyed on substance+domain pairs that actually have records.
 */
function levelSnapshot(evidenceDir: string): Map<string, string> {
  const evidence = loadEvidenceStore(evidenceDir);
  const levels = new Map<string, string>();
  for (const substanceId of evidence.substanceIds()) {
    for (const domain of ['food', 'cosmetic'] as const) {
      const records = evidence.forSubstanceInDomain(substanceId, domain);
      if (records.length === 0) continue;
      levels.set(`${substanceId}:${domain}`, applyPolicy(records, { domain }).level);
    }
  }
  return levels;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const adapter = ADAPTERS[args.source];
  if (!adapter) {
    throw new Error(`Unknown source "${args.source}". Known: ${Object.keys(ADAPTERS).join(', ')}`);
  }

  const ext = path.extname(args.snapshot).toLowerCase();
  if (!adapter.accepts.includes(ext)) {
    throw new Error(`${adapter.label} accepts ${adapter.accepts.join(', ')}, got ${ext}`);
  }

  const text = fs.readFileSync(args.snapshot, 'utf-8');
  const rows = parseCsv(text, { headerMustInclude: adapter.requiredColumns });
  if (rows.length === 0) throw new Error('Snapshot parsed to zero rows.');

  // Fail loudly on a format change instead of writing thousands of empty rows.
  assertColumns(adapter, rows);

  const meta: SnapshotMeta = {
    version: args.version,
    fetchedAt: new Date().toISOString().slice(0, 10),
    url: args.url,
  };

  console.log(`\n[INGEST] ${adapter.label}`);
  console.log(`  snapshot: ${args.snapshot} (${rows.length} rows)`);
  console.log(`  version:  ${args.version}`);

  const before = levelSnapshot(EVIDENCE_DIR);

  const result = adapter.parse(rows, meta);
  console.log(`  parsed:   ${result.substances.length} substances, ${result.records.length} records`);
  if (result.skipped.length > 0) {
    console.log(`  skipped:  ${result.skipped.length} rows`);
    for (const s of result.skipped.slice(0, 10)) {
      console.log(`    row ${s.row}: ${s.reason}${s.raw ? ` — ${s.raw}` : ''}`);
    }
    if (result.skipped.length > 10) console.log(`    …and ${result.skipped.length - 10} more`);
  }

  if (result.review && result.review.length > 0) {
    // Printed in full, not truncated. This is the list a person has to read,
    // and a "…and 30 more" on it would defeat the point of collecting it.
    console.log(`\n  needs review: ${result.review.length} entries the adapter would not judge`);
    for (const r of result.review) {
      console.log(`    row ${r.row}: ${r.note}`);
      console.log(`      "${r.raw}"`);
    }
  }

  // --- write registry ---
  const registryFile = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8')) as SubstanceRegistryFile;
  const { merged, added, enriched } = mergeSubstances(registryFile.substances, result.substances);
  console.log(`  identity: +${added} new, ${enriched} enriched, ${merged.length} total`);

  // --- write evidence ---
  const evidenceFile: EvidenceFile = {
    _metadata: {
      version: `${args.source}-${args.version}`,
      updatedAt: meta.fetchedAt,
      description: `${adapter.label} snapshot ${args.version}, ingested ${meta.fetchedAt}.`,
    },
    records: result.records,
  };
  const evidencePath = path.join(EVIDENCE_DIR, `${args.source}.json`);

  if (args.dryRun) {
    console.log(`\n[DRY RUN] would write:\n  ${REGISTRY_PATH}\n  ${evidencePath}\n`);
    return;
  }

  registryFile.substances = merged;
  registryFile._metadata.updatedAt = meta.fetchedAt;
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registryFile, null, 2) + '\n');
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.writeFileSync(evidencePath, JSON.stringify(evidenceFile, null, 2) + '\n');

  // --- classification diff ---
  const after = levelSnapshot(EVIDENCE_DIR);
  const changes: string[] = [];
  for (const [key, level] of after) {
    const previous = before.get(key);
    if (previous !== level) {
      changes.push(`  ${key}: ${previous ?? 'unknown'} → ${level}`);
    }
  }

  console.log(`\n[DIFF] policy ${POLICY_VERSION}`);
  if (changes.length === 0) {
    console.log('  no classification changes');
  } else {
    console.log(`  ${changes.length} substance/domain pairs changed level:`);
    for (const line of changes.slice(0, 40)) console.log(line);
    if (changes.length > 40) console.log(`  …and ${changes.length - 40} more`);
    console.log('\n  Read this before shipping. A level change is a product change.');
  }
  console.log('');
}

main().catch((error) => {
  console.error(`\n[INGEST] failed: ${error.message}\n`);
  process.exit(1);
});
