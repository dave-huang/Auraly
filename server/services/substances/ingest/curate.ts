import fs from 'fs';
import path from 'path';

import type { Substance, SubstanceRegistryFile } from '../identity';

/**
 * Apply hand-curated identifiers and names to the registry.
 *
 * The counterpart to the source adapters. An adapter reads what a publisher
 * wrote; this applies what a person concluded, and the two need to be told
 * apart — which is why every alias it writes is marked `curated`, the one
 * source the ingest merge and the registry's arbitration both refuse to
 * overrule.
 *
 * It exists because the gap between a register and a label is not always
 * something a rule can close. Ponceau 4R is filed by the EU annex as "Ponceau
 * 4R, Cochineal Red A" — two names in one field, so neither resolves, and one
 * of the six colours the EU requires a warning on could not be looked up at
 * all. No adapter should guess at splitting that; a person should say so once.
 *
 * E numbers arrive the same way. They are how European labels name a colour and
 * how the regulations that govern them are written, and no source in the corpus
 * carries them: the registry holds three E numbers across 8,483 substances.
 *
 * The one rule: this never invents a substance. Every entry names an id that
 * must already exist, so curation stays a correction to what a publisher said
 * and never becomes an unattributed claim of its own.
 *
 *   npx tsx server/services/substances/ingest/curate.ts [--dry-run]
 */

interface CuratedEntry {
  substanceId: string;
  why: string;
  eNumber?: string;
  cas?: string;
  aliases?: string[];
}

interface CuratedFile {
  _metadata: { version: string; updatedAt: string; description: string };
  entries: CuratedEntry[];
}

const DATA_DIR = path.join(process.cwd(), 'server/data/substances');
const REGISTRY_PATH = path.join(DATA_DIR, 'substances.json');
const CURATED_PATH = path.join(DATA_DIR, 'curated/aliases.json');

export function applyCuration(
  registry: SubstanceRegistryFile,
  curated: CuratedFile,
): { applied: number; added: number; missing: string[] } {
  const byId = new Map(registry.substances.map((s) => [s.id, s]));
  const missing: string[] = [];
  let applied = 0;
  let added = 0;

  for (const entry of curated.entries) {
    const substance = byId.get(entry.substanceId) as Substance | undefined;
    if (!substance) {
      missing.push(entry.substanceId);
      continue;
    }

    let touched = false;
    // Identifiers are set even over an existing value, unlike an ingest: a
    // curated identifier exists precisely to correct a bad one.
    if (entry.eNumber && substance.eNumber !== entry.eNumber) {
      substance.eNumber = entry.eNumber;
      touched = true;
    }
    if (entry.cas && substance.cas !== entry.cas) {
      substance.cas = entry.cas;
      touched = true;
    }

    const have = new Set(substance.aliases.map((a) => a.name.toLowerCase()));
    for (const alias of entry.aliases ?? []) {
      if (have.has(alias.toLowerCase())) continue;
      substance.aliases.push({ name: alias, source: 'curated', confidence: 1 });
      have.add(alias.toLowerCase());
      added += 1;
      touched = true;
    }
    if (touched) applied += 1;
  }

  return { applied, added, missing };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8')) as SubstanceRegistryFile;
  const curated = JSON.parse(fs.readFileSync(CURATED_PATH, 'utf-8')) as CuratedFile;

  console.log(`\n[CURATE] ${curated._metadata.version} — ${curated.entries.length} entries`);
  const { applied, added, missing } = applyCuration(registry, curated);
  console.log(`  applied to ${applied} substances, ${added} new aliases`);

  if (missing.length > 0) {
    // Fatal rather than warned. An entry naming an id that does not exist is
    // either a typo or a substance that left the corpus, and both mean somebody
    // believes a name resolves when it does not.
    throw new Error(
      `${missing.length} curated entr${missing.length === 1 ? 'y names an id' : 'ies name ids'} ` +
        `that are not in the registry: ${missing.join(', ')}`,
    );
  }

  if (dryRun) {
    console.log(`\n[DRY RUN] would write ${REGISTRY_PATH}\n`);
    return;
  }
  registry._metadata.updatedAt = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n');
  console.log(`  wrote ${REGISTRY_PATH}\n`);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch((error) => {
    console.error(`\n[CURATE] failed: ${error.message}\n`);
    process.exit(1);
  });
}
