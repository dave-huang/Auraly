import Tesseract from 'tesseract.js';
import { extractTextWithGoogleVision } from './googleVisionOcr';

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
 * Extract text from image using Google Cloud Vision API with Tesseract.js as fallback
 */
export async function extractTextFromImage(imageData: string): Promise<OCRResult> {
  // Validate image data first
  try {
    validateImageData(imageData);
  } catch (error: any) {
    throw new Error(`Image validation failed: ${error.message}`);
  }
  
  // Try Google Cloud Vision first if API key is available
  if (process.env.GOOGLE_CLOUD_VISION_API_KEY) {
    try {
      console.log('Using Google Cloud Vision for OCR...');
      const result = await extractTextWithGoogleVision(imageData);
      console.log('Google Cloud Vision OCR successful');
      return {
        text: result.text,
        language: result.language
      };
    } catch (error: any) {
      console.warn('Google Cloud Vision failed, falling back to Tesseract:', error.message);
      // Fall through to Tesseract fallback
    }
  }
  
  // Fallback to Tesseract.js
  console.log('Using Tesseract.js for OCR...');
  
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
