import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import z from "zod";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { storage } from "./storage";
import { db } from "./db";
import { extractTextFromImage } from "./services/ocr";
import { analyzeIngredients, analyzeIngredientsParallel, extractIngredientsFromText } from "./services/analyzer";
import { batchAnalyzeIngredientsWithCache, getCacheStats, clearAllCache } from "./services/cache";
import { subscriptionService } from "./services/subscription";
import { 
  ocrRequestSchema, 
  analysisRequestSchema,
  riskPreferencesSchema,
  allergenPreferencesSchema,
  users,
  type ProductType,
  type AnalysisResult,
  type InsertScanHistory,
  type Ingredient,
  productTypes,
  productCategories
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

  // GET /api/account/subscription - Get full subscription details
  app.get('/api/account/subscription', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Calculate next free scan refresh date (1st of next month)
      const now = new Date();
      const nextRefreshDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      // Base response with user info
      const response: any = {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        subscriptionStatus: user.subscriptionStatus,
        monthlyFreeScansUsed: user.monthlyFreeScansUsed || 0,
        scanPackBalance: user.scanPackBalance || 0,
        nextFreeScansRefresh: nextRefreshDate.toISOString(),
        createdAt: user.createdAt,
      };

      // Add trial info if on trial
      if (user.subscriptionStatus === 'trial') {
        response.trialEndsAt = user.trialEndsAt;
        if (user.trialEndsAt) {
          const trialEnd = new Date(user.trialEndsAt);
          const daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          response.trialDaysRemaining = daysRemaining;
        }
      }

      // Check if admin-granted premium
      if (user.isAdminGrantedPremium) {
        response.isAdminGrantedPremium = true;
      }

      // Fetch Stripe billing info if customer exists (regardless of subscription status)
      if (user.stripeCustomerId) {
        response.subscriptionEndsAt = user.subscriptionEndsAt;
        
        try {
          const stripe = await getUncachableStripeClient();
          
          // Get payment methods for the customer
          const paymentMethods = await stripe.paymentMethods.list({
            customer: user.stripeCustomerId,
            type: 'card',
            limit: 1,
          });
          
          if (paymentMethods.data && paymentMethods.data.length > 0) {
            const pm = paymentMethods.data[0];
            if (pm.card) {
              response.paymentMethod = {
                brand: pm.card.brand || 'card',
                last4: pm.card.last4 || '****',
                expMonth: pm.card.exp_month,
                expYear: pm.card.exp_year,
              };
            }
          }

          // Get subscription details for next billing date (only for paying subscribers, not admin-granted)
          if (!user.isAdminGrantedPremium && user.subscriptionStatus === 'active') {
            // List active subscriptions for the customer to get the most recent one
            const subscriptions = await stripe.subscriptions.list({
              customer: user.stripeCustomerId,
              status: 'active',
              limit: 1,
              expand: ['data.items.data.price'],
            });
            
            console.log(`[BILLING] Found ${subscriptions.data.length} active subscriptions for customer ${user.stripeCustomerId}`);
            
            if (subscriptions.data.length > 0) {
              const subscription = subscriptions.data[0] as any;
              console.log(`[BILLING] Full subscription object keys: ${Object.keys(subscription).join(', ')}`);
              console.log(`[BILLING] Subscription ID: ${subscription.id}, current_period_end: ${subscription.current_period_end}, status: ${subscription.status}`);
              
              // current_period_end is a Unix timestamp
              if (subscription.current_period_end) {
                response.nextBillingDate = new Date(subscription.current_period_end * 1000).toISOString();
              }
              
              // Get price info from expanded items
              const priceData = subscription.items?.data?.[0]?.price;
              if (priceData) {
                response.billingAmount = priceData.unit_amount || null;
                response.billingCurrency = priceData.currency || 'usd';
                response.billingInterval = priceData.recurring?.interval || 'month';
              }
              
              console.log(`[BILLING] Response: nextBillingDate=${response.nextBillingDate}, amount=${response.billingAmount}`);
            } else {
              console.log(`[BILLING] No active subscriptions found for customer ${user.stripeCustomerId}`);
            }
          }
        } catch (stripeError: any) {
          console.error('Error fetching Stripe details:', stripeError);
        }
      }

      res.json(response);
    } catch (error: any) {
      console.error("Error fetching subscription:", error);
      res.status(500).json({ message: "Failed to fetch subscription details" });
    }
  });

  // POST /api/account/billing-portal - Create Stripe Customer Portal session
  app.post('/api/account/billing-portal', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.stripeCustomerId) {
        return res.status(400).json({ message: "No billing account found" });
      }

      const stripe = await getUncachableStripeClient();
      
      // Determine return URL
      const returnUrl = req.body.returnUrl || `${req.protocol}://${req.get('host')}/account`;
      
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: returnUrl,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating billing portal session:", error);
      res.status(500).json({ message: "Failed to create billing portal session" });
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
  // SUBSCRIPTION & BILLING ENDPOINTS
  // ==========================================

  const { subscriptionService } = await import('./services/subscription');
  const { getUncachableStripeClient, getStripePublishableKey } = await import('./stripeClient');
  const { sql: sqlDrizzle } = await import('drizzle-orm');

  app.get('/api/stripe/publishable-key', async (_req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error: any) {
      console.error('Error getting publishable key:', error);
      res.status(500).json({ error: 'Failed to get Stripe key' });
    }
  });

  app.get('/api/subscription/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const status = await subscriptionService.getUserQuotaStatus(userId);
      res.json(status);
    } catch (error: any) {
      console.error('Error fetching subscription status:', error);
      res.status(500).json({ error: 'Failed to fetch subscription status' });
    }
  });

  app.get('/api/subscription/products', async (_req, res) => {
    try {
      const result = await db.execute(
        sqlDrizzle`
          SELECT 
            p.id as product_id,
            p.name as product_name,
            p.description as product_description,
            p.metadata as product_metadata,
            pr.id as price_id,
            pr.unit_amount,
            pr.currency,
            pr.recurring,
            pr.metadata as price_metadata
          FROM stripe.products p
          LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
          WHERE p.active = true
          ORDER BY p.name, pr.unit_amount
        `
      );

      const productsMap = new Map();
      for (const row of result.rows as any[]) {
        if (!productsMap.has(row.product_id)) {
          productsMap.set(row.product_id, {
            id: row.product_id,
            name: row.product_name,
            description: row.product_description,
            metadata: row.product_metadata,
            prices: []
          });
        }
        if (row.price_id) {
          productsMap.get(row.product_id).prices.push({
            id: row.price_id,
            unitAmount: row.unit_amount,
            currency: row.currency,
            recurring: row.recurring,
            metadata: row.price_metadata,
          });
        }
      }

      res.json({ products: Array.from(productsMap.values()) });
    } catch (error: any) {
      console.error('Error fetching products:', error);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });

  app.post('/api/subscription/checkout', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { priceId, mode } = req.body;

      if (!priceId) {
        return res.status(400).json({ error: 'priceId is required' });
      }

      const stripe = await getUncachableStripeClient();
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          metadata: { userId },
        });
        await db.update(users)
          .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
          .where(eq(users.id, userId));
        customerId = customer.id;
      }

      // Redirect to /results after successful payment - this resumes pending analysis from sessionStorage
      const successUrl = `${req.protocol}://${req.get('host')}/results?payment=success`;
      const cancelUrl = `${req.protocol}://${req.get('host')}/upload`;

      const sessionConfig: any = {
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: mode || 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
      };

      const session = await stripe.checkout.sessions.create(sessionConfig);

      await subscriptionService.logUpgradeClick(userId, 'auraly_plus');

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  });

  app.post('/api/subscription/portal', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user?.stripeCustomerId) {
        return res.status(400).json({ error: 'No active subscription' });
      }

      const stripe = await getUncachableStripeClient();
      const returnUrl = `${req.protocol}://${req.get('host')}/settings`;

      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: returnUrl,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Error creating portal session:', error);
      res.status(500).json({ error: 'Failed to create portal session' });
    }
  });

  app.post('/api/analytics/paywall-view', async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || null;
      const { source } = req.body;
      await subscriptionService.logPaywallView(userId, source || 'unknown');
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error logging paywall view:', error);
      res.status(500).json({ error: 'Failed to log event' });
    }
  });

  app.post('/api/analytics/gated-content', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { contentType } = req.body;
      await subscriptionService.logGatedContentTap(userId, contentType || 'unknown');
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error logging gated content tap:', error);
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

  app.get('/api/admin/dashboard', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const allUsers = await db.select().from(users);
      
      const totalUsers = allUsers.length;
      const premiumUsers = allUsers.filter(u => u.subscriptionStatus === 'active').length;
      const freeUsers = totalUsers - premiumUsers;
      
      const totalScansThisMonth = allUsers.reduce((sum, u) => sum + (u.monthlyFreeScansUsed || 0), 0);

      const recentUsers = allUsers
        .sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        })
        .slice(0, 50)
        .map(u => ({
          id: u.id,
          replitId: u.id,
          email: u.email || '',
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unknown',
          subscriptionStatus: u.subscriptionStatus,
          scanPackBalance: u.scanPackBalance || 0,
          monthlyFreeScansUsed: u.monthlyFreeScansUsed || 0,
          createdAt: u.createdAt?.toString() || '',
        }));

      res.json({
        stats: {
          totalUsers,
          premiumUsers,
          freeUsers,
          totalScansThisMonth,
        },
        recentUsers,
      });
    } catch (error: any) {
      console.error('Admin dashboard error:', error);
      res.status(500).json({ error: 'Failed to load dashboard' });
    }
  });

  app.post('/api/admin/grant-subscription', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      await db.update(users)
        .set({ 
          subscriptionStatus: 'active',
          subscriptionStartedAt: new Date(),
        })
        .where(eq(users.id, userId));

      res.json({ success: true });
    } catch (error: any) {
      console.error('Grant subscription error:', error);
      res.status(500).json({ error: 'Failed to grant subscription' });
    }
  });

  app.post('/api/admin/revoke-subscription', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      await db.update(users)
        .set({ 
          subscriptionStatus: 'free',
          subscriptionEndsAt: new Date(),
        })
        .where(eq(users.id, userId));

      res.json({ success: true });
    } catch (error: any) {
      console.error('Revoke subscription error:', error);
      res.status(500).json({ error: 'Failed to revoke subscription' });
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

      const newBalance = (user.scanPackBalance || 0) + amount;
      await db.update(users)
        .set({ scanPackBalance: newBalance })
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
      const clearedCount = clearAllCache();
      console.log(`[ADMIN] Cache cleared by user ${req.user.claims.sub}: ${clearedCount} entries removed`);
      res.json({ success: true, clearedCount, message: `Cleared ${clearedCount} cached ingredient analyses` });
    } catch (error: any) {
      console.error('Clear cache error:', error);
      res.status(500).json({ error: 'Failed to clear cache' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
