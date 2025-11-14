import { gemini } from '../gemini';

export interface GeminiOCRResult {
  text: string;
  language?: string;
}

/**
 * Extract text from image using Gemini 2.5 Flash vision capabilities
 * Much faster than Google Vision API (2-5s vs 10-20s)
 */
export async function extractTextWithGemini(imageData: string): Promise<GeminiOCRResult> {
  try {
    const startTime = Date.now();
    
    // Remove the data URL prefix if present
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    
    // Determine MIME type from data URL or default to jpeg
    let mimeType = 'image/jpeg';
    const dataUrlMatch = imageData.match(/^data:(image\/\w+);base64,/);
    if (dataUrlMatch) {
      mimeType = dataUrlMatch[1];
    }
    
    console.log('[GEMINI-OCR] Starting OCR with Gemini 2.5 Flash...');
    
    // Use Gemini 2.5 Flash for fast vision-based OCR
    const response = await gemini.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [
          { 
            text: `Extract ALL text from this product label image. Focus on the ingredients list section. Return ONLY the extracted text exactly as it appears, preserving all formatting, line breaks, parentheses, and punctuation. Do not add any explanations or formatting - just the raw text.` 
          },
          { 
            inlineData: { 
              mimeType, 
              data: base64Data 
            } 
          }
        ]
      }]
    });
    
    const extractedText = response.text?.trim() || '';
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[GEMINI-OCR] Extracted ${extractedText.length} characters in ${duration}s`);
    
    // Handle empty or very short results
    if (!extractedText || extractedText.length < 5) {
      throw new Error('No text found in image. Please ensure the ingredient list is clearly visible and try again with better lighting or a closer photo.');
    }
    
    return {
      text: extractedText,
      language: 'auto' // Gemini auto-detects language
    };
  } catch (error: any) {
    console.error('[GEMINI-OCR] Failed:', error);
    
    // Preserve meaningful error messages
    if (error.message && error.message.includes('No text found')) {
      throw error;
    }
    
    // Rethrow to allow fallback
    throw new Error('Gemini OCR failed: ' + (error.message || 'Unknown error'));
  }
}
