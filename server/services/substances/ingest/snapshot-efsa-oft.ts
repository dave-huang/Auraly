import fs from 'fs';
import path from 'path';

import { readSheet, readZip, sheetIndex } from './xlsx';

/**
 * Snapshot EFSA's OpenFoodTox as CSV.
 *
 * Same shape as the FDA snapshot script and for the same reason: what EFSA
 * publishes is not a file this corpus can read. OpenFoodTox 3.0 is a single
 * 22 MB workbook holding an eighteen-sheet relational schema — dossiers,
 * substances, reference substances, and a toxicological-reference-values sheet
 * that carries the numbers but identifies its subject only by UUID.
 *
 * So this script does the join once, here, and writes a flat CSV that says what
 * each row means. The CSV is the snapshot of record: committed, diffable, and
 * the only thing the adapter reads.
 *
 * The join, for anyone re-reading this in a year:
 *
 *   FLEX_SUM.ToxRefValues.ParentUUID   → SUB.DocumentUUID
 *   SUB.ReferenceSubstance             → REF_SUB.DocumentUUID   (CAS, names)
 *   DOSSIER_DOCS.DocumentUUID          → the value's own DOSSIER (title, DOI)
 *
 * That last hop has to go through DOSSIER_DOCS, and the reason is worth
 * writing down. A substance is often assessed several times across decades:
 * sorbates carry three acceptable daily intakes — JECFA's 25 mg/kg from 1974, a
 * temporary group ADI of 3, and 11 from a 2019 re-evaluation. Reaching the
 * dossier by way of the substance instead pairs every one of those numbers with
 * whichever opinion happened to be first, so two of the three end up quoting a
 * paper that never said them. DOSSIER_DOCS is the only table that says which
 * dossier a given value document belongs to.
 *
 *   npx tsx server/services/substances/ingest/snapshot-efsa-oft.ts <path-to.xlsx>
 *
 * The workbook itself is NOT committed — it is 22 MB of which this uses a
 * fraction. Download it from the Zenodo record below, which is versioned and
 * citable, and keep the DOI with the snapshot.
 */

const ZENODO_RECORD = 'https://zenodo.org/records/19388272';
const SOURCE_TITLE = 'OpenFoodTox 3.0: EFSA’s chemical hazards database';

/** Columns of the flat file this produces. */
const COLUMNS = [
  'Substance',
  'CAS number',
  'ADI lower',
  'ADI upper',
  'ADI unit',
  'No ADI allocated',
  'Food domain',
  'EFSA output',
  'DOI',
  'Evaluation date',
] as const;

// Sheet columns, by the header labels EFSA gives them.
const T_PARENT = 'Parent UUID';
const T_ADI_LOWER = 'HumanHealthHazardCharacteristics.AcceptableDailyIntake.Adi.lowerValue';
const T_ADI_UPPER = 'HumanHealthHazardCharacteristics.AcceptableDailyIntake.Adi.upperValue';
const T_ADI_UNIT = 'HumanHealthHazardCharacteristics.AcceptableDailyIntake.Adi.Unit';
const T_ADI_NONE = 'HumanHealthHazardCharacteristics.AcceptableDailyIntake.NoAllocated';

function toCsvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * EFSA's export carries UTF-8 that has been through a Latin-1 round trip in
 * places, so "µg" arrives as "Âµg". Repaired here rather than in the adapter:
 * a mangled unit is a snapshot defect, and the snapshot is where it belongs.
 */
function repairMojibake(value: string): string {
  return value.replace(/Â(?=[µµ])/g, '');
}

export function buildRows(entries: Map<string, Buffer>): Record<string, string>[] {
  const sheets = sheetIndex(entries);
  const need = (name: string): string => {
    const part = sheets.get(name);
    if (!part) {
      throw new Error(
        `Sheet "${name}" is missing. Found: ${Array.from(sheets.keys()).join(', ')}. ` +
          'EFSA has probably restructured the export — fix this script, not the snapshot.',
      );
    }
    return part;
  };

  const toxRefValues = readSheet(entries, need('FLEX_SUM.ToxRefValues'));
  const substances = readSheet(entries, need('SUB'));
  const referenceSubstances = readSheet(entries, need('REF_SUB'));
  const dossiers = readSheet(entries, need('DOSSIER'));
  const dossierDocs = readSheet(entries, need('DOSSIER_DOCS'));

  const subById = new Map(substances.map((s) => [s['Document UUID'], s]));
  const refById = new Map(referenceSubstances.map((r) => [r['Document UUID'], r]));
  const dossierById = new Map(dossiers.map((d) => [d['Document UUID'], d]));
  const dossierByDoc = new Map<string, Record<string, string>>();
  for (const link of dossierDocs) {
    const dossier = dossierById.get(link['DOSSIER UUID'] ?? '');
    const doc = link['DOCUMENT UUID'];
    if (dossier && doc) dossierByDoc.set(doc, dossier);
  }

  const rows: Record<string, string>[] = [];
  for (const value of toxRefValues) {
    const lower = value[T_ADI_LOWER] ?? '';
    const upper = value[T_ADI_UPPER] ?? '';
    const none = value[T_ADI_NONE] ?? '';
    if (!lower && !upper && !none) continue;

    const sub = subById.get(value[T_PARENT] ?? '');
    if (!sub) continue;
    const ref = refById.get((sub['ReferenceSubstance.ReferenceSubstance'] ?? '').split('/')[0]);
    const name = ref?.['ReferenceSubstanceName'] || ref?.['PARAM NAME'] || sub['ChemicalName'] || '';
    if (!name) continue;

    const dossier = dossierByDoc.get(value['Document UUID'] ?? '');
    rows.push({
      Substance: name,
      'CAS number': ref?.['Inventory.CASNumber'] || ref?.['CAS number'] || '',
      'ADI lower': lower,
      'ADI upper': upper,
      'ADI unit': repairMojibake(value[T_ADI_UNIT] ?? ''),
      'No ADI allocated': none,
      'Food domain': dossier?.['Domain.FoodDomain'] ?? '',
      'EFSA output': dossier?.['LiteratureReference.EFSAOutputTitle'] ?? '',
      DOI: dossier?.['LiteratureReference.LinkToPersistentIdentifier'] ?? '',
      'Evaluation date': dossier?.['LiteratureReference.DateOfEvaluation'] ?? '',
    });
  }
  return rows;
}

async function main() {
  const source = process.argv[2];
  if (!source) {
    throw new Error(
      `Usage: npx tsx ${path.relative(process.cwd(), process.argv[1])} <OFT3.0 export repository.xlsx>\n` +
        `Download the workbook from ${ZENODO_RECORD} (CC BY 4.0).`,
    );
  }

  console.log(`[SNAPSHOT] reading ${source}`);
  const entries = readZip(fs.readFileSync(source));
  const rows = buildRows(entries);
  if (rows.length === 0) throw new Error('No reference values found — the join produced nothing.');

  const stamp = new Date().toISOString().slice(0, 7);
  const out = path.join(process.cwd(), 'server/data/substances/snapshots', `efsa-oft-${stamp}.csv`);
  const csv = [
    COLUMNS.join(','),
    ...rows.map((r) => COLUMNS.map((c) => toCsvField(r[c] ?? '')).join(',')),
  ].join('\n');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, csv + '\n');

  const withCas = rows.filter((r) => r['CAS number']).length;
  console.log(`[SNAPSHOT] wrote ${rows.length} reference values (${withCas} with a CAS) to ${out}`);
  console.log(`\nSource: ${SOURCE_TITLE} — ${ZENODO_RECORD}`);
  console.log(`\nNext:\n  npm run substances:ingest -- efsa_openfoodtox ${out} --version ${stamp} --url "${ZENODO_RECORD}"\n`);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch((error) => {
    console.error(`\n[SNAPSHOT] failed: ${error.message}\n`);
    process.exit(1);
  });
}
