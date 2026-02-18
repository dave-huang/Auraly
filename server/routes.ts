import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import z from "zod";
import crypto from "crypto";
import { eq, sql, gte, and, count, desc, inArray } from "drizzle-orm";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { storage } from "./storage";
import { db } from "./db";
import { extractTextFromImage } from "./services/ocr";
import { analyzeIngredients, analyzeIngredientsParallel, extractIngredientsFromText } from "./services/analyzer";
import { batchAnalyzeIngredientsWithCache, getCacheStats, clearAllCache, getAllCacheEntries } from "./services/cache";
import { subscriptionService } from "./services/subscription";
import { 
  ocrRequestSchema, 
  analysisRequestSchema,
  riskPreferencesSchema,
  allergenPreferencesSchema,
  users,
  scanHistory,
  scanUsageLogs,
  sessions,
  purchaseLogs,
  type ProductType,
  type AnalysisResult,
  type InsertScanHistory,
  type Ingredient,
  productTypes,
  productCategories,
  getDailyFreeScansRemaining,
  getTotalScansAvailable,
  canUserScan,
  getDailyFreeScansLimit,
} from "@shared/schema";
import { getUncachableStripeClient } from "./stripeClient";

// In-memory store for analysis requests (for background processing)
interface AnalysisRequest {
  id: string;
  status: 'processing' | 'ocr_complete' | 'completed' | 'failed';
  result?: AnalysisResult;
  error?: string;
  ocrText?: string;
  timestamp: number;
}

const analysisRequests = new Map<string, AnalysisRequest>();

// Global OCR cache - keyed by image content hash (language-independent)
interface OCRCacheEntry {
  text: string;
  timestamp: number;
}
const ocrCache = new Map<string, OCRCacheEntry>();

// Global extracted ingredients cache - keyed by OCR text hash (language-independent)
// This ensures ingredients are extracted ONCE and reused for all languages
interface ExtractedIngredientsEntry {
  ingredients: string[];
  timestamp: number;
}
const extractedIngredientsCache = new Map<string, ExtractedIngredientsEntry>();

// Helper to compute hash of image data
function hashImageData(imageData: string): string {
  return crypto.createHash('sha256').update(imageData).digest('hex');
}

// Clean up old OCR cache entries (older than 1 hour)
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [hash, entry] of Array.from(ocrCache.entries())) {
    if (entry.timestamp < oneHourAgo) {
      ocrCache.delete(hash);
    }
  }
}, 5 * 60 * 1000);

// Clean up old requests (older than 1 hour)
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [id, req] of Array.from(analysisRequests.entries())) {
    if (req.timestamp < oneHourAgo) {
      analysisRequests.delete(id);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes

// Configure multer for in-memory file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Schema for batch ingredient analysis (with caching)
const batchAnalyzeRequestSchema = z.object({
  ingredients: z.array(z.string().min(1)).min(1),
  category: z.enum(productTypes as readonly [ProductType, ...ProductType[]]),
  userLanguage: z.string().optional().default('en')
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

  // Auth endpoint
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ==========================================
  // RISK PREFERENCES ENDPOINTS
  // ==========================================

  // GET /api/user/preferences - Get current user's risk preferences
  app.get('/api/user/preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const preferences = await storage.getUserPreferences(userId);
      const onboardingCompleted = await storage.isOnboardingCompleted(userId);
      res.json({ preferences, onboardingCompleted });
    } catch (error) {
      console.error("Error fetching preferences:", error);
      res.status(500).json({ message: "Failed to fetch preferences" });
    }
  });

  // PATCH /api/user/preferences - Update user's risk preferences
  app.patch('/api/user/preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const preferences = riskPreferencesSchema.partial().parse(req.body);
      const user = await storage.updateUserPreferences(userId, preferences);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ success: true, preferences: user.riskPreferences });
    } catch (error: any) {
      console.error("Error updating preferences:", error);
      res.status(400).json({ message: error.message || "Failed to update preferences" });
    }
  });

  // POST /api/user/onboarding - Complete onboarding with preferences
  app.post('/api/user/onboarding', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const preferences = riskPreferencesSchema.parse(req.body);
      const user = await storage.completeOnboarding(userId, preferences);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ success: true, onboardingCompleted: true });
    } catch (error: any) {
      console.error("Error completing onboarding:", error);
      res.status(400).json({ message: error.message || "Failed to complete onboarding" });
    }
  });

  // POST /api/user/reset-onboarding - Reset onboarding (for testing/re-doing)
  app.post('/api/user/reset-onboarding', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db
        .update(users)
        .set({ onboardingCompleted: false, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ success: true, onboardingCompleted: false });
    } catch (error) {
      console.error("Error resetting onboarding:", error);
      res.status(500).json({ message: "Failed to reset onboarding" });
    }
  });

  // ==========================================
  // ALLERGEN PREFERENCES ENDPOINTS
  // ==========================================

  // GET /api/user/allergen-preferences - Get current user's allergen preferences
  app.get('/api/user/allergen-preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const preferences = await storage.getUserAllergenPreferences(userId);
      res.json({ preferences });
    } catch (error) {
      console.error("Error fetching allergen preferences:", error);
      res.status(500).json({ message: "Failed to fetch allergen preferences" });
    }
  });

  // PATCH /api/user/allergen-preferences - Update user's allergen preferences
  app.patch('/api/user/allergen-preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const preferences = allergenPreferencesSchema.partial().parse(req.body);
      const user = await storage.updateUserAllergenPreferences(userId, preferences);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ success: true, preferences: user.allergenPreferences });
    } catch (error: any) {
      console.error("Error updating allergen preferences:", error);
      res.status(400).json({ message: error.message || "Failed to update allergen preferences" });
    }
  });

  // POST /api/user/allergen-onboarding - Complete allergen onboarding with preferences
  app.post('/api/user/allergen-onboarding', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const preferences = allergenPreferencesSchema.parse(req.body);
      const user = await storage.completeAllergenOnboarding(userId, preferences);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error completing allergen onboarding:", error);
      res.status(400).json({ message: error.message || "Failed to complete allergen onboarding" });
    }
  });

  // ==========================================
  // ACCOUNT MANAGEMENT ENDPOINTS
  // ==========================================

  // GET /api/account/scan-balance - Get scan balance and account details
  app.get('/api/account/scan-balance', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const quota = await subscriptionService.getUserQuotaStatus(userId);

      res.json({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        dailyFreeScansUsed: quota.dailyFreeScansUsed,
        dailyFreeScansLimit: quota.dailyFreeScansLimit,
        dailyFreeScansRemaining: quota.dailyFreeScansRemaining,
        purchasedScanBalance: quota.purchasedScanBalance,
        totalScansAvailable: quota.totalScansAvailable,
        nextDailyReset: quota.nextDailyReset,
      });
    } catch (error: any) {
      console.error("Error fetching scan balance:", error);
      res.status(500).json({ message: "Failed to fetch scan balance" });
    }
  });

  // OCR endpoint - extract text from image (protected)
  app.post("/api/ocr", isAuthenticated, async (req, res) => {
    const startTime = Date.now();
    try {
      const { imageData } = ocrRequestSchema.parse(req.body);
      
      const result = await extractTextFromImage(imageData);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[TIMING] OCR completed in ${duration}s`);
      
      res.json(result);
    } catch (error: any) {
      console.error('OCR error:', error);
      res.status(400).json({ 
        error: error.message || 'Failed to process image' 
      });
    }
  });

  // Analysis endpoint - analyze ingredients (protected)
  app.post("/api/analyze", isAuthenticated, async (req, res) => {
    const startTime = Date.now();
    try {
      const { productType, ingredientsText, userLanguage } = analysisRequestSchema.parse(req.body);
      
      if (!ingredientsText || ingredientsText.trim().length < 10) {
        return res.status(400).json({ 
          error: 'Ingredient text is too short or empty. Please provide a clear image with visible ingredients.' 
        });
      }
      
      const result = await analyzeIngredients(productType as ProductType, ingredientsText, userLanguage);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[TIMING] Analysis completed in ${duration}s`);
      
      res.json(result);
    } catch (error: any) {
      console.error('Analysis endpoint error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Return appropriate status based on error type
      const statusCode = error.message?.includes('Incomplete ingredient analysis') ? 400 : 500;
      
      res.status(statusCode).json({ 
        error: error.message || 'Failed to analyze ingredients. Please try again.' 
      });
    }
  });

  // Batch analyze ingredients with backend caching (protected)
  app.post("/api/analyze-ingredients", isAuthenticated, async (req, res) => {
    const startTime = Date.now();
    try {
      const { ingredients, category, userLanguage } = batchAnalyzeRequestSchema.parse(req.body);
      
      console.log(`[BATCH-ANALYZE] Processing ${ingredients.length} ingredients for ${category}`);
      
      // Use cache-aware batch analyzer
      // Note: Individual ingredient analysis is a simplified extraction here
      // In production, you'd call a dedicated ingredient analyzer
      const results = await batchAnalyzeIngredientsWithCache(
        ingredients,
        category,
        async (ingredient: string) => {
          // For now, return a placeholder that indicates caching works
          // In production, this would call your AI service for individual ingredient analysis
          return JSON.stringify({
            ingredient,
            riskLevel: 'moderate',
            summary: `Cached or analyzed ingredient: ${ingredient}`,
            details: `Analysis for ${ingredient} in ${category} category`,
            category
          });
        }
      );
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const cachedCount = results.filter(r => r.fromCache).length;
      const newCount = results.filter(r => !r.fromCache).length;
      
      console.log(`[BATCH-ANALYZE] Completed in ${duration}s (${cachedCount} cached, ${newCount} newly analyzed)`);
      
      res.json({
        results: results.map(r => ({
          ingredient: r.ingredient,
          analysis: JSON.parse(r.analysis),
          fromCache: r.fromCache
        })),
        summary: {
          total: results.length,
          cached: cachedCount,
          freshlyAnalyzed: newCount,
          processingTimeMs: Math.round((Date.now() - startTime))
        }
      });
    } catch (error: any) {
      console.error('Batch analyze error:', error);
      const statusCode = error instanceof z.ZodError ? 400 : 500;
      res.status(statusCode).json({
        error: error.message || 'Failed to analyze ingredients'
      });
    }
  });

  // Cache statistics endpoint (optional)
  app.get("/api/cache-stats", async (req, res) => {
    try {
      const stats = await getCacheStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Check analysis status (for polling from mobile when tab is backgrounded) (protected)
  app.get("/api/analysis-status/:requestId", isAuthenticated, (req, res) => {
    const { requestId } = req.params;
    const request = analysisRequests.get(requestId);
    
    if (!request) {
      return res.status(404).json({ error: 'Analysis request not found' });
    }
    
    if (request.status === 'processing') {
      return res.status(202).json({ status: 'processing' });
    }
    
    if (request.status === 'ocr_complete') {
      return res.status(202).json({ status: 'ocr_complete' });
    }
    
    if (request.status === 'failed') {
      return res.status(400).json({ 
        status: 'failed',
        error: request.error 
      });
    }
    
    // Status === 'completed'
    res.json({
      status: 'completed',
      ocrText: request.ocrText,
      analysis: request.result
    });
  });

  // Combined OCR + Analysis endpoint (returns request ID immediately for mobile resilience) (protected)
  app.post("/api/scan-and-analyze", isAuthenticated, async (req, res) => {
    const body = req.body;
    
    // Validate required fields
    if ((!body.imageData && !body.ocrText) || !body.productType || !body.userLanguage) {
      return res.status(400).json({ 
        error: 'Missing required fields: (imageData OR ocrText), productType, and userLanguage are required.' 
      });
    }

    // Generate request ID
    const requestId = crypto.randomBytes(8).toString('hex');
    const analysisRequest: AnalysisRequest = {
      id: requestId,
      status: 'processing',
      timestamp: Date.now()
    };
    analysisRequests.set(requestId, analysisRequest);
    
    // Return request ID immediately so client can poll
    res.status(202).json({ requestId, status: 'processing' });
    
    // Process analysis in background (non-blocking)
    (async () => {
      const startTime = Date.now();
      let ocrText: string | undefined;
      let ocrDuration: string = '0.00';
      let ocrStage: 'skipped' | 'success' | 'failed' = 'skipped';
      let analysisStage: 'pending' | 'success' | 'failed' = 'pending';
      
      try {
        const { imageData, productType, userLanguage, ocrText: cachedOcrText } = body;
        
        // Step 1: Run OCR or use cached (language-independent - same OCR for all languages)
        if (cachedOcrText) {
          console.log(`[SCAN-AND-ANALYZE-${requestId}] Using frontend-provided OCR text (${cachedOcrText.length} chars)`);
          ocrText = cachedOcrText;
          ocrStage = 'skipped';
        } else if (imageData) {
          // Check global OCR cache first (keyed by image hash, not language)
          const imageHash = hashImageData(imageData);
          const cachedOCREntry = ocrCache.get(imageHash);
          
          if (cachedOCREntry) {
            console.log(`[SCAN-AND-ANALYZE-${requestId}] OCR cache HIT - reusing result for all languages`);
            ocrText = cachedOCREntry.text;
            ocrStage = 'skipped';
          } else {
            // Cache miss - run OCR once, will be reused for all language variants
            console.log(`[SCAN-AND-ANALYZE-${requestId}] OCR cache MISS - running Gemini OCR once`);
            try {
              const ocrResult = await extractTextFromImage(imageData);
              ocrDuration = ((Date.now() - startTime) / 1000).toFixed(2);
              console.log(`[TIMING] [OCR-SUCCESS-${requestId}] OCR completed in ${ocrDuration}s`);
              ocrStage = 'success';
              
              if (!ocrResult.text || ocrResult.text.trim().length < 10) {
                ocrStage = 'failed';
                throw new Error('No ingredients found in image. Please ensure the ingredient list is clearly visible and try again.');
              }
              
              ocrText = ocrResult.text;
              
              // Store in global cache for future requests (all languages will use this same text)
              ocrCache.set(imageHash, {
                text: ocrText,
                timestamp: Date.now()
              });
              console.log(`[SCAN-AND-ANALYZE-${requestId}] OCR result cached - will be reused for other languages`);
            } catch (ocrError: any) {
              ocrStage = 'failed';
              ocrDuration = ((Date.now() - startTime) / 1000).toFixed(2);
              console.error(`[OCR-FAILED-${requestId}] OCR error after ${ocrDuration}s:`, ocrError.message);
              throw new Error(`OCR failed: ${ocrError.message}`);
            }
          }
        }
        
        // Update status to indicate OCR is complete, now analyzing
        analysisRequest.status = 'ocr_complete';
        analysisRequest.timestamp = Date.now();
        console.log(`[SCAN-AND-ANALYZE-${requestId}] OCR phase complete, starting analysis phase`);
        
        // Step 2a: Extract ingredients ONCE (language-independent) and cache them
        const extractionStartTime = Date.now();
        let extractedIngredients: string[] = [];
        const ocrTextHash = crypto.createHash('sha256').update(ocrText!).digest('hex');
        const cachedExtraction = extractedIngredientsCache.get(ocrTextHash);
        
        if (cachedExtraction) {
          console.log(`[EXTRACTION] Cache HIT - reusing ${cachedExtraction.ingredients.length} pre-extracted ingredients`);
          extractedIngredients = cachedExtraction.ingredients;
        } else {
          console.log(`[EXTRACTION] Cache MISS - extracting ingredients from OCR text`);
          const extractionResult = extractIngredientsFromText(ocrText!);
          extractedIngredients = extractionResult.ingredients;
          
          // Cache extracted ingredients for future language requests
          extractedIngredientsCache.set(ocrTextHash, {
            ingredients: extractedIngredients,
            timestamp: Date.now()
          });
          console.log(`[EXTRACTION] Cached ${extractedIngredients.length} extracted ingredients for reuse`);
        }
        
        const extractionDuration = ((Date.now() - extractionStartTime) / 1000).toFixed(2);
        console.log(`[TIMING] [EXTRACTION-${requestId}] Extraction completed in ${extractionDuration}s`);
        
        // Step 2b: Run Parallel Micro-Batched Analysis (using pre-extracted ingredients)
        const analysisStartTime = Date.now();
        try {
          const analysisResult = await analyzeIngredientsParallel(productType as ProductType, ocrText!, userLanguage, extractedIngredients);
          analysisStage = 'success';
          const analysisDuration = ((Date.now() - analysisStartTime) / 1000).toFixed(2);
          const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
          
          console.log(`[TIMING] [ANALYSIS-SUCCESS-${requestId}] Analysis completed in ${analysisDuration}s (total: ${totalDuration}s)`);
          
          // Store completed result
          analysisRequest.status = 'completed';
          analysisRequest.result = analysisResult;
          analysisRequest.ocrText = ocrText;
          analysisRequest.timestamp = Date.now();
          
        } catch (analysisError: any) {
          analysisStage = 'failed';
          const analysisDuration = ((Date.now() - analysisStartTime) / 1000).toFixed(2);
          console.error(`[ANALYSIS-FAILED-${requestId}] Analysis error after ${analysisDuration}s:`, analysisError.message);
          throw analysisError;
        }
      } catch (error: any) {
        console.error(`[SCAN-AND-ANALYZE-FAILED-${requestId}] Error:`, error.message);
        analysisRequest.status = 'failed';
        analysisRequest.error = error.message || 'Failed to analyze image. Please try again.';
        analysisRequest.timestamp = Date.now();
      }
    })();
  });

  // ==================== SCAN HISTORY ENDPOINTS ====================

  // Schema for creating scan history
  const createScanHistorySchema = z.object({
    productName: z.string().optional().default("Unnamed Product"),
    productCategory: z.enum(productCategories as readonly [string, ...string[]]).optional().default("other"),
    originalImageUrl: z.string().nullable().optional(),
    detectedIngredients: z.array(z.string()),
    analysisResults: z.array(z.object({
      name: z.string(),
      riskLevel: z.enum(["low", "moderate", "high"]),
      summary: z.string(),
      details: z.string(),
      category: z.string().nullish(),
    })),
    overallRisk: z.enum(["low", "moderate", "high"]),
    language: z.string().optional().default("en"),
    isUpdatedFromCache: z.boolean().optional().default(false),
  });

  // POST /api/history - Save a new scan to history
  app.post("/api/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = createScanHistorySchema.parse(req.body);
      
      const scanData: InsertScanHistory = {
        userId,
        productName: data.productName || "Unnamed Product",
        productCategory: data.productCategory || "other",
        originalImageUrl: data.originalImageUrl || null,
        detectedIngredients: data.detectedIngredients,
        analysisResults: data.analysisResults,
        overallRisk: data.overallRisk,
        language: data.language || "en",
        isUpdatedFromCache: data.isUpdatedFromCache || false,
        ingredientCount: data.detectedIngredients.length,
      };
      
      const scan = await storage.createScanHistory(scanData);
      console.log(`[HISTORY] Saved scan ${scan.id} for user ${userId}`);
      
      // Consume a scan from user's quota (tracks free scans / premium rate limits)
      try {
        await subscriptionService.consumeScan(userId, data.productCategory);
        console.log(`[HISTORY] Consumed scan for user ${userId}`);
      } catch (scanError: any) {
        console.error(`[HISTORY] Failed to consume scan for user ${userId}:`, scanError.message);
        // Don't fail the request - scan is already saved
      }
      
      res.status(201).json({ success: true, scanId: scan.id });
    } catch (error: any) {
      console.error("[HISTORY] Error saving scan:", error);
      res.status(400).json({ error: error.message || "Failed to save scan" });
    }
  });

  // Validation schema for pagination query params
  const paginationSchema = z.object({
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
    offset: z.coerce.number().int().min(0).optional().default(0),
  });

  // Validation schema for scan ID params
  const scanIdSchema = z.object({
    scanId: z.string().uuid(),
  });

  // GET /api/history - Get user's scan history (paginated)
  app.get("/api/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { limit, offset } = paginationSchema.parse(req.query);
      
      const [scans, totalCount] = await Promise.all([
        storage.getScanHistory(userId, limit, offset),
        storage.getScanHistoryCount(userId),
      ]);
      
      res.json({
        scans,
        total: totalCount,
        limit,
        offset,
        hasMore: offset + scans.length < totalCount,
      });
    } catch (error: any) {
      console.error("[HISTORY] Error fetching history:", error);
      res.status(500).json({ error: error.message || "Failed to fetch history" });
    }
  });

  // GET /api/history/:scanId - Get a single scan by ID
  app.get("/api/history/:scanId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { scanId } = scanIdSchema.parse(req.params);
      
      const scan = await storage.getScanById(scanId, userId);
      
      if (!scan) {
        return res.status(404).json({ error: "Scan not found" });
      }
      
      res.json(scan);
    } catch (error: any) {
      console.error("[HISTORY] Error fetching scan:", error);
      res.status(500).json({ error: error.message || "Failed to fetch scan" });
    }
  });

  // PATCH /api/history/:scanId - Update a scan (rename)
  const updateScanSchema = z.object({
    productName: z.string().min(1).max(200),
  });

  app.patch("/api/history/:scanId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { scanId } = scanIdSchema.parse(req.params);
      const { productName } = updateScanSchema.parse(req.body);
      
      const scan = await storage.updateScanName(scanId, userId, productName);
      
      if (!scan) {
        return res.status(404).json({ error: "Scan not found" });
      }
      
      console.log(`[HISTORY] Renamed scan ${scanId} to "${productName}"`);
      res.json(scan);
    } catch (error: any) {
      console.error("[HISTORY] Error updating scan:", error);
      res.status(400).json({ error: error.message || "Failed to update scan" });
    }
  });

  // DELETE /api/history/:scanId - Delete a single scan
  app.delete("/api/history/:scanId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { scanId } = scanIdSchema.parse(req.params);
      
      const deleted = await storage.deleteScan(scanId, userId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Scan not found" });
      }
      
      console.log(`[HISTORY] Deleted scan ${scanId} for user ${userId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[HISTORY] Error deleting scan:", error);
      res.status(500).json({ error: error.message || "Failed to delete scan" });
    }
  });

  // DELETE /api/history - Delete all scans for user
  app.delete("/api/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const deletedCount = await storage.deleteAllScans(userId);
      
      console.log(`[HISTORY] Deleted ${deletedCount} scans for user ${userId}`);
      res.json({ success: true, deletedCount });
    } catch (error: any) {
      console.error("[HISTORY] Error deleting all scans:", error);
      res.status(500).json({ error: error.message || "Failed to delete scans" });
    }
  });

  // ==========================================
  // FEEDBACK ENDPOINT (using Replit Resend integration)
  // ==========================================
  
  const feedbackSchema = z.object({
    type: z.enum(['bug', 'improvement', 'positive']),
    email: z.string().email().optional(),
    message: z.string().min(1).max(5000)
  });

  app.post("/api/feedback", async (req: any, res) => {
    try {
      const { type, email, message } = feedbackSchema.parse(req.body);
      const userId = req.user?.claims?.sub || 'Anonymous';
      const userEmail = req.user?.claims?.email || 'Anonymous';
      
      // Import and use Replit Resend integration
      const { getResendClient } = await import('./services/resend');
      const { client, fromEmail } = await getResendClient();
      
      const YOUR_EMAIL = process.env.FEEDBACK_EMAIL || 'davehuang01@gmail.com';
      
      const typeLabels: Record<string, string> = {
        bug: 'Bug Report',
        improvement: 'Improvement Suggestion',
        positive: 'Positive Feedback'
      };
      
      const emailContent = `
New ${typeLabels[type]} from Auraly

User ID: ${userId}
User Email: ${userEmail}
Feedback Type: ${typeLabels[type]}
Contact Email: ${email || 'Not provided'}

Message:
${message}

---
Sent from Auraly Feedback System
      `.trim();
      
      console.log(`[FEEDBACK] Attempting to send email from: ${fromEmail} to: ${YOUR_EMAIL}`);
      
      const result = await client.emails.send({
        from: fromEmail || 'Auraly Feedback <onboarding@resend.dev>',
        to: YOUR_EMAIL,
        replyTo: email || undefined,
        subject: `[Auraly] ${typeLabels[type]} from ${userEmail}`,
        text: emailContent
      });
      
      console.log('[FEEDBACK] Resend response:', JSON.stringify(result, null, 2));
      
      if (result.error) {
        console.error('[FEEDBACK] Resend API error:', result.error);
        return res.status(500).json({ error: 'Failed to send feedback' });
      }
      
      console.log(`[FEEDBACK] Sent ${type} feedback from user ${userId}, email id: ${result.data?.id}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[FEEDBACK] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to send feedback' });
    }
  });

  // ==========================================
  // SCAN PURCHASE & BILLING ENDPOINTS
  // ==========================================

  app.get('/api/stripe/publishable-key', async (_req, res) => {
    try {
      const publishableKey = process.env.STRIPE_LIVE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY;
      if (!publishableKey) {
        return res.status(500).json({ error: 'Stripe publishable key not configured' });
      }
      res.json({ publishableKey });
    } catch (error: any) {
      console.error('Error getting publishable key:', error);
      res.status(500).json({ error: 'Failed to get Stripe key' });
    }
  });

  app.get('/api/scan/quota', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const status = await subscriptionService.getUserQuotaStatus(userId);
      res.json(status);
    } catch (error: any) {
      console.error('Error fetching scan quota:', error);
      res.status(500).json({ error: 'Failed to fetch scan quota' });
    }
  });

  app.post('/api/scan/purchase', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      const stripe = await getUncachableStripeClient();
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      let customerId: string | null = null;
      let needsMetadataUpdate = false;
      
      const existingByUserId = await stripe.customers.search({
        query: `metadata['userId']:'${userId}'`,
        limit: 10,
      });
      
      for (const customer of existingByUserId.data) {
        if (!customer.deleted) {
          customerId = customer.id;
          console.log(`[CHECKOUT] Found existing Stripe customer ${customerId} for user ${userId} (by userId metadata)`);
          break;
        }
      }
      
      if (!customerId && user.email) {
        const existingByEmail = await stripe.customers.search({
          query: `email:'${user.email}'`,
          limit: 10,
        });
        
        for (const customer of existingByEmail.data) {
          if (!customer.deleted) {
            customerId = customer.id;
            needsMetadataUpdate = true;
            console.log(`[CHECKOUT] Found existing Stripe customer ${customerId} for user ${userId} (by email fallback)`);
            break;
          }
        }
        
        if (customerId && needsMetadataUpdate) {
          await stripe.customers.update(customerId, {
            metadata: { userId },
          });
          console.log(`[CHECKOUT] Updated customer ${customerId} with userId metadata`);
        }
      }
      
      if (!customerId) {
        const customer = await stripe.customers.create(
          {
            email: user.email || undefined,
            metadata: { userId },
          },
          {
            idempotencyKey: `customer-create-${userId}`,
          }
        );
        customerId = customer.id;
        console.log(`[CHECKOUT] Created new Stripe customer ${customerId} for user ${userId}`);
      }
      
      if (user.stripeCustomerId !== customerId) {
        await db.update(users)
          .set({ stripeCustomerId: customerId, updatedAt: new Date() })
          .where(eq(users.id, userId));
      }

      const successUrl = `${req.protocol}://${req.get('host')}/upload?payment=success`;
      const cancelUrl = `${req.protocol}://${req.get('host')}/upload`;

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            unit_amount: 299,
            currency: 'usd',
            product_data: {
              name: '10 Scan Bundle',
            },
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId,
          scansToAdd: '10',
        },
      });

      await subscriptionService.logPurchaseClick(userId, 'scan_bundle_10');

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  });

  app.post('/api/analytics/purchase-prompt-view', async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || null;
      const { source } = req.body;
      await subscriptionService.logPurchasePromptView(userId, source || 'unknown');
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error logging purchase prompt view:', error);
      res.status(500).json({ error: 'Failed to log event' });
    }
  });

  // ==========================================
  // ADMIN ENDPOINTS
  // ==========================================
  const ADMIN_USER_ID = "48931740";

  const isAdmin = (req: any, res: any, next: any) => {
    if (!req.user?.claims?.sub) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (req.user.claims.sub !== ADMIN_USER_ID) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };

  // Check if a user is a test account based on email patterns
  function isTestUser(email: string | null | undefined): boolean {
    if (!email) return false;
    const lowerEmail = email.toLowerCase();
    
    // Fake/placeholder email domains (from automated testing)
    if (lowerEmail.endsWith('@example.com') || lowerEmail.endsWith('@test.com')) {
      return true;
    }
    
    // Replit internal domains
    if (lowerEmail.endsWith('@replit.com') || lowerEmail.endsWith('@repl.it')) {
      return true;
    }
    
    // Emails starting with test/testing (anchored to start)
    if (lowerEmail.startsWith('test@') || lowerEmail.startsWith('testing@')) {
      return true;
    }
    
    // Gmail-style +test aliases
    if (lowerEmail.includes('+test@') || lowerEmail.includes('+testing@')) {
      return true;
    }
    
    return false;
  }

  app.get('/api/admin/dashboard', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const showTestUsers = req.query.showTestUsers === 'true';
      const allUsers = await db.select().from(users);
      
      // Filter out test users unless toggle is on
      const displayUsers = showTestUsers ? allUsers : allUsers.filter(u => !isTestUser(u.email));
      const realUsers = allUsers.filter(u => !isTestUser(u.email));
      
      const totalUsers = realUsers.length;
      const totalPurchasedScansBalance = realUsers.reduce((sum, u) => sum + (u.purchasedScanBalance || 0), 0);
      
      // Get scan history for time-based stats
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfWeek.getDate() - 7);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Query scans from scanHistory table
      const allScans = await db.select().from(scanHistory);
      const scansToday = allScans.filter(s => s.createdAt && new Date(s.createdAt) >= startOfToday).length;
      const scansThisWeek = allScans.filter(s => s.createdAt && new Date(s.createdAt) >= startOfWeek).length;
      const scansThisMonth = allScans.filter(s => s.createdAt && new Date(s.createdAt) >= startOfMonth).length;
      
      // Build per-user scan counts
      const userScanCounts = new Map<string, { today: number; week: number; month: number; total: number }>();
      for (const scan of allScans) {
        const userId = scan.userId;
        const counts = userScanCounts.get(userId) || { today: 0, week: 0, month: 0, total: 0 };
        counts.total++;
        if (scan.createdAt) {
          const scanDate = new Date(scan.createdAt);
          if (scanDate >= startOfToday) counts.today++;
          if (scanDate >= startOfWeek) counts.week++;
          if (scanDate >= startOfMonth) counts.month++;
        }
        userScanCounts.set(userId, counts);
      }

      // Use displayUsers for the user list (respects toggle), stats always use realUsers
      const recentUsers = displayUsers
        .sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        })
        .slice(0, 100)
        .map(u => {
          const scanCounts = userScanCounts.get(u.id) || { today: 0, week: 0, month: 0, total: 0 };
          return {
            id: u.id,
            replitId: u.id,
            email: u.email || '',
            name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unknown',
            dailyFreeScansUsed: u.dailyFreeScansUsed || 0,
            purchasedScanBalance: u.purchasedScanBalance || 0,
            createdAt: u.createdAt?.toString() || '',
            scansToday: scanCounts.today,
            scansThisWeek: scanCounts.week,
            scansThisMonth: scanCounts.month,
            totalScans: scanCounts.total,
            isTestUser: isTestUser(u.email),
          };
        });

      res.json({
        stats: {
          totalUsers,
          totalPurchasedScansBalance,
          totalScansToday: scansToday,
          totalScansThisWeek: scansThisWeek,
          totalScansThisMonth: scansThisMonth,
        },
        recentUsers,
      });
    } catch (error: any) {
      console.error('Admin dashboard error:', error);
      res.status(500).json({ error: 'Failed to load dashboard' });
    }
  });
  
  // Daily usage stats (logins and scans by day)
  app.get('/api/admin/daily-usage', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - days);
      
      // Get all scans in the period
      const scans = await db.select().from(scanHistory).where(gte(scanHistory.createdAt, startDate));
      
      // Get all sessions for login data
      const allSessions = await db.select().from(sessions);
      
      // Build daily stats
      const dailyStats: Record<string, { date: string; scans: number; logins: number }> = {};
      
      // Initialize all days
      for (let i = 0; i <= days; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dailyStats[dateStr] = { date: dateStr, scans: 0, logins: 0 };
      }
      
      // Count scans by day
      for (const scan of scans) {
        if (scan.createdAt) {
          const dateStr = new Date(scan.createdAt).toISOString().split('T')[0];
          if (dailyStats[dateStr]) {
            dailyStats[dateStr].scans++;
          }
        }
      }
      
      // Count unique logins by day (from session expires)
      // Sessions expire in the future, so we estimate login date
      for (const session of allSessions) {
        if (session.expire) {
          // Session typically expires 24h after login, so subtract 24h
          const loginDate = new Date(session.expire);
          loginDate.setHours(loginDate.getHours() - 24);
          const dateStr = loginDate.toISOString().split('T')[0];
          if (dailyStats[dateStr]) {
            dailyStats[dateStr].logins++;
          }
        }
      }
      
      // Convert to array sorted by date
      const result = Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date));
      
      res.json({ dailyStats: result });
    } catch (error: any) {
      console.error('Daily usage error:', error);
      res.status(500).json({ error: 'Failed to load daily usage' });
    }
  });
  
  // Ingredient cache viewer
  app.get('/api/admin/ingredient-cache', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const entries = await getAllCacheEntries();
      
      // Sort by most recently updated
      entries.sort((a, b) => b.lastUpdated - a.lastUpdated);
      
      res.json({
        totalEntries: entries.length,
        entries: entries.slice(0, 500), // Limit to 500 entries for performance
      });
    } catch (error: any) {
      console.error('Ingredient cache error:', error);
      res.status(500).json({ error: 'Failed to load ingredient cache' });
    }
  });

  app.post('/api/admin/grant-scans', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId, amount } = req.body;
      if (!userId || !amount || amount < 1) {
        return res.status(400).json({ error: 'User ID and valid amount required' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const newBalance = (user.purchasedScanBalance || 0) + amount;
      await db.update(users)
        .set({ purchasedScanBalance: newBalance })
        .where(eq(users.id, userId));

      res.json({ success: true, newBalance });
    } catch (error: any) {
      console.error('Grant scans error:', error);
      res.status(500).json({ error: 'Failed to grant scans' });
    }
  });

  // Clear ingredient cache (admin only - use when AI prompts change)
  app.post('/api/admin/clear-cache', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const clearedCount = await clearAllCache();
      console.log(`[ADMIN] Cache cleared by user ${req.user.claims.sub}: ${clearedCount} entries removed`);
      res.json({ success: true, clearedCount, message: `Cleared ${clearedCount} cached ingredient analyses` });
    } catch (error: any) {
      console.error('Clear cache error:', error);
      res.status(500).json({ error: 'Failed to clear cache' });
    }
  });

  // Admin endpoint to clean up stale Stripe customers that no longer exist in Stripe
  app.post('/api/admin/cleanup-stripe-customers', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const stripe = await getUncachableStripeClient();
      
      // Get all customers from our stripe.customers table
      const localCustomers = await db.execute(sql`SELECT id, email, metadata FROM stripe.customers`);
      
      const results: { id: string; status: string; email?: string }[] = [];
      const staleCustomerIds: string[] = [];
      
      for (const customer of localCustomers.rows as any[]) {
        try {
          const stripeCustomer = await stripe.customers.retrieve(customer.id);
          if ((stripeCustomer as any).deleted) {
            results.push({ id: customer.id, status: 'deleted_in_stripe', email: customer.email });
            staleCustomerIds.push(customer.id);
          } else {
            results.push({ id: customer.id, status: 'active', email: customer.email });
          }
        } catch (err: any) {
          if (err.code === 'resource_missing') {
            results.push({ id: customer.id, status: 'not_found_in_stripe', email: customer.email });
            staleCustomerIds.push(customer.id);
          } else {
            results.push({ id: customer.id, status: `error: ${err.message}`, email: customer.email });
          }
        }
      }
      
      // Clear stale customer IDs from users table
      if (staleCustomerIds.length > 0) {
        await db.update(users)
          .set({ stripeCustomerId: null, updatedAt: new Date() })
          .where(inArray(users.stripeCustomerId, staleCustomerIds));
      }
      
      console.log(`[ADMIN] Stripe customer cleanup by ${req.user.claims.sub}:`, results);
      res.json({ 
        success: true, 
        results,
        staleCustomersCleared: staleCustomerIds.length,
        message: `Found ${staleCustomerIds.length} stale customers. Cleared from users table. Note: stripe.customers table is read-only and managed by stripe-replit-sync.`
      });
    } catch (error: any) {
      console.error('Stripe customer cleanup error:', error);
      res.status(500).json({ error: 'Failed to cleanup Stripe customers: ' + error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
