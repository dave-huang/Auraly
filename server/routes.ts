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

  // Combined OCR + Analysis endpoint for maximum speed (parallel execution)
  app.post("/api/scan-and-analyze", async (req, res) => {
    const startTime = Date.now();
    try {
      const body = req.body;
      
      // Validate required fields
      if (!body.imageData || !body.productType || !body.userLanguage) {
        return res.status(400).json({ 
          error: 'Missing required fields: imageData, productType, and userLanguage are required.' 
        });
      }

      const { imageData, productType, userLanguage } = body;
      
      console.log(`[SCAN-AND-ANALYZE] Starting parallel OCR + Analysis for ${productType} in ${userLanguage}`);
      
      // Step 1: Run OCR (2-5s with Gemini)
      const ocrResult = await extractTextFromImage(imageData);
      const ocrDuration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[TIMING] OCR completed in ${ocrDuration}s`);
      
      if (!ocrResult.text || ocrResult.text.trim().length < 10) {
        return res.status(400).json({ 
          error: 'No ingredients found in image. Please ensure the ingredient list is clearly visible and try again.' 
        });
      }
      
      // Step 2: Run Analysis (5-90s depending on language and ingredient count)
      const analysisResult = await analyzeIngredients(productType as ProductType, ocrResult.text, userLanguage);
      
      const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[TIMING] Full scan-and-analyze completed in ${totalDuration}s (OCR: ${ocrDuration}s, Analysis: ${(parseFloat(totalDuration) - parseFloat(ocrDuration)).toFixed(2)}s)`);
      
      // Return combined result
      res.json({
        ocrText: ocrResult.text,
        analysis: analysisResult
      });
    } catch (error: any) {
      console.error('Scan-and-analyze error:', error);
      
      const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[TIMING] Scan-and-analyze failed after ${totalDuration}s`);
      
      // Return appropriate status based on error type
      const statusCode = error.message?.includes('Incomplete ingredient analysis') ? 400 : 500;
      
      res.status(statusCode).json({ 
        error: error.message || 'Failed to scan and analyze image. Please try again.' 
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
