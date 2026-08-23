import { profileConditions, profileDietary } from '@shared/schema';
import type { AnalysisResult, PersonalFlag, Profile, RiskLevel } from '@shared/schema';
import { nearMissForAllergen } from './allergenMatcher';
import { getConcept, matchConcept, matchProfileAllergen } from './concepts';
import { advisoryCitation, impactToRisk, matchAdvisory } from './conditionAdvisories';
import { getCitations } from './knowledgeBase';

// Applies a personal profile to a finished analysis result, producing
// personalFlags and an adjusted overall risk. Runs AFTER cache retrieval so
// all analysis caches stay profile-agnostic — one cached analysis serves
// every family member's profile.
//
// Flagging philosophy (per the accuracy/liability plan): deterministic,
// conservative, and explainable. Better a false flag the user dismisses than
// a silent miss.

// The dietary vocabulary MOVED to server/services/concepts.ts on 2026-08-22,
// verbatim. It lived here beside a second copy of the same words in the
// allergen matcher and a third inside the condition advisories; gluten was
// spelled out in all three and they had already drifted. The concept registry
// holds one definition and every axis reads it, so a correction lands once.

const riskRank: Record<RiskLevel, number> = { low: 0, moderate: 1, high: 2 };
/** Exported so callers deriving an overall verdict use this ordering, not a second copy. */
export const maxRisk = (a: RiskLevel, b: RiskLevel): RiskLevel => (riskRank[a] >= riskRank[b] ? a : b);

/**
 * How hard a flag lands, in one word the UI can colour by.
 *
 * The card used to infer this from `type === 'allergen'`, which is wrong in both
 * directions now: an intolerance is not an avoid, and a PKU advisory is.
 */
const impactFor = (risk: RiskLevel): 'avoid' | 'caution' => (risk === 'high' ? 'avoid' : 'caution');

/**
 * Does this ingredient match a profile allergen entry?
 *
 * Thin wrapper so the boolean call sites below read as they did. The concept
 * layer behind it runs an identity pass first — resolving both the ingredient
 * and the profile's own words through the substance alias graph — and falls
 * back to exactly the keyword semantics this used to call directly. Identity
 * can only add matches, never veto one, so recall cannot fall.
 */
function matchesAllergenEntry(
  ingredientName: string,
  allergen: string,
  extraKeywords: string[] = [],
): boolean {
  return matchProfileAllergen(ingredientName, allergen, extraKeywords) !== null;
}

/**
 * Attach knowledge-base citations (general/children contexts) to every
 * ingredient that has an entry. Runs post-cache on every result, so cached
 * analyses pick up KB updates without re-analysis.
 */
export function annotateWithCitations(result: AnalysisResult): AnalysisResult {
  let any = false;
  const ingredients = result.ingredients.map(ing => {
    const citations = getCitations(ing.name);
    if (citations.length === 0) return ing;
    any = true;
    return { ...ing, citations };
  });
  return any ? { ...result, ingredients } : result;
}

export function applyProfileToAnalysis(result: AnalysisResult, profile: Profile): AnalysisResult {
  const flags: PersonalFlag[] = [];
  let overallRisk = result.overallRisk;

  // Condition advisories are domain-scoped. "Alcohol" in a drink and "alcohol
  // denat." in a toner are different exposures, and a pregnancy advisory that
  // ignored that would flag every moisturiser on the shelf.
  const domain: 'food' | 'cosmetic' = result.productType === 'personal_care' ? 'cosmetic' : 'food';

  // Allergen matching must run against ENGLISH ingredient names. When the
  // user reads results in Chinese or Spanish, result.ingredients[].name is
  // localized and the English keyword lists match nothing — a silent miss in
  // exactly the cross-language case this product exists for. The label
  // reader's canonical English names are the reliable source; localized names
  // are still checked so English scans and older cached results keep working.
  const canonical = result.canonicalIngredients ?? [];
  for (const entry of profile.allergens ?? []) {
    const matchedIndex = canonical.findIndex(name =>
      matchesAllergenEntry(name, entry.allergen, entry.keywords ?? []));
    const matchedCanonical = matchedIndex >= 0 ? canonical[matchedIndex] : undefined;
    const matchedLocalized = result.ingredients.some(ing =>
      matchesAllergenEntry(ing.name, entry.allergen, entry.keywords ?? []));

    // This branch fires only for a translated label, where the English keyword
    // list matched the reader's canonical name and no localized row name did.
    // There is then no name shared between the flag and any row, so position
    // is the only link available — and it is trustworthy only if the two lists
    // are the same length. Where they are not, the flag still shows on the
    // card; it simply attaches to no row, which is the honest outcome.
    const alignedByIndex = canonical.length === result.ingredients.length;
    const rowIndex = alignedByIndex && matchedIndex >= 0 ? matchedIndex : undefined;

    if (matchedCanonical && !matchedLocalized) {
      const flagRisk: RiskLevel =
        entry.severity === 'intolerance' || entry.severity === 'avoid' ? 'moderate' : 'high';
      flags.push({
        ingredientName: matchedCanonical,
        ...(rowIndex !== undefined ? { ingredientIndex: rowIndex } : {}),
        type: 'allergen',
        match: entry.allergen,
        severity: entry.severity,
        certainty: 'definite',
        impact: impactFor(flagRisk),
        reason: `Matches "${entry.allergen}" (${entry.severity}) in ${profile.name}'s profile`,
        reasonKey: 'flag.allergenMatch',
        reasonParams: { allergen: entry.allergen, severity: entry.severity, profile: profile.name },
      });
      overallRisk = maxRisk(overallRisk, flagRisk);
    }
  }

  // A label's own "contains" line catches allergens no ingredient name
  // reveals (e.g. "Lecithin" + a separate "contains soy" declaration).
  // "May contain" is surfaced separately and never raises risk to allergen
  // level — it is a cross-contamination warning, not an ingredient.
  const declared = result.declaredAllergens;
  if (declared) {
    for (const entry of profile.allergens ?? []) {
      const inContains = declared.contains.some(d =>
        matchesAllergenEntry(d, entry.allergen, entry.keywords ?? []));
      const alreadyFlagged =
        result.ingredients.some(ing =>
          matchesAllergenEntry(ing.name, entry.allergen, entry.keywords ?? [])) ||
        canonical.some(name =>
          matchesAllergenEntry(name, entry.allergen, entry.keywords ?? []));

      if (inContains && !alreadyFlagged) {
        const flagRisk: RiskLevel =
          entry.severity === 'intolerance' || entry.severity === 'avoid' ? 'moderate' : 'high';
        flags.push({
          ingredientName: 'Label allergen statement',
          type: 'allergen',
          match: entry.allergen,
          severity: entry.severity,
          certainty: 'definite',
          impact: impactFor(flagRisk),
          reason: `The label declares this product contains ${entry.allergen}, though no single ingredient names it`,
          reasonKey: 'flag.declaredContains',
          reasonParams: { allergen: entry.allergen },
        });
        overallRisk = maxRisk(overallRisk, flagRisk);
      }

      // Every entry warns on traces. A per-entry policy existed briefly (see
      // the note in shared/schema.ts) and was removed as too much to ask of
      // someone setting up a profile.
      const inMayContain = declared.mayContain.some(d =>
        matchesAllergenEntry(d, entry.allergen, entry.keywords ?? []));
      if (inMayContain && !inContains && !alreadyFlagged) {
        flags.push({
          ingredientName: 'Label allergen statement',
          type: 'allergen',
          match: entry.allergen,
          severity: entry.severity,
          certainty: 'verify',
          reason: `The label warns this product may contain traces of ${entry.allergen} (shared equipment or production line)`,
          reasonKey: 'flag.mayContain',
          reasonParams: { allergen: entry.allergen },
        });
        overallRisk = maxRisk(overallRisk, 'moderate');
      }
    }
  }

  const ingredients = result.ingredients.map((ing, ingIndex) => {
    // The universal level — risk to most people — is the floor. Personal
    // factors can only raise it: an allergy makes peanuts worse for you, it
    // cannot make trans fat better. `personalRisk` stays undefined unless
    // something actually raised it, which is what lets the UI say "normally
    // low, for you avoid" instead of silently showing one number.
    const universal = ing.universalRiskLevel ?? ing.riskLevel;
    let personalRisk: RiskLevel | undefined;
    const raise = (level: RiskLevel) => {
      if (riskRank[level] > riskRank[universal] && riskRank[level] > riskRank[personalRisk ?? universal]) {
        personalRisk = level;
      }
    };
    const reasons: string[] = [];

    // 1. Allergens — the highest-stakes match
    for (const entry of profile.allergens ?? []) {
      if (matchesAllergenEntry(ing.name, entry.allergen, entry.keywords ?? [])) {
        const severity = entry.severity;
        const flagRisk: RiskLevel = severity === 'intolerance' || severity === 'avoid' ? 'moderate' : 'high';
        flags.push({
          ingredientName: ing.name,
          ingredientIndex: ingIndex,
          type: 'allergen',
          match: entry.allergen,
          severity,
          certainty: 'definite',
          impact: impactFor(flagRisk),
          reason: `Matches "${entry.allergen}" (${severity}) in ${profile.name}'s profile`,
          reasonKey: 'flag.allergenMatch',
          reasonParams: { allergen: entry.allergen, severity, profile: profile.name },
        });
        raise(flagRisk);
        reasons.push(`Flagged for ${profile.name}: ${entry.allergen} (${severity})`);
      }
    }

    // 2. Dietary rules
    for (const rule of profileDietary(profile.dietaryRules)) {
      const spec = getConcept(rule);
      if (!spec) continue;
      // One call, because the concept layer already orders definite above
      // verify — it returns the strongest available match rather than the
      // first one to fire.
      const hit = matchConcept(ing.name, spec);
      const definite = hit?.certainty === 'definite' ? hit.evidence : undefined;
      const verify = hit?.certainty === 'verify' ? hit.evidence : undefined;
      if (definite) {
        flags.push({
          ingredientName: ing.name,
          ingredientIndex: ingIndex,
          type: 'dietary',
          match: rule,
          certainty: 'definite',
          reason: `Not ${rule.replace('_', '-')} (contains ${definite})`,
          reasonKey: 'flag.dietaryDefinite',
          reasonParams: { rule: rule.replace('_', '-'), ingredient: definite },
        });
        raise('moderate');
        reasons.push(`Conflicts with ${rule.replace('_', '-')} rule`);
      } else if (verify) {
        flags.push({
          ingredientName: ing.name,
          ingredientIndex: ingIndex,
          type: 'dietary',
          match: rule,
          certainty: 'verify',
          reason: `May not be ${rule.replace('_', '-')} depending on sourcing (${verify}) — verify with manufacturer`,
          reasonKey: 'flag.dietaryVerify',
          reasonParams: { rule: rule.replace('_', '-'), ingredient: verify },
        });
      }
    }

    // 3. Conditions — sourced advisories, and the one place a non-allergen
    //    personal match is allowed to reach `high`. Aspartame for someone with
    //    PKU is not a caution.
    for (const condition of profileConditions(profile.conditions)) {
      const matched = matchAdvisory(ing.name, condition, domain);
      if (!matched) continue;
      const { advisory, term } = matched;
      const flagRisk = impactToRisk(advisory.impact);

      // The advisory's own source, plus anything the knowledge base holds for
      // this ingredient in this condition's context.
      const kbCitations = getCitations(ing.name, [condition]);

      flags.push({
        ingredientName: ing.name,
        ingredientIndex: ingIndex,
        type: 'condition',
        match: condition,
        certainty: 'definite',
        impact: advisory.impact,
        advisoryId: advisory.id,
        reason: advisory.reason,
        reasonKey: advisory.reasonKey,
        reasonParams: { ingredient: ing.name, term },
        citations: [advisoryCitation(advisory), ...kbCitations],
      });
      raise(flagRisk);
      reasons.push(`${advisory.impact === 'avoid' ? 'Avoid' : 'Caution'} for ${condition}`);
    }

    if (!personalRisk && reasons.length === 0) return ing;
    // riskLevel is whichever applies, so every existing reader keeps working.
    // universalRiskLevel is left untouched — it is what this product is to
    // everyone else, and the card needs both to say "normally X, for you Y".
    return {
      ...ing,
      universalRiskLevel: universal,
      personalRiskLevel: personalRisk,
      riskLevel: personalRisk ?? universal,
      riskAdjustmentReason: reasons.length
        ? [ing.riskAdjustmentReason, ...reasons].filter(Boolean).join('; ')
        : ing.riskAdjustmentReason,
    };
  });

  // WHAT WE CHECKED — every term the profile carries, and whether it turned
  // up. A Safe verdict that cannot name what it looked for is asking to be
  // taken on faith; this is the receipt.
  // "Found" means a DEFINITE violation. A `verify` flag is a hedge about
  // sourcing, not a find — reporting "vegan: found" for a sugar that might be
  // bone-char filtered would put a claim in the card the matcher never made.
  const found = (type: PersonalFlag['type'], term: string) =>
    flags.some(f => f.type === type && f.match === term && f.certainty !== 'verify');

  const checked: NonNullable<AnalysisResult['checked']> = [
    ...(profile.allergens ?? []).map(entry => ({
      term: entry.allergen,
      type: 'allergen' as const,
      found: found('allergen', entry.allergen),
    })),
    ...profileDietary(profile.dietaryRules).map(rule => ({
      term: rule,
      type: 'dietary' as const,
      found: found('dietary', rule),
    })),
    ...profileConditions(profile.conditions).map(condition => ({
      term: condition,
      type: 'condition' as const,
      found: found('condition', condition),
    })),
  ];

  // The product's verdict is the worst single row, recomputed from the finished
  // rows rather than accumulated as we went. `overallRisk` arrives here already
  // carrying the label-statement flags — a "contains soy" declaration belongs to
  // no ingredient row, so it has nowhere else to live.
  for (const ing of ingredients) {
    overallRisk = maxRisk(overallRisk, ing.riskLevel);
  }

  const closestCall = findClosestCall(result, profile, canonical);
  const settle = findSettlingAction(flags, ingredients, overallRisk);

  // Rules a label cannot answer, however well it was read.
  //
  // Halal and kosher turn on slaughter method and supervision, so a clean
  // ingredient list is not evidence of compliance — it is the absence of one
  // kind of counter-evidence. Reporting "no violations found" as a pass told a
  // kosher user that a gelatin product was Cleared, which is a false statement
  // about their own practice rather than a near miss.
  //
  // A DEFINITE violation settles the question in the other direction and is
  // reported normally: pork in the list needs no certificate to be wrong.
  const unsettled = profileDietary(profile.dietaryRules).filter(rule => {
    if (getConcept(rule)?.determinability !== 'certification') return false;
    return !flags.some(f => f.type === 'dietary' && f.match === rule && f.certainty === 'definite');
  });

  return {
    ...result,
    ingredients,
    overallRisk,
    personalFlags: flags,
    appliedProfile: { id: profile.id, name: profile.name },
    checked,
    ...(closestCall ? { closestCall } : {}),
    ...(settle ? { settle } : {}),
    ...(unsettled.length > 0 ? { unsettled } : {}),
  };
}

/**
 * The nearest miss across the whole label: an ingredient that tripped one of
 * the profile's allergen keywords and was then ruled out by an exclusion.
 *
 * Only near misses on the person's OWN allergens count. A milk near-miss is
 * interesting to someone with a milk allergy and pure noise to everyone else.
 */
function findClosestCall(
  result: AnalysisResult,
  profile: Profile,
  canonical: string[],
): AnalysisResult['closestCall'] {
  const names = [...canonical, ...result.ingredients.map(i => i.name)];
  for (const entry of profile.allergens ?? []) {
    for (const name of names) {
      const keyword = nearMissForAllergen(name, entry.allergen, entry.keywords ?? []);
      if (keyword) {
        return { ingredientName: name, term: entry.allergen, keyword };
      }
    }
  }
  return undefined;
}

/**
 * WHAT WOULD SETTLE THIS — the specific next move that resolves a hedged
 * verdict, or nothing.
 *
 * Deliberately returns undefined when the doubt is not actually resolvable:
 * a "what would settle this" block with generic advice in it is worse than no
 * block, because it implies an action exists when none does.
 */
function findSettlingAction(
  flags: PersonalFlag[],
  ingredients: AnalysisResult['ingredients'],
  overallRisk: RiskLevel,
): AnalysisResult['settle'] {
  if (overallRisk === 'low') return undefined;

  // A shared-line warning is settled by the maker, and only by the maker.
  const trace = flags.find(f => f.type === 'allergen' && f.certainty === 'verify');
  if (trace) {
    return {
      reasonKey: 'settle.askMakerTrace',
      params: { allergen: trace.match },
    };
  }

  // Sourcing-dependent dietary matches are also a question for the maker, but
  // they can at least name the ingredient in question.
  const sourcing = flags.find(f => f.type === 'dietary' && f.certainty === 'verify');
  if (sourcing) {
    return {
      reasonKey: 'settle.askMakerSourcing',
      ingredientName: sourcing.ingredientName,
      params: { ingredient: sourcing.ingredientName },
    };
  }

  // A DEFINITE personal flag leaves nothing to settle. "Contains honey" is
  // not a doubt, it is an answer, and offering to resolve it would imply the
  // verdict is softer than it is.
  if (flags.some(f => f.certainty !== 'verify')) return undefined;

  // Otherwise the doubt is about one ingredient's general profile, which the
  // drill-down's sources can actually answer — so point at it by name.
  const driver = ingredients.find(i => i.riskLevel !== 'low' && (i.citations?.length ?? 0) > 0)
    ?? ingredients.find(i => i.riskLevel !== 'low');
  if (driver) {
    return {
      reasonKey: 'settle.readSources',
      ingredientName: driver.name,
      params: { ingredient: driver.name },
    };
  }

  return undefined;
}
