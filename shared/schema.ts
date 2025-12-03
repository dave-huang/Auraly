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

// Users table (REQUIRED for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;

// Extended product categories for history
export const productCategories = [
  "food",
  "skincare",
  "haircare",
  "cosmetics",
  "oral-care",
  "fragrance",
  "lotion",
  "other"
] as const;

export type ProductCategory = typeof productCategories[number];

// Scan History table
export const scanHistory = pgTable(
  "scan_history",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    productName: varchar("product_name").notNull().default("Unnamed Product"),
    productCategory: varchar("product_category").notNull().default("other"),
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

// Product types that can be analyzed
export const productTypes = [
  "food",
  "skincare",
  "oral-care",
  "cosmetics"
] as const;

export type ProductType = typeof productTypes[number];

// Risk levels for ingredients
export const riskLevels = ["low", "moderate", "high"] as const;
export type RiskLevel = typeof riskLevels[number];

// Top allergens list (FDA/EU major allergens)
export const topAllergens = [
  "milk", "egg", "peanut", "tree nuts", "soy", "wheat", 
  "sesame", "shellfish", "fish", "gluten"
] as const;

export type TopAllergen = typeof topAllergens[number];

// Ingredient analysis schema
export const ingredientSchema = z.object({
  name: z.string(),
  riskLevel: z.enum(riskLevels),
  summary: z.string(),
  details: z.string(),
  category: z.string().nullish(),
  isAllergen: z.boolean().optional().default(false),
});

export type Ingredient = z.infer<typeof ingredientSchema>;

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
