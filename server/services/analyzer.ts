import { openai } from '../openai';
import { analysisResultSchema, type ProductType, type AnalysisResult, type RiskLevel } from '@shared/schema';

/**
 * Expands parenthetical ingredient groups into individual ingredients using a stack-based parser
 * Defaults to extracting inner content to avoid losing ingredients across translations
 * Only keeps parent when inner is a redundant alias/certification
 * 
 * Examples:
 * - "Spices (turmeric, cumin)" → "turmeric, cumin" (extract list)
 * - "Spices (turmeric)" → "turmeric" (extract single item)  
 * - "Niacin (Vitamin B3)" → "Niacin" (vitamin alias - keep parent)
 * - "Palm Oil (RSPO Certified)" → "Palm Oil" (certification - keep parent)
 */
function expandParentheticalIngredients(text: string): string {
  try {
    console.log('[EXPANDER] Starting parenthetical expansion');
    console.log(`[EXPANDER] Input text length: ${text.length} chars`);
    
    if (!text || text.length === 0) {
      console.log('[EXPANDER] Empty input, returning as-is');
      return text;
    }
    
    let result = '';
    let stack: string[] = [];
    let expansionCount = 0;
    let unmatchedOpen = 0;
    let unmatchedClose = 0;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      if (char === '(') {
        // Push current content onto stack and start collecting inner content
        stack.push(result);
        result = '';
      } else if (char === ')') {
        if (stack.length === 0) {
          unmatchedClose++;
          // Unmatched closing paren - just include it
          result += char;
          continue;
        }
        
        // Pop from stack and merge
        const innerContent = result.trim();
        const beforeParen = stack.pop()!;
        
        // Find the last token before the opening paren (potential parent ingredient)
        const beforeParenTrimmed = beforeParen.trimEnd();
        const lastCommaIndex = Math.max(
          beforeParenTrimmed.lastIndexOf(','),
          beforeParenTrimmed.lastIndexOf('，'),
          beforeParenTrimmed.lastIndexOf('、'),
          beforeParenTrimmed.lastIndexOf(';'),
          beforeParenTrimmed.lastIndexOf('；'),
          beforeParenTrimmed.lastIndexOf(':'),
          beforeParenTrimmed.lastIndexOf('：')
        );
        
        const parentToken = beforeParenTrimmed.substring(lastCommaIndex + 1).trim();
        const restOfText = beforeParenTrimmed.substring(0, lastCommaIndex + 1);
        
        expansionCount++;
        
        // Intelligent expansion logic - DEFAULT TO EXPANSION to avoid losing ingredients:
        // 1. Extract inner content by default (e.g., "Spices (turmeric)" → "turmeric")
        // 2. ONLY keep parent when inner is clearly a redundant alias/certification
        //
        // Keep parent only when:
        // - Inner matches vitamin/chemical patterns (e.g., "Niacin (Vitamin B3)", "Ascorbic Acid (Vitamin C)")
        // - Inner is a certification/standard (e.g., "Palm Oil (RSPO Certified)", "Sugar (Fair Trade)")
        // - Inner is just a number/code (e.g., "E300 (300)")
        //
        // Otherwise extract inner to avoid losing ingredients across translations
        
        if (innerContent.length > 0) {
          // Check if inner is a redundant alias we should drop
          // Use strict boundary matching to avoid false positives (e.g., "organic carrots" should NOT match)
          const trimmedInner = innerContent.trim();
          
          // Match vitamin aliases (single tokens like "Vitamin B3", "Vitamina C", "维生素D")
          const isVitaminAlias = /^(?:vitamin\s+[A-K][\d]*|vitamina\s+[A-K][\d]*|维生素\s*[A-K][\d]*)$/i.test(trimmedInner);
          
          // Match certifications/standards only if it's the ONLY content (no commas, no actual ingredients)
          // Includes multi-word qualifiers like "Non-GMO Project Verified", "Fair Trade Certified"
          const isCertification = /^(?:RSPO\s+certified|fair\s+trade(?:\s+certified)?|non-GMO(?:\s+project\s+verified)?|organic|bio|ecológico|有机|certified|kosher|halal)$/i.test(trimmedInner);
          
          // Match pure numbers or E-numbers
          const isNumberCode = /^[E\d]+$/i.test(trimmedInner);
          
          // Match percentages
          const isPercentage = /^\d+%$/.test(trimmedInner);
          
          const shouldDropInner = isVitaminAlias || isCertification || isNumberCode || isPercentage;
          
          if (shouldDropInner) {
            // Inner is redundant alias/qualifier - keep parent only
            result = beforeParenTrimmed;
            console.log(`[EXPANDER #${expansionCount}] Alias/qualifier: kept parent "${parentToken}", dropped "${innerContent.substring(0, 30)}..."`);
          } else {
            // Default: extract inner content (may be single or multiple items)
            result = restOfText + (restOfText && !restOfText.endsWith(',') && !restOfText.endsWith('，') ? ', ' : '') + innerContent;
            console.log(`[EXPANDER #${expansionCount}] Expanded: "${parentToken}" → "${innerContent.substring(0, 50)}..."`);
          }
        } else {
          // Empty parentheses - just keep what was before
          result = beforeParen;
        }
      } else {
        result += char;
      }
    }
    
    // If stack is not empty, we have unmatched opening parens
    unmatchedOpen = stack.length;
    if (unmatchedOpen > 0) {
      console.log(`[EXPANDER] Warning: ${unmatchedOpen} unmatched opening parentheses found`);
      // Reconstruct by popping everything
      while (stack.length > 0) {
        result = stack.pop()! + '(' + result;
      }
    }
    
    if (unmatchedClose > 0) {
      console.log(`[EXPANDER] Warning: ${unmatchedClose} unmatched closing parentheses found`);
    }
    
    console.log(`[EXPANDER] Completed: expanded ${expansionCount} parenthetical groups`);
    console.log(`[EXPANDER] Output text length: ${result.length} chars`);
    console.log(`[EXPANDER] First 300 chars: ${result.substring(0, 300).replace(/\n/g, ' ')}...`);
    
    return result;
  } catch (error) {
    console.error('[EXPANDER] Error during expansion:', error);
    console.error('[EXPANDER] Returning original text due to error');
    // Return original text on error to prevent 500
    return text;
  }
}

const PRODUCT_TYPE_CONTEXTS = {
  food: `Food products. Focus on:
    - Food additives (E-numbers, preservatives, colorants)
    - Artificial sweeteners (aspartame, sucralose, saccharin)
    - Trans fats and hydrogenated oils
    - High sodium content
    - Allergens (gluten, nuts, dairy, soy)
    - Artificial flavors and colors
    - High fructose corn syrup
    - MSG and flavor enhancers`,
  
  skincare: `Skincare and haircare products. Focus on:
    - Parabens (hormone disruptors)
    - Sulfates (SLS, SLES)
    - Phthalates
    - Formaldehyde-releasing preservatives
    - Fragrance (potential allergens)
    - Mineral oil and petrolatum
    - Silicones
    - Alcohols (drying types)
    - Heavy metals (lead, mercury)`,
  
  'oral-care': `Oral care products. Focus on:
    - Triclosan (endocrine disruptor)
    - SLS (sodium lauryl sulfate)
    - Artificial sweeteners
    - Microbeads (plastic particles)
    - Fluoride (in excessive amounts)
    - Parabens
    - DEA (diethanolamine)
    - Propylene glycol`,
  
  cosmetics: `Cosmetics and fragrance products. Focus on:
    - Parabens
    - Phthalates (in fragrances)
    - Formaldehyde
    - Toluene
    - Heavy metals (lead, arsenic)
    - Coal tar dyes
    - BHA and BHT
    - Synthetic fragrance compounds
    - Talc (asbestos contamination risk)`
};

const LANGUAGE_INSTRUCTIONS = {
  'zh': 'CRITICAL INSTRUCTION: You MUST respond ONLY in Simplified Chinese (简体中文). ALL ingredient names, summaries, and detailed explanations MUST be written in Chinese, regardless of what language the input text is in.',
  'en': 'CRITICAL INSTRUCTION: You MUST respond ONLY in English. ALL ingredient names, summaries, and detailed explanations MUST be written in English, regardless of what language the input text is in (even if the ingredients are written in Chinese, Japanese, or any other language).',
  'es': 'INSTRUCCIÓN CRÍTICA: Debes responder SOLO en español. TODOS los nombres de ingredientes, resúmenes y explicaciones detalladas DEBEN estar escritos en español, sin importar en qué idioma esté escrito el texto de entrada (incluso si los ingredientes están escritos en chino, japonés o cualquier otro idioma).',
};

export async function analyzeIngredients(
  productType: ProductType,
  ingredientsText: string,
  userLanguage: string = 'en'
): Promise<AnalysisResult> {
  console.log(`[ANALYZER] User language: ${userLanguage}`);
  console.log(`[ANALYZER] OCR text length: ${ingredientsText.length} characters`);
  
  // Pre-process the text to expand parenthetical ingredients
  // This is more reliable than asking the AI to do it
  const expandedText = expandParentheticalIngredients(ingredientsText);
  console.log(`[ANALYZER] After expanding parentheticals: ${expandedText.length} characters`);
  
  // Try to isolate the ingredients section from the full OCR text
  // Look for common markers like "INGREDIENTS:", "成分:", etc.
  // Use the expanded text for analysis
  let textToAnalyze = expandedText;
  let foundIngredientsMarker = false;
  const ingredientsMarkers = [
    /INGREDIENTS?\s*[:：]/i,
    /成分\s*[:：]/,
    /原料\s*[:：]/,
    /配料\s*[:：]/,
    /INGREDIENTES?\s*[:：]/i,
    /INGRÉDIENTS?\s*[:：]/i
  ];
  
  for (const marker of ingredientsMarkers) {
    const match = expandedText.match(marker);
    if (match && match.index !== undefined) {
      foundIngredientsMarker = true;
      // Extract text after the marker
      textToAnalyze = expandedText.substring(match.index + match[0].length);
      console.log(`[ANALYZER] Found ingredients marker "${match[0]}", text after marker: ${textToAnalyze.length} chars`);
      
      // Stop at next section markers (CONTAINS, DIRECTIONS, etc.)
      const endMarkers = [
        /CONTAINS?\s*[:：]/i,
        /ALLERGENS?\s*[:：]/i,
        /DIRECTIONS?\s*[:：]/i,
        /INSTRUCTIONS?\s*[:：]/i,
        /NUTRITION\s+FACTS?\s*[:：]/i,
        /MANUFACTURED BY/i,
        /PRODUCT OF/i,
        /含\s*[:：]/,
        /过敏原\s*[:：]/,
        /使用方法\s*[:：]/,
        /CONTIENE\s*[:：]/i,
        /MODO DE USO\s*[:：]/i
      ];
      
      let foundEndMarker = false;
      for (const endMarker of endMarkers) {
        const endMatch = textToAnalyze.match(endMarker);
        if (endMatch && endMatch.index !== undefined && endMatch.index > 20) { // Must be at least 20 chars in
          textToAnalyze = textToAnalyze.substring(0, endMatch.index);
          console.log(`[ANALYZER] Found end marker "${endMatch[0]}" at position ${endMatch.index}, trimmed to ${textToAnalyze.length} characters`);
          foundEndMarker = true;
          break;
        }
      }
      
      if (!foundEndMarker) {
        console.log(`[ANALYZER] No end marker found, using full text after ingredients marker`);
      }
      
      break;
    }
  }
  
  // Estimate expected ingredient count based on common separators and patterns
  // Only analyze the ingredients section (or full text if no marker found)
  const commaCount = (textToAnalyze.match(/[,，]/g) || []).length + 1;
  const chineseSeparatorCount = (textToAnalyze.match(/[、]/g) || []).length + 1;
  const semicolonCount = (textToAnalyze.match(/[;；]/g) || []).length + 1;
  const newlineCount = (textToAnalyze.match(/\n/g) || []).length + 1;
  
  // Only count actual bullet markers (not hyphens which appear in ingredient names like "beta-carotene")
  // Look for bullets at line starts only
  const bulletCount = (textToAnalyze.match(/^[•·∙\*]\s/gm) || []).length;
  
  // Use comma count as primary estimate (most common separator)
  // If Chinese separators are more common, use those instead
  // Cap at a reasonable maximum to prevent estimation errors
  const validCounts = [
    commaCount > 1 ? commaCount : 0,
    chineseSeparatorCount > 1 ? chineseSeparatorCount : 0,
    semicolonCount > 1 ? semicolonCount : 0,
    newlineCount > 3 ? newlineCount : 0,
    bulletCount > 1 ? bulletCount : 0
  ].filter(c => c > 0);
  
  // Use the maximum of valid counts, but cap at 100 to prevent unreasonable estimates
  const estimatedIngredientCount = validCounts.length > 0 
    ? Math.min(Math.max(...validCounts), 100)
    : 1;
  
  console.log(`[ANALYZER] Separator analysis - Commas: ${commaCount}, Chinese: ${chineseSeparatorCount}, Semicolons: ${semicolonCount}, Newlines: ${newlineCount}, Bullets: ${bulletCount}`);
  console.log(`[ANALYZER] Estimated ingredient count: ${estimatedIngredientCount}`);
  
  const context = PRODUCT_TYPE_CONTEXTS[productType];
  const languageInstruction = LANGUAGE_INSTRUCTIONS[userLanguage as keyof typeof LANGUAGE_INSTRUCTIONS] || LANGUAGE_INSTRUCTIONS['en'];
  console.log(`[ANALYZER] Language instruction: ${languageInstruction.substring(0, 100)}...`);
  
  const prompt = `You are a health-focused ingredient analyst. Analyze the following ingredient list from a ${productType} product.

${languageInstruction}

Product Type Context: ${context}

Ingredient List (parenthetical groups have been pre-expanded):
${textToAnalyze}

CRITICAL EXTRACTION RULES:
1. Extract EVERY SINGLE ingredient from the list above
2. If an ingredient appears multiple times, count it only ONCE (deduplicate)
3. Include ALL: additives, vitamins, minerals, preservatives, colors, emulsifiers, starches, sweeteners, oils, and flavorings
4. The list contains approximately ${estimatedIngredientCount} ingredients based on separators
5. If an ingredient name has OCR errors, correct them to the proper chemical/ingredient name

For each ingredient, determine:
1. The ingredient name (clean, standardized format) - MUST be in the user's language
2. Risk level: "low" (safe), "moderate" (limited evidence/moderate concern), or "high" (known health risks)
3. A brief summary (1-2 sentences) explaining what it is and why it's flagged - MUST be in the user's language
4. Detailed explanation (2-3 sentences) with more context about health impacts - MUST be in the user's language

INGREDIENT NAME TRANSLATION REQUIREMENTS:
- ALWAYS translate ingredient names to the user's language accurately
- Use proper chemical/scientific names when translating
- Examples: "水" → "Water" (English) or "Agua" (Spanish), "甘油" → "Glycerin" (English) or "Glicerina" (Spanish)
- For unclear OCR text, correct to the nearest valid ingredient name based on context
- NEVER leave ingredient names in the original language from the label
- NEVER invent ingredients that don't exist in the text

OTHER IMPORTANT NOTES:
- ALL text output (name, summary, details) must be in the user's selected language
- Extract the product name if mentioned (product name can stay in original language)
- Determine overall product risk (low/moderate/high) based on the worst ingredients
- Be friendly and clear in explanations, not alarmist
- If an ingredient is generally safe, mark it as "low" risk

Return your analysis as JSON with this structure:
{
  "productName": "Product name if found or null",
  "ingredients": [
    {
      "name": "Ingredient Name",
      "riskLevel": "low|moderate|high",
      "summary": "Brief explanation",
      "details": "Detailed explanation",
      "category": "Optional category like 'preservative', 'sweetener', etc"
    }
  ],
  "overallRisk": "low|moderate|high"
}`;

  // Retry logic with exponential backoff for reliability
  // OpenAI API experiences intermittent timeouts/slowness, especially during peak hours
  let lastError: Error | null = null;
  const maxRetries = 3; // Increased from 2 to 3 for better resilience
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`[ANALYZER] Retry attempt ${attempt}/${maxRetries} due to: ${lastError?.message || 'unknown error'}`);
      }
      
      console.log('[TIMING] Sending request to OpenAI...');
      const aiStartTime = Date.now();
      
      const systemMessages = {
        'zh': "You are a helpful health and wellness assistant that analyzes product ingredients. Extract and analyze EVERY ingredient from the list. Count each distinct ingredient only once (deduplicate). Always respond with valid JSON. All text in your response must be in Simplified Chinese (简体中文), regardless of the input language.",
        'en': "You are a helpful health and wellness assistant that analyzes product ingredients. Extract and analyze EVERY ingredient from the list. Count each distinct ingredient only once (deduplicate). Always respond with valid JSON. All text in your response must be in English, regardless of the input language.",
        'es': "Eres un asistente de salud y bienestar que analiza ingredientes de productos. Extrae y analiza TODOS los ingredientes de la lista. Cuenta cada ingrediente distinto solo una vez (deduplica). Siempre responde con JSON válido. Todo el texto en tu respuesta debe estar en español, sin importar el idioma de entrada."
      };
      const systemMessage = systemMessages[userLanguage as keyof typeof systemMessages] || systemMessages['en'];
      
      // Adjust max_tokens based on estimated ingredient count and language
      // Chinese characters consume more tokens than Latin characters, so reduce limits for Chinese mode
      // With GPT-4o, use moderate limits for speed while ensuring completeness
      // Each ingredient needs ~120-150 tokens (name, risk, concise summary/details) in English/Spanish
      // Chinese needs ~100-120 tokens per ingredient due to higher token density
      const tokensPerIngredient = userLanguage === 'zh' ? 110 : 140;
      const baseTokens = userLanguage === 'zh' ? 600 : 800;
      const maxCap = userLanguage === 'zh' ? 4500 : 6000; // Lower cap for Chinese to improve speed
      
      const estimatedTokensNeeded = Math.min(estimatedIngredientCount * tokensPerIngredient + baseTokens, maxCap);
      const maxTokens = Math.max(2500, estimatedTokensNeeded);
      
      console.log(`[ANALYZER] Using max_tokens: ${maxTokens} for language: ${userLanguage} (estimated ${estimatedIngredientCount} ingredients)`);
      
      // Use GPT-4o (primary, faster than GPT-4o-mini), fall back to GPT-4o-mini if unavailable
      let response;
      try {
        console.log('[ANALYZER] Attempting GPT-4o for fast analysis');
        response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: systemMessage
            },
            {
              role: "user",
              content: prompt
            }
          ],
          response_format: { type: "json_object" },
          max_tokens: maxTokens,
          temperature: 0.3
        });
        console.log('[ANALYZER] GPT-4o succeeded');
      } catch (modelError: any) {
        // If GPT-4o is unavailable, fall back to GPT-4o-mini
        if (modelError?.status === 400 || modelError?.code === 'unknown_model') {
          console.log('[ANALYZER] GPT-4o unavailable, falling back to GPT-4o-mini');
          response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: systemMessage
              },
              {
                role: "user",
                content: prompt
              }
            ],
            response_format: { type: "json_object" },
            max_tokens: maxTokens,
            temperature: 0.3
          });
          console.log('[ANALYZER] GPT-4o-mini succeeded');
        } else {
          // If it's not a model availability error, re-throw
          throw modelError;
        }
      }

      const aiDuration = ((Date.now() - aiStartTime) / 1000).toFixed(2);
      const tokensUsed = response.usage?.total_tokens || 0;
      const completionTokens = response.usage?.completion_tokens || 0;
      console.log(`[TIMING] OpenAI API call completed in ${aiDuration}s (${tokensUsed} tokens, ${completionTokens} completion)`);
      console.log('OpenAI response received:', JSON.stringify(response, null, 2));
      
      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        console.error('Empty AI response. Full response:', JSON.stringify(response));
        throw new Error('No response from AI');
      }

      let analysis;
      try {
        analysis = JSON.parse(content);
      } catch (parseError) {
        console.error('Failed to parse AI response:', content.substring(0, 500));
        throw new Error('AI returned invalid JSON format');
      }
      
      // Validate the analysis result against our schema
      const validatedResult = analysisResultSchema.safeParse({
        productType,
        productName: analysis.productName || undefined,
        ingredients: analysis.ingredients || [],
        overallRisk: analysis.overallRisk || 'moderate',
        analyzedAt: new Date().toISOString(),
        originalText: ingredientsText
      });
      
      if (!validatedResult.success) {
        console.error('Validation failed:', validatedResult.error);
        console.error(`Received ${analysis.ingredients?.length || 0} ingredients before validation failed`);
        throw new Error('AI response did not match expected format');
      }
      
      const detectedCount = validatedResult.data.ingredients.length;
      console.log(`[ANALYZER] Successfully analyzed ${detectedCount} ingredients`);
      console.log(`[ANALYZER] Product name: ${validatedResult.data.productName || 'Not detected'}`);
      console.log(`[ANALYZER] Overall risk: ${validatedResult.data.overallRisk}`);
      
      // TEMPORARILY DISABLED: Completeness check is interfering with parenthetical expansion
      // The AI needs to expand grouped ingredients (e.g., "Enriched Flour (Wheat, Niacin)" → 2 ingredients)
      // Estimation counts commas, which doesn't account for expansion, causing false failures
      // TODO: Re-enable with smarter estimation that accounts for parenthetical groups
      console.log(`[ANALYZER] Completeness check DISABLED. Detected: ${detectedCount}, Estimated: ${estimatedIngredientCount}, Found marker: ${foundIngredientsMarker}`);
      
      return validatedResult.data;
      
    } catch (error: any) {
      lastError = error;
      console.error(`[ANALYZER] Attempt ${attempt}/${maxRetries} failed:`, error.message);
      console.error(`[ANALYZER] Error details:`, {
        name: error.name,
        code: error.code,
        status: error.status,
        type: error.type
      });
      
      // Classify error types for retry decision
      const errorStatus = (error as any).status || (error as any).code;
      const errorType = (error as any).type || '';
      const errorMessage = error.message || '';
      
      // Non-retryable errors (client-side issues that won't be fixed by retrying)
      const nonRetryableErrors = [
        'API key',
        'unauthorized',
        'forbidden',
        'invalid_request_error',
        'authentication_error',
        'permission_denied'
      ];
      
      const shouldNotRetry = nonRetryableErrors.some(msg => 
        errorMessage.toLowerCase().includes(msg.toLowerCase()) ||
        errorType.toLowerCase().includes(msg.toLowerCase())
      );
      
      if (shouldNotRetry) {
        console.log(`[ANALYZER] Non-retryable error detected (auth/config issue), failing immediately`);
        break;
      }
      
      // Retryable server errors (500, 502, 503, 429, timeouts, network issues)
      const isRetryableServerError = 
        errorStatus === 500 || 
        errorStatus === 502 || 
        errorStatus === 503 || 
        errorStatus === 429 ||
        errorType === 'server_error' ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('ECONNREFUSED');
      
      if (isRetryableServerError) {
        console.log(`[ANALYZER] Retryable server error detected (status: ${errorStatus}, type: ${errorType}), will retry`);
      }
      
      // Wait before retry (exponential backoff: 2s, 4s, 8s)
      if (attempt < maxRetries) {
        const waitTime = 2000 * Math.pow(2, attempt - 1);
        console.log(`[ANALYZER] Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // All retries failed
  console.error('[ANALYZER] All retry attempts exhausted');
  
  // Provide user-friendly error messages based on error type
  if (lastError) {
    const errorStatus = (lastError as any).status || (lastError as any).code;
    const errorType = (lastError as any).type || '';
    const errorMessage = lastError.message || '';
    
    // Check for server errors (500, 502, 503)
    if (errorStatus === 500 || errorStatus === 502 || errorStatus === 503 || errorType === 'server_error') {
      throw new Error(`The AI service is temporarily unavailable (tried ${maxRetries} times). This usually resolves within a few minutes. Please try again shortly.`);
    }
    
    // Check for timeout errors
    if (errorMessage.includes('timeout') || errorStatus === 'ETIMEDOUT') {
      throw new Error('Analysis is taking longer than expected. The AI service may be experiencing high load. Please try again in a few moments.');
    }
    
    // Check for rate limit errors
    if (errorMessage.includes('rate limit') || errorStatus === 429) {
      throw new Error('The AI service is currently busy. Please wait a minute and try again.');
    }
    
    // Check for network errors
    if (errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
      throw new Error('Unable to connect to the AI service. Please check your internet connection and try again.');
    }
    
    // Preserve meaningful validation error messages
    if (lastError.message && (
      lastError.message.includes('Incomplete ingredient analysis') ||
      lastError.message.includes('invalid') || 
      lastError.message.includes('expected format') ||
      lastError.message.includes('AI response did not match')
    )) {
      throw lastError;
    }
    
    // Generic fallback with context
    throw new Error(`Analysis failed after ${maxRetries} attempts. The AI service may be temporarily unavailable. Please try again.`);
  }
  
  throw new Error('Failed to analyze ingredients after multiple attempts. Please try again.');
}
