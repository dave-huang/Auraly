import fs from 'fs';
import path from 'path';

/**
 * The evidence store: facts from authoritative sources, one record per claim.
 *
 * The rule that makes this work is that NOTHING here holds a risk level. A
 * record says "OEHHA lists this for cancer, since 1994" or "EFSA set an ADI of
 * 7 mg/kg bw/day". Whether that adds up to low, moderate or high is the policy
 * engine's job, and keeping the two apart is what lets us:
 *
 *  - ingest in bulk without a human adjudicating every substance
 *  - change the entire classification by editing rules, not re-curating data
 *  - explain any verdict by naming the rule and the records it fired on
 *
 * The retired regulatory-bans.json conflated the two: it stored `risk: "high"`
 * next to a prose `regulation` string, so every new substance needed someone to
 * reach a verdict before it could be added. That is why it stalled at 40 rows.
 *
 * Records live in versioned JSON on disk rather than Postgres, deliberately.
 * The full corpus of the sources below is single-digit megabytes, so in-memory
 * lookup is free — and a regulatory corpus that lives in git gets code review,
 * blame, and a diff on every change. For a safety-critical dataset that
 * reviewability is worth more than query flexibility.
 */

export const EVIDENCE_SOURCES = [
  'prop65', // California OEHHA Prop 65 list
  'iarc', // IARC Monographs
  'clp', // ECHA CLP Annex VI harmonised classifications
  'cosing_annex_ii', // EU Cosmetics Regulation — prohibited
  'cosing_annex_iii', // EU Cosmetics Regulation — restricted, with limits
  // Annexes IV–VI are POSITIVE authorization lists: colourants, preservatives
  // and UV filters a regulator has affirmatively allowed. They are recorded as
  // `permitted`, not `restricted`, and the distinction is the whole point.
  // Nearly every entry carries a maximum concentration, because that is how an
  // authorization is written — it is not a finding of concern. Treating them as
  // restrictions would make every product containing phenoxyethanol, sodium
  // benzoate or a paraben read Caution, which is both wrong and the exact
  // false-alarm flood these lists should be curing.
  'cosing_annex_iv', // EU Cosmetics Regulation — allowed colourants
  'cosing_annex_v', // EU Cosmetics Regulation — allowed preservatives
  'cosing_annex_vi', // EU Cosmetics Regulation — allowed UV filters
  'eu_additives', // EU Reg. 1333/2008 Annexes II–III
  'fda_food_additives', // FDA Substances Added to Food + Color Additive Status
  'efsa_openfoodtox', // EFSA hazard reference points / ADIs
  'canada_hotlist', // Health Canada Cosmetic Ingredient Hotlist
  'ntp_roc', // NTP Report on Carcinogens
  // Health bodies that publish intake guidance rather than enforcement action.
  // Their statements are as dated, quotable and attributable as any register —
  // they simply answer "how much of this should a person have" instead of "is
  // this allowed on the market".
  'who', // WHO guidelines (sugars, sodium, trans fat, non-sugar sweeteners)
  'jecfa', // Joint FAO/WHO Expert Committee on Food Additives
  'curated', // Hand-entered, reviewed. Carries a citation like any other.
] as const;
export type EvidenceSource = (typeof EVIDENCE_SOURCES)[number];

export const EVIDENCE_KINDS = [
  /** Listed as a carcinogen by the source. `endpoint` carries the detail. */
  'carcinogen_listing',
  /** Listed for developmental or reproductive toxicity. */
  'repro_tox_listing',
  /** A harmonised hazard class, e.g. CLP "Carc. 1B". `classification` carries it. */
  'hazard_classification',
  /** Outright prohibited in the named jurisdiction for the named use. */
  'prohibited',
  /** Permitted but restricted — `limit` carries the numeric cap where given. */
  'restricted',
  /** Permitted for the named use with no restriction recorded. */
  'permitted',
  /** A mandatory consumer-facing warning is required. `warningText` if known. */
  'warning_required',
  /** A numeric health-based guidance value (ADI/TDI/UL). */
  'guidance_value',
  /** The source has this substance under active re-evaluation. */
  'under_review',
  /** Authorization withdrawn or lapsed. */
  'authorization_withdrawn',
  /**
   * A health body's intake guidance about a substance or nutrient.
   * `direction` carries which way it points.
   *
   * This kind is what lets the scale be about health rather than about
   * enforcement history. Nobody has banned sugar and nobody will; WHO has
   * nonetheless published a dated, quotable determination that intake above a
   * threshold carries health risk, and that is a fact about the substance which
   * a risk rating is dishonest to ignore.
   */
  'health_guidance',
  /**
   * An affirmative determination that there is no concern at typical exposure.
   * The only evidence that can honestly produce `low` for something no
   * regulator has ever needed to act on.
   */
  'no_concern_at_typical_exposure',
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/** Which market a record speaks about. */
export type Jurisdiction = 'EU' | 'UK' | 'US' | 'US-CA' | 'CA' | 'AU' | 'INTL';

/** Which product domain a record applies to. */
export type UseDomain = 'food' | 'cosmetic' | 'any';

export interface EvidenceCitation {
  org: string;
  title: string;
  year?: number;
  url?: string;
}

export interface EvidenceRecord {
  /** Substance id from the identity registry. */
  substanceId: string;
  source: EvidenceSource;
  kind: EvidenceKind;
  jurisdiction: Jurisdiction;
  domain: UseDomain;

  /** IARC group ("1", "2A", "2B", "3"). */
  iarcGroup?: '1' | '2A' | '2B' | '3';
  /** CLP class string as published, e.g. "Carc. 1B", "Repr. 2". */
  classification?: string;
  /** Prop 65 / NTP endpoint, e.g. "cancer", "developmental". */
  endpoint?: string;
  /** Numeric limit for `restricted`, e.g. { value: 0.4, unit: '%' }. */
  limit?: { value: number; unit: string; basis?: string };
  /**
   * The uses an authorisation is confined to, verbatim from the source —
   * "Rinse-off products", "Eye products", "Not to be used in products for
   * children under 3 years of age".
   *
   * Distinct from `limit` on purpose. A cap is a condition of safe use; a use
   * restriction records that the regulator found the substance unacceptable in
   * some ordinary product, which is a statement about the substance itself.
   */
  useRestriction?: string;
  /** Guidance value for `guidance_value`, e.g. ADI 7 mg/kg bw/day. */
  guidance?: { kind: 'ADI' | 'TDI' | 'UL' | 'other'; value: number; unit: string };
  /**
   * Which way a `health_guidance` record points.
   *   eliminate  — the body calls for removal from the food supply (trans fat)
   *   limit      — intake should be held below a stated threshold
   *   no_concern — assessed, and no concern found at typical exposure
   * Required on `health_guidance`; meaningless elsewhere.
   */
  direction?: 'eliminate' | 'limit' | 'no_concern';
  /** Plain-language threshold, e.g. "under 5 g of salt a day". For display. */
  threshold?: string;
  /** The exact wording a mandatory warning must carry, when specified. */
  warningText?: string;

  /** Prose straight from the source. Never our summary of it. */
  statement: string;
  /** When the source made this determination. ISO date or year. */
  determinedOn?: string;

  /** Snapshot identity of the source, so a record is reproducible. */
  sourceVersion: string;
  fetchedAt?: string;
  citation: EvidenceCitation;

  /**
   * Set when a human entered or corrected the record. Reviewed evidence and
   * bulk-ingested evidence are treated identically by the policy engine — this
   * is for provenance display, not for weighting.
   */
  reviewedBy?: string;
}

export interface EvidenceFile {
  _metadata: {
    version: string;
    updatedAt: string;
    description: string;
  };
  records: EvidenceRecord[];
}

export class EvidenceStore {
  private bySubstance = new Map<string, EvidenceRecord[]>();
  readonly version: string;
  readonly recordCount: number;

  constructor(files: EvidenceFile[]) {
    this.version = files.map((f) => f._metadata.version).join('+');
    let count = 0;
    for (const file of files) {
      for (const record of file.records) {
        const list = this.bySubstance.get(record.substanceId);
        if (list) list.push(record);
        else this.bySubstance.set(record.substanceId, [record]);
        count += 1;
      }
    }
    this.recordCount = count;
  }

  /** Every record for a substance. Empty array means we have nothing on it. */
  forSubstance(substanceId: string): EvidenceRecord[] {
    return this.bySubstance.get(substanceId) ?? [];
  }

  /**
   * Records that bear on a given product domain. A cosmetic prohibition says
   * nothing about a biscuit, and mixing the two is how you get a nonsense
   * verdict on a food label.
   */
  forSubstanceInDomain(substanceId: string, domain: Exclude<UseDomain, 'any'>): EvidenceRecord[] {
    return this.forSubstance(substanceId).filter(
      (r) => r.domain === 'any' || r.domain === domain,
    );
  }

  /**
   * The same, across every id that denotes one chemical.
   *
   * A substance filed under two names carries two half-sets of records — one
   * annex found it under one name, another under the other. Reading only the
   * id the alias happened to resolve to would answer with half the evidence,
   * and a missing prohibition is the expensive half to miss.
   */
  forSubstancesInDomain(
    substanceIds: string[],
    domain: Exclude<UseDomain, 'any'>,
  ): EvidenceRecord[] {
    if (substanceIds.length === 1) return this.forSubstanceInDomain(substanceIds[0], domain);
    return substanceIds.flatMap((id) => this.forSubstanceInDomain(id, domain));
  }

  get substanceCount(): number {
    return this.bySubstance.size;
  }

  /** Every substance we hold at least one record for. */
  substanceIds(): string[] {
    return Array.from(this.bySubstance.keys());
  }
}

const EVIDENCE_DIR = path.join(process.cwd(), 'server/data/substances/evidence');

let store: EvidenceStore | null = null;

export function loadEvidenceStore(dir: string = EVIDENCE_DIR): EvidenceStore {
  if (!fs.existsSync(dir)) {
    return new EvidenceStore([]);
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort() // deterministic load order
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as EvidenceFile);
  return new EvidenceStore(files);
}

export function getEvidenceStore(): EvidenceStore {
  if (!store) {
    try {
      store = loadEvidenceStore();
      console.log(
        `[EVIDENCE] ${store.recordCount} records across ${store.substanceCount} substances (v${store.version || 'empty'})`,
      );
    } catch (error: any) {
      console.error(`[EVIDENCE] Could not load evidence, everything resolves to unknown: ${error.message}`);
      store = new EvidenceStore([]);
    }
  }
  return store;
}

/** Test seam. */
export function __setEvidenceStore(next: EvidenceStore | null): void {
  store = next;
}
