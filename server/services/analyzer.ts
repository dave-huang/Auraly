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

// Step 1: Analyze ingredients (always in English for consistency)
async function analyzeIngredientsEnglish(
  productType: ProductType,
  ingredientsText: string
): Promise<AnalysisResult> {
  const context = PRODUCT_TYPE_CONTEXTS[productType];
  
  const prompt = `You are a health-focused ingredient analyst. Analyze the following ingredient list from a ${productType} product.

Product Type Context: ${context}

Ingredient List (may be in any language):
${ingredientsText}

CRITICAL INSTRUCTIONS:
1. Identify EVERY ingredient mentioned in the text, no matter what language it's in
2. Translate ALL ingredient names to English 
3. For each ingredient, provide:
   - name: Standardized English name (e.g., "水" → "Water", "甘油" → "Glycerin")
   - riskLevel: "low", "moderate", or "high"
   - summary: Brief 1-2 sentence explanation in English
   - details: Detailed 2-3 sentence explanation in English
   - category: Optional category (e.g., "preservative", "sweetener")

4. Extract product name if mentioned (keep in original language)
5. Determine overall risk based on worst ingredients
6. Be thorough - include ALL ingredients from the list

Return JSON with this structure:
{
  "productName": "Product name if found or null",
  "ingredients": [
    {
      "name": "Ingredient Name",
      "riskLevel": "low|moderate|high",
      "summary": "Brief explanation",
      "details": "Detailed explanation",
      "category": "Optional category"
    }
  ],
  "overallRisk": "low|moderate|high"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a helpful health and wellness assistant that analyzes product ingredients. Always respond with valid JSON in English."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 4096
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const analysis = JSON.parse(content);
    
    const result: AnalysisResult = {
      productType,
      productName: analysis.productName || undefined,
      ingredients: analysis.ingredients || [],
      overallRisk: analysis.overallRisk || 'moderate',
      analyzedAt: new Date().toISOString(),
      originalText: ingredientsText
    };
    
    // Validate the English result
    const validated = analysisResultSchema.safeParse(result);
    if (!validated.success) {
      console.error('[ANALYZER] English analysis validation failed:', validated.error);
      throw new Error('AI response did not match expected format');
    }
    
    return validated.data;
  } catch (error: any) {
    console.error('[ANALYZER] English analysis failed:', error);
    throw error;
  }
}

// Step 2: Translate results to target language
async function translateResults(
  result: AnalysisResult,
  targetLanguage: string
): Promise<AnalysisResult> {
  if (targetLanguage === 'en') {
    return result; // Already in English
  }

  const languageNames: Record<string, string> = {
    'zh': 'Simplified Chinese (简体中文)',
    'es': 'Spanish (Español)'
  };
  
  const targetLangName = languageNames[targetLanguage];
  if (!targetLangName) {
    console.warn(`[ANALYZER] Unknown target language: ${targetLanguage}, falling back to English`);
    return result;
  }

  const prompt = `Translate the following ingredient analysis to ${targetLangName}.

CRITICAL INSTRUCTIONS:
1. Translate ALL ingredient names to ${targetLangName}
   - Example: "Water" → "水" (Chinese) or "Agua" (Spanish)
   - Example: "Glycerin" → "甘油" (Chinese) or "Glicerina" (Spanish)
2. Translate ALL summaries and details to ${targetLangName}
3. Keep the same number of ingredients - do NOT add or remove any
4. Keep productName in original language (if present)
5. Keep riskLevel and overallRisk values exactly the same
6. Keep category values in English (optional field)

Original analysis (in English):
${JSON.stringify(result, null, 2)}

Return the translated analysis as JSON with the same structure.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a professional translator specializing in ingredient analysis. Translate to ${targetLangName} while preserving the JSON structure.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 4096
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No response from translation AI');
    }

    const translated = JSON.parse(content);
    
    const translatedResult: AnalysisResult = {
      ...result,
      ingredients: translated.ingredients || result.ingredients,
      productName: translated.productName || result.productName
    };
    
    // Validate the translated result
    const validated = analysisResultSchema.safeParse(translatedResult);
    if (!validated.success) {
      console.error('[ANALYZER] Translation validation failed:', validated.error);
      console.warn('[ANALYZER] Falling back to English results');
      return result; // Return English version if translation fails
    }
    
    return validated.data;
  } catch (error: any) {
    console.error('[ANALYZER] Translation failed:', error);
    console.warn('[ANALYZER] Falling back to English results');
    return result; // Return English version on any error
  }
}

export async function analyzeIngredients(
  productType: ProductType,
  ingredientsText: string,
  userLanguage: string = 'en'
): Promise<AnalysisResult> {
  console.log(`[ANALYZER] Starting analysis in user language: ${userLanguage}`);
  console.log(`[ANALYZER] Step 1: Analyzing ingredients in English for consistency...`);
  
  try {
    // Step 1: Always analyze in English first (ensures consistent ingredient identification)
    const englishResult = await analyzeIngredientsEnglish(productType, ingredientsText);
    console.log(`[ANALYZER] English analysis complete. Found ${englishResult.ingredients.length} ingredients`);
    
    // Step 2: Translate to target language if needed
    if (userLanguage !== 'en') {
      console.log(`[ANALYZER] Step 2: Translating results to ${userLanguage}...`);
      const translatedResult = await translateResults(englishResult, userLanguage);
      console.log(`[ANALYZER] Translation complete. Ingredients: ${translatedResult.ingredients.length}`);
      return translatedResult; // Already validated in translateResults()
    }
    
    return englishResult; // Already validated in analyzeIngredientsEnglish()
  } catch (error: any) {
    console.error('[ANALYZER] Analysis failed:', error);
    
    // Preserve meaningful error messages
    if (error.message && (error.message.includes('invalid response') || error.message.includes('expected format'))) {
      throw error;
    }
    
    throw new Error('Failed to analyze ingredients. Please try again.');
  }
}
