import type { EvidenceRecord } from '../evidence';
import { normalizeCas } from '../identity';
import type { IngestResult, SnapshotMeta, SourceAdapter } from './adapter';
import { slugifySubstanceId } from './adapter';

/**
 * FDA "Substances Added to Food" — the inventory formerly published as EAFUS.
 *
 * The first food source in the corpus, and the reason it was needed: everything
 * ingested before it was about cosmetics (the CosIng annexes) or about cancer
 * (IARC, Prop 65). On a real food label that combination resolved almost
 * nothing, so every risk level a user saw on a biscuit was the model's own
 * opinion with no record behind it. This inventory is what an ordinary food
 * ingredient can finally be looked up in.
 *
 * What the inventory is, in the FDA's own terms: food and colour additives
 * listed in FDA regulations, GRAS substances listed in regulations, substances
 * prior-sanctioned before 1958, substances formerly used and now prohibited or
 * delisted, and — separately — flavourings evaluated by FEMA and JECFA, which
 * are NOT FDA determinations. The FDA says so plainly on the page: the
 * inventory "is only a partial list", and "inclusion in this inventory of
 * information from non-FDA entities does not indicate an FDA approval or
 * evaluation of this use." That sentence is load-bearing here — see the
 * ingredient-only rule below.
 *
 * The snapshot is produced by snapshot-fda-saf.ts, because the FDA publishes
 * this as a web application rather than a file.
 *
 *   npx tsx server/services/substances/ingest/snapshot-fda-saf.ts
 *   npm run substances:ingest -- fda_food_additives <path> --version 2026-08
 */

const COL_CAS = 'CAS Reg. No.';
const COL_SUBSTANCE = 'Substance';
const COL_EFFECT = 'Used for (Technical Effect)';
const COL_CFR = '21 CFR';

/**
 * 21 CFR parts, and what each one means about a substance.
 *
 * This mapping is the whole adapter. Everything else is string handling.
 *
 * The parts are grouped by the KIND of statement the regulation makes, not by
 * how reassuring they sound:
 *
 *   authorised   — the FDA permits this in food, subject to the regulation
 *   affirmed     — the FDA has affirmatively concluded it is safe as used
 *   interim      — permitted only pending additional study, which is a stated
 *                  unresolved question and not a clean bill of health
 *   contact      — food-CONTACT substances: packaging adhesives, polymers,
 *                  paper coatings. These are not ingredients. A row that cites
 *                  only these parts tells us nothing about eating the
 *                  substance, so it contributes identity and no evidence.
 *
 * Anything not listed here (part 170 procedure, part 179 irradiation, part 81
 * delisting history) is deliberately inert: it is real regulation, but it makes
 * no claim about the substance's safety as an ingredient.
 */
const AUTHORISED_PARTS = new Set([
  '172', // food additives permitted for direct addition to food
  '173', // secondary direct food additives
  '181', // prior-sanctioned food ingredients
  '73', // colour additives exempt from certification
  '74', // colour additives subject to certification
  '82', // listing of certified provisionally listed colours
]);
const AFFIRMED_GRAS_PARTS = new Set([
  '182', // substances generally recognized as safe
  '184', // direct food substances affirmed as GRAS
  '186', // indirect food substances affirmed as GRAS
]);
const INTERIM_PARTS = new Set(['180']); // permitted on an interim basis pending additional study
const PROHIBITED_PARTS = new Set(['189']); // substances prohibited from use in human food

/**
 * Suffixes the FDA appends to a substance name to record its status.
 *
 * The `\s*` after the dashes is not defensive padding — the inventory really
 * does contain "DIETHYL PYROCARBONATE-- PROHIBITED", one row out of twenty,
 * spaced differently from every other. A marker regex without it read that
 * substance as unremarkable, which is the exact silent false negative this
 * corpus exists to prevent, and it was caught only because the review list
 * prints part-189 citations that carry no marker. Match loosely here.
 */
const STATUS_MARKERS = [
  { pattern: /--\s*PROHIBITED WITH EXCEPTIONS\s*$/i, status: 'prohibited_with_exceptions' as const },
  { pattern: /--\s*PROHIBITED\s*$/i, status: 'prohibited' as const },
  { pattern: /--\s*DELISTED\s*$/i, status: 'delisted' as const },
  { pattern: /--\s*NLFG\s*$/i, status: 'no_longer_fema_gras' as const },
];

/**
 * Any all-caps suffix after a double dash, recognised or not.
 *
 * The guard for the next spelling variant. A status the adapter does not know
 * about is a statement the FDA is making and we are dropping, so it goes on the
 * review list rather than passing as part of the substance's name.
 */
const UNKNOWN_MARKER = /--\s*([A-Z][A-Z0-9 ]{2,})\s*$/;

type NameStatus = (typeof STATUS_MARKERS)[number]['status'] | null;

/**
 * Split the FDA's status suffix off the name.
 *
 * Essential rather than cosmetic. "CALAMUS OIL--PROHIBITED" is how the FDA
 * writes it and "Calamus Oil" is how a label writes it; an alias carrying the
 * suffix would never match anything, so the one substance in the inventory we
 * most need to catch would be the one we silently miss.
 */
function splitStatus(raw: string): { name: string; status: NameStatus } {
  for (const marker of STATUS_MARKERS) {
    if (marker.pattern.test(raw)) {
      return { name: raw.replace(marker.pattern, '').trim(), status: marker.status };
    }
  }
  return { name: raw.trim(), status: null };
}

/** The distinct 21 CFR parts a row cites, e.g. "172.780 184.1330" → 172, 184. */
function citedParts(cfr: string): string[] {
  return Array.from(new Set(Array.from(cfr.matchAll(/(\d{2,3})\.\d+/g), (m) => m[1])));
}

/**
 * Confidence for an alias this adapter DERIVED rather than read.
 *
 * Above `MIN_ALIAS_CONFIDENCE`, so a derived form still resolves on its own —
 * but below the 1.0 carried by a name a source actually printed, which is what
 * makes the registry's arbitration come out right. Both values matter:
 *
 * Deriving at full confidence put "LECITHIN" (my truncation of the inventory's
 * "LECITHIN (VEGETABLE)") level with the curated Lecithin entry, and the
 * registry, correctly refusing to guess between two equal claims, dropped the
 * name — so an ingredient on half the labels in a supermarket stopped
 * resolving at all. A form I computed should never be able to do that to a name
 * somebody wrote down.
 */
const DERIVED_ALIAS_CONFIDENCE = 0.95;

/**
 * Alias forms for one inventory name, with how much each is trusted.
 *
 * The inventory writes names in a register nobody prints on a label: upper
 * case, botanically qualified, and comma-inverted for filing. Matching is exact
 * after normalization, so an inventory that only ever offers its own house
 * style resolves the ingredients nobody types and misses the ones everybody
 * does. Each transform below is mechanical and reversible — none of them
 * invents a synonym, they only undo a formatting convention.
 */
function aliasForms(name: string): { name: string; confidence: number }[] {
  const forms = new Set<string>();

  // "ACACIA, GUM (ACACIA SENEGAL (L.) WILLD.)" → "ACACIA, GUM"
  // The parenthetical is a botanical or chemical qualifier, never the name.
  const unqualified = name.replace(/\s*\([^()]*(\([^()]*\)[^()]*)*\)\s*$/, '').trim();
  if (unqualified && unqualified !== name) forms.add(unqualified);

  for (const form of [name, ...Array.from(forms)]) {
    // "ACACIA, GUM" → "GUM ACACIA". Only for a single comma: two or more mean
    // a qualifier list ("SACCHARIN, SODIUM SALT, ANHYDROUS"), where inverting
    // produces a string that denotes nothing and could only mislead.
    const parts = form.split(',');
    if (parts.length === 2) {
      const [head, tail] = parts.map((p) => p.trim());
      if (head && tail) forms.add(`${tail} ${head}`);
    }
  }

  // "FD&C RED NO. 40" → "RED 40", "RED NO. 40", "FD&C RED 40".
  // The certified colours are the clearest case of the register gap: the
  // regulation's name and the label's name share no normalized form at all,
  // and these are among the most-scanned ingredients there are.
  const colour = name.match(/^FD&C\s+([A-Z]+)\s+NO\.\s*(\d+)$/i);
  if (colour) {
    const [, hue, number] = colour;
    forms.add(`${hue} ${number}`);
    forms.add(`${hue} No. ${number}`);
    forms.add(`FD&C ${hue} ${number}`);
  }

  // The inventory's own name is the one claim this adapter did not invent.
  return [
    { name, confidence: 1 },
    ...Array.from(forms)
      .filter((form) => form !== name)
      .map((form) => ({ name: form, confidence: DERIVED_ALIAS_CONFIDENCE })),
  ];
}

export const fdaFoodAdditivesAdapter: SourceAdapter = {
  source: 'fda_food_additives',
  label: 'FDA Substances Added to Food',
  accepts: ['.csv'],
  requiredColumns: [COL_SUBSTANCE, COL_CFR],

  parse(rows: Record<string, string>[], meta: SnapshotMeta): IngestResult {
    const substances = new Map<string, any>();
    const records: EvidenceRecord[] = [];
    const skipped: IngestResult['skipped'] = [];
    const review: NonNullable<IngestResult['review']> = [];

    const citation = {
      org: 'US FDA',
      title: 'Substances Added to Food inventory',
      url: meta.url,
    };
    const base = {
      source: 'fda_food_additives' as const,
      jurisdiction: 'US' as const,
      domain: 'food' as const,
      sourceVersion: meta.version,
      fetchedAt: meta.fetchedAt,
      citation,
    };

    rows.forEach((row, index) => {
      const rawName = row[COL_SUBSTANCE]?.trim();
      if (!rawName) {
        skipped.push({ row: index + 2, reason: 'no substance name' });
        return;
      }

      const { name, status } = splitStatus(rawName);
      if (status === null) {
        const unknown = rawName.match(UNKNOWN_MARKER);
        if (unknown) {
          review.push({
            row: index + 2,
            note: `unrecognised status marker "${unknown[1].trim()}" — treated as part of the name`,
            raw: rawName,
          });
        }
      }
      const cas = normalizeCas(row[COL_CAS]);
      const id = slugifySubstanceId(name);
      const effect = row[COL_EFFECT]?.trim() || '';
      const cfr = row[COL_CFR]?.trim() || '';
      const parts = citedParts(cfr);

      if (!substances.has(id)) {
        substances.set(id, {
          id,
          name,
          cas,
          ec: null,
          eNumber: null,
          inci: null,
          // The technical-effect column is a controlled vocabulary and several
          // effects can apply, so it is recorded whole rather than mapped onto
          // our own category names. It is descriptive only — the policy engine
          // is forbidden from reading it.
          category: effect || null,
          aliases: aliasForms(name).map((alias) => ({
            name: alias.name,
            source: 'fda' as const,
            confidence: alias.confidence,
          })),
        });
      }

      // --- statements the FDA makes about substances it no longer allows ---

      if (status === 'prohibited' || status === 'prohibited_with_exceptions') {
        records.push({
          ...base,
          substanceId: id,
          kind: 'prohibited',
          statement:
            status === 'prohibited'
              ? `Prohibited from use in human food by FDA regulation (21 CFR ${cfr || 'part 189'}).`
              : `Prohibited from use in human food by FDA regulation, with stated exceptions (21 CFR ${cfr}).`,
        });
        if (status === 'prohibited_with_exceptions') {
          // Recorded as a prohibition, which drives `high`, and flagged so a
          // person decides whether that is right for this substance. The
          // exceptions are narrow permitted uses written into the same
          // regulation, and the label never tells us which use we are holding —
          // so the conservative reading ships, and the judgement call is
          // printed instead of buried.
          review.push({
            row: index + 2,
            note: 'prohibited with exceptions — recorded as a prohibition, which reads high',
            raw: `${rawName} | 21 CFR ${cfr}`,
          });
        }
        return;
      }

      if (status === 'delisted') {
        records.push({
          ...base,
          substanceId: id,
          kind: 'authorization_withdrawn',
          statement: `Delisted as a colour additive by FDA regulation (21 CFR ${cfr || '81.10, 81.30'}).`,
        });
        return;
      }

      if (status === 'no_longer_fema_gras') {
        records.push({
          ...base,
          substanceId: id,
          kind: 'authorization_withdrawn',
          // Named as FEMA's conclusion, not the FDA's, because it is FEMA's.
          // The inventory carries it; the FDA disclaims it.
          statement:
            'No longer considered GRAS by the Flavor and Extract Manufacturers Association (FEMA), ' +
            'as recorded in the FDA’s Substances Added to Food inventory.',
        });
        return;
      }

      // --- statements about substances still in use ---

      // A row with no 21 CFR citation is in the inventory on the strength of a
      // FEMA or JECFA flavour evaluation, and the FDA states that this "does
      // not indicate an FDA approval or evaluation of this use". Ingesting it
      // as permission would put words in the regulator's mouth, and would do it
      // for 1,700 substances at once. Identity only.
      if (parts.length === 0) return;

      const interim = parts.filter((p) => INTERIM_PARTS.has(p));
      const affirmed = parts.filter((p) => AFFIRMED_GRAS_PARTS.has(p));
      const authorised = parts.filter((p) => AUTHORISED_PARTS.has(p));
      const prohibitedPart = parts.filter((p) => PROHIBITED_PARTS.has(p));

      // A part-189 citation on a row the FDA did not mark PROHIBITED means the
      // prohibition applies to some other form or use of the substance. Not
      // ingested as a prohibition — the marker is the FDA's own signal and it
      // is absent — but printed, because a silent part 189 is worth a human's
      // attention either way.
      if (prohibitedPart.length > 0) {
        review.push({
          row: index + 2,
          note: 'cites 21 CFR part 189 but is not marked PROHIBITED — no prohibition recorded',
          raw: `${rawName} | 21 CFR ${cfr}`,
        });
      }

      if (interim.length > 0) {
        records.push({
          ...base,
          substanceId: id,
          kind: 'under_review',
          statement:
            `Permitted in food on an interim basis pending additional study (21 CFR ${cfr}). ` +
            'An interim listing is an unresolved safety question, not a completed one.',
        });
      }

      if (affirmed.length > 0) {
        records.push({
          ...base,
          substanceId: id,
          kind: 'no_concern_at_typical_exposure',
          statement:
            `Listed by the FDA as generally recognized as safe for its intended use in food ` +
            `(21 CFR ${cfr}).`,
        });
      } else if (authorised.length > 0) {
        records.push({
          ...base,
          substanceId: id,
          kind: 'permitted',
          statement: `Authorised as a food or colour additive by FDA regulation (21 CFR ${cfr}).`,
        });
      }
      // Rows citing only food-CONTACT parts fall through to identity only. A
      // packaging adhesive being permitted in an adhesive says nothing about
      // an ingredient list.
    });

    return { substances: Array.from(substances.values()), records, skipped, review };
  },
};
