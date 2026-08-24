import type { EvidenceRecord, UseDomain } from './evidence';

/**
 * The policy engine: evidence in, risk level out, deterministically.
 *
 * This is the ONLY place in the codebase allowed to decide a population-level
 * risk level. No model, no override layer, no per-ingredient special case. If a
 * verdict looks wrong, exactly one rule fired and produced it, and the fix is a
 * rule change plus a version bump — not a hand-edit of a substance.
 *
 * `POLICY_VERSION` is part of the ingredient cache key, so bumping it retires
 * every cached risk level that the old rules produced.
 */
/**
 * What this scale measures — restated, because it changed.
 *
 * The rule set began as an enforcement scale: a level was a function of what
 * regulators had DONE about a substance. That made regulatory action the
 * definition of risk rather than one source of it, and the consequence was
 * indefensible — nothing a health authority says about a substance could raise
 * it unless someone had also restricted it, and a substance nobody had needed
 * to restrict came back as "no evidence" rather than "assessed, no concern".
 *
 * The scale now measures health risk. Regulatory action remains the strongest
 * and most legible input, and is SUFFICIENT for `high` — every one of the
 * original prohibition and carcinogen rules is untouched and still fires first.
 * It is simply no longer NECESSARY: a health body's dated, quotable
 * determination can also produce a level, in either direction.
 */
export const POLICY_VERSION = '2026-08-23.2';

/**
 * Four states, not three.
 *
 * `unknown` is the honest answer when we could not resolve the substance, or
 * resolved it and hold no evidence. It is surfaced to the user as caution-level
 * (never as safe), but it is tracked separately from `moderate` so that "we
 * assessed this and it sits in the middle" is never confused with "we have
 * nothing on this". Collapsing those two is how an app reassures someone by
 * accident, and it is also the only honest way to measure corpus coverage.
 */
export type PolicyLevel = 'low' | 'moderate' | 'high' | 'unknown';

export interface PolicyRule {
  id: string;
  level: Exclude<PolicyLevel, 'unknown'>;
  /** Why this rule exists, in one line. Shown in explain output. */
  rationale: string;
  /** Returns the records that triggered it, or an empty array for no match. */
  match: (records: EvidenceRecord[], ctx: PolicyContext) => EvidenceRecord[];
}

export interface PolicyContext {
  domain: Exclude<UseDomain, 'any'>;
}

const has =
  (predicate: (r: EvidenceRecord) => boolean) =>
  (records: EvidenceRecord[]): EvidenceRecord[] =>
    records.filter(predicate);

/**
 * Markets whose regulators we treat as authoritative.
 *
 * This includes the US. An earlier draft of this rule set listed only the EU,
 * UK, Canada and Australia — on the reasoning that the interesting story is
 * "permitted in the US, banned elsewhere" — and the effect was that lead
 * acetate, banned by the FDA in cosmetics in 2022, classified as `unknown`.
 *
 * Two separate questions were being conflated. Which prohibitions make a
 * substance high? Any of them. Which comparison is worth *explaining* to the
 * user? The divergence one. The second belongs in `buildEvidenceBrief`, which
 * derives it from the permitted/prohibited records, and never in the rule that
 * decides the level.
 */
const TRACKED_MARKETS = new Set(['EU', 'UK', 'US', 'US-CA', 'CA', 'AU']);

/**
 * Ordered rules. The first matching rule wins, so `high` rules precede
 * `moderate` ones and the sequence is the policy.
 */
export const POLICY_RULES: PolicyRule[] = [
  // ---- high ----
  {
    id: 'high.clp_cmr_category_1',
    level: 'high',
    rationale:
      'Carries the EU’s legally harmonised classification as a category 1A/1B carcinogen, mutagen or reproductive toxicant.',
    match: has(
      (r) =>
        r.kind === 'hazard_classification' &&
        /\b(carc|muta|repr)\.?\s*1[ab]\b/i.test(r.classification ?? ''),
    ),
  },
  {
    id: 'high.iarc_group_1_or_2a',
    level: 'high',
    rationale: 'Classified by IARC as carcinogenic (Group 1) or probably carcinogenic (Group 2A) to humans.',
    match: has((r) => r.iarcGroup === '1' || r.iarcGroup === '2A'),
  },
  {
    id: 'high.carcinogen_or_repro_listing',
    level: 'high',
    rationale:
      'Listed by a regulator as a carcinogen or as a developmental/reproductive toxicant.',
    // Matches on the hazard KIND, not on which source reported it. An earlier
    // draft required `source === 'prop65'` and the corpus integrity check caught
    // the consequence: dibutyl phthalate — banned in EU cosmetics and Prop 65
    // listed — fell through to `unknown`, because its record's source was the EU
    // ban while its kind was the Prop 65 listing. A reproductive toxicant is a
    // reproductive toxicant regardless of which register we read it from.
    match: has((r) => r.kind === 'carcinogen_listing' || r.kind === 'repro_tox_listing'),
  },
  {
    id: 'high.prohibited_in_tracked_market',
    level: 'high',
    rationale: 'Prohibited outright by a regulator in at least one major market for this kind of product.',
    match: (records, ctx) =>
      records.filter(
        (r) =>
          r.kind === 'prohibited' &&
          TRACKED_MARKETS.has(r.jurisdiction) &&
          (r.domain === 'any' || r.domain === ctx.domain),
      ),
  },
  {
    id: 'high.ntp_known_carcinogen',
    level: 'high',
    rationale: 'Listed by the US National Toxicology Program as a known human carcinogen.',
    match: has(
      (r) => r.source === 'ntp_roc' && /\bknown\b/i.test(r.classification ?? r.statement),
    ),
  },
  {
    id: 'high.health_body_elimination',
    level: 'high',
    rationale:
      'A health authority calls for this to be eliminated from the food supply, not merely limited.',
    // The narrowest possible health-based `high`: not "bad for you", but a body
    // like WHO saying the target intake is zero. Industrially-produced trans fat
    // is the case it was written for, and it is nearly the only one — which is
    // the point. `high` drives an Avoid verdict, so a health rule that fired on
    // ordinary dietary advice would make the strongest word in the app cheap.
    match: has((r) => r.kind === 'health_guidance' && r.direction === 'eliminate'),
  },

  // ---- moderate ----
  {
    id: 'moderate.iarc_group_2b',
    level: 'moderate',
    rationale: 'Classified by IARC as possibly carcinogenic to humans (Group 2B).',
    match: has((r) => r.iarcGroup === '2B'),
  },
  {
    id: 'moderate.clp_cmr_category_2',
    level: 'moderate',
    rationale: 'Carries an EU category 2 classification — a suspected, not established, CMR hazard.',
    match: has(
      (r) =>
        r.kind === 'hazard_classification' && /\b(carc|muta|repr)\.?\s*2\b/i.test(r.classification ?? ''),
    ),
  },
  {
    id: 'moderate.restricted_with_limit',
    level: 'moderate',
    rationale: 'Permitted only under a numeric limit, which means a regulator identified a threshold of concern.',
    match: (records, ctx) =>
      records.filter(
        (r) => r.kind === 'restricted' && (r.domain === 'any' || r.domain === ctx.domain),
      ),
  },
  {
    id: 'moderate.mandatory_consumer_warning',
    level: 'moderate',
    rationale: 'A regulator requires a consumer-facing warning on products containing it.',
    // This was a `high` rule until the first records that could fire it arrived,
    // and seeing what they were is what re-levelled it. The six colours the EU
    // requires a warning on — E 102, E 104, E 110, E 122, E 124, E 129 — include
    // Red 40 and Yellow 5, which are in an enormous share of packaged food. All
    // of it reading Avoid would empty the word out.
    //
    // The distinction that settles it: there is a difference between a
    // regulator saying "you may not sell this" and one saying "you must tell
    // people this", and it is exactly the difference between avoid and caution.
    // A prohibition already produces `high` through its own rule, and a warning
    // that accompanies a genuine hazard finding — a Prop 65 cancer warning —
    // produces `high` through the carcinogen rule. What is left for this rule to
    // decide alone is the informational case, where a regulator wants a person
    // to be able to weigh something for themselves. That is a caution, and the
    // warning text is the point: it is shown, so the reader weighs the actual
    // statement rather than our compression of it.
    match: (records, ctx) =>
      records.filter(
        (r) => r.kind === 'warning_required' && (r.domain === 'any' || r.domain === ctx.domain),
      ),
  },
  // There was a `moderate.has_guidance_value` rule here, and it was wrong.
  //
  // It fired on any ADI, TDI or UL, on the reasoning that a bounded intake is a
  // bounded intake. But a guidance value is the OUTPUT of a safety assessment:
  // a regulator derives an ADI at the end of the work and then authorises uses
  // that keep intake beneath it. "Somebody established how much of this is
  // safe" is close to the opposite of a warning.
  //
  // Ingesting EFSA's OpenFoodTox made the consequence measurable rather than
  // theoretical: sixty-seven substances would have moved from low to moderate,
  // among them riboflavin — vitamin B2 — potassium sorbate, tartaric acid and
  // MSG. That is the false-alarm flood, and this file already refuses it once,
  // for exactly the same reason, in `moderate.permitted_only_for_limited_uses`:
  // a concentration cap is how an authorisation is written, not a finding of
  // concern. A guidance value is the food-side twin of that cap.
  //
  // Guidance values are still ingested and still shown. They make the app able
  // to say "EFSA set an acceptable daily intake of 25 mg per kg of body weight
  // in 2015", which is worth reading. They no longer set a level on their own.
  //
  // What legitimately raises a level is a body concluding that real intake
  // EXCEEDS its own guidance value. That is a finding, not a number, and it
  // lives in opinion prose rather than in any column of any export — so it
  // arrives as curated evidence when someone writes it down, and never by
  // inference from the presence of an ADI.
  {
    id: 'moderate.authorization_withdrawn',
    level: 'moderate',
    rationale: 'A regulator has withdrawn or allowed its authorization to lapse.',
    match: has((r) => r.kind === 'authorization_withdrawn'),
  },
  {
    id: 'moderate.under_reevaluation',
    level: 'moderate',
    rationale: 'Under active re-evaluation by a food-safety authority.',
    match: has((r) => r.kind === 'under_review'),
  },
  {
    id: 'moderate.health_body_intake_limit',
    level: 'moderate',
    rationale:
      'A health authority publishes an intake limit for it, so how much is in a product is a real question.',
    match: has((r) => r.kind === 'health_guidance' && r.direction === 'limit'),
  },
  {
    id: 'moderate.prop65_other_endpoint',
    level: 'moderate',
    rationale: 'Appears on California Proposition 65 under an endpoint other than cancer or reproductive toxicity.',
    match: has((r) => r.source === 'prop65'),
  },
  {
    id: 'moderate.permitted_only_for_limited_uses',
    level: 'moderate',
    rationale:
      'Authorised, but only for some uses — a regulator has ruled it out of ordinary products of this kind.',
    // Sits above `low.permitted_no_hazard_records` so a confined authorisation
    // is never read as an unconditional one.
    //
    // The distinction is between the two things an annex entry can say. "Up to
    // 1 %" is the regulator describing safe use, and an ingredient list gives
    // us no reason to doubt the product complies — that stays low. "Rinse-off
    // products only" is the regulator saying this substance is not acceptable
    // in a leave-on product, and we cannot tell from a label which kind of
    // product we are holding. That is a caution.
    //
    // Deliberately NOT triggered by the presence of a concentration cap. Every
    // preservative and UV filter in Annexes V and VI carries one, so keying on
    // caps would rate essentially every cosmetic moderate and teach people to
    // ignore the colour.
    match: (records, ctx) =>
      records.filter(
        (r) =>
          r.kind === 'permitted' &&
          !!r.useRestriction &&
          (r.domain === 'any' || r.domain === ctx.domain),
      ),
  },

  // ---- low ----
  {
    id: 'low.assessed_no_concern',
    level: 'low',
    rationale:
      'A health authority assessed it and found no concern at the amounts people are actually exposed to.',
    // The difference between "we found nothing" and "someone looked and found
    // nothing". Only the second is `low`, and before this rule existed the
    // engine had no way to record the second at all — so every ordinary
    // ingredient on a label fell through to `unknown`.
    match: has((r) => r.kind === 'no_concern_at_typical_exposure'),
  },
  {
    id: 'low.permitted_no_hazard_records',
    level: 'low',
    rationale:
      'Affirmatively permitted for this use in at least one regulated market, with no hazard record from any source.',
    match: (records, ctx) =>
      records.filter(
        (r) => r.kind === 'permitted' && (r.domain === 'any' || r.domain === ctx.domain),
      ),
  },
];

export interface FiredRule {
  ruleId: string;
  level: Exclude<PolicyLevel, 'unknown'>;
  rationale: string;
  records: EvidenceRecord[];
}

export interface PolicyDecision {
  level: PolicyLevel;
  /** The rule that decided the level, if any. */
  decidedBy?: FiredRule;
  /**
   * Every rule that matched, in policy order — not just the winner. A `high`
   * substance that also has an ADI should show both; the extra records are the
   * body of the explanation the user reads.
   */
  fired: FiredRule[];
  policyVersion: string;
  /** Why `unknown`, when it is unknown. */
  unknownReason?: 'unresolved' | 'no_evidence';
}

/**
 * Classify from evidence alone.
 *
 * An empty record set is `unknown`, never `low`. "We found nothing" and "this is
 * safe" are different claims and only one of them is true.
 */
export function applyPolicy(records: EvidenceRecord[], ctx: PolicyContext): PolicyDecision {
  if (records.length === 0) {
    return { level: 'unknown', fired: [], policyVersion: POLICY_VERSION, unknownReason: 'no_evidence' };
  }

  const fired: FiredRule[] = [];
  for (const rule of POLICY_RULES) {
    const matched = rule.match(records, ctx);
    if (matched.length > 0) {
      fired.push({ ruleId: rule.id, level: rule.level, rationale: rule.rationale, records: matched });
    }
  }

  if (fired.length === 0) {
    // Records exist but none are dispositive — e.g. we hold only an alias note.
    // Still not safe to call low.
    return { level: 'unknown', fired, policyVersion: POLICY_VERSION, unknownReason: 'no_evidence' };
  }

  // Rules are declared worst-first, so the first match is the verdict. `low`
  // additionally requires that nothing above it fired, which the ordering gives
  // us for free.
  const decidedBy = fired[0];
  return { level: decidedBy.level, decidedBy, fired, policyVersion: POLICY_VERSION };
}

/** Level shown to a user for a policy outcome. `unknown` reads as caution. */
export function toDisplayRisk(level: PolicyLevel): 'low' | 'moderate' | 'high' {
  return level === 'unknown' ? 'moderate' : level;
}
