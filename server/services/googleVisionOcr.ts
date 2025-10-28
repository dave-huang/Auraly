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
              type: 'TEXT_DETECTION'
            }
          ]
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
    
    const textAnnotations = result.responses?.[0]?.textAnnotations;
    
    if (!textAnnotations || textAnnotations.length === 0) {
      throw new Error('No text found in image');
    }
    
    // The first annotation contains the entire detected text
    const extractedText = textAnnotations[0].description?.trim() || '';
    
    // Handle empty or very short results
    if (!extractedText || extractedText.length < 5) {
      throw new Error('No text found in image. Please ensure the ingredient list is clearly visible and try again with better lighting or a closer photo.');
    }
    
    // Extract language if available (usually in locale format like 'en')
    const locale = textAnnotations[0].locale || 'en';
    
    return {
      text: extractedText,
      language: locale,
      confidence: 0.9 // Google Vision typically has high confidence
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
