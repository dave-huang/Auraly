// Re-exports the server's domain types for the app.
//
// IMPORTANT: these are `export type` only. shared/schema.ts imports
// drizzle-orm (Postgres table definitions) which must never be bundled into
// the RN app — type-only exports are erased at compile time, so Metro never
// sees them. If you need a runtime value (a zod schema, a constant array),
// duplicate it here rather than importing it.
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
