import Tesseract from 'tesseract.js';
import { extractTextWithGoogleVision } from './googleVisionOcr';
import { extractTextWithGemini } from './geminiOcr';

export interface OCRResult {
  text: string;
  language?: string;
}

/**
 * Validate that the image data is valid base64
 */
function validateImageData(imageData: string): void {
  // Remove the data URL prefix if present
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
  
  // Check if it's valid base64
  if (!base64Data || !/^[A-Za-z0-9+/]+=*$/.test(base64Data)) {
    throw new Error('Invalid image data format');
  }
  
  // Check minimum size (at least 100 bytes for a valid image)
  const buffer = Buffer.from(base64Data, 'base64');
  if (buffer.length < 100) {
    throw new Error('Image data too small - appears to be corrupted');
  }
  
  // Check maximum size (10MB limit)
  if (buffer.length > 10 * 1024 * 1024) {
    throw new Error('Image too large - maximum size is 10MB');
  }
}

/**
 * Score OCR result quality based on heuristics
 * Higher score = better quality
 */
function scoreOCRQuality(text: string): { score: number; details: string } {
  let score = 0;
  const details: string[] = [];
  
  // Count parentheses (ingredient lists have many parenthetical groups)
  const parenCount = (text.match(/\(/g) || []).length;
  score += parenCount * 5;
  details.push(`${parenCount} parentheses`);
  
  // Count commas (ingredient separators)
  const commaCount = (text.match(/,/g) || []).length;
  score += commaCount;
  details.push(`${commaCount} commas`);
  
  // Penalize for malformed words (excessive single letters)
  const words = text.split(/\s+/);
  const singleLetterWords = words.filter(w => w.length === 1 && /[A-Z]/i.test(w)).length;
  const malformedPenalty = singleLetterWords * 2;
  score -= malformedPenalty;
  if (singleLetterWords > 5) {
    details.push(`-${malformedPenalty} (${singleLetterWords} single letters)`);
  }
  
  // Check for common ingredient keywords
  const ingredientKeywords = [
    'INGREDIENTS', 'ENRICHED', 'FLOUR', 'SUGAR', 'SALT', 'OIL', 
    'WATER', 'WHEAT', 'CORN', 'SOY', 'MILK', 'EGG', 'VITAMIN',
    'NIACIN', 'THIAMINE', 'RIBOFLAVIN', 'ACID', 'STARCH'
  ];
  const keywordMatches = ingredientKeywords.filter(kw => text.toUpperCase().includes(kw)).length;
  score += keywordMatches * 3;
  details.push(`${keywordMatches} keywords`);
  
  // Prefer longer text (more complete OCR)
  score += Math.min(text.length / 100, 10);
  details.push(`${text.length} chars`);
  
  return { score, details: details.join(', ') };
}

/**
 * Extract text from image using dual OCR (Google Vision + Tesseract), choose best result
 */
export async function extractTextFromImage(imageData: string): Promise<OCRResult> {
  // Validate image data first
  try {
    validateImageData(imageData);
  } catch (error: any) {
    throw new Error(`Image validation failed: ${error.message}`);
  }
  
  const results: Array<{ text: string; language?: string; source: string }> = [];
  
  // Run Gemini (primary), Google Vision (secondary), and Tesseract (fallback) in parallel
  const ocrPromises: Promise<void>[] = [];
  
  // Try Gemini 2.5 Flash first (fastest, 2-5s)
  ocrPromises.push(
    extractTextWithGemini(imageData)
      .then(result => {
        console.log(`[MULTI-OCR] Gemini Flash: ${result.text.length} chars`);
        results.push({ ...result, source: 'Gemini Flash' });
      })
      .catch(error => {
        console.warn('[MULTI-OCR] Gemini failed:', error.message);
      })
  );
  
  // Try Google Cloud Vision as secondary option
  if (process.env.GOOGLE_CLOUD_VISION_API_KEY) {
    ocrPromises.push(
      extractTextWithGoogleVision(imageData)
        .then(result => {
          console.log(`[MULTI-OCR] Google Vision: ${result.text.length} chars`);
          results.push({ ...result, source: 'Google Vision' });
        })
        .catch(error => {
          console.warn('[MULTI-OCR] Google Vision failed:', error.message);
        })
    );
  }
  
  // Tesseract as final fallback
  ocrPromises.push(
    runTesseractOCR(imageData)
      .then(result => {
        console.log(`[MULTI-OCR] Tesseract: ${result.text.length} chars`);
        results.push({ ...result, source: 'Tesseract' });
      })
      .catch(error => {
        console.warn('[MULTI-OCR] Tesseract failed:', error.message);
      })
  );
  
  // Wait for all OCR engines to complete (or fail)
  await Promise.allSettled(ocrPromises);
  
  // If all engines failed, throw error
  if (results.length === 0) {
    throw new Error('All OCR engines failed. Please try with a clearer image.');
  }
  
  // Score each result and choose the best
  const scoredResults = results.map(r => {
    const quality = scoreOCRQuality(r.text);
    return { ...r, score: quality.score, scoreDetails: quality.details };
  });
  
  // Sort by score (descending)
  scoredResults.sort((a, b) => b.score - a.score);
  
  const best = scoredResults[0];
  console.log(`[MULTI-OCR] Quality scores:`);
  scoredResults.forEach(r => {
    console.log(`  ${r.source}: ${r.score.toFixed(1)} (${r.scoreDetails})`);
  });
  console.log(`[MULTI-OCR] Selected: ${best.source} (score: ${best.score.toFixed(1)})`);
  
  return {
    text: best.text,
    language: best.language
  };
}

/**
 * Run Tesseract OCR
 */
async function runTesseractOCR(imageData: string): Promise<{ text: string; language?: string }> {
  let worker;
  try {
    // Remove the data URL prefix if present
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    
    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Create a worker with error handling
    worker = await Tesseract.createWorker('eng', 1, {
      logger: () => {}, // Suppress logging
      errorHandler: (err: any) => {
        console.error('Tesseract worker error:', err);
      }
    });
    
    // Perform OCR with timeout
    const recognizePromise = worker.recognize(buffer);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('OCR timeout after 30 seconds')), 30000)
    );
    
    const result = await Promise.race([recognizePromise, timeoutPromise]) as Tesseract.RecognizeResult;
    
    const extractedText = result.data.text.trim();
    
    // Handle empty OCR results
    if (!extractedText || extractedText.length < 5) {
      throw new Error('No text found in image. Please ensure the ingredient list is clearly visible and try again with better lighting or a closer photo.');
    }
    
    console.log('Tesseract.js OCR successful');
    return {
      text: extractedText,
      language: 'en' // Tesseract doesn't provide reliable language detection
    };
  } catch (error: any) {
    console.error('Tesseract OCR failed:', error);
    
    // Preserve meaningful error messages
    if (error.message && error.message.includes('No text found')) {
      throw error;
    }
    
    if (error.message && error.message.includes('timeout')) {
      throw new Error('OCR processing took too long. Please try with a smaller or clearer image.');
    }
    
    throw new Error('Failed to extract text from image. The image may be corrupted or in an unsupported format. Please try again with a different photo.');
  } finally {
    // Always terminate the worker to prevent memory leaks
    if (worker) {
      try {
        await worker.terminate();
      } catch (e) {
        // Ignore termination errors
      }
    }
  }
}
