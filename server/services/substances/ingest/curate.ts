import fs from 'fs';
import path from 'path';

import { stampRegistry, type Substance, type SubstanceRegistryFile } from '../identity';

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
 * Two sections, kept apart on purpose. `entries` corrects substances a
 * publisher already gave us, and an entry naming an id that does not exist is
 * fatal — that is how a typo stays a typo instead of quietly becoming a new
 * substance. `creates` adds substances no publisher will ever supply.
 *
 * That second section exists for whole foods. Every source in this corpus is a
 * register of things somebody regulates: additives, colours, preservatives,
 * carcinogens. Nobody maintains a register of palm oil, and so the ingredients
 * printed most often on real labels were the ones the corpus could not see at
 * all — palm oil, cocoa butter, butter, salt. They are not exotic and they are
 * not unknowable; they are simply nobody's job to list.
 *
 * A created substance carries no CAS unless a human is certain of it. A wrong
 * CAS joins another source's evidence onto the wrong chemical, which is the
 * failure the identity layer exists to prevent, and for a whole food the CAS
 * buys nothing: no other source is going to have a record to join.
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

interface CreatedSubstance {
  id: string;
  name: string;
  why: string;
  cas?: string;
  eNumber?: string;
  category?: string;
  aliases: string[];
}

interface CuratedFile {
  _metadata: { version: string; updatedAt: string; description: string };
  entries: CuratedEntry[];
  creates?: CreatedSubstance[];
}

const DATA_DIR = path.join(process.cwd(), 'server/data/substances');
const REGISTRY_PATH = path.join(DATA_DIR, 'substances.json');
const CURATED_PATH = path.join(DATA_DIR, 'curated/aliases.json');

export function applyCuration(
  registry: SubstanceRegistryFile,
  curated: CuratedFile,
): { applied: number; added: number; created: number; missing: string[]; collided: string[] } {
  const byId = new Map(registry.substances.map((s) => [s.id, s]));
  const missing: string[] = [];
  const collided: string[] = [];
  let applied = 0;
  let added = 0;
  let created = 0;

  // Creates run first, so an `entries` correction can refer to one of them.
  for (const create of curated.creates ?? []) {
    if (byId.has(create.id)) {
      // A publisher has since started covering this, which is good news and
      // still has to be looked at: their entry and this one may disagree about
      // what the name denotes, and silently keeping one of the two would hide
      // that. Reported rather than merged.
      collided.push(create.id);
      continue;
    }
    const substance: Substance = {
      id: create.id,
      name: create.name,
      cas: create.cas ?? null,
      ec: null,
      eNumber: create.eNumber ?? null,
      inci: null,
      category: create.category ?? null,
      aliases: create.aliases.map((name) => ({ name, source: 'curated' as const, confidence: 1 })),
    };
    registry.substances.push(substance);
    byId.set(substance.id, substance);
    created += 1;
  }

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

  return { applied, added, created, missing, collided };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8')) as SubstanceRegistryFile;
  const curated = JSON.parse(fs.readFileSync(CURATED_PATH, 'utf-8')) as CuratedFile;

  console.log(
    `\n[CURATE] ${curated._metadata.version} — ${curated.entries.length} entries, ` +
      `${curated.creates?.length ?? 0} creates`,
  );
  const { applied, added, created, missing, collided } = applyCuration(registry, curated);
  console.log(`  applied to ${applied} substances, ${added} new aliases, ${created} substances created`);

  for (const id of collided) {
    console.log(`  note: "${id}" now exists in an ingested source — compare them and drop the curated create`);
  }

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
  const version = stampRegistry(registry, curated._metadata.version);
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n');
  console.log(`  registry: ${version}`);
  console.log(`  wrote ${REGISTRY_PATH}\n`);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch((error) => {
    console.error(`\n[CURATE] failed: ${error.message}\n`);
    process.exit(1);
  });
}
