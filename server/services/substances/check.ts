import { profileConditionTypes } from '@shared/schema';
import {
  CONDITION_ADVISORIES,
  conditionsWithAdvisories,
  matchAdvisory,
} from '../conditionAdvisories';
import { getEvidenceStore } from './evidence';
import { getSubstanceRegistry, isValidCas, normalizeSubstanceName } from './identity';
import { POLICY_RULES, POLICY_VERSION, applyPolicy } from './policy';
import { classifyIngredient } from './classify';

/**
 * Integrity check for the substance corpus.
 *
 *   npm run substances:check
 *
 * Runs before shipping a corpus change. The failures it looks for are the ones
 * that would produce a confidently wrong answer rather than a crash:
 *
 *  - evidence pointing at a substance id that does not exist (a record that can
 *    never fire, i.e. a silent false negative)
 *  - malformed CAS numbers, which join evidence onto the wrong substance
 *  - aliases that collide across substances
 *  - rules that no record in the corpus can currently trigger
 *
 * Exits non-zero on any error so it can gate a commit.
 */

interface Problem {
  severity: 'error' | 'warning';
  message: string;
}

function main(): void {
  const problems: Problem[] = [];
  const registry = getSubstanceRegistry();
  const evidence = getEvidenceStore();

  console.log(`\n[CHECK] registry v${registry.version} — ${registry.size} substances, ${registry.aliasCount} aliases`);
  console.log(`[CHECK] evidence v${evidence.version} — ${evidence.recordCount} records on ${evidence.substanceCount} substances`);
  console.log(`[CHECK] policy ${POLICY_VERSION} — ${POLICY_RULES.length} rules`);

  // --- orphaned evidence ---
  for (const substanceId of evidence.substanceIds()) {
    if (!registry.getById(substanceId)) {
      problems.push({
        severity: 'error',
        message: `evidence references unknown substance "${substanceId}" — these records can never fire`,
      });
    }
  }

  // --- identifier sanity ---
  for (const id of evidence.substanceIds()) {
    const substance = registry.getById(id);
    if (substance?.cas && !isValidCas(substance.cas)) {
      problems.push({
        severity: 'error',
        message: `substance "${id}" has an invalid CAS "${substance.cas}" (check digit fails)`,
      });
    }
  }

  // --- alias collisions ---
  // The registry silently drops colliding aliases by design; surface them so a
  // curator knows a name is unreachable rather than merely absent.
  const aliasOwners = new Map<string, string[]>();
  const unresolvable: string[] = [];
  for (const id of evidence.substanceIds()) {
    const substance = registry.getById(id);
    if (!substance) continue;
    for (const alias of [{ name: substance.name }, ...substance.aliases]) {
      const key = normalizeSubstanceName(alias.name);
      if (!key) continue;
      const owners = aliasOwners.get(key) ?? [];
      if (!owners.includes(substance.id)) owners.push(substance.id);
      aliasOwners.set(key, owners);
    }
  }
  for (const [alias, owners] of aliasOwners) {
    if (owners.length <= 1) continue;

    // Two claims are not automatically a dropped alias. The registry arbitrates
    // by confidence — an exact entry beats a name pulled out of a family cell —
    // and only genuinely tied claims are dropped. Counting raw claims reported
    // 37 aliases as unreachable, including methylisothiazolinone, which in fact
    // resolves and carries a record. A check that cries wolf on a name that
    // works is worse than no check: it trains a curator to skim past the line
    // that eventually matters.
    //
    // So ask the registry what actually happened rather than predicting it.
    const resolved = registry.resolve(alias);
    if (resolved) {
      problems.push({
        severity: 'warning',
        message:
          `alias "${alias}" is claimed by ${owners.length} substances; ` +
          `resolves to ${resolved.substance.id} on the stronger claim`,
      });
      continue;
    }
    unresolvable.push(
      `alias "${alias}" is claimed by ${owners.join(', ')} with equal confidence — it will never resolve`,
    );
  }

  // A ratchet, not a pass/fail line.
  //
  // These are real defects — a name a label prints that the corpus cannot
  // answer — but they are a backlog, not a regression: each one needs a person
  // to decide whether two entries with no shared CAS are the same substance,
  // and that is not a judgement to rush. Failing the build on all of them
  // leaves the gate permanently red, which teaches everyone to run it with
  // their eyes closed and is how the two authentication holes survived.
  //
  // So the count is what is gated. Lower the baseline as they are curated
  // away; it can never drift upward without failing.
  const UNRESOLVABLE_BASELINE = 9;
  if (unresolvable.length > UNRESOLVABLE_BASELINE) {
    problems.push({
      severity: 'error',
      message:
        `${unresolvable.length} unresolvable aliases, up from a baseline of ` +
        `${UNRESOLVABLE_BASELINE}. A new name has become unreachable.`,
    });
  } else if (unresolvable.length < UNRESOLVABLE_BASELINE) {
    problems.push({
      severity: 'warning',
      message:
        `${unresolvable.length} unresolvable aliases, below the baseline of ` +
        `${UNRESOLVABLE_BASELINE} — lower UNRESOLVABLE_BASELINE to lock the gain in`,
    });
  }
  for (const message of unresolvable) {
    problems.push({ severity: 'warning', message });
  }

  // --- rule reachability ---
  const fired = new Set<string>();
  const levels = { low: 0, moderate: 0, high: 0, unknown: 0 };
  for (const substanceId of evidence.substanceIds()) {
    for (const domain of ['food', 'cosmetic'] as const) {
      // Unioned, so this sweep counts the levels the app will actually serve.
      const records = evidence.forSubstancesInDomain(
        registry.sameSubstanceIds(substanceId),
        domain,
      );
      if (records.length === 0) continue;
      const decision = applyPolicy(records, { domain });
      levels[decision.level] += 1;
      for (const f of decision.fired) fired.add(f.ruleId);
    }
  }
  // On an empty corpus every rule is unreachable, which is expected rather than
  // interesting — reporting 14 warnings would bury a real problem. Only flag
  // individual unreachable rules once there is a corpus for them to miss.
  if (evidence.recordCount === 0) {
    console.log(
      '\n[CHECK] corpus is empty — every ingredient classifies as unknown. ' +
        'Rule reachability is not checked until a source is ingested.',
    );
  } else {
    for (const rule of POLICY_RULES) {
      if (!fired.has(rule.id)) {
        problems.push({
          severity: 'warning',
          message: `rule "${rule.id}" is never triggered by the current corpus — no source feeds it yet`,
        });
      }
    }
  }

  console.log(
    `\n[CHECK] levels across substance/domain pairs: ` +
      `high ${levels.high}, moderate ${levels.moderate}, low ${levels.low}, unknown ${levels.unknown}`,
  );

  // --- must never resolve ---
  //
  // These hold on an empty corpus and on a full one. They are the shapes the
  // retired fuzzy matcher got wrong: it substring-matched regulated terms, so
  // "lake salt" hit its "lake" dye pattern and "formaldehyde-free" hit
  // "formaldehyde", and it called both high. A failure here means the resolver
  // has loosened into guessing.
  const mustNotResolve = [
    { name: 'lake salt', domain: 'food' as const },
    { name: 'formaldehyde-free', domain: 'cosmetic' as const },
    { name: 'sodium benzoate-free', domain: 'food' as const },
    { name: 'water', domain: 'cosmetic' as const },
    { name: '', domain: 'food' as const },
    // The colour index number is shared by carbon black and carbon black
    // (nano), which the annexes treat as separate entities with separate
    // limits. Merging duplicate entries on a shared CAS must not reach across
    // that line: if this ever resolves, the nano restrictions have been
    // attached to the bulk pigment or the reverse.
    { name: 'CI 77266', domain: 'cosmetic' as const },
  ];

  console.log('\n[CHECK] must-not-resolve');
  for (const probe of mustNotResolve) {
    const result = classifyIngredient(probe.name, probe.domain, { recordMiss: false });
    const resolved = result.resolved !== null;
    console.log(
      `  ${resolved ? 'FAIL' : 'ok  '} "${probe.name}" → ${
        resolved ? result.resolved!.substance.id : 'unresolved'
      }`,
    );
    if (resolved) {
      problems.push({
        severity: 'error',
        message: `"${probe.name}" must not resolve, but matched ${result.resolved!.substance.id}`,
      });
    }
  }

  // --- regression guards, armed by coverage ---
  //
  // Each of these pins a bug that was found and fixed. They cannot run against
  // an empty corpus, so a guard whose substance is absent reports `pending` and
  // arms itself automatically once a snapshot brings that substance in. The
  // point is that the knowledge of the bug outlives the seed data that exposed
  // it — when Prop 65 and CosIng are ingested, these start asserting.
  const guards: {
    substanceId: string;
    name: string;
    domain: 'food' | 'cosmetic';
    expectLevel: string;
    expectRule?: string;
    why: string;
  }[] = [
    {
      substanceId: 'methylparaben',
      name: 'Methylparaben',
      domain: 'cosmetic',
      expectLevel: 'moderate',
      expectRule: 'moderate.restricted_with_limit',
      why: 'permitted in the EU under a concentration limit, not prohibited',
    },
    // --- FDA Substances Added to Food ---
    //
    // The food source. Everything above it is about cosmetics or about cancer,
    // and before it landed an ordinary food label resolved almost nothing.
    {
      substanceId: 'diethyl_pyrocarbonate',
      name: 'Diethyl Pyrocarbonate',
      domain: 'food',
      expectLevel: 'high',
      expectRule: 'high.prohibited_in_tracked_market',
      why: 'the FDA spells one of its twenty prohibitions "-- PROHIBITED", with a space, and a marker regex without slack read it as an ordinary additive',
    },
    {
      substanceId: 'fd_c_red_no_40',
      name: 'Red 40',
      domain: 'food',
      expectLevel: 'low',
      why: 'the regulation calls it FD&C Red No. 40 and every label calls it Red 40; without the colour alias the most-scanned dye in the inventory resolved to nothing',
    },
    {
      substanceId: 'mannitol',
      name: 'Mannitol',
      domain: 'food',
      expectLevel: 'moderate',
      expectRule: 'moderate.under_reevaluation',
      why: 'permitted on an interim basis pending additional study — an unresolved question, not a clean bill of health',
    },
    {
      substanceId: 'acacia_gum_acacia_senegal_l_willd',
      name: 'Gum Acacia',
      domain: 'food',
      expectLevel: 'low',
      expectRule: 'low.assessed_no_concern',
      why: 'the inventory files it comma-inverted and botanically qualified; a label just says gum acacia',
    },
    {
      // The rule that keeps the food source honest. Acetaldehyde is an
      // authorised flavouring AND an IARC Group 2A carcinogen, filed under
      // different ids by the two sources. If permission could outrank a hazard
      // — or if the CAS grouping failed to join them — this reads low.
      substanceId: 'acetaldehyde',
      name: 'Acetaldehyde',
      domain: 'food',
      expectLevel: 'high',
      expectRule: 'high.iarc_group_1_or_2a',
      why: 'an FDA authorisation never outranks a carcinogen listing, even across two substance ids',
    },
    {
      substanceId: 'formaldehyde',
      name: 'Formaldehyde',
      domain: 'cosmetic',
      expectLevel: 'high',
      expectRule: 'high.iarc_group_1_or_2a',
      why: 'high on IARC Group 1, not on a ban belonging to another market',
    },
    {
      substanceId: 'lead_acetate',
      name: 'Lead Acetate',
      domain: 'cosmetic',
      expectLevel: 'high',
      why: 'a US prohibition is still a prohibition',
    },
    {
      // The pair that has to move together. MI is authorised in the EU but
      // only in rinse-off products, and it read `low` for as long as the
      // corpus saw the cap and discarded the confinement.
      substanceId: '2_methyl_2h_isothiazol_3_one',
      name: 'Methylisothiazolinone',
      domain: 'cosmetic',
      expectLevel: 'moderate',
      expectRule: 'moderate.permitted_only_for_limited_uses',
      why: 'authorised for rinse-off products only, and a label does not say which kind of product this is',
    },
    {
      // Filed twice — "Talc" in one annex, "Talc: hydrated magnesium silicate"
      // in another — which made the name unresolvable until entries sharing a
      // CAS were merged. The guard is that it resolves at all; the level
      // follows from IARC and will move if IARC does.
      substanceId: 'talc',
      name: 'Talc',
      domain: 'cosmetic',
      expectLevel: 'high',
      why: 'one substance filed under two names must still answer to its common name',
    },
    {
      // The control. An unconditional authorisation must stay low, or the fix
      // above has simply moved the false-alarm problem to the other side and
      // every preservative in the aisle reads Caution.
      substanceId: '2_phenoxyethanol',
      name: 'Phenoxyethanol',
      domain: 'cosmetic',
      expectLevel: 'low',
      expectRule: 'low.permitted_no_hazard_records',
      why: 'a concentration cap is how an authorisation is written, not a finding of concern',
    },
  ];

  console.log('\n[CHECK] regression guards');
  for (const guard of guards) {
    if (!registry.getById(guard.substanceId)) {
      console.log(`  pend "${guard.name}" — ${guard.substanceId} not in corpus yet`);
      continue;
    }
    const result = classifyIngredient(guard.name, guard.domain, { recordMiss: false });
    const level = String(result.decision.level);
    const rule = result.decision.decidedBy?.ruleId ?? '—';

    const failures: string[] = [];
    if (level !== guard.expectLevel) failures.push(`expected ${guard.expectLevel}, got ${level}`);
    if (guard.expectRule && rule !== guard.expectRule) {
      failures.push(`expected decider ${guard.expectRule}, got ${rule}`);
    }

    console.log(
      `  ${failures.length === 0 ? 'ok  ' : 'FAIL'} "${guard.name}" (${guard.domain}) → ` +
        `${level} / ${rule}  — ${guard.why}`,
    );
    for (const failure of failures) {
      problems.push({ severity: 'error', message: `"${guard.name}": ${failure}` });
    }
  }

  // ---- condition advisories ----
  //
  // The corpus and the advisory table answer different questions, but they fail
  // the same way: a condition offered in the UI with nothing behind it looks
  // like a check that ran and found nothing. Someone selects "PKU", scans a
  // diet drink, and reads a clean card. So every selectable condition must be
  // reachable, and every advisory must actually fire on its own terms.
  console.log('\n[CHECK] condition advisories');
  const covered = conditionsWithAdvisories();
  for (const condition of profileConditionTypes) {
    const ok = covered.has(condition);
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${condition}`);
    if (!ok) {
      problems.push({
        severity: 'error',
        message: `condition "${condition}" is selectable but has no advisory — it would silently never fire`,
      });
    }
  }

  for (const advisory of CONDITION_ADVISORIES) {
    const domain = advisory.domain === 'any' ? 'food' : advisory.domain;
    const dead = advisory.terms.filter(
      (term) => matchAdvisory(term, advisory.condition, domain)?.advisory.id !== advisory.id,
    );
    // A term that cannot match itself is either shadowed by a higher-impact
    // advisory on the same condition (fine, and expected) or unreachable
    // because of the negation guard (not fine). Reported as a warning so the
    // shadowing case does not fail the build.
    if (dead.length > 0) {
      problems.push({
        severity: 'warning',
        message: `advisory "${advisory.id}" — term(s) never resolve to it: ${dead.join(', ')}`,
      });
    }
  }

  const errors = problems.filter((p) => p.severity === 'error');
  const warnings = problems.filter((p) => p.severity === 'warning');

  if (warnings.length > 0) {
    console.log(`\n[CHECK] ${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  - ${w.message}`);
  }
  if (errors.length > 0) {
    console.log(`\n[CHECK] ${errors.length} error(s):`);
    for (const e of errors) console.log(`  - ${e.message}`);
    console.log('');
    process.exit(1);
  }

  console.log(`\n[CHECK] passed${warnings.length ? ` with ${warnings.length} warning(s)` : ''}\n`);
}

main();
