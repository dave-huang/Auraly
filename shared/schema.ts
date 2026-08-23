import { z } from "zod";
import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

// Sessions table (REQUIRED for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// ==========================================
// RISK PREFERENCE CATEGORIES & TYPES
// ==========================================

export const preferenceCategories = [
  "artificial_fragrances",
  "artificial_colors",
  "preservatives", 
  "endocrine_disruptors",
  "contact_sensitizers",
  "alcohols",
  "fragrance_allergens",
  "parabens",
  "sulfates",
  "pegs_ethoxylated",
  "silicones"
] as const;

export type PreferenceCategory = typeof preferenceCategories[number];

// ==========================================
// ALLERGEN CATEGORIES & TYPES
// ==========================================

// Food-Derived Allergens
export const foodAllergenCategories = [
  "nuts",
  "soy",
  "dairy",
  "gluten_wheat",
  "eggs",
  "seafood_shellfish"
] as const;

// Cosmetic Allergens
export const cosmeticAllergenCategories = [
  "fragrance_allergens_cosmetic",
  "preservative_allergens",
  "lanolin",
  "botanical_extracts"
] as const;

// Chemical Additive Allergens
export const chemicalAllergenCategories = [
  "colorants_dyes",
  "drying_alcohols"
] as const;

// All allergen categories combined
export const allergenCategories = [
  ...foodAllergenCategories,
  ...cosmeticAllergenCategories,
  ...chemicalAllergenCategories
] as const;

export type AllergenCategory = typeof allergenCategories[number];
export type FoodAllergenCategory = typeof foodAllergenCategories[number];
export type CosmeticAllergenCategory = typeof cosmeticAllergenCategories[number];
export type ChemicalAllergenCategory = typeof chemicalAllergenCategories[number];

// Allergen preferences schema (all default to false/OFF)
export const allergenPreferencesSchema = z.object({
  // Food-Derived
  nuts: z.boolean().default(false),
  soy: z.boolean().default(false),
  dairy: z.boolean().default(false),
  gluten_wheat: z.boolean().default(false),
  eggs: z.boolean().default(false),
  seafood_shellfish: z.boolean().default(false),
  // Cosmetic
  fragrance_allergens_cosmetic: z.boolean().default(false),
  preservative_allergens: z.boolean().default(false),
  lanolin: z.boolean().default(false),
  botanical_extracts: z.boolean().default(false),
  // Chemical
  colorants_dyes: z.boolean().default(false),
  drying_alcohols: z.boolean().default(false),
});

export type AllergenPreferences = z.infer<typeof allergenPreferencesSchema>;

export const defaultAllergenPreferences: AllergenPreferences = {
  nuts: false,
  soy: false,
  dairy: false,
  gluten_wheat: false,
  eggs: false,
  seafood_shellfish: false,
  fragrance_allergens_cosmetic: false,
  preservative_allergens: false,
  lanolin: false,
  botanical_extracts: false,
  colorants_dyes: false,
  drying_alcohols: false,
};

// Helper to check if user has any allergen preferences enabled
export function hasActiveAllergenPreferences(prefs: AllergenPreferences | null | undefined): boolean {
  if (!prefs) return false;
  return Object.values(prefs).some(v => v === true);
}

export const riskToleranceLevels = [
  "avoid",           // Avoid Completely - elevates risk to high
  "caution",         // Use With Caution - elevates risk by one level
  "no_preference"    // No Preference - use base scientific risk
] as const;

export type RiskTolerance = typeof riskToleranceLevels[number];

export const riskPreferencesSchema = z.object({
  artificial_fragrances: z.enum(riskToleranceLevels).default("no_preference"),
  artificial_colors: z.enum(riskToleranceLevels).default("no_preference"),
  preservatives: z.enum(riskToleranceLevels).default("no_preference"),
  endocrine_disruptors: z.enum(riskToleranceLevels).default("no_preference"),
  contact_sensitizers: z.enum(riskToleranceLevels).default("no_preference"),
  alcohols: z.enum(riskToleranceLevels).default("no_preference"),
  fragrance_allergens: z.enum(riskToleranceLevels).default("no_preference"),
  parabens: z.enum(riskToleranceLevels).default("no_preference"),
  sulfates: z.enum(riskToleranceLevels).default("no_preference"),
  pegs_ethoxylated: z.enum(riskToleranceLevels).default("no_preference"),
  silicones: z.enum(riskToleranceLevels).default("no_preference"),
});

export type RiskPreferences = z.infer<typeof riskPreferencesSchema>;

export const defaultRiskPreferences: RiskPreferences = {
  artificial_fragrances: "no_preference",
  artificial_colors: "no_preference",
  preservatives: "no_preference",
  endocrine_disruptors: "no_preference",
  contact_sensitizers: "no_preference",
  alcohols: "no_preference",
  fragrance_allergens: "no_preference",
  parabens: "no_preference",
  sulfates: "no_preference",
  pegs_ethoxylated: "no_preference",
  silicones: "no_preference",
};

// Users table (REQUIRED for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  riskPreferences: jsonb("risk_preferences").$type<RiskPreferences>().default(defaultRiskPreferences),
  allergenPreferences: jsonb("allergen_preferences").$type<AllergenPreferences>().default(defaultAllergenPreferences),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  
  // Stripe customer ID (for scan bundle purchases)
  stripeCustomerId: varchar("stripe_customer_id"),
  
  // Daily free scan tracking (2 free scans per day, reset every 24h)
  dailyFreeScansUsed: integer("daily_free_scans_used").default(0),
  lastDailyReset: timestamp("last_daily_reset").defaultNow(),
  
  // Purchased scan balance (never expires)
  purchasedScanBalance: integer("purchased_scan_balance").default(0),
  
  // Referral code (unique per user, auto-generated)
  referralCode: varchar("referral_code").unique(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;

const DAILY_FREE_SCANS = 2;

export function getDailyFreeScansLimit(): number {
  return DAILY_FREE_SCANS;
}

export function needsDailyReset(user: User): boolean {
  if (!user.lastDailyReset) return true;
  const lastReset = new Date(user.lastDailyReset);
  const now = new Date();
  return lastReset.toDateString() !== now.toDateString();
}

export function getDailyFreeScansRemaining(user: User): number {
  if (needsDailyReset(user)) return DAILY_FREE_SCANS;
  return Math.max(0, DAILY_FREE_SCANS - (user.dailyFreeScansUsed || 0));
}

export function getTotalScansAvailable(user: User): number {
  return getDailyFreeScansRemaining(user) + (user.purchasedScanBalance || 0);
}

export function canUserScan(user: User): boolean {
  return getTotalScansAvailable(user) > 0;
}

// Scan usage logs table (for analytics)
export const scanUsageLogs = pgTable(
  "scan_usage_logs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    action: varchar("action").notNull(), // 'scan_attempt', 'scan_success', 'scan_blocked', 'scan_error'
    scanSource: varchar("scan_source"), // 'free', 'purchased'
    productType: varchar("product_type"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("IDX_scan_usage_user_id").on(table.userId),
    index("IDX_scan_usage_created_at").on(table.createdAt),
  ]
);

export type ScanUsageLog = typeof scanUsageLogs.$inferSelect;

// Purchase logs table (for tracking scan pack purchases)
export const purchaseLogs = pgTable(
  "purchase_logs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    purchaseType: varchar("purchase_type").notNull(), // 'scan_bundle'
    amount: integer("amount").notNull(), // in cents
    currency: varchar("currency").default("usd"),
    scansAdded: integer("scans_added"), // for scan packs
    stripePaymentIntentId: varchar("stripe_payment_intent_id"),
    stripeCheckoutSessionId: varchar("stripe_checkout_session_id"),
    status: varchar("status").default("completed"), // 'completed', 'refunded', 'failed'
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("IDX_purchase_user_id").on(table.userId),
    index("IDX_purchase_created_at").on(table.createdAt),
  ]
);

export type PurchaseLog = typeof purchaseLogs.$inferSelect;

// Analytics events table (for conversion tracking)
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
    eventType: varchar("event_type").notNull(), // 'paywall_view', 'paywall_dismiss', 'upgrade_click', 'gated_content_tap'
    eventData: jsonb("event_data"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("IDX_analytics_event_type").on(table.eventType),
    index("IDX_analytics_created_at").on(table.createdAt),
  ]
);

// Simplified product categories (2 main categories)
export const productCategories = [
  "food",           // Food & Supplements (food, beverages, vitamins, supplements, etc.)
  "personal_care"   // Personal Care (skincare, haircare, cosmetics, fragrance, body care)
] as const;

export type ProductCategory = typeof productCategories[number];

// Scan History table
export const scanHistory = pgTable(
  "scan_history",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    productName: varchar("product_name").notNull().default("Unnamed Product"),
    productCategory: varchar("product_category").notNull().default("food"),
    originalImageUrl: text("original_image_url"),
    detectedIngredients: text("detected_ingredients").array().notNull().default(sql`ARRAY[]::text[]`),
    analysisResults: jsonb("analysis_results").notNull(),
    overallRisk: varchar("overall_risk").notNull().default("low"),
    language: varchar("language").notNull().default("en"),
    isUpdatedFromCache: boolean("is_updated_from_cache").notNull().default(false),
    ingredientCount: integer("ingredient_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("IDX_scan_history_user_id").on(table.userId),
    index("IDX_scan_history_created_at").on(table.createdAt),
  ]
);

export type ScanHistory = typeof scanHistory.$inferSelect;
export type InsertScanHistory = typeof scanHistory.$inferInsert;

// ==========================================
// PERSONAL PROFILES (multi-profile per user, e.g. family members)
// ==========================================

// Severity of a profile allergen entry — drives how hard a match is flagged.
export const allergenSeverities = [
  "anaphylaxis",  // life-threatening — always flag as high risk
  "allergy",      // diagnosed allergy — always flag as high risk
  "intolerance",  // e.g. lactose intolerance — flag as moderate+
  "avoid",        // personal avoidance preference — flag as moderate
] as const;
export type AllergenSeverity = typeof allergenSeverities[number];

/**
 * A per-entry `traces` policy — whether a label's "may contain" line counted
 * for this allergen — shipped on 2026-08-22 and was removed on 2026-08-23,
 * alongside the dietary strictness control and for the same reason: it asked
 * people to make a judgement about cross-contamination risk that the app is in
 * no position to help them make.
 *
 * Every entry now warns on traces, which is both the conservative answer and
 * what the app did before the setting existed. The cost is real and known: a
 * lactose-intolerance entry goes amber on products that merely share a line
 * with dairy, where the dose is the entire mechanism and there is no dose. If
 * that noise becomes the complaint, the fix is a quieter PRESENTATION of a
 * trace flag — it is already `certainty: 'verify'` and could be shown as a note
 * rather than a verdict change — not a setting asking the user to decide.
 *
 * Entries stored while the control existed still carry `traces`; it is ignored.
 */
export const profileAllergenSchema = z.object({
  // Canonical name: a big-9 allergen ("peanut", "milk", "sesame", ...) or any
  // custom ingredient/term ("red 40", "carrageenan")
  allergen: z.string().min(1),
  severity: z.enum(allergenSeverities).default("allergy"),
  // Extra match terms beyond the built-in keyword list for this allergen
  keywords: z.array(z.string()).optional(),
});
export type ProfileAllergen = z.infer<typeof profileAllergenSchema>;

export const dietaryRuleTypes = [
  "vegan", "vegetarian", "gluten_free", "halal", "kosher",
] as const;
export type DietaryRule = typeof dietaryRuleTypes[number];

/**
 * Dietary rules and conditions carried a per-entry `strictness` for one day,
 * on 2026-08-23. It was removed the same day: the control asked people to
 * predict how the app would treat "sourcing doubt", which is a distinction
 * about our internals rather than about their life, and the honest default was
 * always the conservative one anyway.
 *
 * Everything now behaves as the old `strict` did — sourcing-dependent hits are
 * shown, caution advisories move the verdict. Entries written while the control
 * existed still parse; the field is simply ignored.
 */


// Conditions that change what is safe for THIS person, independent of what any
// regulator has done about an ingredient. Aspartame is approved in every market
// on earth and causes irreversible harm to someone with PKU; a scale built only
// on enforcement action cannot see that, which is why this list exists and why
// an advisory here is allowed to reach `high`.
//
// Each entry must be backed by a sourced advisory in
// server/services/conditionAdvisories.ts — adding a member here without one
// makes the condition selectable in the UI and silently inert.
export const profileConditionTypes = [
  "pregnancy", "breastfeeding", "celiac", "eczema",
  "pku", "g6pd_deficiency", "hypertension", "diabetes", "kidney_disease",
] as const;
export type ProfileCondition = typeof profileConditionTypes[number];
/** Stored shape while the strictness control existed. Read, never written. */
export type LegacyDietaryEntry = { rule: DietaryRule; strictness?: string };
export type LegacyConditionEntry = { condition: ProfileCondition; strictness?: string };

export const profiles = pgTable(
  "profiles",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    allergens: jsonb("allergens").$type<ProfileAllergen[]>().notNull().default([]),
    // Union types on purpose. Rows written during the one day the strictness
    // control existed hold objects, and are never rewritten. Typing the stored
    // shape honestly means TypeScript refuses a direct read and pushes every
    // caller through profileDietary()/profileConditions() below, which is the
    // only place that knows how to read both.
    dietaryRules: jsonb("dietary_rules")
      .$type<(DietaryRule | LegacyDietaryEntry)[]>().notNull().default([]),
    conditions: jsonb("conditions")
      .$type<(ProfileCondition | LegacyConditionEntry)[]>().notNull().default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("IDX_profiles_user_id").on(table.userId),
  ]
);

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = typeof profiles.$inferInsert;

// Ingredients we could not classify, ranked by how often real scans hit them.
//
// This is the curation queue for the substance corpus: rather than guessing
// which corner of the additive index to fill in next, you work down this table.
// No user id — the interesting unit is the ingredient string, and keeping this
// unattributed means it survives account deletion without any special handling.
export const substanceCoverageMisses = pgTable(
  "substance_coverage_misses",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    /** The name exactly as the label printed it, for curation. */
    inputName: text("input_name").notNull(),
    /** Lowercased/trimmed form that the upsert key is built on. */
    normalizedName: text("normalized_name").notNull(),
    domain: varchar("domain").notNull(), // 'food' | 'cosmetic'
    reason: varchar("reason").notNull(), // 'unresolved' | 'no_evidence'
    /** Set when identity resolved but we hold no evidence for the substance. */
    substanceId: varchar("substance_id"),
    seenCount: integer("seen_count").notNull().default(1),
    firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("UQ_coverage_miss").on(table.normalizedName, table.domain, table.reason),
    index("IDX_coverage_seen_count").on(table.seenCount),
  ]
);

export type SubstanceCoverageMiss = typeof substanceCoverageMisses.$inferSelect;

/**
 * Read a profile's dietary rules, whichever shape they were stored in.
 *
 * Profiles are jsonb, so the short-lived strictness field arrived and left
 * without a migration. Rows written while it existed hold `{ rule, strictness }`
 * and are never rewritten; the strictness is dropped on read, which lands them
 * on the conservative behaviour every other row already had.
 */
export function profileDietary(
  rules: (DietaryRule | LegacyDietaryEntry)[] | null | undefined,
): DietaryRule[] {
  return (rules ?? []).map(entry => (typeof entry === "string" ? entry : entry.rule));
}

/** As above, for conditions. */
export function profileConditions(
  conditions: (ProfileCondition | LegacyConditionEntry)[] | null | undefined,
): ProfileCondition[] {
  return (conditions ?? []).map(entry =>
    typeof entry === "string" ? entry : entry.condition,
  );
}

// Accepts the entry shape from a client too. Build 6 shipped sending it, and an
// app build the user has not updated must not start failing to save profiles.
const dietaryInput = z.union([
  z.enum(dietaryRuleTypes),
  z.object({ rule: z.enum(dietaryRuleTypes) }).transform(entry => entry.rule),
]);
const conditionInput = z.union([
  z.enum(profileConditionTypes),
  z.object({ condition: z.enum(profileConditionTypes) }).transform(entry => entry.condition),
]);

export const upsertProfileSchema = z.object({
  name: z.string().min(1).max(60),
  isDefault: z.boolean().optional(),
  allergens: z.array(profileAllergenSchema).max(50).default([]),
  dietaryRules: z.array(dietaryInput).default([]),
  conditions: z.array(conditionInput).default([]),
});
export type UpsertProfileInput = z.infer<typeof upsertProfileSchema>;

// A cited claim from the knowledge base attached to an ingredient or flag
export const citationSchema = z.object({
  entryId: z.string(),
  statement: z.string(),
  riskContext: z.string(),
  sources: z.array(z.object({
    org: z.string(),
    title: z.string(),
    year: z.number().optional(),
    url: z.string().optional(),
  })),
  reviewStatus: z.enum(["ai_seeded", "human_reviewed"]),
});
export type Citation = z.infer<typeof citationSchema>;

// A personal flag attached to an analysis result for one profile match.
export const personalFlagSchema = z.object({
  ingredientName: z.string(),
  // Index into `ingredients` of the row this flag belongs to, when it belongs
  // to one at all (a label's "contains" declaration belongs to no row).
  //
  // The client used to pair a flag to a row by NAME, falling back to
  // `canonicalIngredients[i]` when the two arrays happened to be the same
  // length. Equal length is not alignment: the reader's list is the label's
  // printed order and the analyzer's is not guaranteed to match it, so one
  // split or merged entry shifts everything after it. On a 63-ingredient curry
  // roux that put "milk" flags on Dextrin, Enzymes, Citric Acid and Maltose —
  // each of which sits directly beside a real dairy entry.
  //
  // The server knows the row exactly, because it creates the flag while
  // walking it. Sending the index removes the guess.
  ingredientIndex: z.number().int().nonnegative().optional(),
  type: z.enum(["allergen", "dietary", "condition"]),
  match: z.string(),           // what matched: "peanut", "vegan", "pregnancy"
  severity: z.enum(allergenSeverities).optional(), // for allergen flags
  // How sure we are the ingredient violates the rule. "verify" means it
  // depends on sourcing (e.g. sugar may be bone-char filtered) — the UI
  // should present these more quietly than definite violations.
  certainty: z.enum(["definite", "verify"]).default("definite"),
  // English fallback text. Prefer reasonKey/reasonParams when present: the
  // client renders flags in the user's language, and a server-built English
  // sentence would sit untranslated inside a localized results screen.
  reason: z.string(),
  reasonKey: z.string().optional(),
  reasonParams: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  citations: z.array(citationSchema).optional(), // condition-specific KB evidence

  // How much this matters to THIS person. Allergen flags derive it from the
  // profile's own severity; condition flags carry it from the advisory that
  // fired. A condition is allowed to be "avoid" — someone with PKU reading a
  // can of diet soda is not being cautioned, they are being warned.
  impact: z.enum(["avoid", "caution"]).optional(),
  // Stable id of the advisory behind a condition flag, so the drill-down can
  // show who says so and the check script can assert every one is reachable.
  advisoryId: z.string().optional(),
});
export type PersonalFlag = z.infer<typeof personalFlagSchema>;

// Product types that can be analyzed (simplified to 2 categories)
export const productTypes = [
  "food",           // Food & Supplements
  "personal_care"   // Personal Care
] as const;

export type ProductType = typeof productTypes[number];

// Risk levels for ingredients
export const riskLevels = ["low", "moderate", "high"] as const;
export type RiskLevel = typeof riskLevels[number];

// Ingredient analysis schema
export const ingredientSchema = z.object({
  name: z.string(),
  riskLevel: z.enum(riskLevels),
  baseRiskLevel: z.enum(riskLevels).optional(), // Original AI-determined risk
  summary: z.string(),
  details: z.string(),
  category: z.string().nullish(),
  preferenceCategories: z.array(z.enum(preferenceCategories)).optional(), // Which preference categories this ingredient belongs to
  riskAdjustmentReason: z.string().optional(), // Why risk was adjusted (e.g., "User avoids parabens")
  citations: z.array(citationSchema).optional(), // Knowledge-base evidence, attached post-analysis

  // ---- population-level classification provenance ----
  // Whether the substance corpus could speak to this ingredient at all.
  // "unknown" means we did not resolve its identity, or resolved it and hold no
  // evidence — which the UI must present as "we have nothing on this" rather
  // than as a clean bill of health. The displayed riskLevel in that case is the
  // model's reading, not a verdict from evidence.
  // ---- the two levels ----
  //
  // Every ingredient has a UNIVERSAL level — the risk to most people, with no
  // allergies or conditions — and may also have a PERSONAL one, when something
  // about this user makes it worse for them. `riskLevel` above is whichever
  // applies, so existing readers keep working; these two say which is which.
  //
  // An earlier design had no universal level for anything we lacked a
  // regulatory record on, which meant most of a normal grocery label came back
  // as "unknown". The model now rates everything, and a stored record overrides
  // it where we hold one.

  /** The model's own rating. Set once at analysis, never recomputed — it is the
   *  input to everything below, so re-deriving must be idempotent. */
  modelRiskLevel: z.enum(riskLevels).optional(),
  /** Risk to most people: the record's level where we hold one, else the model's. */
  universalRiskLevel: z.enum(riskLevels).optional(),
  /** Set ONLY when a profile factor raises the level above universal. Personal
   *  risk never lowers it — a peanut allergy makes peanuts worse for you, it
   *  cannot make trans fat better. */
  personalRiskLevel: z.enum(riskLevels).optional(),
  /** Where the universal level came from. `record` means a published document
   *  decided it and can be quoted; `model` means it is our assessment. */
  riskSource: z.enum(["model", "record"]).optional(),

  // Which policy rules fired, worst-first. The first one decided the level.
  policyRuleIds: z.array(z.string()).optional(),
  // Resolved substance id, for looking up the evidence behind the level.
  substanceId: z.string().optional(),

  // ---- label-derived, not evidence ----
  // Position in the ingredient list. Ingredient lists are a legal declaration
  // in descending order of weight, so rank is a real statement about how much
  // of a product an ingredient is — the one dose signal available without a
  // nutrition panel. Derived per label, so it is NEVER an evidence record and
  // NEVER feeds the policy level; it qualifies a level the policy already set.
  labelRank: z.object({ rank: z.number().int().min(1), total: z.number().int().min(1) }).optional(),
});

export type Ingredient = z.infer<typeof ingredientSchema>;

// ==========================================
// INGREDIENT CATEGORY MAPPING (for alias detection)
// ==========================================

// Maps ingredient names/patterns to preference categories
// This allows the system to identify which user preferences apply to each ingredient
export const ingredientCategoryMap: Record<string, PreferenceCategory[]> = {
  // Artificial Fragrances
  "fragrance": ["artificial_fragrances", "fragrance_allergens"],
  "parfum": ["artificial_fragrances", "fragrance_allergens"],
  "perfume": ["artificial_fragrances", "fragrance_allergens"],
  "aroma": ["artificial_fragrances"],
  
  // Artificial Colors / Dyes
  "fd&c": ["artificial_colors"],
  "d&c": ["artificial_colors"],
  "ci ": ["artificial_colors"],
  "red 40": ["artificial_colors"],
  "red no": ["artificial_colors"],
  "yellow 5": ["artificial_colors"],
  "yellow 6": ["artificial_colors"],
  "yellow no": ["artificial_colors"],
  "blue 1": ["artificial_colors"],
  "blue no": ["artificial_colors"],
  "green 3": ["artificial_colors"],
  "caramel color": ["artificial_colors"],
  "titanium dioxide": ["artificial_colors"],
  "iron oxide": ["artificial_colors"],
  "ultramarine": ["artificial_colors"],
  "carmine": ["artificial_colors"],
  "tartrazine": ["artificial_colors"],
  "sunset yellow": ["artificial_colors"],
  "brilliant blue": ["artificial_colors"],
  "allura red": ["artificial_colors"],
  
  // Preservatives
  "phenoxyethanol": ["preservatives"],
  "benzisothiazolinone": ["preservatives"],
  "methylisothiazolinone": ["preservatives"],
  "formaldehyde": ["preservatives", "contact_sensitizers"],
  "dmdm hydantoin": ["preservatives", "contact_sensitizers"],
  "imidazolidinyl urea": ["preservatives"],
  "diazolidinyl urea": ["preservatives"],
  "quaternium-15": ["preservatives"],
  "sodium benzoate": ["preservatives"],
  "potassium sorbate": ["preservatives"],
  "bha": ["preservatives", "endocrine_disruptors"],
  "bht": ["preservatives", "endocrine_disruptors"],
  "edta": ["preservatives"],
  "triclosan": ["preservatives", "endocrine_disruptors"],
  
  // Parabens (also preservatives)
  "paraben": ["parabens", "preservatives", "endocrine_disruptors"],
  "methylparaben": ["parabens", "preservatives", "endocrine_disruptors"],
  "propylparaben": ["parabens", "preservatives", "endocrine_disruptors"],
  "butylparaben": ["parabens", "preservatives", "endocrine_disruptors"],
  "ethylparaben": ["parabens", "preservatives", "endocrine_disruptors"],
  "isobutylparaben": ["parabens", "preservatives", "endocrine_disruptors"],
  
  // Endocrine Disruptors
  "phthalate": ["endocrine_disruptors"],
  "dibutyl phthalate": ["endocrine_disruptors"],
  "dbp": ["endocrine_disruptors"],
  "diethyl phthalate": ["endocrine_disruptors"],
  "dep": ["endocrine_disruptors"],
  "oxybenzone": ["endocrine_disruptors"],
  "benzophenone": ["endocrine_disruptors"],
  "octinoxate": ["endocrine_disruptors"],
  "homosalate": ["endocrine_disruptors"],
  "resorcinol": ["endocrine_disruptors"],
  
  // Contact Sensitizers (common skin sensitizers)
  "lanolin": ["contact_sensitizers"],
  "propolis": ["contact_sensitizers"],
  "balsam of peru": ["contact_sensitizers"],
  "cocamidopropyl betaine": ["contact_sensitizers"],
  "nickel": ["contact_sensitizers"],
  "cobalt": ["contact_sensitizers"],
  "methylchloroisothiazolinone": ["contact_sensitizers", "preservatives"],
  
  // Fragrance Allergens (EU 26 allergens)
  "limonene": ["fragrance_allergens"],
  "linalool": ["fragrance_allergens"],
  "citronellol": ["fragrance_allergens"],
  "geraniol": ["fragrance_allergens"],
  "eugenol": ["fragrance_allergens"],
  "coumarin": ["fragrance_allergens"],
  "cinnamal": ["fragrance_allergens"],
  "citral": ["fragrance_allergens"],
  "benzyl alcohol": ["fragrance_allergens", "alcohols"],
  "benzyl benzoate": ["fragrance_allergens"],
  "benzyl salicylate": ["fragrance_allergens"],
  "hexyl cinnamal": ["fragrance_allergens"],
  "hydroxycitronellal": ["fragrance_allergens"],
  "isoeugenol": ["fragrance_allergens"],
  "oak moss": ["fragrance_allergens"],
  "tree moss": ["fragrance_allergens"],
  "farnesol": ["fragrance_allergens"],
  "amyl cinnamal": ["fragrance_allergens"],
  "butylphenyl methylpropional": ["fragrance_allergens"],
  "alpha-isomethyl ionone": ["fragrance_allergens"],
  
  // Alcohols (drying types)
  "alcohol denat": ["alcohols"],
  "sd alcohol": ["alcohols"],
  "isopropyl alcohol": ["alcohols"],
  "ethyl alcohol": ["alcohols"],
  "ethanol": ["alcohols"],
  "denatured alcohol": ["alcohols"],
  "methanol": ["alcohols"],
  
  // Sulfates
  "sodium lauryl sulfate": ["sulfates"],
  "sls": ["sulfates"],
  "sodium laureth sulfate": ["sulfates"],
  "sles": ["sulfates"],
  "ammonium lauryl sulfate": ["sulfates"],
  "ammonium laureth sulfate": ["sulfates"],
  "sodium coco sulfate": ["sulfates"],
  "sodium myreth sulfate": ["sulfates"],
  
  // PEGs / Ethoxylated Ingredients
  "peg-": ["pegs_ethoxylated"],
  "polyethylene glycol": ["pegs_ethoxylated"],
  "ppg-": ["pegs_ethoxylated"],
  "polypropylene glycol": ["pegs_ethoxylated"],
  "ceteareth": ["pegs_ethoxylated"],
  "laureth": ["pegs_ethoxylated"],
  "steareth": ["pegs_ethoxylated"],
  "oleth": ["pegs_ethoxylated"],
  "polysorbate": ["pegs_ethoxylated"],
  "eth-": ["pegs_ethoxylated"],
  "oxynol": ["pegs_ethoxylated"],
  
  // Silicones
  "dimethicone": ["silicones"],
  "cyclomethicone": ["silicones"],
  "cyclopentasiloxane": ["silicones"],
  "cyclohexasiloxane": ["silicones"],
  "cyclotetrasiloxane": ["silicones"],
  "phenyl trimethicone": ["silicones"],
  "amodimethicone": ["silicones"],
  "trimethylsiloxysilicate": ["silicones"],
  "siloxane": ["silicones"],
  "silicone": ["silicones"],
  "methicone": ["silicones"],
};

// Helper function to find which preference categories an ingredient belongs to
export function getIngredientCategories(ingredientName: string): PreferenceCategory[] {
  const normalizedName = ingredientName.toLowerCase().trim();
  const matchedCategories: Set<PreferenceCategory> = new Set();
  
  for (const [pattern, categories] of Object.entries(ingredientCategoryMap)) {
    if (normalizedName.includes(pattern.toLowerCase())) {
      categories.forEach(cat => matchedCategories.add(cat));
    }
  }
  
  return Array.from(matchedCategories);
}

// ==========================================
// ALLERGEN CATEGORY MAPPING (for allergen detection)
// ==========================================

// Maps ingredient names/patterns to allergen categories
export const allergenCategoryMap: Record<string, AllergenCategory[]> = {
  // ========== FOOD-DERIVED ALLERGENS ==========
  
  // Nuts
  "almond": ["nuts"],
  "cashew": ["nuts"],
  "walnut": ["nuts"],
  "pecan": ["nuts"],
  "pistachio": ["nuts"],
  "hazelnut": ["nuts"],
  "macadamia": ["nuts"],
  "brazil nut": ["nuts"],
  "chestnut": ["nuts"],
  "pine nut": ["nuts"],
  "peanut": ["nuts"],
  "groundnut": ["nuts"],
  "arachis hypogaea": ["nuts"],
  "prunus amygdalus": ["nuts"],
  "juglans regia": ["nuts"],
  "tree nut": ["nuts"],
  "nut oil": ["nuts"],
  "nut butter": ["nuts"],
  "nut extract": ["nuts"],
  "shea butter": ["nuts"],
  "butyrospermum parkii": ["nuts"],
  
  // Soy
  "soy": ["soy"],
  "soya": ["soy"],
  "soybean": ["soy"],
  "glycine max": ["soy"],
  "soy lecithin": ["soy"],
  "tofu": ["soy"],
  "edamame": ["soy"],
  "miso": ["soy"],
  "tempeh": ["soy"],
  "soy protein": ["soy"],
  "soy isolate": ["soy"],
  "hydrolyzed soy": ["soy"],
  "soy flour": ["soy"],
  
  // Dairy
  "milk": ["dairy"],
  "dairy": ["dairy"],
  "lactose": ["dairy"],
  "casein": ["dairy"],
  "whey": ["dairy"],
  "cream": ["dairy"],
  "butter": ["dairy"],
  "cheese": ["dairy"],
  "yogurt": ["dairy"],
  "lactis": ["dairy"],
  "lactic acid": ["dairy"],
  "lactoferrin": ["dairy"],
  "lactoglobulin": ["dairy"],
  "lactalbumin": ["dairy"],
  "galactose": ["dairy"],
  "ghee": ["dairy"],
  "curd": ["dairy"],
  "buttermilk": ["dairy"],
  "milk protein": ["dairy"],
  "sodium caseinate": ["dairy"],
  "calcium caseinate": ["dairy"],
  
  // Gluten / Wheat
  "wheat": ["gluten_wheat"],
  "gluten": ["gluten_wheat"],
  "barley": ["gluten_wheat"],
  "rye": ["gluten_wheat"],
  "oat": ["gluten_wheat"],
  "spelt": ["gluten_wheat"],
  "kamut": ["gluten_wheat"],
  "triticale": ["gluten_wheat"],
  "semolina": ["gluten_wheat"],
  "durum": ["gluten_wheat"],
  "couscous": ["gluten_wheat"],
  "farina": ["gluten_wheat"],
  "seitan": ["gluten_wheat"],
  "triticum": ["gluten_wheat"],
  "hordeum vulgare": ["gluten_wheat"],
  "secale cereale": ["gluten_wheat"],
  "avena sativa": ["gluten_wheat"],
  "hydrolyzed wheat": ["gluten_wheat"],
  "wheat germ": ["gluten_wheat"],
  "wheat starch": ["gluten_wheat"],
  "modified food starch": ["gluten_wheat"],
  
  // Eggs
  "egg": ["eggs"],
  "albumin": ["eggs"],
  "ovalbumin": ["eggs"],
  "ovomucin": ["eggs"],
  "ovomucoid": ["eggs"],
  "ovovitellin": ["eggs"],
  "lysozyme": ["eggs"],
  "egg lecithin": ["eggs"],
  "globulin": ["eggs"],
  "mayonnaise": ["eggs"],
  "meringue": ["eggs"],
  "eggnog": ["eggs"],
  
  // Seafood / Shellfish
  "fish": ["seafood_shellfish"],
  "seafood": ["seafood_shellfish"],
  "shellfish": ["seafood_shellfish"],
  "shrimp": ["seafood_shellfish"],
  "crab": ["seafood_shellfish"],
  "lobster": ["seafood_shellfish"],
  "oyster": ["seafood_shellfish"],
  "mussel": ["seafood_shellfish"],
  "clam": ["seafood_shellfish"],
  "scallop": ["seafood_shellfish"],
  "squid": ["seafood_shellfish"],
  "calamari": ["seafood_shellfish"],
  "anchovy": ["seafood_shellfish"],
  "sardine": ["seafood_shellfish"],
  "salmon": ["seafood_shellfish"],
  "tuna": ["seafood_shellfish"],
  "cod": ["seafood_shellfish"],
  "mackerel": ["seafood_shellfish"],
  "herring": ["seafood_shellfish"],
  "caviar": ["seafood_shellfish"],
  "roe": ["seafood_shellfish"],
  "fish oil": ["seafood_shellfish"],
  "omega-3": ["seafood_shellfish"],
  "marine collagen": ["seafood_shellfish"],
  "chitosan": ["seafood_shellfish"],
  "glucosamine": ["seafood_shellfish"],
  "isinglass": ["seafood_shellfish"],
  
  // ========== COSMETIC ALLERGENS ==========
  
  // Fragrance Allergens (EU 26 allergens + common ones)
  "limonene": ["fragrance_allergens_cosmetic"],
  "linalool": ["fragrance_allergens_cosmetic"],
  "citronellol": ["fragrance_allergens_cosmetic"],
  "geraniol": ["fragrance_allergens_cosmetic"],
  "eugenol": ["fragrance_allergens_cosmetic"],
  "coumarin": ["fragrance_allergens_cosmetic"],
  "cinnamal": ["fragrance_allergens_cosmetic"],
  "cinnamic": ["fragrance_allergens_cosmetic"],
  "citral": ["fragrance_allergens_cosmetic"],
  "benzyl alcohol": ["fragrance_allergens_cosmetic"],
  "benzyl benzoate": ["fragrance_allergens_cosmetic"],
  "benzyl salicylate": ["fragrance_allergens_cosmetic"],
  "benzyl cinnamate": ["fragrance_allergens_cosmetic"],
  "hexyl cinnamal": ["fragrance_allergens_cosmetic"],
  "hydroxycitronellal": ["fragrance_allergens_cosmetic"],
  "isoeugenol": ["fragrance_allergens_cosmetic"],
  "oakmoss": ["fragrance_allergens_cosmetic"],
  "oak moss": ["fragrance_allergens_cosmetic"],
  "treemoss": ["fragrance_allergens_cosmetic"],
  "tree moss": ["fragrance_allergens_cosmetic"],
  "evernia prunastri": ["fragrance_allergens_cosmetic"],
  "evernia furfuracea": ["fragrance_allergens_cosmetic"],
  "farnesol": ["fragrance_allergens_cosmetic"],
  "amyl cinnamal": ["fragrance_allergens_cosmetic"],
  "amylcinnamyl alcohol": ["fragrance_allergens_cosmetic"],
  "anise alcohol": ["fragrance_allergens_cosmetic"],
  "butylphenyl methylpropional": ["fragrance_allergens_cosmetic"],
  "lilial": ["fragrance_allergens_cosmetic"],
  "alpha-isomethyl ionone": ["fragrance_allergens_cosmetic"],
  "methyl 2-octynoate": ["fragrance_allergens_cosmetic"],
  
  // Preservative Allergens
  "methylisothiazolinone": ["preservative_allergens"],
  "mi ": ["preservative_allergens"],
  "methylchloroisothiazolinone": ["preservative_allergens"],
  "mci": ["preservative_allergens"],
  "kathon": ["preservative_allergens"],
  "dmdm hydantoin": ["preservative_allergens"],
  "quaternium-15": ["preservative_allergens"],
  "diazolidinyl urea": ["preservative_allergens"],
  "imidazolidinyl urea": ["preservative_allergens"],
  "bronopol": ["preservative_allergens"],
  "2-bromo-2-nitropropane": ["preservative_allergens"],
  "formaldehyde": ["preservative_allergens"],
  "formalin": ["preservative_allergens"],
  "formaldehyde releaser": ["preservative_allergens"],
  
  // Lanolin
  "lanolin": ["lanolin"],
  "lanolinum": ["lanolin"],
  "wool wax": ["lanolin"],
  "wool fat": ["lanolin"],
  "wool alcohol": ["lanolin"],
  "laneth": ["lanolin"],
  "lanolic acid": ["lanolin"],
  "adeps lanae": ["lanolin"],
  
  // Botanical Extract Allergens
  "essential oil": ["botanical_extracts"],
  "propolis": ["botanical_extracts"],
  "arnica": ["botanical_extracts"],
  "chamomile": ["botanical_extracts"],
  "chamomilla": ["botanical_extracts"],
  "matricaria": ["botanical_extracts"],
  "tea tree": ["botanical_extracts"],
  "melaleuca": ["botanical_extracts"],
  "ylang ylang": ["botanical_extracts"],
  "ylang-ylang": ["botanical_extracts"],
  "cananga odorata": ["botanical_extracts"],
  "citrus peel": ["botanical_extracts"],
  "citrus oil": ["botanical_extracts"],
  "lemon oil": ["botanical_extracts"],
  "orange oil": ["botanical_extracts"],
  "bergamot": ["botanical_extracts"],
  "grapefruit oil": ["botanical_extracts"],
  "lime oil": ["botanical_extracts"],
  "lavender": ["botanical_extracts"],
  "lavandula": ["botanical_extracts"],
  "rosemary": ["botanical_extracts"],
  "rosmarinus": ["botanical_extracts"],
  "peppermint": ["botanical_extracts"],
  "mentha": ["botanical_extracts"],
  "eucalyptus": ["botanical_extracts"],
  "clove": ["botanical_extracts"],
  "cinnamon": ["botanical_extracts"],
  "cinnamomum": ["botanical_extracts"],
  "jasmine": ["botanical_extracts"],
  "jasminum": ["botanical_extracts"],
  "rose oil": ["botanical_extracts"],
  "rosa damascena": ["botanical_extracts"],
  "sandalwood": ["botanical_extracts"],
  "santalum": ["botanical_extracts"],
  "neroli": ["botanical_extracts"],
  "frankincense": ["botanical_extracts"],
  "boswellia": ["botanical_extracts"],
  "balsam": ["botanical_extracts"],
  "peru balsam": ["botanical_extracts"],
  "myroxylon": ["botanical_extracts"],
  "turpentine": ["botanical_extracts"],
  "pine tar": ["botanical_extracts"],
  "juniper": ["botanical_extracts"],
  
  // ========== CHEMICAL ADDITIVE ALLERGENS ==========
  
  // Colorants / Dyes
  "fd&c": ["colorants_dyes"],
  "d&c": ["colorants_dyes"],
  "ci ": ["colorants_dyes"],
  "red 40": ["colorants_dyes"],
  "red no.": ["colorants_dyes"],
  "red no ": ["colorants_dyes"],
  "yellow 5": ["colorants_dyes"],
  "yellow 6": ["colorants_dyes"],
  "yellow no.": ["colorants_dyes"],
  "yellow no ": ["colorants_dyes"],
  "blue 1": ["colorants_dyes"],
  "blue no.": ["colorants_dyes"],
  "blue no ": ["colorants_dyes"],
  "green 3": ["colorants_dyes"],
  "tartrazine": ["colorants_dyes"],
  "sunset yellow": ["colorants_dyes"],
  "brilliant blue": ["colorants_dyes"],
  "allura red": ["colorants_dyes"],
  "erythrosine": ["colorants_dyes"],
  "amaranth": ["colorants_dyes"],
  "ponceau": ["colorants_dyes"],
  "quinoline yellow": ["colorants_dyes"],
  "patent blue": ["colorants_dyes"],
  "indigo carmine": ["colorants_dyes"],
  "fast green": ["colorants_dyes"],
  "coal tar": ["colorants_dyes"],
  "azo dye": ["colorants_dyes"],
  "p-phenylenediamine": ["colorants_dyes"],
  "ppd": ["colorants_dyes"],
  "carmine": ["colorants_dyes"],
  
  // Drying Alcohols
  "alcohol denat": ["drying_alcohols"],
  "denatured alcohol": ["drying_alcohols"],
  "sd alcohol": ["drying_alcohols"],
  "isopropyl alcohol": ["drying_alcohols"],
  "isopropanol": ["drying_alcohols"],
  "ethyl alcohol": ["drying_alcohols"],
  "ethanol": ["drying_alcohols"],
};

// Allergen flag type for ingredient analysis output
export interface AllergenFlag {
  ingredientName: string;
  category: AllergenCategory;
  categoryLabel: string;
}

// Helper function to find which allergen categories an ingredient belongs to
export function getIngredientAllergenCategories(ingredientName: string): AllergenCategory[] {
  const normalizedName = ingredientName.toLowerCase().trim();
  const matchedCategories: Set<AllergenCategory> = new Set();
  
  for (const [pattern, categories] of Object.entries(allergenCategoryMap)) {
    if (normalizedName.includes(pattern.toLowerCase())) {
      categories.forEach(cat => matchedCategories.add(cat));
    }
  }
  
  return Array.from(matchedCategories);
}

// Detect allergens in ingredients based on user preferences
export function detectAllergens(
  ingredients: Array<{ name: string }>,
  preferences: AllergenPreferences
): AllergenFlag[] {
  const flags: AllergenFlag[] = [];
  const seenCombinations = new Set<string>();
  
  for (const ingredient of ingredients) {
    const categories = getIngredientAllergenCategories(ingredient.name);
    
    for (const category of categories) {
      // Only flag if user has enabled this category
      if (preferences[category]) {
        const key = `${ingredient.name.toLowerCase()}-${category}`;
        if (!seenCombinations.has(key)) {
          seenCombinations.add(key);
          flags.push({
            ingredientName: ingredient.name,
            category,
            categoryLabel: category.replace(/_/g, ' ')
          });
        }
      }
    }
  }
  
  return flags;
}

// Analysis request schema
export const analysisRequestSchema = z.object({
  productType: z.enum(productTypes),
  ingredientsText: z.string(),
  originalLanguage: z.string().optional(),
  userLanguage: z.string().optional().default('en'),
});

export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;

// Analysis result schema
export const analysisResultSchema = z.object({
  productType: z.enum(productTypes),
  productName: z.string().nullish(),
  ingredients: z.array(ingredientSchema).min(1, "Analysis must include at least one ingredient"),
  overallRisk: z.enum(riskLevels),
  analyzedAt: z.string(),
  originalText: z.string().optional(),
  translatedText: z.string().optional(),
  // Present only when a personal profile was applied (post-cache, per-request)
  personalFlags: z.array(personalFlagSchema).optional(),
  /**
   * Profile rules the label cannot settle, however well it was read.
   *
   * Distinct from a low read confidence, which is about the photo. This is
   * about the question: halal and kosher turn on slaughter method and
   * supervision, so "no pork in the list" is not an answer, and a card that
   * stamps CLEARED on it tells a person something false about their own
   * practice.
   *
   * Only ever suppresses a clean verdict. A real violation or a genuine
   * allergen still outranks it — being unable to certify a product does not
   * make it safer.
   */
  unsettled: z.array(z.string()).optional(),
  appliedProfile: z.object({ id: z.string(), name: z.string() }).optional(),
  // The label's own allergen statement, when the reader captured one.
  declaredAllergens: z.object({
    contains: z.array(z.string()).default([]),
    mayContain: z.array(z.string()).default([]),
  }).optional(),
  // Canonical ENGLISH ingredient names from the label reader, kept alongside
  // the (possibly localized) display names in `ingredients`. Allergen
  // matching runs against these: keyword lists are English, so matching a
  // Chinese or Spanish display name would silently find nothing.
  canonicalIngredients: z.array(z.string()).optional(),
  // Ingredient names exactly as printed on the label, in its own language.
  // Kept alongside the English canonical names so the verdict card can show
  // the original beside the translation — the bilingual pair is the app's
  // trust-builder, so the source text must survive translation, not be
  // discarded after it.
  originalIngredients: z.array(z.string()).optional(),
  /** BCP-47-ish language of the label itself, e.g. "zh", "pt". */
  sourceLanguage: z.string().optional(),
  /** How completely the label was read; drives the uncertain state. */
  readConfidence: z.enum(["high", "medium", "low"]).optional(),
  /**
   * The reader's own count of printed lines in the ingredient block, and how
   * many it transcribed with full confidence. Self-reported by the vision
   * model — the only available source — so it is presented as the reader
   * describing its own work ("22 of 22 lines"), never as a measured fact.
   */
  lineCount: z.object({
    read: z.number(),
    total: z.number(),
  }).optional(),
  /**
   * What the profile was actually checked against, and whether each was
   * found. A Safe verdict is only trustworthy if it can say what it looked
   * for; without this the card asserts an absence it never demonstrates.
   */
  checked: z.array(z.object({
    term: z.string(),
    type: z.enum(["allergen", "dietary", "condition"]),
    found: z.boolean(),
  })).optional(),
  /**
   * The nearest miss: an ingredient that hit an allergen keyword and was then
   * ruled out by an exclusion rule. Real matcher output, not a heuristic —
   * "Peanut Butter" genuinely trips the milk keyword "butter" before the
   * plant-butter exclusion vetoes it. Showing the near miss is what makes a
   * clean verdict credible rather than lucky.
   */
  closestCall: z.object({
    ingredientName: z.string(),
    term: z.string(),
    keyword: z.string(),
  }).optional(),
  /**
   * What would resolve a hedged verdict, plus the ingredient it concerns.
   * Only present when the doubt is actually resolvable — a Caution with no
   * settling action gets no block rather than an empty gesture.
   */
  settle: z.object({
    reasonKey: z.string(),
    ingredientName: z.string().optional(),
    params: z.record(z.string(), z.string()).optional(),
  }).optional(),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

// OCR result schema
export const ocrResultSchema = z.object({
  text: z.string(),
  language: z.string().optional(),
});

export type OCRResult = z.infer<typeof ocrResultSchema>;

// Scan history item
export const scanHistoryItemSchema = z.object({
  id: z.string(),
  productType: z.enum(productTypes),
  productName: z.string().optional(),
  overallRisk: z.enum(riskLevels),
  analyzedAt: z.string(),
  ingredientCount: z.number(),
});

export type ScanHistoryItem = z.infer<typeof scanHistoryItemSchema>;

// ==========================================
// INGREDIENT CACHE TABLE (persistent across deployments)
// ==========================================

export const ingredientCache = pgTable(
  "ingredient_cache",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    ingredient: varchar("ingredient").notNull(),
    category: varchar("category").notNull(),
    language: varchar("language").notNull().default("en"),
    analysis: text("analysis").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  },
  (table) => [
    index("IDX_ingredient_cache_lookup").on(table.ingredient, table.category, table.language),
  ]
);

export type IngredientCacheEntry = typeof ingredientCache.$inferSelect;
export type InsertIngredientCacheEntry = typeof ingredientCache.$inferInsert;

export const promoCodes = pgTable(
  "promo_codes",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    code: varchar("code").notNull().unique(),
    scansGranted: integer("scans_granted").notNull().default(10),
    maxRedemptions: integer("max_redemptions").notNull().default(100),
    totalRedemptions: integer("total_redemptions").notNull().default(0),
    expiresAt: timestamp("expires_at").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("IDX_promo_code").on(table.code),
  ]
);

export type PromoCode = typeof promoCodes.$inferSelect;
export type InsertPromoCode = typeof promoCodes.$inferInsert;

export const insertPromoCodeSchema = z.object({
  code: z.string().min(3).max(30).transform(v => v.toUpperCase().trim()),
  scansGranted: z.number().int().min(1).max(100).default(10),
  maxRedemptions: z.number().int().min(1).max(100000).default(100),
  expiresAt: z.string().or(z.date()),
});

export type InsertPromoCodeInput = z.infer<typeof insertPromoCodeSchema>;

export const promoRedemptions = pgTable(
  "promo_redemptions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    promoCodeId: varchar("promo_code_id").notNull().references(() => promoCodes.id, { onDelete: "cascade" }),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    redeemedAt: timestamp("redeemed_at").defaultNow().notNull(),
  },
  (table) => [
    index("IDX_promo_redemption_user").on(table.userId),
    index("IDX_promo_redemption_code").on(table.promoCodeId),
  ]
);

export type PromoRedemption = typeof promoRedemptions.$inferSelect;

// ==========================================
// REFERRALS
// ==========================================

export const referrals = pgTable(
  "referrals",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    referrerId: varchar("referrer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    referredId: varchar("referred_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    rewardGranted: boolean("reward_granted").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("IDX_referral_referrer").on(table.referrerId),
    index("IDX_referral_referred").on(table.referredId),
  ]
);

export type Referral = typeof referrals.$inferSelect;

export const REFERRAL_REWARD_SCANS = 10;
