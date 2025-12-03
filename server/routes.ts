import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import z from "zod";
import crypto from "crypto";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { storage } from "./storage";
import { extractTextFromImage } from "./services/ocr";
import { analyzeIngredients, analyzeIngredientsParallel, extractIngredientsFromText } from "./services/analyzer";
import { batchAnalyzeIngredientsWithCache, getCacheStats } from "./services/cache";
import { 
  ocrRequestSchema, 
  analysisRequestSchema,
  type ProductType,
  type AnalysisResult,
  type InsertScanHistory,
  type Ingredient,
  productTypes,
  productCategories
} from "@shared/schema";

// In-memory store for analysis requests (for background processing)
interface AnalysisRequest {
  id: string;
  status: 'processing' | 'completed' | 'failed';
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
  app.get("/api/cache-stats", (req, res) => {
    try {
      const stats = getCacheStats();
      res.json({
        ...stats,
        hitRate: stats.total > 0 ? ((stats.fresh / stats.total) * 100).toFixed(2) + '%' : 'N/A'
      });
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
      
      res.status(201).json({ success: true, scanId: scan.id });
    } catch (error: any) {
      console.error("[HISTORY] Error saving scan:", error);
      res.status(400).json({ error: error.message || "Failed to save scan" });
    }
  });

  // GET /api/history - Get user's scan history (paginated)
  app.get("/api/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const offset = parseInt(req.query.offset as string) || 0;
      
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
      const { scanId } = req.params;
      
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

  // DELETE /api/history/:scanId - Delete a single scan
  app.delete("/api/history/:scanId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { scanId } = req.params;
      
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

  const httpServer = createServer(app);

  return httpServer;
}
