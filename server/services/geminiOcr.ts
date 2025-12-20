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
            text: `Extract ONLY the ingredients list from this product label image.

INSTRUCTIONS:
1. Look for text that starts with "INGREDIENTS:", "Ingredients:", or similar heading
2. Extract the ingredients list (comma-separated items)
3. STOP extracting when you encounter any of these boundary markers:
   - "Contains:" or "Contains" followed by allergen info
   - "May contain:" or "May Contain"
   - "Distributed by:" or "Distributed by"
   - "Manufactured by:" or "Manufactured by"
   - "Produced by:" or "Produced by"
   - "Made in" or "Product of"
   - Company names with "Inc.", "LLC", "Corp.", "Ltd."
   - City, State ZIP patterns (e.g., "New York, NY 10001")
   - Phone numbers, websites, or email addresses
   - "Best Before:", "Best By:", "Exp:", expiration dates
   - Nutrition Facts or nutritional information
   - UPC codes, barcodes, lot numbers
   - "Net Wt.", "Net Weight", serving size info

4. Return ONLY the actual ingredient names and their sub-ingredients in parentheses
5. Preserve parentheses for sub-ingredients like "Peanut Butter (Ground Peanuts)"
6. Do NOT include allergen warnings, company addresses, or any non-ingredient text

Return the extracted ingredients as a clean list, preserving commas and parentheses. No explanations.` 
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
