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
  "allergens",
  "alcohols",
  "fragrance_allergens",
  "parabens",
  "sulfates",
  "pegs_ethoxylated",
  "silicones"
] as const;

export type PreferenceCategory = typeof preferenceCategories[number];

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
  allergens: z.enum(riskToleranceLevels).default("no_preference"),
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
  allergens: "no_preference",
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
  onboardingCompleted: boolean("onboarding_completed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;

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
  "formaldehyde": ["preservatives", "allergens"],
  "dmdm hydantoin": ["preservatives", "allergens"],
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
  
  // Allergens (common contact allergens)
  "lanolin": ["allergens"],
  "propolis": ["allergens"],
  "balsam of peru": ["allergens"],
  "cocamidopropyl betaine": ["allergens"],
  "nickel": ["allergens"],
  "cobalt": ["allergens"],
  "methylchloroisothiazolinone": ["allergens", "preservatives"],
  
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
