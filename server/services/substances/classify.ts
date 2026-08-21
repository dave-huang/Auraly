import type { Ingredient } from '@shared/schema';
import { getEvidenceStore, type EvidenceRecord } from './evidence';
import { getSubstanceRegistry, type ResolvedSubstance } from './identity';
import { POLICY_VERSION, applyPolicy, toDisplayRisk, type PolicyDecision } from './policy';
import { recordCoverageMiss } from './coverage';

/**
 * The one function the rest of the app calls to get a population-level risk
 * level for an ingredient name.
 *
 * Pipeline: resolve identity → gather evidence for the product domain → apply
 * policy. No model is consulted here; this function answers only "what do our
 * records say", and returns `unknown` when they say nothing.
 *
 * `unknown` is NOT the end of the line any more. `applyPopulationRisk` below
 * falls back to the model's own rating when we hold no record, so the user
 * always gets a level. What this function decides is whether that level can be
 * QUOTED — records can, assessments cannot.
 */

export interface Classification {
  /** What the label said. */
  inputName: string;
  /** Resolved substance, or null when identity was not certain. */
  resolved: ResolvedSubstance | null;
  decision: PolicyDecision;
  /** Every record the decision saw, for citation display. */
  evidence: EvidenceRecord[];
  /** The three-level value to show. `unknown` surfaces as moderate. */
  displayRisk: 'low' | 'moderate' | 'high';
}

export type ClassifyDomain = 'food' | 'cosmetic';

/**
 * Load the corpus eagerly and report its size.
 *
 * Called at server start so a missing or malformed corpus is discovered at
 * deploy time rather than on someone's first scan — and so the boot log says
 * what the app is actually classifying against. Both loaders degrade to empty
 * on failure, which resolves everything to `unknown`; that is the safe failure,
 * but it should never be silent.
 */
export function warmSubstanceCorpus(): void {
  const registry = getSubstanceRegistry();
  const evidence = getEvidenceStore();
  if (registry.size === 0 || evidence.recordCount === 0) {
    // Expected until a source snapshot is ingested — the corpus ships empty on
    // purpose, so that every record is traceable to a publisher. Stated plainly
    // rather than as a warning, but stated: an operator should always be able to
    // read off the boot log how much the app can actually speak to.
    console.log(
      '[SUBSTANCES] Corpus is empty — no ingredient level can be backed by a ' +
        'quotable record, so every level will be the model’s own assessment. ' +
        'Ingest a source: npm run substances:ingest',
    );
  }
}

/** Map the app's productType onto an evidence domain. */
export function domainForProductType(productType: string): ClassifyDomain {
  return productType === 'personal_care' ? 'cosmetic' : 'food';
}

export function classifyIngredient(
  inputName: string,
  domain: ClassifyDomain,
  options: { recordMiss?: boolean } = {},
): Classification {
  const registry = getSubstanceRegistry();
  const resolved = registry.resolve(inputName);

  if (!resolved) {
    // Unresolved is not a failure to hide — it is the signal that drives corpus
    // growth, so it is logged with the name as written for later curation.
    if (options.recordMiss !== false) {
      recordCoverageMiss({ inputName, domain, reason: 'unresolved' });
    }
    return {
      inputName,
      resolved: null,
      decision: {
        level: 'unknown',
        fired: [],
        policyVersion: POLICY_VERSION,
        unknownReason: 'unresolved',
      },
      evidence: [],
      displayRisk: 'moderate',
    };
  }

  const evidence = getEvidenceStore().forSubstancesInDomain(
    registry.sameSubstanceIds(resolved.substance.id),
    domain,
  );
  const decision = applyPolicy(evidence, { domain });

  if (decision.level === 'unknown' && options.recordMiss !== false) {
    recordCoverageMiss({
      inputName,
      domain,
      reason: 'no_evidence',
      substanceId: resolved.substance.id,
    });
  }

  return {
    inputName,
    resolved,
    decision,
    evidence,
    displayRisk: toDisplayRisk(decision.level),
  };
}

/**
 * Attach a population-level risk level to one analysed ingredient.
 *
 * Lives here rather than in the analyzer because two callers need it: the
 * analyzer when a scan is first read, and the history route when a stored scan
 * is re-opened.
 *
 * The result is deliberately NOT persisted with the scan. It is derived, on
 * every read, for the same reason personal flags are: the inputs change. A
 * profile's allergens change, and so do the evidence corpus and the policy
 * rules — a level frozen at scan time would still be asserting last month's
 * regulatory picture. Re-deriving also means ingesting a new source improves
 * every historical scan retroactively, which is the right direction for a
 * safety claim to move.
 */
export function applyPopulationRisk(ingredient: Ingredient, domain: ClassifyDomain): Ingredient {
  const classification = classifyIngredient(ingredient.name, domain);
  const { decision } = classification;

  // The MODEL's rating, read from its own field rather than from riskLevel.
  //
  // This function runs again every time a stored scan is reopened, so it has to
  // be idempotent. Reading `riskLevel` would feed the previous run's OUTPUT
  // back in as this run's input, and a personal override or a record decision
  // would silently become "what the model said".
  const modelRisk = ingredient.modelRiskLevel ?? ingredient.riskLevel;

  // A stored record beats the model. Not because the model is bad at this, but
  // because a published document can be quoted, dated and attributed, and an
  // assessment cannot. If a maker asks why their product says Avoid, "this rule
  // fired on this record, here it is" is an answer.
  //
  // Records can lower a level as well as raise it: the only rules that produce
  // `low` require an affirmative "assessed, no concern" or a permitted entry
  // with no hazard record anywhere, so a `low` record is a finding, not a gap.
  if (decision.level !== 'unknown') {
    const recordRisk = decision.level;
    if (recordRisk !== modelRisk) {
      console.log(
        `[POLICY] "${ingredient.name}" model:${modelRisk} → record:${recordRisk} ` +
          `by ${decision.decidedBy?.ruleId ?? '—'}`,
      );
    }
    return {
      ...ingredient,
      modelRiskLevel: modelRisk,
      universalRiskLevel: recordRisk,
      riskLevel: recordRisk,
      riskSource: 'record',
      baseRiskLevel: modelRisk,
      policyRuleIds: decision.fired.map((f) => f.ruleId),
      substanceId: classification.resolved?.substance.id,
    };
  }

  // No record. The model's rating IS the universal level — which is the whole
  // point of the change: cocoa mass is ordinary food and gets rated as such,
  // instead of coming back as "we could not identify this".
  return {
    ...ingredient,
    modelRiskLevel: modelRisk,
    universalRiskLevel: modelRisk,
    riskLevel: modelRisk,
    riskSource: 'model',
    baseRiskLevel: modelRisk,
  };
}

/**
 * The facts a constrained explanation may draw on, and nothing else.
 *
 * This is what gets handed to the model when it writes consumer-facing prose.
 * It is deliberately a list of source statements rather than a summary: the
 * model's job is to phrase what these records say, not to add to them. Passing
 * the raw records is what makes "banned in the EU since 2008" checkable instead
 * of recalled.
 */
export interface EvidenceBrief {
  substanceName: string;
  displayRisk: 'low' | 'moderate' | 'high';
  isUnknown: boolean;
  /** One line per record: the source's own words plus its attribution. */
  facts: {
    statement: string;
    org: string;
    jurisdiction: string;
    determinedOn?: string;
    url?: string;
  }[];
  /** Rule rationales that fired, so the explanation can say why it matters. */
  rationales: string[];
  /**
   * Set when the substance is permitted in the US but prohibited in a peer
   * market — the divergence that is the whole point of the feature.
   */
  divergence?: { permittedIn: string[]; prohibitedIn: string[] };
}

export function buildEvidenceBrief(classification: Classification): EvidenceBrief {
  const { resolved, evidence, decision, displayRisk } = classification;

  const permittedIn = Array.from(
    new Set(evidence.filter((r) => r.kind === 'permitted').map((r) => r.jurisdiction)),
  );
  const prohibitedIn = Array.from(
    new Set(evidence.filter((r) => r.kind === 'prohibited').map((r) => r.jurisdiction)),
  );

  return {
    substanceName: resolved?.substance.name ?? classification.inputName,
    displayRisk,
    isUnknown: decision.level === 'unknown',
    facts: evidence.map((r) => ({
      statement: r.statement,
      org: r.citation.org,
      jurisdiction: r.jurisdiction,
      determinedOn: r.determinedOn,
      url: r.citation.url,
    })),
    rationales: decision.fired.map((f) => f.rationale),
    divergence:
      permittedIn.length > 0 && prohibitedIn.length > 0
        ? { permittedIn, prohibitedIn }
        : undefined,
  };
}
