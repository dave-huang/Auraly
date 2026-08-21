import type { EvidenceRecord } from '../evidence';
import { normalizeCas } from '../identity';
import type { IngestResult, SnapshotMeta, SourceAdapter } from './adapter';
import { slugifySubstanceId } from './adapter';

/**
 * IARC Monographs — the WHO agency's carcinogenicity classifications.
 *
 * Group 1 (carcinogenic) and 2A (probably) drive a high verdict; 2B (possibly)
 * drives moderate; Group 3 (not classifiable) is recorded but fires no rule —
 * it is still worth holding, because "IARC looked at this and could not
 * classify it" is a fact the explanation may legitimately cite, and because its
 * presence means the substance is not `unknown`.
 *
 * IARC publishes its classification list as a table on the monographs site.
 * Save it as CSV under server/data/substances/snapshots/ and run:
 *   npm run substances:ingest -- iarc <path> --version 2026-06
 */

const COL_AGENT = 'Agent';
const COL_GROUP = 'Group';
const COL_CAS = 'CAS No.';
const COL_VOLUME = 'Volume';
// The export carries two years — the volume's publication year and the year
// the evaluation was made. The publication year is the citable one.
const COL_YEAR = 'Volume publication year';

const GROUPS: Record<string, EvidenceRecord['iarcGroup']> = {
  '1': '1',
  '2a': '2A',
  '2b': '2B',
  '3': '3',
};

export const iarcAdapter: SourceAdapter = {
  source: 'iarc',
  label: 'IARC Monographs',
  accepts: ['.csv'],
  requiredColumns: [COL_AGENT, COL_GROUP],

  parse(rows: Record<string, string>[], meta: SnapshotMeta): IngestResult {
    const substances = new Map<string, any>();
    const records: EvidenceRecord[] = [];
    const skipped: IngestResult['skipped'] = [];

    rows.forEach((row, index) => {
      const name = row[COL_AGENT]?.trim();
      if (!name) {
        skipped.push({ row: index + 2, reason: 'no agent name' });
        return;
      }

      // Group strings arrive as "1", "2A", "Group 2B", "2b" and similar.
      const groupKey = (row[COL_GROUP] ?? '')
        .toLowerCase()
        .replace(/group/g, '')
        .trim();
      const group = GROUPS[groupKey];
      if (!group) {
        skipped.push({ row: index + 2, reason: `unrecognised group "${row[COL_GROUP]}"`, raw: name });
        return;
      }

      const id = slugifySubstanceId(name);
      const cas = normalizeCas(row[COL_CAS]);

      if (!substances.has(id)) {
        substances.set(id, {
          id,
          name,
          cas,
          ec: null,
          eNumber: null,
          inci: null,
          category: null,
          aliases: [{ name, source: 'iarc' as const, confidence: 1 }],
        });
      }

      const groupLabel: Record<string, string> = {
        '1': 'carcinogenic to humans (Group 1)',
        '2A': 'probably carcinogenic to humans (Group 2A)',
        '2B': 'possibly carcinogenic to humans (Group 2B)',
        '3': 'not classifiable as to carcinogenicity to humans (Group 3)',
      };

      const year = row[COL_YEAR]?.trim();
      records.push({
        substanceId: id,
        source: 'iarc',
        kind: 'hazard_classification',
        jurisdiction: 'INTL',
        domain: 'any',
        iarcGroup: group,
        classification: `IARC Group ${group}`,
        statement: `Classified by IARC as ${groupLabel[group]}.`,
        determinedOn: year,
        sourceVersion: meta.version,
        fetchedAt: meta.fetchedAt,
        citation: {
          org: 'IARC',
          title: row[COL_VOLUME] ? `IARC Monographs, Volume ${row[COL_VOLUME]}` : 'IARC Monographs',
          year: year ? Number(year) || undefined : undefined,
          url: meta.url,
        },
      });
    });

    return { substances: Array.from(substances.values()), records, skipped };
  },
};
