import type { EvidenceRecord } from '../evidence';
import { normalizeCas } from '../identity';
import type { IngestResult, SnapshotMeta, SourceAdapter } from './adapter';
import { slugifySubstanceId } from './adapter';

/**
 * EU Cosmetic Ingredient database (CosIng), Annexes II and III.
 *
 * The single highest-value source for personal care:
 *  - Annex II is a list of substances PROHIBITED in cosmetics in the EU. It is
 *    literally the "banned in Europe" claim, with an entry number to cite.
 *  - Annex III is substances permitted only under restriction, usually with a
 *    numeric maximum concentration — which is what gives the moderate tier a
 *    real backbone instead of model judgement.
 *
 * CosIng is also where INCI ↔ CAS mappings come from, so this adapter does
 * double duty: it feeds the identity registry the INCI names that personal-care
 * labels actually print.
 *
 * Two annexes, two invocations:
 *   npm run substances:ingest -- cosing_annex_ii  <path> --version 2026-06
 *   npm run substances:ingest -- cosing_annex_iii <path> --version 2026-06
 */

const COL_NAME = 'Chemical name / INN';
const COL_INCI = 'Name of Common Ingredients Glossary';
const COL_CAS = 'CAS Number';
const COL_EC = 'EC Number';
const COL_REF = 'Reference Number';
const COL_MAX = 'Maximum concentration in ready for use preparation';
const COL_CONDITIONS = 'Other';
const COL_PRODUCT_TYPE = 'Product Type, body parts';

/**
 * Split the glossary column into individual INCI names.
 *
 * One CosIng row routinely covers a family, and the glossary cell lists every
 * member of it: "BENZOIC ACID; SODIUM BENZOATE", "AMMONIUM BENZOATE / BUTYL
 * BENZOATE / CALCIUM BENZOATE", "METHYLCHLOROISOTHIAZOLINONE AND
 * METHYLISOTHIAZOLINONE". Stored as one string, that cell matches nothing: a
 * label prints SODIUM BENZOATE on its own line, and resolution is exact.
 *
 * Splitting is what makes the cosmetic corpus usable at all. INCI names do not
 * themselves contain slashes, semicolons or commas, so the separators are
 * unambiguous.
 */
function splitInciNames(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[/;,]|\s+AND\s+/i)
    .map((n) => n.trim())
    .filter((n) => n.length > 1);
}

function buildSubstance(row: Record<string, string>, id: string, inciCol = COL_INCI) {
  const name = row[COL_NAME]?.trim() || row[inciCol]?.trim() || '';
  const inciNames = splitInciNames(row[inciCol]);
  const seen = new Set<string>();
  const aliases: { name: string; source: 'cosing'; confidence: number }[] = [];
  // A name pulled out of a multi-name family cell is a weaker claim on that
  // name than a row whose glossary entry IS that name.
  //
  // Methylisothiazolinone is the case: Annex V entry 39 covers the MCI/MI
  // mixture and lists both names, while entry 57 is MI alone. Both then claimed
  // "METHYLISOTHIAZOLINONE", the registry saw a collision and — correctly
  // refusing to guess — dropped the alias entirely, so the ingredient resolved
  // to nothing. Grading the family-cell claim lower lets the exact entry win
  // without arbitrating between two equally specific claims, which stays
  // ambiguous and stays dropped.
  const inciConfidence = inciNames.length > 1 ? 0.9 : 1;
  for (const candidate of [name, ...inciNames]) {
    const key = candidate.toLowerCase();
    if (!candidate || seen.has(key)) continue;
    seen.add(key);
    aliases.push({
      name: candidate,
      source: 'cosing',
      confidence: candidate === name ? 1 : inciConfidence,
    });
  }
  return {
    id,
    name,
    cas: normalizeCas(row[COL_CAS]),
    ec: row[COL_EC]?.trim() || null,
    eNumber: null,
    inci: inciNames[0] ?? null,
    category: null,
    aliases,
  };
}

/** Pull "5 %" or "0.4%" out of the maximum-concentration column. */
function parseLimit(raw: string | undefined): { value: number; unit: string } | undefined {
  if (!raw) return undefined;
  const match = raw.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (!match) return undefined;
  const value = Number(match[1].replace(',', '.'));
  return Number.isFinite(value) ? { value, unit: '%' } : undefined;
}

/**
 * The uses an authorisation is confined to, as published.
 *
 * A concentration cap and a use restriction are different statements. Every
 * entry in Annexes IV-VI carries a cap — that is what the annexes are — and a
 * cap is the regulator saying "safe, used this way". A use restriction is the
 * regulator saying the substance is NOT acceptable in some ordinary product,
 * which is a fact about the substance and belongs in the verdict.
 *
 * Methylisothiazolinone is the case that surfaced this. It sits in Annex V at
 * 0,0015 % and rinse-off only — the EU cut it to that in 2017 after widespread
 * contact allergy from leave-on products. Reading only the cap, the corpus
 * called it "permitted, no hazard record" and the app rated it low. The
 * restriction was on the page the whole time and was being discarded.
 *
 * The annexes put it in two places. Usually it is its own column; for MI it is
 * appended to the concentration cell ("0,0015 % Rinse-off products"). Both are
 * read, because the published file is the authority on its own layout and the
 * adapter is what bends.
 */
function parseUseRestriction(row: Record<string, string>): string | undefined {
  for (const candidate of useTextCandidates(row)) {
    if (confinesUse(candidate)) return candidate;
  }
  return undefined;
}

/**
 * The cells that may carry a statement about use, in the order they should be
 * trusted: the dedicated column first, then whatever shares the concentration
 * cell.
 *
 * Both go through the same classifier. An earlier version returned the column
 * unexamined on the reasoning that a dedicated column must mean a restriction,
 * and that let "a) Rinse-off products b) Leave-on products" — a tiered cap,
 * where the substance is allowed in both — read as a confinement and move the
 * substance to moderate. Where the text sits says nothing about what it means.
 */
function useTextCandidates(row: Record<string, string>): string[] {
  const candidates: string[] = [];

  const column = row[COL_PRODUCT_TYPE]?.trim().replace(/\s+/g, ' ');
  if (column) candidates.push(column);

  const max = row[COL_MAX]?.trim().replace(/\s+/g, ' ');
  if (max) {
    // Prose sharing the concentration cell sits after the last figure quoted.
    // Splitting on the FIRST figure instead pulls in the qualifiers between
    // two of them: salicylic acid reads "3 % (as acid) Salicylic acid salts:
    // 0,5 % (acid)", and the text after its first "%" says nothing about use.
    const lastPercent = max.lastIndexOf('%');
    const trailing = (lastPercent >= 0 ? max.slice(lastPercent + 1) : max)
      .replace(/^[-–—,;:()\s]+/, '')
      .trim();
    if (trailing) candidates.push(trailing);
  }

  return candidates;
}

/** The vocabulary the annexes use when they confine a substance to some uses. */
const USE_LANGUAGE =
  /\b(products?|use[ds]?|applied|application|children|spray|rinse[- ]off|leave[- ]on|oral|eye|mucous|hair|skin|face|lip|hand|body|professional)\b/i;

/**
 * Text that mentions use but restricts nothing.
 *
 * Combined-use notes ("In case of combined use of Titanium Dioxide and
 * Titanium Dioxide (nano), the sum shall not exceed…") are caps expressed
 * across two entries. Footnotes carry labelling duties and impurity limits —
 * real obligations, but on the manufacturer, not confinements of use.
 */
const COMBINED_USE_FOOTNOTE = /combined use|^\s*\*|^footnote\b/i;

/**
 * Names both rinse-off and leave-on products, which between them are every
 * cosmetic there is. "Allowed for use as a preservative in rinse off, oral
 * care and leave-on cosmetic products" reads like a restriction and permits
 * the entire market.
 */
const COVERS_EVERY_PRODUCT = /rinse[\s-]?off/i;

/**
 * An enumeration of alternatives — "a) Rinse-off products b) Leave-on
 * products" — which is a tiered cap, not a confinement: the substance is
 * allowed in both, at different maxima. Only the sub-markers count, because
 * "a)" alone can open a single-item list.
 */
const ENUMERATED_ALTERNATIVES = /\(?\b[b-e]\)/;

/**
 * Does this text confine the substance to some uses, as opposed to describing
 * where different caps apply?
 *
 * Deliberately conservative, and it does miss cases. "(a) Lip products (b) Eye
 * shadow" is an exhaustive two-item allow-list — a real confinement — and it
 * is rejected here as an enumeration, so that substance stays low. Telling the
 * two apart needs a reading of the entry, not a pattern, and a rule that
 * guesses would be wrong in the other direction on entries where the tiers
 * cover the whole market. The rejected entries are a short list and the ingest
 * prints them, so they can be reviewed by a person and, if warranted, carried
 * as curated records rather than inferred ones.
 */
function confinesUse(text: string): boolean {
  if (COMBINED_USE_FOOTNOTE.test(text)) return false;
  if (ENUMERATED_ALTERNATIVES.test(text)) return false;
  if (COVERS_EVERY_PRODUCT.test(text) && /leave[\s-]?on/i.test(text)) return false;
  return USE_LANGUAGE.test(text);
}

/**
 * Text that talks about use but that `confinesUse` declined to act on — the
 * enumerations. Returned for the review list so the entries a person needs to
 * look at are named at ingest time instead of discovered later.
 */
function undecidedUseText(row: Record<string, string>): string | undefined {
  for (const text of useTextCandidates(row)) {
    if (COMBINED_USE_FOOTNOTE.test(text)) continue;
    if (ENUMERATED_ALTERNATIVES.test(text) && USE_LANGUAGE.test(text)) return text;
  }
  return undefined;
}

export const cosingAnnexIIAdapter: SourceAdapter = {
  source: 'cosing_annex_ii',
  label: 'EU CosIng Annex II (prohibited in cosmetics)',
  accepts: ['.csv'],
  requiredColumns: [COL_NAME],

  parse(rows, meta): IngestResult {
    const substances = new Map<string, any>();
    const records: EvidenceRecord[] = [];
    const skipped: IngestResult['skipped'] = [];

    rows.forEach((row, index) => {
      const name = row[COL_NAME]?.trim() || row[COL_INCI]?.trim();
      if (!name) {
        skipped.push({ row: index + 2, reason: 'no substance or INCI name' });
        return;
      }
      const id = slugifySubstanceId(name);
      if (!substances.has(id)) substances.set(id, buildSubstance(row, id));

      const ref = row[COL_REF]?.trim();
      records.push({
        substanceId: id,
        source: 'cosing_annex_ii',
        kind: 'prohibited',
        jurisdiction: 'EU',
        domain: 'cosmetic',
        statement: `Prohibited in cosmetic products in the EU${
          ref ? ` (Annex II, entry ${ref})` : ''
        }.`,
        sourceVersion: meta.version,
        fetchedAt: meta.fetchedAt,
        citation: {
          org: 'European Union',
          title: 'Regulation (EC) No 1223/2009, Annex II',
          url: meta.url,
        },
      });
    });

    return { substances: Array.from(substances.values()), records, skipped };
  },
};

export const cosingAnnexIIIAdapter: SourceAdapter = {
  source: 'cosing_annex_iii',
  label: 'EU CosIng Annex III (restricted in cosmetics)',
  accepts: ['.csv'],
  requiredColumns: [COL_NAME],

  parse(rows, meta): IngestResult {
    const substances = new Map<string, any>();
    const records: EvidenceRecord[] = [];
    const skipped: IngestResult['skipped'] = [];

    rows.forEach((row, index) => {
      const name = row[COL_NAME]?.trim() || row[COL_INCI]?.trim();
      if (!name) {
        skipped.push({ row: index + 2, reason: 'no substance or INCI name' });
        return;
      }
      const id = slugifySubstanceId(name);
      if (!substances.has(id)) substances.set(id, buildSubstance(row, id));

      const limit = parseLimit(row[COL_MAX]);
      const conditions = row[COL_CONDITIONS]?.trim();
      const ref = row[COL_REF]?.trim();

      records.push({
        substanceId: id,
        source: 'cosing_annex_iii',
        kind: 'restricted',
        jurisdiction: 'EU',
        domain: 'cosmetic',
        limit: limit ? { ...limit, basis: 'ready for use preparation' } : undefined,
        statement:
          `Permitted in EU cosmetics only under restriction` +
          (limit ? `, to a maximum of ${limit.value}${limit.unit} in the finished product` : '') +
          (ref ? ` (Annex III, entry ${ref})` : '') +
          '.' +
          (conditions ? ` ${conditions}` : ''),
        sourceVersion: meta.version,
        fetchedAt: meta.fetchedAt,
        citation: {
          org: 'European Union',
          title: 'Regulation (EC) No 1223/2009, Annex III',
          url: meta.url,
        },
      });
    });

    return { substances: Array.from(substances.values()), records, skipped };
  },
};

// Annex IV names its columns slightly differently from V and VI.
const COL_NAME_IV = 'Chemical name';
const COL_INCI_IV = 'Colour index Number / Name of Common Ingredients Glossary';

/**
 * Annexes IV, V and VI — the POSITIVE lists: colourants, preservatives and UV
 * filters a regulator has affirmatively allowed in cosmetics.
 *
 * Recorded as `permitted`, deliberately not as `restricted`. Nearly every entry
 * carries a maximum concentration, because a cap is how an authorization is
 * expressed — it is not a finding of concern. Importing these as restrictions
 * would rate phenoxyethanol, sodium benzoate and every paraben as Caution, i.e.
 * most of the cosmetics aisle, which is the false-alarm problem these lists
 * exist to fix rather than cause.
 *
 * `permitted` is also the lowest-precedence signal in the policy engine, so a
 * substance that is authorised here AND carries a hazard record from Prop 65,
 * IARC or Annex II keeps the hazard level. Authorization only decides the level
 * when nothing else has anything against the substance.
 *
 * Where a cap is not a finding of concern, a USE restriction is. The two were
 * treated alike here at first, on the reasoning that we cannot tell a rinse-off
 * product from a leave-on one and so should print the condition and let the
 * reader apply it. That was wrong, and methylisothiazolinone is how it showed:
 * Annex V entry 57 confines it to rinse-off products at 0,0015 %, the EU having
 * cut it to that in 2017 after widespread contact allergy from leave-on use.
 * Reading only the cap, the app rated it low and printed "Safe" over one of the
 * better-documented cosmetic sensitisers of the last decade.
 *
 * Not knowing which kind of product is in the user's hand is precisely the
 * reason to raise it, not to stay quiet: a regulator has ruled the substance
 * out of some ordinary product, and we cannot rule out that this is one. So a
 * confined authorisation reads moderate, an unconditional one stays low, and
 * `parseUseRestriction` records which is which — still quoting the source
 * verbatim, and still refusing to invent a level where the text is ambiguous.
 */
function makeAllowListAdapter(opts: {
  source: 'cosing_annex_iv' | 'cosing_annex_v' | 'cosing_annex_vi';
  label: string;
  annex: string;
  nameCol: string;
  inciCol: string;
}): SourceAdapter {
  return {
    source: opts.source,
    label: opts.label,
    accepts: ['.csv'],
    requiredColumns: [opts.nameCol, opts.inciCol],

    parse(rows, meta): IngestResult {
      const substances = new Map<string, any>();
      const records: EvidenceRecord[] = [];
      const skipped: IngestResult['skipped'] = [];
      const review: NonNullable<IngestResult['review']> = [];

      rows.forEach((row, index) => {
        const name = row[opts.nameCol]?.trim() || row[opts.inciCol]?.trim();
        if (!name) {
          skipped.push({ row: index + 2, reason: 'no substance or INCI name' });
          return;
        }
        const id = slugifySubstanceId(name);
        if (!substances.has(id)) {
          const built = buildSubstance({ ...row, [COL_NAME]: row[opts.nameCol] }, id, opts.inciCol);
          substances.set(id, built);
        }

        const limit = parseLimit(row[COL_MAX]);
        const maxText = row[COL_MAX]?.trim().replace(/\s+/g, ' ');
        const conditions = row[COL_CONDITIONS]?.trim();
        const ref = row[COL_REF]?.trim();

        const useRestriction = parseUseRestriction(row);
        const undecided = undecidedUseText(row);
        if (!useRestriction && undecided) {
          review.push({
            row: index + 2,
            note: `${name.slice(0, 60)} — use text not classified, level left at permitted`,
            raw: undecided,
          });
        }

        records.push({
          substanceId: id,
          source: opts.source,
          kind: 'permitted',
          jurisdiction: 'EU',
          domain: 'cosmetic',
          limit: limit ? { ...limit, basis: 'ready for use preparation' } : undefined,
          useRestriction,
          statement:
            `Authorised for use in EU cosmetics` +
            (ref ? ` (${opts.annex}, entry ${ref})` : '') +
            (maxText ? `, up to ${maxText}` : '') +
            '.' +
            (conditions ? ` ${conditions}` : ''),
          sourceVersion: meta.version,
          fetchedAt: meta.fetchedAt,
          citation: {
            org: 'European Union',
            title: `Regulation (EC) No 1223/2009, ${opts.annex}`,
            url: meta.url,
          },
        });
      });

      return { substances: Array.from(substances.values()), records, skipped, review };
    },
  };
}

export const cosingAnnexIVAdapter = makeAllowListAdapter({
  source: 'cosing_annex_iv',
  label: 'EU CosIng Annex IV (allowed colourants)',
  annex: 'Annex IV',
  nameCol: COL_NAME_IV,
  inciCol: COL_INCI_IV,
});

export const cosingAnnexVAdapter = makeAllowListAdapter({
  source: 'cosing_annex_v',
  label: 'EU CosIng Annex V (allowed preservatives)',
  annex: 'Annex V',
  nameCol: COL_NAME,
  inciCol: COL_INCI,
});

export const cosingAnnexVIAdapter = makeAllowListAdapter({
  source: 'cosing_annex_vi',
  label: 'EU CosIng Annex VI (allowed UV filters)',
  annex: 'Annex VI',
  nameCol: COL_NAME,
  inciCol: COL_INCI,
});
