import type { EvidenceRecord } from '../evidence';
import { normalizeCas } from '../identity';
import type { IngestResult, SnapshotMeta, SourceAdapter } from './adapter';
import { slugifySubstanceId } from './adapter';

/**
 * EFSA OpenFoodTox — health-based guidance values, chiefly acceptable daily
 * intakes.
 *
 * What an ADI is, and why that governs everything below: it is the amount of a
 * substance a person can consume every day for a lifetime without appreciable
 * risk. A regulator derives one at the END of a safety assessment, and then
 * authorises uses that keep expected intake underneath it. An ADI is therefore
 * a finding of SAFETY with a number attached — not a warning.
 *
 * The corpus learned this the hard way. `moderate.has_guidance_value` used to
 * read any guidance value as a caution, and switching this source on would have
 * moved sixty-seven substances from low to moderate, among them riboflavin —
 * vitamin B2 — along with potassium sorbate, tartaric acid and MSG. Rating
 * vitamin B2 as a caution because somebody had established how much of it is
 * safe is precisely backwards, and it is the false-alarm flood that teaches
 * people to ignore the colour. The rule was narrowed; see policy.ts.
 *
 * So these records exist to be QUOTED, not to be scored. "EFSA set an
 * acceptable daily intake of 25 mg per kg of body weight in 2015" is a good
 * sentence to show someone reading an ingredient list, and until now the app
 * could not say anything of the kind.
 *
 * Snapshot: snapshot-efsa-oft.ts, which flattens EFSA's 18-sheet workbook.
 *
 *   npm run substances:ingest -- efsa_openfoodtox <path> --version 2026-08
 */

const COL_SUBSTANCE = 'Substance';
const COL_CAS = 'CAS number';
const COL_LOWER = 'ADI lower';
const COL_UPPER = 'ADI upper';
const COL_UNIT = 'ADI unit';
const COL_NONE = 'No ADI allocated';
const COL_DOMAIN = 'Food domain';
const COL_OUTPUT = 'EFSA output';
const COL_DOI = 'DOI';
const COL_DATE = 'Evaluation date';

/**
 * EFSA aliases are trusted a step below an exact name, deliberately.
 *
 * A dossier's subject is an assessment scope, not always a labelled ingredient:
 * the nitrite entry is called "Nitrites", covering a family. A name like that
 * is a fair alias but a poor arbiter, and letting it tie with a substance's own
 * recorded name is how a common ingredient stops resolving — the mistake the
 * FDA ingest made and paid for.
 */
const EFSA_ALIAS_CONFIDENCE = 0.95;

/**
 * Round a spreadsheet float back to what a person wrote.
 *
 * EFSA's export renders 0.07 as 7.0000000000000007E-2. Quoting that at a user
 * would be absurd, and storing it would make two snapshots of the same value
 * compare unequal.
 */
function parseValue(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return Number(value.toPrecision(6));
}

/**
 * What an assessment was FOR, from EFSA's "Food domain" column and, because
 * that column is sometimes blank or "other:" even on a food additive
 * re-evaluation (acesulfame K 2020, neotame 2025), from the opinion's title.
 *
 * A side assessment is about something other than people eating the
 * substance as a food ingredient: a feed additive (often for pets), a
 * pesticide residue, a contaminant, a previous cargo in a food tanker. Its
 * ADI may be a real human value, but it is not EFSA's position on the
 * substance as food, and a reader shown "EFSA set an acceptable daily intake"
 * above a citation about cat food is right to distrust the page.
 *
 * "Food and feed additives" in a title is a food assessment (EFSA's 2013
 * statement on Allura Red covers both), so the feed patterns are specific.
 */
const SIDE_DOMAINS = new Set([
  'pesticides',
  'sensory additives',
  'zootechnical additives',
  'nutritional additives',
  'technological additives',
  'cocciodiostats / hormones / histomonostats',
  'processing contaminants',
  'natural plant product contaminants',
  'persistent organic pollutants',
  'food contact materials',
]);
const SIDE_TITLE =
  /\bin feed\b|as (a )?feed additive|feed additive for|feedingstuff|for (cats|dogs|chickens|pigs|piglets|poultry|rabbits|turkeys|all animal)|animal species|pesticide|\bMRLs?\b|maximum residue|previous cargoes/i;
const FOOD_DOMAINS = new Set(['food additives', 'flavourings', 'nutrient sources']);
const FOOD_TITLE = /food additive|flavouring group|\(E ?\d{3}/i;

/** A side assessment, by EFSA's domain (may be blank) and the opinion's title. */
export function sideAssessment(domain: string, title: string): boolean {
  return SIDE_DOMAINS.has(domain) || SIDE_TITLE.test(title);
}

function assessedAsFood(domain: string, title: string): boolean {
  if (sideAssessment(domain, title)) return false;
  return FOOD_DOMAINS.has(domain) || FOOD_TITLE.test(title);
}

export const efsaOpenFoodToxAdapter: SourceAdapter = {
  source: 'efsa_openfoodtox',
  label: 'EFSA OpenFoodTox',
  accepts: ['.csv'],
  requiredColumns: [COL_SUBSTANCE, COL_UNIT, COL_OUTPUT],

  parse(rows: Record<string, string>[], meta: SnapshotMeta): IngestResult {
    const substances = new Map<string, any>();
    const candidates: EvidenceRecord[] = [];
    const domains = new Map<EvidenceRecord, string>();
    const skipped: IngestResult['skipped'] = [];
    const review: NonNullable<IngestResult['review']> = [];

    rows.forEach((row, index) => {
      const name = row[COL_SUBSTANCE]?.trim();
      if (!name) {
        skipped.push({ row: index + 2, reason: 'no substance name' });
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
          aliases: [{ name, source: 'efsa' as const, confidence: EFSA_ALIAS_CONFIDENCE }],
        });
      }

      const output = row[COL_OUTPUT]?.trim() || 'an EFSA scientific opinion';
      const doi = row[COL_DOI]?.trim();
      const date = row[COL_DATE]?.trim();
      const citation = {
        org: 'EFSA',
        title: output,
        year: date ? Number(date.slice(0, 4)) || undefined : undefined,
        url: doi ? `https://doi.org/${doi.replace(/^doi:/i, '')}` : meta.url,
      };

      // EFSA sometimes records that no ADI was set. That reads like a concern
      // and is usually the opposite — "not deemed necessary" because exposure
      // is trivially low — but it can also mean the data would not support one.
      // The two are told apart only by reading the opinion, so nothing is
      // ingested and the row is printed for a person to judge.
      if (row[COL_NONE]?.trim() && !row[COL_LOWER]?.trim() && !row[COL_UPPER]?.trim()) {
        review.push({
          row: index + 2,
          note: 'EFSA allocated no ADI — reason is in the opinion text, not in the data',
          raw: `${name} — ${output}`,
        });
        return;
      }

      const value = parseValue(row[COL_LOWER] || row[COL_UPPER] || '');
      const unit = row[COL_UNIT]?.trim();
      if (value === null || !unit) {
        skipped.push({ row: index + 2, reason: 'no usable ADI value or unit', raw: name });
        return;
      }

      const bounded = row[COL_LOWER]?.trim() && row[COL_UPPER]?.trim() ? ' (range)' : '';
      const domain = row[COL_DOMAIN]?.trim();

      const record: EvidenceRecord = {
        substanceId: id,
        source: 'efsa_openfoodtox',
        kind: 'guidance_value',
        jurisdiction: 'EU',
        // An intake value is about eating it. A cosmetic label is not the place
        // to quote a daily dietary intake, so these never reach that domain.
        domain: 'food',
        guidance: { kind: 'ADI', value, unit },
        statement:
          `EFSA established an acceptable daily intake of ${value} ${unit}${bounded}` +
          `${domain ? ` in its assessment of ${domain}` : ''}, in "${output}".`,
        determinedOn: date || undefined,
        sourceVersion: meta.version,
        fetchedAt: meta.fetchedAt,
        citation,
      };
      candidates.push(record);
      domains.set(record, domain ?? '');
    });

    // One ADI per substance: the most recent.
    //
    // A substance assessed repeatedly carries its whole history here. Sorbates
    // hold three — JECFA's 25 mg/kg from 1974, a temporary group ADI of 3 set
    // in the 2015 re-evaluation, and 11 from the 2019 follow-up. Those are not
    // three simultaneous answers, they are one answer that changed twice, and
    // showing a reader all of them side by side would present a revision
    // history as a disagreement. An ADI supersedes its predecessor; the current
    // one is EFSA's position and the older ones are superseded, so only the
    // newest survives. Undated values lose to dated ones, and a true tie goes
    // to the lower number, which is the more protective of the two.
    //
    // But only among assessments of the same kind. Until 2026-09-26 the newest
    // row won whatever it assessed, and for a food additive that was often a
    // pet-food opinion: tartrazine's ADI was quoted as 10, from "Safety and
    // efficacy of tartrazine (E 102) for cats and dogs...", when EFSA's own
    // re-evaluation of it as a food additive set 7.5. So when EFSA has assessed
    // a substance as food (see assessedAsFood), assessments of it as a feed
    // additive, a pesticide or a contaminant are set aside first. A substance
    // EFSA only ever assessed as a pesticide keeps its newest row, as before.
    const bySubstance = new Map<string, EvidenceRecord[]>();
    for (const record of candidates) {
      const list = bySubstance.get(record.substanceId) ?? [];
      list.push(record);
      bySubstance.set(record.substanceId, list);
    }
    const side = (r: EvidenceRecord) => sideAssessment(domains.get(r) ?? '', r.citation?.title ?? '');
    const food = (r: EvidenceRecord) => assessedAsFood(domains.get(r) ?? '', r.citation?.title ?? '');
    const eligible = Array.from(bySubstance.values()).flatMap((list) =>
      list.some(food) ? list.filter((r) => !side(r)) : list,
    );

    const newest = new Map<string, EvidenceRecord>();
    for (const record of eligible) {
      const held = newest.get(record.substanceId);
      if (!held) {
        newest.set(record.substanceId, record);
        continue;
      }
      const a = record.determinedOn ?? '';
      const b = held.determinedOn ?? '';
      const supersedes =
        a > b || (a === b && (record.guidance?.value ?? 0) < (held.guidance?.value ?? 0));
      if (supersedes) newest.set(record.substanceId, record);
    }

    return {
      substances: Array.from(substances.values()),
      records: Array.from(newest.values()),
      skipped,
      review,
    };
  },
};
