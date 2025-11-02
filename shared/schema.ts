import { z } from "zod";

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

// Ingredient analysis schema
export const ingredientSchema = z.object({
  name: z.string(),
  riskLevel: z.enum(riskLevels),
  summary: z.string(),
  details: z.string(),
  category: z.string().nullish(), // Allow null, undefined, or string
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
  productName: z.string().nullish(), // Allow null, undefined, or string
  ingredients: z.array(ingredientSchema),
  overallRisk: z.enum(riskLevels),
  analyzedAt: z.string(),
  originalText: z.string().optional(),
  translatedText: z.string().optional(),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

// OCR request schema
export const ocrRequestSchema = z.object({
  imageData: z.string(), // base64 encoded image
});

export type OCRRequest = z.infer<typeof ocrRequestSchema>;

// OCR result schema
export const ocrResultSchema = z.object({
  text: z.string(),
  language: z.string().optional(),
});

export type OCRResult = z.infer<typeof ocrResultSchema>;

// Scan history item (for localStorage)
export const scanHistoryItemSchema = z.object({
  id: z.string(),
  productType: z.enum(productTypes),
  productName: z.string().optional(),
  overallRisk: z.enum(riskLevels),
  analyzedAt: z.string(),
  ingredientCount: z.number(),
});

export type ScanHistoryItem = z.infer<typeof scanHistoryItemSchema>;
