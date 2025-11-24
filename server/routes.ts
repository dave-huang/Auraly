import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import z from "zod";
import crypto from "crypto";
import { extractTextFromImage } from "./services/ocr";
import { analyzeIngredients, analyzeIndividualIngredients } from "./services/analyzer";
import { batchAnalyzeIngredientsWithCache, getCacheStats, getCachedIngredientAnalysis, setCachedIngredientAnalysis } from "./services/cache";
import { parseIngredients } from "./services/ingredientParser";
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

  // Streaming OCR + Analysis endpoint (SSE - must be GET to work with EventSource)
  app.get("/api/scan-and-analyze-stream", async (req, res) => {
    const { imageData, ocrText: cachedOcrText, productType, userLanguage } = req.query;
    
    // Validate required fields
    if ((!imageData && !cachedOcrText) || !productType || !userLanguage) {
      return res.status(400).json({ 
        error: 'Missing required fields in query: imageData or ocrText, productType, and userLanguage are required.' 
      });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const requestId = crypto.randomBytes(8).toString('hex');
    const startTime = Date.now();
    let ocrText: string | undefined;
    let allIngredients: Array<{ name: string; originalIndex: number }> = [];

    try {
      // Decode image data if provided
      const imageDataStr = imageData as string | undefined;
      const ocrTextStr = cachedOcrText as string | undefined;

      // Step 1: Run OCR or use cached
      if (ocrTextStr) {
        console.log(`[STREAM-${requestId}] Using cached OCR text (${ocrTextStr.length} chars)`);
        ocrText = ocrTextStr;
      } else if (imageDataStr) {
        console.log(`[STREAM-${requestId}] Starting OCR for ${productType} in ${userLanguage}`);
        try {
          const ocrResult = await extractTextFromImage(imageDataStr);
          const ocrDuration = ((Date.now() - startTime) / 1000).toFixed(2);
          console.log(`[TIMING] [OCR-${requestId}] OCR completed in ${ocrDuration}s`);
          
          if (!ocrResult.text || ocrResult.text.trim().length < 10) {
            throw new Error('No ingredients found in image. Please ensure the ingredient list is clearly visible and try again.');
          }
          
          ocrText = ocrResult.text;
        } catch (ocrError: any) {
          console.error(`[OCR-FAILED-${requestId}] OCR error:`, ocrError.message);
          res.write(`data: ${JSON.stringify({ type: 'error', error: `OCR failed: ${ocrError.message}` })}\n\n`);
          res.end();
          return;
        }
      } else {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'Neither imageData nor ocrText provided' })}\n\n`);
        res.end();
        return;
      }

      // Step 2: Parse ingredients
      console.log(`[STREAM-${requestId}] Parsing ingredients from OCR text`);
      allIngredients = parseIngredients(ocrText!);
      console.log(`[STREAM-${requestId}] Parsed ${allIngredients.length} ingredients`);

      // Emit OCR text
      res.write(`data: ${JSON.stringify({ type: 'ocr_complete', ocrText: ocrText!, ingredientCount: allIngredients.length })}\n\n`);

      // Step 3: Stream ingredients (cached first, then uncached)
      const cachedIngredients: any[] = [];
      const uncachedIngredients: any[] = [];

      for (const ingredient of allIngredients) {
        const cached = getCachedIngredientAnalysis(ingredient.name, productType as string);
        if (cached) {
          cachedIngredients.push({ ...ingredient, analysis: cached.analysis });
        } else {
          uncachedIngredients.push(ingredient);
        }
      }

      // Emit all cached ingredients immediately
      console.log(`[STREAM-${requestId}] Streaming ${cachedIngredients.length} cached ingredients`);
      for (const ingredient of cachedIngredients) {
        try {
          const parsed = JSON.parse(ingredient.analysis);
          res.write(`data: ${JSON.stringify({ type: 'ingredient', ingredient: parsed, fromCache: true })}\n\n`);
        } catch (e) {
          console.error(`[STREAM-${requestId}] Error parsing cached ingredient:`, e);
        }
      }

      // Emit progress update
      res.write(`data: ${JSON.stringify({ type: 'progress', cached: cachedIngredients.length, total: allIngredients.length })}\n\n`);

      // Step 4: Analyze uncached ingredients in batches
      if (uncachedIngredients.length > 0) {
        console.log(`[STREAM-${requestId}] Analyzing ${uncachedIngredients.length} uncached ingredients`);
        
        try {
          const analyzedIngredients = await analyzeIndividualIngredients(
            uncachedIngredients.map((i: any) => i.name),
            productType as ProductType,
            userLanguage as string
          );

          // Stream and cache each analyzed ingredient
          for (const analyzed of analyzedIngredients) {
            try {
              // Cache the analysis
              setCachedIngredientAnalysis(analyzed.name, productType as string, JSON.stringify(analyzed));
              
              // Stream to client
              res.write(`data: ${JSON.stringify({ type: 'ingredient', ingredient: analyzed, fromCache: false })}\n\n`);
            } catch (e) {
              console.error(`[STREAM-${requestId}] Error processing analyzed ingredient:`, e);
            }
          }
        } catch (analyzeError: any) {
          console.error(`[STREAM-${requestId}] Error analyzing uncached ingredients:`, analyzeError.message);
          res.write(`data: ${JSON.stringify({ type: 'error', error: `Analysis failed: ${analyzeError.message}` })}\n\n`);
        }
      }

      // Emit completion
      const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[TIMING] [STREAM-${requestId}] Completed in ${totalDuration}s`);
      res.write(`data: ${JSON.stringify({ type: 'complete', duration: totalDuration })}\n\n`);
      res.end();

    } catch (error: any) {
      console.error(`[STREAM-${requestId}] Unexpected error:`, error.message);
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message || 'Unexpected error' })}\n\n`);
      res.end();
    }
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

  const httpServer = createServer(app);

  return httpServer;
}
