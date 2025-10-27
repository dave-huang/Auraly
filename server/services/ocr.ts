import Tesseract from 'tesseract.js';

export interface OCRResult {
  text: string;
  language?: string;
}

export async function extractTextFromImage(imageData: string): Promise<OCRResult> {
  try {
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
    
    return {
      text: result.data.text.trim(),
      language: 'en' // Tesseract doesn't provide reliable language detection
    };
  } catch (error) {
    console.error('OCR extraction failed:', error);
    throw new Error('Failed to extract text from image');
  }
}
