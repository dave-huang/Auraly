import { openai } from '../openai';
import { analysisResultSchema, type ProductType, type AnalysisResult, type RiskLevel } from '@shared/schema';

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
  
  // Estimate expected ingredient count based on common separators and patterns
  // Try multiple heuristics and use the most reliable one
  const commaCount = (ingredientsText.match(/[,，]/g) || []).length + 1;
  const chineseSeparatorCount = (ingredientsText.match(/[、]/g) || []).length + 1;
  const semicolonCount = (ingredientsText.match(/[;；]/g) || []).length + 1;
  const newlineCount = (ingredientsText.match(/\n/g) || []).length + 1;
  
  // Only count actual bullet markers (not hyphens which appear in ingredient names like "beta-carotene")
  // Look for bullets at line starts only
  const bulletCount = (ingredientsText.match(/^[•·∙\*]\s/gm) || []).length;
  
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

Ingredient List:
${ingredientsText}

CRITICAL COMPLETENESS REQUIREMENT:
- You MUST identify and analyze EVERY SINGLE ingredient mentioned in the ingredient list above
- Do NOT skip any ingredients - the list should contain approximately ${estimatedIngredientCount} ingredients based on separators
- Include ALL ingredients in the exact order they appear in the list
- If an ingredient name has OCR errors, correct them to the proper chemical/ingredient name
- Count the ingredients carefully to ensure you haven't missed any

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
      'zh': "You are a helpful health and wellness assistant that analyzes product ingredients. Your task is to identify EVERY ingredient in the list and analyze each one. Always respond with valid JSON. CRITICAL: All text in your response must be in Simplified Chinese (简体中文), regardless of the input language. Extract ALL ingredients without skipping any.",
      'en': "You are a helpful health and wellness assistant that analyzes product ingredients. Your task is to identify EVERY ingredient in the list and analyze each one. Always respond with valid JSON. CRITICAL: All text in your response must be in English, regardless of the input language. Extract ALL ingredients without skipping any.",
      'es': "Eres un asistente de salud y bienestar que analiza ingredientes de productos. Tu tarea es identificar CADA ingrediente en la lista y analizar cada uno. Siempre responde con JSON válido. CRÍTICO: Todo el texto en tu respuesta debe estar en español, sin importar el idioma de entrada. Extrae TODOS los ingredientes sin saltarte ninguno."
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
    
    // Enforce completeness: reject if detected count is materially below estimate
    // Allow some tolerance (80%) for cases where separators might be miscounted
    const minimumAcceptableCount = Math.max(
      Math.floor(estimatedIngredientCount * 0.80), // 80% of estimated
      estimatedIngredientCount > 10 ? estimatedIngredientCount - 5 : 1 // Or within 5 of estimate for large lists
    );
    
    if (estimatedIngredientCount > 5 && detectedCount < minimumAcceptableCount) {
      console.error(`[ANALYZER] COMPLETENESS FAILURE: Detected only ${detectedCount} ingredients but estimated ${estimatedIngredientCount} (minimum required: ${minimumAcceptableCount})`);
      throw new Error(
        `Incomplete ingredient analysis: detected ${detectedCount} ingredients but the label appears to contain approximately ${estimatedIngredientCount}. ` +
        `This might indicate the AI missed some ingredients. Please try scanning again.`
      );
    }
    
    return validatedResult.data;
  } catch (error: any) {
    console.error('Analysis failed:', error);
    
    // Preserve meaningful error messages
    if (error.message && (error.message.includes('invalid response') || error.message.includes('expected format'))) {
      throw error;
    }
    
    throw new Error('Failed to analyze ingredients. Please try again.');
  }
}
