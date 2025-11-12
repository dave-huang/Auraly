import { openai } from '../openai';
import { analysisResultSchema, type ProductType, type AnalysisResult, type RiskLevel } from '@shared/schema';

/**
 * Expands parenthetical ingredient groups into individual ingredients
 * Example: "Enriched Flour (Wheat Flour, Niacin)" → "Wheat Flour, Niacin"
 */
function expandParentheticalIngredients(text: string): string {
  console.log('[EXPANDER] Starting parenthetical expansion');
  console.log(`[EXPANDER] Input text length: ${text.length} chars`);
  let result = text;
  let expansionCount = 0;
  
  // More robust pattern that handles various cases:
  // - Matches anything before parentheses (including numbers, special chars)
  // - Captures content within parentheses
  // - Handles multiple spaces and line breaks
  const parentheticalPattern = /([^(),]+?)\s*\(([^()]+)\)/g;
  
  result = result.replace(parentheticalPattern, (match, parentName, innerContent) => {
    expansionCount++;
    const parentTrimmed = parentName.trim();
    const innerTrimmed = innerContent.trim();
    
    console.log(`[EXPANDER #${expansionCount}] Replacing "${parentTrimmed}" (${parentTrimmed.length} chars)`);
    console.log(`[EXPANDER #${expansionCount}] With inner content: "${innerTrimmed.substring(0, 100)}..." (${innerTrimmed.length} chars)`);
    
    // Return just the inner content (comma-separated sub-ingredients)
    // This effectively replaces "Parent (A, B, C)" with "A, B, C"
    return innerTrimmed;
  });
  
  console.log(`[EXPANDER] Completed: expanded ${expansionCount} parenthetical groups`);
  console.log(`[EXPANDER] Output text length: ${result.length} chars`);
  
  // Log first 500 chars for debugging
  console.log(`[EXPANDER] First 500 chars of output: ${result.substring(0, 500)}`);
  
  return result;
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

  try {
    console.log('Sending request to OpenAI...');
    const systemMessages = {
      'zh': "You are a helpful health and wellness assistant that analyzes product ingredients. Extract and analyze EVERY ingredient from the list. Count each distinct ingredient only once (deduplicate). Always respond with valid JSON. All text in your response must be in Simplified Chinese (简体中文), regardless of the input language.",
      'en': "You are a helpful health and wellness assistant that analyzes product ingredients. Extract and analyze EVERY ingredient from the list. Count each distinct ingredient only once (deduplicate). Always respond with valid JSON. All text in your response must be in English, regardless of the input language.",
      'es': "Eres un asistente de salud y bienestar que analiza ingredientes de productos. Extrae y analiza TODOS los ingredientes de la lista. Cuenta cada ingrediente distinto solo una vez (deduplica). Siempre responde con JSON válido. Todo el texto en tu respuesta debe estar en español, sin importar el idioma de entrada."
    };
    const systemMessage = systemMessages[userLanguage as keyof typeof systemMessages] || systemMessages['en'];
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Optimized for speed - much faster than GPT-5 (10-20s vs 60-75s)
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
      max_tokens: 4096 // Sufficient for ingredient analysis
    });

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
      console.error('Failed to parse AI response:', content);
      throw new Error('AI returned invalid response format');
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
    console.error('Analysis failed:', error);
    
    // Preserve meaningful error messages for user feedback
    if (error.message && (
      error.message.includes('Incomplete ingredient analysis') ||
      error.message.includes('invalid response') || 
      error.message.includes('expected format') ||
      error.message.includes('AI response did not match')
    )) {
      throw error;
    }
    
    // Log the full error for debugging
    console.error('Unexpected error details:', error);
    throw new Error('Failed to analyze ingredients. Please try again.');
  }
}
