import Tesseract from 'tesseract.js';
import { extractTextWithGoogleVision } from './googleVisionOcr';

export interface OCRResult {
  text: string;
  language?: string;
}

/**
 * Extract text from image using Google Cloud Vision API with Tesseract.js as fallback
 */
export async function extractTextFromImage(imageData: string): Promise<OCRResult> {
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
  try {
    console.log('Using Tesseract.js for OCR...');
    
    // Remove the data URL prefix if present
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    
    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Perform OCR
    const result = await Tesseract.recognize(
      buffer,
      'eng', // Start with English, Tesseract will auto-detect
      {
        logger: () => {} // Suppress logging
      }
    );
    
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
    console.error('OCR extraction failed:', error);
    
    // Preserve meaningful error messages
    if (error.message && error.message.includes('No text found')) {
      throw error;
    }
    
    throw new Error('Failed to extract text from image. Please try again with a clearer photo.');
  }
}
