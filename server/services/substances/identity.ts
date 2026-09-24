import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Substance identity — the layer every other join depends on.
 *
 * Authoritative sources key on CAS numbers, EC numbers, E-numbers and INCI
 * names. Labels print marketing names. "Red 40" and "Allura Red AC" and "E129"
 * and "CI 16035" are one substance, and a system that cannot see that will
 * report "no hazards found" for an ingredient that is listed under a name it
 * failed to match. A silent false negative in a safety app is the worst class
 * of bug we can ship, so this module is deliberately pessimistic:
 *
 *  - an alias match must be EXACT after normalization, or
 *  - a match must clear an explicit, per-alias confidence bar,
 *  - and anything else resolves to null, which the policy engine reads as
 *    "unknown" rather than "nothing found".
 *
 * The retired regulatory-bans.json did the opposite. It substring-matched every
 * regulated term against the ingredient name with a word-boundary regex, so
 * "lake salt" matched the "lake" dye pattern and "formaldehyde-free" matched
 * "formaldehyde" — both classified high. Confident wrong answers are worse than
 * admitted ignorance, and this module will not produce them.
 */

/** How an alias came to be attached to a substance. */
export type AliasSource =
  | 'curated' // a human wrote it down
  | 'cosing' // EU Cosmetic Ingredient database (INCI ↔ CAS)
  | 'pubchem' // PubChem synonym list
  | 'eu_additives' // E-number ↔ name from the EU additive annexes
  | 'codex_ins' // an INS number (Codex International Numbering System) read as its E number
  | 'prop65' // OEHHA chemical name
  | 'iarc' // IARC agent name
  | 'fda' // FDA Substances Added to Food inventory name
  | 'efsa' // EFSA OpenFoodTox dossier subject name
  /**
   * The substance's own preferred name, indexed as an alias of itself.
   *
   * Never written to a data file — the registry synthesises it at index time.
   * It exists as its own source so that `curated` can keep meaning what it says:
   * a name a person recorded, deliberately, as denoting this substance. When
   * every entry's own name also counted as curated, "a human wrote this down"
   * was true of all 7,764 substances and could not break a tie between any two
   * of them.
   */
  | 'self';

export interface SubstanceAlias {
  /** The printable form, as written by the source. */
  name: string;
  source: AliasSource;
  /**
   * 1.0 means "this string denotes exactly this substance". Lower values are
   * for aliases that are real but ambiguous in isolation — a bare colour name,
   * a truncated trade name. `MIN_ALIAS_CONFIDENCE` is the bar to match on.
   */
  confidence: number;
}

export interface Substance {
  /** Stable internal id. Never a CAS number — those change hands and get retired. */
  id: string;
  /** Preferred display name. */
  name: string;
  /** CAS registry number, when a source has given us one. Never invented. */
  cas?: string | null;
  /** EC / EINECS number. */
  ec?: string | null;
  /** EU food-additive E-number, e.g. "E129". */
  eNumber?: string | null;
  /** INCI name, for personal-care matching. */
  inci?: string | null;
  /**
   * Functional grouping (synthetic_dye, paraben, phthalate...). Descriptive
   * only — the policy engine must never infer a hazard from a category, because
   * "is a paraben" is not evidence about a specific paraben.
   */
  category?: string | null;
  aliases: SubstanceAlias[];
}

export interface SubstanceRegistryFile {
  _metadata: {
    /**
     * What is in this file, derived rather than written.
     *
     * Every source that has contributed, joined the way the evidence store
     * joins its own, followed by a fingerprint of the substances themselves.
     * `stampRegistry` computes it; nobody types it.
     *
     * The fingerprint is the part that matters. This string is reported by
     * /api/healthz and is the only way to tell what a running server is
     * actually classifying against — and for twelve days it did not do that.
     * Both writers bumped `updatedAt` and left `version` alone, so the registry
     * went from 3,903 substances to 8,487 across three ingests and a curation
     * pass while still calling itself curated-nutrients-2026-08-12. A corpus
     * whose whole claim is that every record traces to a snapshot cannot have a
     * version that stops describing it, and a rule saying "remember to bump
     * this" would have failed the same way. Deriving it from the contents means
     * it cannot be forgotten.
     */
    version: string;
    updatedAt: string;
    description: string;
    /** Source stamps that have contributed, in the order they arrived. */
    sources?: string[];
  };
  substances: Substance[];
}

/**
 * Fingerprint of the identity content — everything a lookup can depend on.
 *
 * Deliberately not a hash of the file. Formatting, key order and `updatedAt`
 * must not change the fingerprint, or every rewrite would look like a corpus
 * change and the signal would be worthless. Two registries with the same
 * fingerprint resolve every name identically.
 */
export function fingerprintSubstances(substances: Substance[]): string {
  const canonical = substances
    .map((s) =>
      [
        s.id,
        s.name,
        s.cas ?? '',
        s.ec ?? '',
        s.eNumber ?? '',
        s.inci ?? '',
        [...s.aliases]
          .map((a) => `${a.name}:${a.source}:${a.confidence}`)
          .sort()
          .join('|'),
      ].join('\u0001'),
    )
    .sort()
    .join('\u0002');
  return createHash('sha256').update(canonical).digest('hex').slice(0, 12);
}

/**
 * Record a contribution and restamp the version. Called by every writer.
 *
 * Idempotent in the way that matters: re-running the same ingest re-records the
 * same stamp once and produces the same fingerprint, so a no-op ingest leaves
 * the version alone.
 */
export function stampRegistry(file: SubstanceRegistryFile, contribution: string): string {
  const sources = file._metadata.sources ?? [];
  if (contribution && !sources.includes(contribution)) sources.push(contribution);
  file._metadata.sources = sources;
  file._metadata.updatedAt = new Date().toISOString().slice(0, 10);
  file._metadata.version = `${sources.join('+')}#${fingerprintSubstances(file.substances)}`;
  return file._metadata.version;
}

/** Aliases below this confidence never produce a match on their own. */
export const MIN_ALIAS_CONFIDENCE = 0.9;

/**
 * Normalize a label string for comparison.
 *
 * Deliberately conservative: it folds case, punctuation and whitespace, and
 * nothing else. It does NOT strip parentheticals or qualifiers, because
 * "sodium benzoate" and "sodium benzoate-free" must not normalize alike.
 */
export function normalizeSubstanceName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining accents
    .replace(/[&]/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * An E number in one canonical form, or null if the text is not one.
 *
 * Labels print the same number several ways: "E171", "E 171", "E-171",
 * "e171". Normalizing as an ordinary name folds the hyphen into a space and
 * keeps the space, so "E 171" became "e 171" while the registry held "e171",
 * and every spaced or hyphenated E number on a label resolved to nothing.
 * Suffixes are kept, because they name different additives: E160a is not
 * E160b, and E160a(ii) is not E160a(i).
 *
 * Only a whole name that is nothing but an E number matches. "E 330 citric
 * acid" is a name with a number in it, and it resolves (or fails) as a name.
 */
export function eNumberKey(raw: string): string | null {
  const m = normalizeSubstanceName(raw).match(/^e ?(\d{3,4}) ?([a-z])?(?: ?([ivx]+))?$/);
  return m ? `e${m[1]}${m[2] ?? ''}${m[3] ?? ''}` : null;
}

/**
 * Words a label uses to introduce an additive by number, as in Australian and
 * New Zealand labels: "Thickener (1422)", "Colour (102)", "Food acid (330)".
 * The class word says what the additive does; the number says which one.
 */
const ADDITIVE_CLASSES = [
  'colour', 'colours', 'color', 'colors', 'preservative', 'preservatives', 'emulsifier', 'emulsifiers',
  'thickener', 'thickeners', 'vegetable gum', 'vegetable gums', 'stabiliser', 'stabilisers', 'stabilizer',
  'stabilizers', 'antioxidant', 'antioxidants', 'food acid', 'food acids', 'acid', 'acidity regulator',
  'acidity regulators', 'mineral salt', 'mineral salts', 'flavour enhancer', 'flavour enhancers',
  'flavor enhancer', 'flavor enhancers', 'raising agent', 'raising agents', 'sweetener', 'sweeteners',
  'humectant', 'humectants', 'gelling agent', 'gelling agents', 'anticaking agent', 'anti caking agent',
  'anticaking agents', 'anti caking agents', 'firming agent', 'glazing agent', 'bulking agent',
  'modified starch', 'emulsifying salt', 'emulsifying salts', 'propellant', 'packaging gas', 'enzyme',
].sort((a, b) => b.length - a.length).join('|');

const ADDITIVE_NUMBER = new RegExp(
  // Optional class word, optional "E" or "INS" (with "no"), then the number,
  // an optional letter and an optional Roman sub-index. Normalization has
  // already turned every bracket, hyphen and full stop into a single space.
  `^(?:(?:${ADDITIVE_CLASSES}) )?(?:(e|ins)(?: no)? ?)?(\\d{3,4}) ?([a-z])?(?: ?([ivx]+))?$`,
);

/**
 * Where INS and E numbering part ways, keyed by the INS form, valued by the E
 * number the registry holds. Short on purpose: for everything else the two
 * systems use the same number, and a guessed mapping here would put one
 * additive's verdict on another.
 *
 *   307a, 307c  d- and dl-alpha-tocopherol, which the EU numbers E307
 *   307b        tocopherol concentrate, mixed: the EU's E306
 *   960a-d      steviol glycosides by source; the registry holds them as E960
 */
const INS_TO_E: Record<string, string> = {
  e307a: 'e307', e307b: 'e306', e307c: 'e307',
  e960a: 'e960', e960b: 'e960', e960c: 'e960', e960d: 'e960',
};

/**
 * The E-number key for any way a label refers to a food additive by number,
 * or null if the text is not such a reference.
 *
 * INS numbers are the Codex twin of E numbers and, for everything in this
 * registry, the same number: INS 171 and E171 are both titanium dioxide. So
 * they share one index, the E-number one, and "INS 171" is looked up as e171.
 * Labels print them as "INS 171", "INS No. 171", and in Australia and New
 * Zealand as a class word with a bracketed number, "Thickener (1422)", or as
 * the number alone.
 *
 * `how` says which it was, so the resolver can record where the number came
 * from. A bare number is only ever looked up among numbers the registry
 * holds, so it cannot turn an unknown string into a wrong substance.
 */
export function additiveNumberKey(raw: string): { key: string; kind: 'e' | 'ins' | 'bare' } | null {
  const m = normalizeSubstanceName(raw).match(ADDITIVE_NUMBER);
  if (!m) return null;
  const [, prefix, digits, letter, roman] = m;
  const n = Number(digits);
  // The E and INS series run from 100; nothing below is an additive number.
  if (n < 100) return null;
  return {
    key: `e${digits}${letter ?? ''}${roman ?? ''}`,
    kind: prefix === 'e' ? 'e' : prefix === 'ins' ? 'ins' : 'bare',
  };
}

/** Normalize a CAS number to its canonical hyphenated form, or null. */
export function normalizeCas(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, '');
  // CAS is 2–7 digits, then 2, then a single check digit.
  if (digits.length < 5 || digits.length > 10) return null;
  const check = digits.slice(-1);
  const middle = digits.slice(-3, -1);
  const first = digits.slice(0, -3);
  const cas = `${first}-${middle}-${check}`;
  return isValidCas(cas) ? cas : null;
}

/**
 * CAS check-digit validation.
 *
 * Worth doing: a mistyped or OCR-mangled CAS that still parses would join
 * evidence onto the wrong substance, which is exactly the failure this whole
 * layer exists to prevent.
 */
export function isValidCas(cas: string): boolean {
  const match = cas.match(/^(\d{2,7})-(\d{2})-(\d)$/);
  if (!match) return false;
  const digits = (match[1] + match[2]).split('').reverse();
  const sum = digits.reduce((acc, d, i) => acc + Number(d) * (i + 1), 0);
  return sum % 10 === Number(match[3]);
}

export interface ResolvedSubstance {
  substance: Substance;
  /** The alias that matched. */
  via: SubstanceAlias;
  /** 'exact' on a normalized alias hit; 'identifier' on CAS/EC/E-number. */
  how: 'exact' | 'identifier';
}

/**
 * The physical form a substance entry is about, when the entry says so.
 *
 * Only forms that carry their own regulatory treatment. Two entries agreeing
 * here means neither is talking about a form the other excludes; it is not an
 * attempt to model particle size.
 */
function formOf(substance: Substance): string {
  const text = `${substance.name} ${substance.inci ?? ''}`.toLowerCase();
  const forms: string[] = [];
  if (/\bnano\b|\(nano\)|nanomaterial/.test(text)) forms.push('nano');
  if (/\bfibrous\b/.test(text)) forms.push('fibrous');
  if (/\bpowder form\b|\bin powder\b/.test(text)) forms.push('powder');
  if (/\bspray\b|\baerosol\b/.test(text)) forms.push('spray');
  return forms.sort().join('+');
}

export class SubstanceRegistry {
  private byId = new Map<string, Substance>();
  private byAlias = new Map<string, { substance: Substance; alias: SubstanceAlias }>();
  private byCas = new Map<string, Substance>();
  private byENumber = new Map<string, Substance>();
  private ambiguous = new Set<string>();
  /**
   * Substance ids that denote the same chemical, grouped by CAS number.
   *
   * The annexes file one substance under several names — Annex III lists
   * "Talc: hydrated magnesium silicate", another list has plain "Talc" — and
   * each becomes its own entry with its own id. Both then claim the alias
   * "talc", the registry saw two claimants of equal confidence, and correctly
   * refusing to guess it dropped the alias: talc resolved to nothing at all.
   * The same went for hydrogen peroxide, resorcinol, benzyl alcohol, coumarin,
   * eugenol, benzoyl peroxide, kojic acid and carbon black — none of them
   * exotic, all of them silent on a scan.
   *
   * A shared CAS number settles it without guessing. CAS identifies the
   * chemical, so two entries carrying the same one are not rival claimants,
   * they are one substance recorded twice, and the honest response is to treat
   * them as one rather than to throw the name away. Their evidence is unioned,
   * so nothing a source said is lost to the merge.
   */
  private idsByCas = new Map<string, string[]>();

  readonly version: string;

  constructor(file: SubstanceRegistryFile) {
    this.version = file._metadata.version;

    // Two passes: identity first, then aliases. Alias arbitration has to know
    // whether two claimants share a CAS, which is not knowable until every
    // substance has been seen.
    for (const substance of file.substances) {
      this.register(substance);
    }
    for (const substance of file.substances) {
      this.indexAliases(substance);
    }

    // Aliases that point at more than one substance are dropped rather than
    // arbitrated. If "red 40" ever denoted two substances, guessing between
    // them is worse than admitting we cannot tell.
    for (const key of this.ambiguous) {
      this.byAlias.delete(key);
    }
  }

  private register(substance: Substance): void {
    if (this.byId.has(substance.id)) {
      throw new Error(`Duplicate substance id: ${substance.id}`);
    }
    this.byId.set(substance.id, substance);

    const cas = normalizeCas(substance.cas);
    if (cas) {
      if (!this.byCas.has(cas)) this.byCas.set(cas, substance);
      this.idsByCas.set(cas, [...(this.idsByCas.get(cas) ?? []), substance.id]);
    }
    if (substance.eNumber) {
      const key = eNumberKey(substance.eNumber);
      if (key) this.byENumber.set(key, substance);
    }
  }

  /** Every id that denotes the same chemical as `id`, including `id` itself. */
  sameSubstanceIds(id: string): string[] {
    const substance = this.byId.get(id);
    const cas = normalizeCas(substance?.cas);
    if (!substance || !cas) return [id];
    const group = this.idsByCas.get(cas);
    if (!group || group.length <= 1) return [id];
    // Same CAS is where the group comes from; `isSameSubstance` is what decides
    // membership, so the nano entry does not sweep the bulk one in with it.
    return group.filter((other) => {
      if (other === id) return true;
      const candidate = this.byId.get(other);
      return !!candidate && this.isSameSubstance(substance, candidate);
    });
  }

  private isSameSubstance(a: Substance, b: Substance): boolean {
    const casA = normalizeCas(a.cas);
    const casB = normalizeCas(b.cas);
    if (!casA || casA !== casB) return false;
    // A shared CAS is necessary but not sufficient. Regulators treat the
    // physical form as a separate entity with its own entry and its own
    // limits: titanium dioxide and titanium dioxide (nano) share CAS
    // 13463-67-7, carbon black and carbon black (nano) share 1333-86-4, and
    // talc is restricted in fibrous form specifically. Merging on CAS alone
    // would push the nano entry's restrictions onto the bulk substance —
    // trading one wrong answer for another, in the direction that cries wolf.
    return formOf(a) === formOf(b);
  }

  private indexAliases(substance: Substance): void {

    const aliases: SubstanceAlias[] = [
      { name: substance.name, source: 'self', confidence: 1 },
      ...substance.aliases,
      ...(substance.inci ? [{ name: substance.inci, source: 'cosing' as AliasSource, confidence: 1 }] : []),
    ];

    for (const alias of aliases) {
      if (alias.confidence < MIN_ALIAS_CONFIDENCE) continue;
      const key = normalizeSubstanceName(alias.name);
      if (!key) continue;
      const existing = this.byAlias.get(key);
      if (existing && existing.substance.id !== substance.id) {
        // Same chemical filed twice, not two chemicals with one name. Keep the
        // entry already indexed and move on: `sameSubstanceIds` unions their
        // evidence, so which of the two wins the name changes nothing about
        // what is known, and dropping the name over it would lose the
        // ingredient entirely.
        if (this.isSameSubstance(existing.substance, substance)) {
          this.ambiguous.delete(key);
          continue;
        }

        // Two substances want the same name. A more confident claim wins; two
        // equally confident claims are genuinely ambiguous and get dropped.
        //
        // This is not arbitration between rival substances — it is preferring a
        // source that names the substance exactly over one that mentions it as
        // a member of a family. A published list may cover a substance both on
        // its own and inside a mixture; the standalone entry is the better
        // identity, and dropping both leaves a common ingredient unresolvable.
        if (alias.confidence > existing.alias.confidence) {
          this.ambiguous.delete(key);
          this.byAlias.set(key, { substance, alias });
          continue;
        }
        if (alias.confidence < existing.alias.confidence) {
          // Keep the stronger claim already indexed.
          continue;
        }

        // Equal confidence, and one claimant carries a CAS number while the
        // other does not. That is not a tie: a CAS is an identity assertion
        // about a single chemical, and an entry making one is a better answer
        // for a chemical's name than an entry that does not.
        //
        // The shape this keeps resolving is a named substance meeting a family
        // it belongs to. "Benzoic acid" is claimed by the FDA's entry for
        // benzoic acid, CAS 65-85-0, and by CosIng's "Benzoic acid and its
        // sodium salt", which has no CAS because a family does not have one.
        // Both claims are honest and both are confident, so the registry
        // dropped the name — and benzoic acid, sorbic acid, propionic acid,
        // formic acid, sodium sulfite and menthol all stopped resolving on the
        // day a second source arrived that knew them individually. Adding
        // knowledge should not subtract answers.
        const existingCas = normalizeCas(existing.substance.cas);
        const incomingCas = normalizeCas(substance.cas);
        if (incomingCas && !existingCas) {
          this.ambiguous.delete(key);
          this.byAlias.set(key, { substance, alias });
          continue;
        }
        if (existingCas && !incomingCas) {
          // Keep the identified claim already indexed.
          continue;
        }

        // Still tied, and one of the claims is a name a person recorded by hand
        // while the other is a name an adapter read off a list. The ingest
        // already resolves that comparison this way — a curated alias is never
        // overwritten by an ingested one — and arbitration should not disagree
        // with merging about who wins.
        //
        // "Corn syrup" is the case: a human mapped it onto glucose syrup, which
        // is what carries the intake guidance, and then the FDA inventory
        // arrived with its own CORN SYRUP row and no CAS on either side. The
        // deliberate mapping is the better answer, and letting the newer list
        // cancel it would mean every ingest quietly costs us curation.
        const curatedIncoming = alias.source === 'curated';
        const curatedExisting = existing.alias.source === 'curated';
        if (curatedIncoming && !curatedExisting) {
          this.ambiguous.delete(key);
          this.byAlias.set(key, { substance, alias });
          continue;
        }
        if (curatedExisting && !curatedIncoming) {
          // Keep the hand-recorded claim already indexed.
          continue;
        }

        // Two substances of equal standing wanting the same name. Genuinely
        // ambiguous — two species of thyme — and guessing between them is worse
        // than admitting we cannot tell.
        this.ambiguous.add(key);
        continue;
      }
      this.byAlias.set(key, { substance, alias });
    }
  }

  get size(): number {
    return this.byId.size;
  }

  get aliasCount(): number {
    return this.byAlias.size;
  }

  getById(id: string): Substance | undefined {
    return this.byId.get(id);
  }

  /**
   * Resolve a label string to a substance, or null when we cannot be sure.
   *
   * Null is a legitimate, expected answer — the caller must treat it as
   * "unknown", never as "no hazards".
   */
  resolve(rawName: string): ResolvedSubstance | null {
    const trimmed = rawName?.trim();
    if (!trimmed) return null;

    // An explicit identifier in the text is the strongest signal available.
    const cas = extractCas(trimmed);
    if (cas) {
      const substance = this.byCas.get(cas);
      if (substance) {
        return {
          substance,
          via: { name: cas, source: 'curated', confidence: 1 },
          how: 'identifier',
        };
      }
    }

    const key = normalizeSubstanceName(trimmed);
    if (!key) return null;

    const hit = this.byAlias.get(key);
    if (hit) {
      return { substance: hit.substance, via: hit.alias, how: 'exact' };
    }

    // An additive number: "E129", "E 129", "E-129", "INS 129", "Colour (129)".
    // A Roman sub-index names a form of one additive rather than a different
    // additive, so "160a(ii)" falls back to 160a when only that is held; the
    // letter is never dropped, because 160a and 160b are different additives.
    const ref = additiveNumberKey(trimmed);
    if (ref) {
      const base = ref.key.replace(/[ivx]+$/, '');
      const eHit =
        this.byENumber.get(ref.key) ??
        this.byENumber.get(base) ??
        (INS_TO_E[base] ? this.byENumber.get(INS_TO_E[base]) : undefined);
      if (eHit) {
        return {
          substance: eHit,
          via: { name: trimmed, source: ref.kind === 'ins' || ref.kind === 'bare' ? 'codex_ins' : 'eu_additives', confidence: 1 },
          how: 'identifier',
        };
      }
    }

    return null;
  }
}

/** Pull a CAS number out of free text, e.g. "Allura Red AC (CAS 25956-17-6)". */
export function extractCas(text: string): string | null {
  const match = text.match(/\b(\d{2,7}-\d{2}-\d)\b/);
  if (!match) return null;
  return isValidCas(match[1]) ? match[1] : null;
}

const REGISTRY_PATH = path.join(process.cwd(), 'server/data/substances/substances.json');

let registry: SubstanceRegistry | null = null;

export function loadSubstanceRegistry(filePath: string = REGISTRY_PATH): SubstanceRegistry {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return new SubstanceRegistry(JSON.parse(raw) as SubstanceRegistryFile);
}

/** Process-wide registry, loaded once. */
export function getSubstanceRegistry(): SubstanceRegistry {
  if (!registry) {
    try {
      registry = loadSubstanceRegistry();
      console.log(
        `[SUBSTANCES] Registry v${registry.version}: ${registry.size} substances, ${registry.aliasCount} unique aliases`,
      );
    } catch (error: any) {
      // An empty registry resolves everything to unknown, which is the safe
      // failure: the app says "we don't know" rather than "this is fine".
      console.error(`[SUBSTANCES] Could not load registry, resolving everything to unknown: ${error.message}`);
      registry = new SubstanceRegistry({
        _metadata: { version: '0-unavailable', updatedAt: '', description: 'load failed' },
        substances: [],
      });
    }
  }
  return registry;
}

/** Test seam. */
export function __setSubstanceRegistry(next: SubstanceRegistry | null): void {
  registry = next;
}
