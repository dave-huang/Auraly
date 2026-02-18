import { z } from "zod";
import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

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
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

// OCR request schema
export const ocrRequestSchema = z.object({
  imageData: z.string(),
});

export type OCRRequest = z.infer<typeof ocrRequestSchema>;

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
