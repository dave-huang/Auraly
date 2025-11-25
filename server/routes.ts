import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import z from "zod";
import crypto from "crypto";
import { extractTextFromImage } from "./services/ocr";
import { analyzeIngredients, analyzeSingleIngredient, generateIngredientDetails } from "./services/analyzer";
import { batchAnalyzeIngredientsWithCache, getCacheStats } from "./services/cache";
import { 
  ocrRequestSchema, 
  analysisRequestSchema,
  type ProductType,
  type AnalysisResult,
  productTypes
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
  // OCR endpoint - extract text from image
  app.post("/api/ocr", async (req, res) => {
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

  // Analysis endpoint - analyze ingredients
  app.post("/api/analyze", async (req, res) => {
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

  // Get detailed explanation for a specific ingredient on-demand
  app.post("/api/ingredient-details", async (req, res) => {
    try {
      const { ingredientName, riskLevel, productType, userLanguage } = req.body;
      
      if (!ingredientName || !productType) {
        return res.status(400).json({ 
          error: 'Missing required fields: ingredientName, productType' 
        });
      }
      
      const details = await generateIngredientDetails(
        ingredientName,
        riskLevel || 'moderate',
        productType as ProductType,
        userLanguage || 'en'
      );
      
      res.json({ details });
    } catch (error: any) {
      console.error('Ingredient details endpoint error:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to generate ingredient details. Please try again.' 
      });
    }
  });

  // Batch analyze ingredients with backend caching
  app.post("/api/analyze-ingredients", async (req, res) => {
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

  // Check analysis status (for polling from mobile when tab is backgrounded)
  app.get("/api/analysis-status/:requestId", (req, res) => {
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

  // Combined OCR + Analysis endpoint (exhaustive ingredient extraction)
  app.post("/api/scan-and-analyze", async (req, res) => {
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
      
      try {
        const { imageData, productType, userLanguage, ocrText: cachedOcrText } = body;
        
        // Step 1: Run OCR or use cached
        if (cachedOcrText) {
          console.log(`[SCAN-AND-ANALYZE-${requestId}] Using cached OCR text (${cachedOcrText.length} chars)`);
          ocrText = cachedOcrText;
        } else {
          console.log(`[SCAN-AND-ANALYZE-${requestId}] Starting OCR for ${productType} in ${userLanguage}`);
          try {
            const ocrResult = await extractTextFromImage(imageData);
            const ocrDuration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`[TIMING] [OCR-SUCCESS-${requestId}] OCR completed in ${ocrDuration}s`);
            
            if (!ocrResult.text || ocrResult.text.trim().length < 10) {
              throw new Error('No ingredients found in image. Please ensure the ingredient list is clearly visible and try again.');
            }
            
            ocrText = ocrResult.text;
          } catch (ocrError: any) {
            const ocrDuration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.error(`[OCR-FAILED-${requestId}] OCR error after ${ocrDuration}s:`, ocrError.message);
            throw new Error(`OCR failed: ${ocrError.message}`);
          }
        }
        
        // Step 2: Run Analysis
        const analysisStartTime = Date.now();
        try {
          const analysisResult = await analyzeIngredients(productType as ProductType, ocrText!, userLanguage);
          const analysisDuration = ((Date.now() - analysisStartTime) / 1000).toFixed(2);
          const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
          
          console.log(`[TIMING] [ANALYSIS-SUCCESS-${requestId}] Analysis completed in ${analysisDuration}s (total: ${totalDuration}s)`);
          
          // Store completed result
          analysisRequest.status = 'completed';
          analysisRequest.result = analysisResult;
          analysisRequest.ocrText = ocrText;
          analysisRequest.timestamp = Date.now();
          
        } catch (analysisError: any) {
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

  // Streaming ingredient analysis endpoint - one ingredient at a time via SSE
  app.post("/stream-ingredient-analysis", async (req, res) => {
    const body = req.body;
    
    // Validate request
    if (!body.ingredients || !Array.isArray(body.ingredients) || body.ingredients.length === 0) {
      return res.status(400).json({ 
        error: 'Missing required field: ingredients array is required.' 
      });
    }
    if (!body.productType || !body.userLanguage) {
      return res.status(400).json({ 
        error: 'Missing required fields: productType and userLanguage are required.' 
      });
    }
    
    const ingredients = body.ingredients as string[];
    const productType = body.productType as string;
    const userLanguage = body.userLanguage as string;
    
    // Set SSE headers - ALL FOUR ARE REQUIRED to prevent buffering
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    
    // Flush headers immediately
    res.flushHeaders();
    console.log(`[SSE-STREAM] Starting stream for ${ingredients.length} ingredients`);
    
    // Process each ingredient sequentially and stream immediately
    (async () => {
      try {
        for (let i = 0; i < ingredients.length; i++) {
          const ingredient = ingredients[i].trim();
          if (!ingredient) continue;
          
          try {
            console.log(`[SSE-STREAM] Processing ingredient ${i + 1}/${ingredients.length}: ${ingredient}`);
            
            // Analyze single ingredient (checks cache first)
            const result = await analyzeSingleIngredient(ingredient, productType as any, userLanguage);
            
            // Send SSE event IMMEDIATELY after this ingredient is done
            const sseEvent = `event: ingredientResult\ndata: ${JSON.stringify({
              ingredient: result.analysis,
              index: i,
              fromCache: result.fromCache
            })}\n\n`;
            
            res.write(sseEvent);
            
            // FLUSH after each ingredient - critical for Replit proxy
            const writable = res as any;
            if (writable.flush) {
              writable.flush();
            }
            
            console.log(`[SSE-STREAM] ✓ Streamed ingredient ${i + 1}/${ingredients.length}: ${ingredient} (${result.fromCache ? 'cached' : 'fresh'})`);
            console.log(`[SSE-STREAM] Written bytes, flushing...`);
            
            // Add small 50ms delay to allow socket to truly flush
            // setImmediate alone isn't enough - we need actual time for network buffers to clear
            if (i < ingredients.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }
            
          } catch (ingredientError: any) {
            console.error(`[SSE-STREAM] Error analyzing ingredient: ${ingredient}`, ingredientError.message);
            
            // Send error event for this ingredient
            const errorEvent = `event: ingredientError\ndata: ${JSON.stringify({
              ingredient,
              index: i,
              error: ingredientError.message || 'Failed to analyze ingredient'
            })}\n\n`;
            
            res.write(errorEvent);
            const writable = res as any;
            if (writable.flush) {
              writable.flush();
            }
            
            // Add delay after error too
            if (i < ingredients.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          }
        }
        
        // Send final completion event
        console.log(`[SSE-STREAM] All ingredients processed, sending done event`);
        res.write('event: done\ndata: complete\n\n');
        const writable = res as any;
        if (writable.flush) {
          writable.flush();
        }
        
        // Close connection
        res.end();
        console.log(`[SSE-STREAM] ✓ Stream completed and closed`);
        
      } catch (error: any) {
        console.error(`[SSE-STREAM] Critical error:`, error.message);
        
        // Send error event
        const errorEvent = `event: streamError\ndata: ${JSON.stringify({
          error: error.message || 'Stream processing failed'
        })}\n\n`;
        
        res.write(errorEvent);
        res.end();
      }
    })();
  });

  const httpServer = createServer(app);

  return httpServer;
}
