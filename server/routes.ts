import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { extractTextFromImage } from "./services/ocr";
import { analyzeIngredients } from "./services/analyzer";
import { 
  ocrRequestSchema, 
  analysisRequestSchema,
  type ProductType 
} from "@shared/schema";

// Configure multer for in-memory file uploads
const upload = multer({ storage: multer.memoryStorage() });

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

  // Combined OCR + Analysis endpoint for maximum speed (sequential execution with caching)
  app.post("/api/scan-and-analyze", async (req, res) => {
    const startTime = Date.now();
    let ocrText: string | undefined;
    let ocrDuration: string = '0.00';
    let ocrStage: 'skipped' | 'success' | 'failed' = 'skipped';
    let analysisStage: 'pending' | 'success' | 'failed' = 'pending';
    
    try {
      const body = req.body;
      
      // Validate required fields (imageData OR ocrText must be provided)
      if ((!body.imageData && !body.ocrText) || !body.productType || !body.userLanguage) {
        return res.status(400).json({ 
          error: 'Missing required fields: (imageData OR ocrText), productType, and userLanguage are required.' 
        });
      }

      const { imageData, productType, userLanguage, ocrText: cachedOcrText } = body;
      
      // Step 1: Run OCR (2-5s with Gemini) OR use cached OCR text
      if (cachedOcrText) {
        console.log(`[SCAN-AND-ANALYZE] Using cached OCR text (${cachedOcrText.length} chars) for ${productType} in ${userLanguage}`);
        ocrText = cachedOcrText;
        ocrStage = 'skipped';
      } else {
        console.log(`[SCAN-AND-ANALYZE] Starting OCR + Analysis for ${productType} in ${userLanguage}`);
        try {
          const ocrResult = await extractTextFromImage(imageData);
          ocrDuration = ((Date.now() - startTime) / 1000).toFixed(2);
          console.log(`[TIMING] [OCR-SUCCESS] OCR completed in ${ocrDuration}s`);
          ocrStage = 'success';
          
          if (!ocrResult.text || ocrResult.text.trim().length < 10) {
            ocrStage = 'failed';
            console.error(`[OCR-FAILED] No text extracted from image`);
            return res.status(400).json({ 
              error: 'No ingredients found in image. Please ensure the ingredient list is clearly visible and try again.',
              stage: 'ocr'
            });
          }
          
          ocrText = ocrResult.text;
        } catch (ocrError: any) {
          ocrStage = 'failed';
          ocrDuration = ((Date.now() - startTime) / 1000).toFixed(2);
          console.error(`[OCR-FAILED] OCR error after ${ocrDuration}s:`, ocrError.message);
          throw new Error(`OCR failed: ${ocrError.message}`);
        }
      }
      
      // Step 2: Run Analysis (5-90s depending on language and ingredient count)
      const analysisStartTime = Date.now();
      try {
        const analysisResult = await analyzeIngredients(productType as ProductType, ocrText!, userLanguage);
        analysisStage = 'success';
        const analysisDuration = ((Date.now() - analysisStartTime) / 1000).toFixed(2);
        const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        console.log(`[TIMING] [ANALYSIS-SUCCESS] Analysis completed in ${analysisDuration}s`);
        console.log(`[TIMING] [COMPLETE] Full scan-and-analyze completed in ${totalDuration}s (OCR: ${ocrStage === 'skipped' ? 'cached' : ocrDuration + 's'}, Analysis: ${analysisDuration}s)`);
        
        // Return combined result with OCR text for caching
        res.json({
          ocrText: ocrText,
          analysis: analysisResult
        });
      } catch (analysisError: any) {
        analysisStage = 'failed';
        const analysisDuration = ((Date.now() - analysisStartTime) / 1000).toFixed(2);
        
        // Log detailed analysis error information
        console.error(`[ANALYSIS-FAILED] Analysis error after ${analysisDuration}s:`, analysisError.message);
        console.error(`[ANALYSIS-FAILED] Error details:`, {
          type: analysisError.name,
          code: analysisError.code,
          status: analysisError.status,
          ocrTextLength: ocrText?.length || 0
        });
        
        throw analysisError;
      }
    } catch (error: any) {
      const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      // Enhanced error logging with stage information
      console.error(`[SCAN-AND-ANALYZE-FAILED] Failed after ${totalDuration}s at stage: ${analysisStage === 'pending' ? 'OCR' : 'Analysis'}`);
      console.error(`[SCAN-AND-ANALYZE-FAILED] Stages: OCR=${ocrStage}, Analysis=${analysisStage}`);
      console.error(`[SCAN-AND-ANALYZE-FAILED] Error:`, error.message);
      
      // Return appropriate status based on error type
      const statusCode = error.message?.includes('Incomplete ingredient analysis') ? 400 : 500;
      
      res.status(statusCode).json({ 
        error: error.message || 'Failed to scan and analyze image. Please try again.',
        stage: analysisStage === 'pending' ? 'ocr' : 'analysis',
        ocrText: ocrStage === 'success' ? ocrText : undefined
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
