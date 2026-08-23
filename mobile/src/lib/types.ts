// Re-exports the server's domain types for the app.
//
// IMPORTANT: these are `export type` only. shared/schema.ts imports
// drizzle-orm (Postgres table definitions) which must never be bundled into
// the RN app — type-only exports are erased at compile time, so Metro never
// sees them. If you need a runtime value (a zod schema, a constant array),
// duplicate it here rather than importing it.
// `export type { ... }` re-exports without binding the names locally, and the
// helpers below need them in scope.
import type { DietaryRule, ProfileCondition } from '@shared/schema';

export type {
  AnalysisResult,
  Ingredient,
  RiskLevel,
  ProductType,
  Profile,
  ProfileAllergen,
  AllergenSeverity,
  DietaryRule,
  ProfileCondition,
  PersonalFlag,
  Citation,
  UpsertProfileInput,
  User,
  ScanHistory,
} from '@shared/schema';

// Runtime constants — duplicated from shared/schema.ts on purpose (see above).
// Keep in sync; the server validates authoritatively.
export const ALLERGEN_SEVERITIES = ['anaphylaxis', 'allergy', 'intolerance', 'avoid'] as const;

/**
 * Read stored dietary rules, whichever shape they were stored in.
 *
 * A per-entry strictness control shipped on 2026-08-23 and was removed the same
 * day, so a few profiles hold `{ rule, strictness }` rather than a bare name.
 * Those rows are never rewritten; the extra field is dropped on read, landing
 * them on the conservative behaviour every other profile already had.
 */
export function dietaryRuleNames(
  rules: (DietaryRule | { rule: DietaryRule })[] | null | undefined,
): DietaryRule[] {
  return (rules ?? []).map((entry) => (typeof entry === 'string' ? entry : entry.rule));
}

/** As above, for conditions. */
export function conditionNames(
  conditions: (ProfileCondition | { condition: ProfileCondition })[] | null | undefined,
): ProfileCondition[] {
  return (conditions ?? []).map((entry) =>
    typeof entry === 'string' ? entry : entry.condition,
  );
}

export const DIETARY_RULES = ['vegan', 'vegetarian', 'gluten_free', 'halal', 'kosher'] as const;
export const PROFILE_CONDITIONS = [
  'pregnancy', 'breastfeeding', 'celiac', 'eczema',
  'pku', 'g6pd_deficiency', 'hypertension', 'diabetes', 'kidney_disease',
] as const;
export const PRODUCT_TYPES = ['food', 'personal_care'] as const;
export const RISK_LEVELS = ['low', 'moderate', 'high'] as const;

// Every allergen that must be declared somewhere this app is used — the US
// FASTER Act nine plus the EU/UK/CA/AU additions and Japan's buckwheat.
//
// MUST stay identical to MAJOR_ALLERGENS in server/services/allergenMatcher.ts.
// An entry offered here with no keyword list there is selectable in the UI and
// silently matches nothing, which is why eval/risk.check.ts compares the two
// lists and fails the build when they drift.
export const MAJOR_ALLERGENS = [
  'milk', 'egg', 'fish', 'shellfish', 'molluscs', 'tree_nuts', 'peanut',
  'wheat', 'soy', 'sesame', 'sulphites', 'mustard', 'celery', 'lupin',
  'buckwheat',
] as const;
