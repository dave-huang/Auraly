export interface GoogleVisionOCRResult {
  text: string;
  language?: string;
  confidence?: number;
}

export async function extractTextWithGoogleVision(imageData: string): Promise<GoogleVisionOCRResult> {
  try {
    // Remove the data URL prefix if present
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    
    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_CLOUD_VISION_API_KEY is not configured');
    }
    
    // Use REST API endpoint with API key authentication
    const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
    
    // Prepare the request payload
    const payload = {
      requests: [
        {
          image: {
            content: base64Data,
          },
          features: [
            {
              type: 'DOCUMENT_TEXT_DETECTION', // Use DOCUMENT_TEXT_DETECTION for dense text like ingredient lists
              maxResults: 1
            }
          ],
          imageContext: {
            languageHints: ['en', 'es', 'zh', 'fr', 'de', 'it', 'ja', 'ko', 'pt', 'ru'] // Support common languages
          }
        }
      ]
    };
    
    // Make the API request
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Vision API error (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    
    // Check for errors in the response
    if (result.responses?.[0]?.error) {
      throw new Error(`Google Vision API error: ${result.responses[0].error.message}`);
    }
    
    // DOCUMENT_TEXT_DETECTION provides fullTextAnnotation as the primary response
    const fullTextAnnotation = result.responses?.[0]?.fullTextAnnotation;
    const textAnnotations = result.responses?.[0]?.textAnnotations;
    
    // Try fullTextAnnotation first (canonical for DOCUMENT_TEXT_DETECTION)
    let extractedText = fullTextAnnotation?.text?.trim() || '';
    let locale = 'en';
    
    // Extract language from fullTextAnnotation if available
    if (extractedText && fullTextAnnotation?.pages?.[0]?.property?.detectedLanguages?.[0]) {
      locale = fullTextAnnotation.pages[0].property.detectedLanguages[0].languageCode || 'en';
    } else if (textAnnotations && textAnnotations.length > 0) {
      // Fallback to textAnnotations for both text and locale if fullTextAnnotation is not available
      if (!extractedText) {
        extractedText = textAnnotations[0].description?.trim() || '';
      }
      locale = textAnnotations[0].locale || 'en';
    }
    
    // Handle empty or very short results
    if (!extractedText || extractedText.length < 5) {
      throw new Error('No text found in image. Please ensure the ingredient list is clearly visible and try again with better lighting or a closer photo.');
    }
    
    console.log(`Google Vision OCR detected ${extractedText.length} characters`);
    
    return {
      text: extractedText,
      language: locale,
      confidence: 0.95 // DOCUMENT_TEXT_DETECTION typically has very high confidence
    };
  } catch (error: any) {
    console.error('Google Vision OCR failed:', error);
    
    // Preserve meaningful error messages
    if (error.message && error.message.includes('No text found')) {
      throw error;
    }
    
    // Rethrow to allow fallback
    throw new Error('Google Vision OCR failed: ' + (error.message || 'Unknown error'));
  }
}
