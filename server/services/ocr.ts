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
 * Extract text from image using Google Cloud Vision (primary) with Gemini fallback
 */
export async function extractTextFromImage(imageData: string): Promise<OCRResult> {
  validateImageData(imageData);

  if (process.env.GOOGLE_CLOUD_VISION_API_KEY) {
    try {
      console.log('[OCR] Using Google Cloud Vision (primary)');
      const result = await extractTextWithGoogleVision(imageData);
      console.log(`[OCR] Google Cloud Vision succeeded: ${result.text.length} chars extracted`);
      return result;
    } catch (visionError: any) {
      console.warn('[OCR] Google Cloud Vision failed:', visionError.message);
      console.log('[OCR] Falling back to Gemini Flash');
    }
  } else {
    console.log('[OCR] GOOGLE_CLOUD_VISION_API_KEY not set, using Gemini Flash');
  }

  try {
    const result = await extractTextWithGemini(imageData);
    console.log(`[OCR] Gemini Flash succeeded: ${result.text.length} chars extracted`);
    return result;
  } catch (geminiError: any) {
    console.error('[OCR] Gemini Flash also failed:', geminiError.message);
    throw new Error('Failed to extract text from image. Please try with a clearer photo of the ingredient list.');
  }
}
