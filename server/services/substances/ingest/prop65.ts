import type { EvidenceRecord } from '../evidence';
import { normalizeCas } from '../identity';
import type { IngestResult, SnapshotMeta, SourceAdapter } from './adapter';
import { slugifySubstanceId } from './adapter';

/**
 * California Proposition 65 — OEHHA's list of chemicals known to the state to
 * cause cancer or reproductive toxicity.
 *
 * The best first source to ingest: around a thousand rows, CAS-keyed, and it
 * states its toxicological endpoint explicitly, which maps straight onto two of
 * the high-risk policy rules with no interpretation needed.
 *
 * Column names below match the published list at the time of writing. If OEHHA
 * renames them the adapter fails loudly via `assertColumns` — fix it here, do
 * not edit the snapshot.
 *
 * Download: OEHHA's "Proposition 65 List" export. Save the CSV under
 * server/data/substances/snapshots/prop65-<version>.csv and run:
 *   npm run substances:ingest -- prop65 <path> --version 2026-06
 */

const COL_CHEMICAL = 'Chemical';
const COL_TYPE = 'Type of Toxicity';
const COL_LISTED = 'Date Listed';
const COL_CAS = 'CAS No.';

export const prop65Adapter: SourceAdapter = {
  source: 'prop65',
  label: 'California Prop 65 (OEHHA)',
  accepts: ['.csv'],
  requiredColumns: [COL_CHEMICAL, COL_TYPE],

  parse(rows: Record<string, string>[], meta: SnapshotMeta): IngestResult {
    const substances = new Map<string, any>();
    const records: EvidenceRecord[] = [];
    const skipped: IngestResult['skipped'] = [];

    rows.forEach((row, index) => {
      const name = row[COL_CHEMICAL]?.trim();
      if (!name) {
        skipped.push({ row: index + 2, reason: 'no chemical name' });
        return;
      }

      const cas = normalizeCas(row[COL_CAS]);
      const id = slugifySubstanceId(name);

      if (!substances.has(id)) {
        substances.set(id, {
          id,
          name,
          cas,
          ec: null,
          eNumber: null,
          inci: null,
          category: null,
          // Prop 65 names are precise chemical names, so the name itself is the
          // only alias we can add with confidence. Trade-name synonyms come from
          // PubChem/CosIng, not from here.
          aliases: [{ name, source: 'prop65' as const, confidence: 1 }],
        });
      }

      // The endpoint column can carry several endpoints, e.g.
      // "cancer, developmental, female reproductive".
      const raw = (row[COL_TYPE] ?? '').toLowerCase();
      const endpoints = raw
        .split(/[,;/]/)
        .map((e) => e.trim())
        .filter(Boolean);

      if (endpoints.length === 0) {
        skipped.push({ row: index + 2, reason: 'no toxicity endpoint', raw: name });
        return;
      }

      const listedOn = row[COL_LISTED]?.trim() || undefined;

      for (const endpoint of endpoints) {
        const isCancer = endpoint.includes('cancer');
        const isRepro =
          endpoint.includes('developmental') ||
          endpoint.includes('reproductive') ||
          endpoint.includes('male') ||
          endpoint.includes('female');

        // An unrecognised endpoint still becomes a record — it will match the
        // catch-all moderate rule rather than being thrown away. Losing a Prop
        // 65 listing because we did not recognise its wording is exactly the
        // silent false negative this system exists to prevent.
        const kind: EvidenceRecord['kind'] = isCancer
          ? 'carcinogen_listing'
          : isRepro
            ? 'repro_tox_listing'
            : 'hazard_classification';

        records.push({
          substanceId: id,
          source: 'prop65',
          kind,
          jurisdiction: 'US-CA',
          domain: 'any',
          endpoint,
          statement: `Listed under California Proposition 65 for ${endpoint}${
            listedOn ? ` (listed ${listedOn})` : ''
          }.`,
          determinedOn: listedOn,
          sourceVersion: meta.version,
          fetchedAt: meta.fetchedAt,
          citation: {
            org: 'California OEHHA',
            title: 'Proposition 65 List of Chemicals',
            url: meta.url,
          },
        });
      }
    });

    return { substances: Array.from(substances.values()), records, skipped };
  },
};
