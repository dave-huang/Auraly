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
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
  
  if (!base64Data || !/^[A-Za-z0-9+/]+=*$/.test(base64Data)) {
    throw new Error('Invalid image data format');
  }
  
  const buffer = Buffer.from(base64Data, 'base64');
  if (buffer.length < 100) {
    throw new Error('Image data too small - appears to be corrupted');
  }
  
  if (buffer.length > 10 * 1024 * 1024) {
    throw new Error('Image too large - maximum size is 10MB');
  }
}

/**
 * Extract text from image using Gemini Flash (primary) with Google Vision fallback
 * Fast and reliable: 2-5s with Gemini, falls back to Google Vision only on failure
 */
export async function extractTextFromImage(imageData: string): Promise<OCRResult> {
  validateImageData(imageData);
  
  try {
    console.log('[OCR] Using Gemini Flash (primary, 2-5s)');
    const result = await extractTextWithGemini(imageData);
    console.log(`[OCR] Gemini Flash succeeded: ${result.text.length} chars extracted`);
    return result;
  } catch (geminiError: any) {
    console.warn('[OCR] Gemini Flash failed:', geminiError.message);
    
    if (process.env.GOOGLE_CLOUD_VISION_API_KEY) {
      try {
        console.log('[OCR] Falling back to Google Vision');
        const result = await extractTextWithGoogleVision(imageData);
        console.log(`[OCR] Google Vision succeeded: ${result.text.length} chars extracted`);
        return result;
      } catch (visionError: any) {
        console.error('[OCR] Google Vision also failed:', visionError.message);
        throw new Error('Failed to extract text from image. Please try with a clearer photo of the ingredient list.');
      }
    } else {
      throw new Error('OCR failed. Please try with a clearer photo of the ingredient list.');
    }
  }
}
