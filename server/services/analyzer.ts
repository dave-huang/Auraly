import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { openai } from '../openai';
import { analysisResultSchema, type ProductType, type AnalysisResult, type RiskLevel, type Ingredient } from '@shared/schema';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Store cache in the project root for better persistence
const cacheFilePath = path.join(process.cwd(), 'analysis_cache.json');

// In-memory cache for full analysis results (keyed by hash of ingredient text + product type + language)
const analysisCache = new Map<string, { result: AnalysisResult; timestamp: number; ocrText: string }>();

// Load cache from disk on startup
function loadCacheFromDisk(): void {
  try {
    console.log(`[CACHE] Attempting to load from: ${cacheFilePath}`);
    if (fs.existsSync(cacheFilePath)) {
      const data = fs.readFileSync(cacheFilePath, 'utf-8');
      const entries = JSON.parse(data) as Array<[string, { result: AnalysisResult; timestamp: number; ocrText?: string }]>;
      for (const [key, value] of entries) {
        // Ensure ocrText is always present
        analysisCache.set(key, {
          ...value,
          ocrText: value.ocrText || ''
        });
      }
      console.log(`[CACHE] ✓ Successfully loaded ${analysisCache.size} analysis results from disk`);
    } else {
      console.log(`[CACHE] No cache file found at ${cacheFilePath} - starting with empty cache`);
    }
  } catch (error) {
    console.error('[CACHE] Error loading cache from disk:', error);
  }
}

// Save cache to disk
function saveCacheToDisk(): void {
  try {
    console.log(`[CACHE] Saving ${analysisCache.size} entries to disk...`);
    const entries = Array.from(analysisCache.entries());
    fs.writeFileSync(cacheFilePath, JSON.stringify(entries, null, 2), 'utf-8');
    console.log(`[CACHE] ✓ Successfully saved cache to ${cacheFilePath}`);
  } catch (error) {
    console.error('[CACHE] Error saving cache to disk:', error);
  }
}

// Initialize cache on module load
loadCacheFromDisk();

// Normalize ingredients text for cache key - handles OCR variations
function normalizeTextForCaching(text: string): string {
  return text
    // Normalize whitespace (multiple spaces/newlines/tabs to single space)
    .replace(/\s+/g, ' ')
    // Trim leading/trailing whitespace
    .trim()
    // Normalize common character variations that OCR might produce
    .replace(/['']/g, "'")           // Various apostrophes to standard
    .replace(/[""]/g, '"')           // Various quotes to standard
    .replace(/[–—]/g, '-')           // Various dashes to standard hyphen
    // Lowercase for consistent comparison across OCR variations
    .toLowerCase();
}

// Calculate Levenshtein similarity between two strings (0-1, where 1 is identical)
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeTextForCaching(str1);
  const s2 = normalizeTextForCaching(str2);
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  const len1 = s1.length;
  const len2 = s2.length;
  const maxLen = Math.max(len1, len2);
  
  // Quick check: if lengths differ dramatically, skip
  if (Math.abs(len1 - len2) > maxLen * 0.2) return 0;
  
  // Calculate edit distance using dynamic programming
  const dp: number[][] = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));
  
  for (let i = 0; i <= len1; i++) dp[i][0] = i;
  for (let j = 0; j <= len2; j++) dp[0][j] = j;
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  
  const distance = dp[len1][len2];
  const similarity = 1 - (distance / maxLen);
  return similarity;
}

// Generate cache key from ingredient text, product type, and language
function getCacheKey(ingredientsText: string, productType: string, userLanguage: string): string {
  const normalizedText = normalizeTextForCaching(ingredientsText);
  const hash = crypto.createHash('sha256')
    .update(`${normalizedText}__${productType}__${userLanguage}`)
    .digest('hex');
  return hash;
}

// Check if cached analysis is still fresh (< 30 days)
function isCacheFresh(timestamp: number): boolean {
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  return (Date.now() - timestamp) < thirtyDaysMs;
}

// Get cached analysis result with fuzzy matching for OCR variations
function getCachedAnalysis(cacheKey: string, ingredientsText?: string, productType?: string, userLanguage?: string): AnalysisResult | null {
  // Try exact match first
  const cached = analysisCache.get(cacheKey);
  if (cached && isCacheFresh(cached.timestamp)) {
    console.log(`[CACHE] HIT (exact): returning cached analysis (${cached.result.ingredients.length} ingredients)`);
    return cached.result;
  }
  
  // If exact match fails and we have OCR text, try fuzzy matching against all cached entries
  if (ingredientsText && productType && userLanguage) {
    let bestMatch: AnalysisResult | null = null;
    let bestSimilarity = 0;
    const similarityThreshold = 0.85; // 85% similarity required
    
    for (const [cachedKey, cachedData] of Array.from(analysisCache.entries())) {
      // Only check entries for the same product type
      if (cachedData.result.productType !== productType) continue;
      
      // Skip if cache entry is stale
      if (!isCacheFresh(cachedData.timestamp)) continue;
      
      // NOW compare the actual OCR text, not the hashes
      const similarity = calculateSimilarity(ingredientsText, cachedData.ocrText);
      
      if (similarity > bestSimilarity && similarity >= similarityThreshold) {
        console.log(`[CACHE] Found fuzzy match (${(similarity * 100).toFixed(1)}% similar) for same product type`);
        bestSimilarity = similarity;
        bestMatch = cachedData.result;
      }
    }
    
    if (bestMatch && bestSimilarity >= similarityThreshold) {
      console.log(`[CACHE] HIT (fuzzy, ${(bestSimilarity * 100).toFixed(1)}% match): returning cached analysis (${bestMatch.ingredients.length} ingredients)`);
      return bestMatch;
    }
  }
  
  if (cached) {
    console.log(`[CACHE] Stale: analysis older than 30 days, will re-analyze`);
    analysisCache.delete(cacheKey);
  } else {
    console.log(`[CACHE] Miss: analysis not found (and no fuzzy match found)`);
  }
  return null;
}

// Store analysis result in cache (with original OCR text for fuzzy matching)
function cacheAnalysis(cacheKey: string, result: AnalysisResult, ocrText: string): void {
  analysisCache.set(cacheKey, {
    result,
    timestamp: Date.now(),
    ocrText
  });
  console.log(`[CACHE] STORED: analysis for ${result.ingredients.length} ingredients (OCR text: ${ocrText.length} chars)`);
  // Persist to disk immediately (synchronous) to ensure cache survives server restarts
  saveCacheToDisk();
}

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

// Extract simple ingredient list (just names) for batch splitting
function extractIngredientNames(ingredientsText: string): string[] {
  // Split by common separators
  const separators = /[,，;；\n•·∙\*]/;
  const items = ingredientsText.split(separators)
    .map(item => item.trim())
    .filter(item => item.length > 1 && item.length < 100)
    .filter(item => !/^(\d+|%|ml|g|oz|mg)/.test(item)); // Remove pure numbers/measurements
  
  return Array.from(new Set(items)); // Deduplicate
}

// Analyze a batch of ingredients in parallel
async function analyzeIngredientBatch(
  ingredientsText: string,
  productType: ProductType,
  userLanguage: string,
  estimatedCount: number,
  context: string,
  maxRetries: number = 3
): Promise<any> {
  const systemMessages = {
    'zh': "You are a helpful health and wellness assistant that analyzes product ingredients. Extract and analyze ingredients from the list. Always respond with valid JSON. All text in your response must be in Simplified Chinese (简体中文).",
    'en': "You are a helpful health and wellness assistant that analyzes product ingredients. Extract and analyze ingredients from the list. Always respond with valid JSON. All text in your response must be in English.",
    'es': "Eres un asistente de salud y bienestar que analiza ingredientes de productos. Extrae y analiza ingredientes de la lista. Siempre responde con JSON válido. Todo el texto en tu respuesta debe estar en español."
  };
  const systemMessage = systemMessages[userLanguage as keyof typeof systemMessages] || systemMessages['en'];
  const languageInstruction = LANGUAGE_INSTRUCTIONS[userLanguage as keyof typeof LANGUAGE_INSTRUCTIONS] || LANGUAGE_INSTRUCTIONS['en'];
  
  const tokensPerIngredient = userLanguage === 'zh' ? 110 : 140;
  const baseTokens = userLanguage === 'zh' ? 600 : 800;
  const maxCap = userLanguage === 'zh' ? 4500 : 6000;
  
  const estimatedTokensNeeded = Math.min(estimatedCount * tokensPerIngredient + baseTokens, maxCap);
  const maxTokens = Math.max(2500, estimatedTokensNeeded);
  
  const prompt = `You are a health-focused ingredient analyst. Analyze the following ingredient batch from a ${productType} product.

${languageInstruction}

Product Type Context: ${context}

Ingredient List:
${ingredientsText}

CRITICAL EXTRACTION RULES:
1. Extract EVERY SINGLE ingredient from the list above
2. If an ingredient appears multiple times, count it only ONCE (deduplicate)
3. Include ALL: additives, vitamins, minerals, preservatives, colors, emulsifiers, starches, sweeteners, oils, and flavorings
4. This batch contains approximately ${estimatedCount} ingredients
5. If an ingredient name has OCR errors, correct them to the proper chemical/ingredient name

For each ingredient, determine:
1. The ingredient name (clean, standardized format) - MUST be in the user's language
2. Risk level: "low" (safe), "moderate" (limited evidence/moderate concern), or "high" (known health risks)
3. A brief summary (1-2 sentences) explaining what it is and why it's flagged - MUST be in the user's language
4. Detailed explanation (2-3 sentences) with more context about health impacts - MUST be in the user's language

Return your analysis as JSON with this structure (ingredients array may be empty if batch has no valid ingredients):
{
  "productName": null,
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

  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
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
        max_completion_tokens: maxTokens,
        temperature: 0.3
      });
      
      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }
      
      const analysis = JSON.parse(content);
      return analysis;
    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries) {
        const waitTime = 1000 * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw lastError || new Error('Batch analysis failed');
}

export async function analyzeIngredients(
  productType: ProductType,
  ingredientsText: string,
  userLanguage: string = 'en'
): Promise<AnalysisResult> {
  console.log(`[ANALYZER] User language: ${userLanguage}`);
  console.log(`[ANALYZER] OCR text length: ${ingredientsText.length} characters`);
  
  // Check cache first before doing any processing
  const cacheKey = getCacheKey(ingredientsText, productType, userLanguage);
  const cachedResult = getCachedAnalysis(cacheKey, ingredientsText, productType, userLanguage);
  if (cachedResult) {
    return cachedResult;
  }
  console.log(`[CACHE] Miss: will perform fresh analysis`);
  
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
  
  // PARALLEL BATCH OPTIMIZATION: Split into smaller batches to parallelize API calls
  // 1 ingredient per batch for maximum parallelization - all ingredients run through GPT-5.1 simultaneously
  // This dramatically reduces total processing time by fully parallelizing API calls
  
  // Extract ingredient lines for batch splitting
  const ingredientLines = textToAnalyze
    .split(/[\n;；]/)
    .map(line => line.trim())
    .filter(line => line.length > 1);
  
  console.log(`[ANALYZER] Extracted ${ingredientLines.length} ingredient lines for parallel processing`);
  
  // Create batches of 1 ingredient each for maximum parallelization
  const batchSize = 1;
  const batches: string[] = [];
  
  for (let i = 0; i < ingredientLines.length; i += batchSize) {
    const batchLines = ingredientLines.slice(i, i + batchSize);
    batches.push(batchLines.join('\n'));
  }
  
  console.log(`[ANALYZER] Created ${batches.length} parallel batches (${batchSize} ingredient per batch)`);
  
  if (batches.length > 1) {
    // Use parallel batch processing for faster analysis
    console.log(`[TIMING] Sending ${batches.length} batches in parallel to GPT-4o...`);
    const parallelStartTime = Date.now();
    
    try {
      // Send all batches in parallel
      const batchPromises = batches.map((batchText, idx) => {
        const estimatedBatchCount = Math.ceil(estimatedIngredientCount / batches.length);
        console.log(`[ANALYZER] Batch ${idx + 1}/${batches.length} - ${batchText.split('\n').length} lines, ~${estimatedBatchCount} ingredients`);
        return analyzeIngredientBatch(
          batchText,
          productType,
          userLanguage,
          estimatedBatchCount,
          context
        );
      });
      
      const batchResults = await Promise.all(batchPromises);
      const parallelDuration = ((Date.now() - parallelStartTime) / 1000).toFixed(2);
      console.log(`[TIMING] All ${batches.length} batches completed in parallel in ${parallelDuration}s`);
      
      // Merge batch results
      const allIngredients: Ingredient[] = [];
      let productName: string | undefined = undefined;
      const riskLevels: RiskLevel[] = [];
      
      for (const batchResult of batchResults) {
        if (batchResult.productName && !productName) {
          productName = batchResult.productName;
        }
        
        if (batchResult.ingredients && Array.isArray(batchResult.ingredients)) {
          // Deduplicate by ingredient name (case-insensitive)
          for (const ing of batchResult.ingredients) {
            const exists = allIngredients.some(
              existing => existing.name.toLowerCase() === ing.name.toLowerCase()
            );
            if (!exists) {
              allIngredients.push(ing);
            }
          }
        }
        
        if (batchResult.overallRisk) {
          riskLevels.push(batchResult.overallRisk);
        }
      }
      
      // Determine overall risk (highest level from all batches)
      const riskOrder = { high: 3, moderate: 2, low: 1 };
      const overallRisk = riskLevels.length > 0
        ? (Object.keys(riskOrder) as RiskLevel[]).reduce((a, b) => 
            riskOrder[a] >= riskOrder[b] ? a : b
          )
        : 'moderate';
      
      const detectedCount = allIngredients.length;
      console.log(`[ANALYZER] Merged ${batches.length} batches into ${detectedCount} unique ingredients`);
      console.log(`[ANALYZER] Product name: ${productName || 'Not detected'}`);
      console.log(`[ANALYZER] Overall risk: ${overallRisk}`);
      
      // Validate merged result
      const mergedResult = {
        productType,
        productName: productName || undefined,
        ingredients: allIngredients,
        overallRisk,
        analyzedAt: new Date().toISOString(),
        originalText: ingredientsText
      };
      
      const validatedResult = analysisResultSchema.safeParse(mergedResult);
      if (!validatedResult.success) {
        console.error('Merged result validation failed:', validatedResult.error);
        throw new Error('Merged analysis did not match expected format');
      }
      
      // Cache the result before returning
      cacheAnalysis(cacheKey, validatedResult.data, ingredientsText);
      return validatedResult.data;
      
    } catch (parallelError: any) {
      console.error('[ANALYZER] Parallel batch processing failed:', parallelError.message);
      console.log('[ANALYZER] Falling back to single large batch analysis...');
      // Fall through to single batch processing below
    }
  }
  
  // FALLBACK: Single large batch processing (for small ingredient lists or if parallel fails)
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
      
      console.log('[TIMING] Sending request to OpenAI (Replit AI Integrations)...');
      const aiStartTime = Date.now();
      
      const systemMessages = {
        'zh': "You are a helpful health and wellness assistant that analyzes product ingredients. Extract and analyze EVERY ingredient from the list. Count each distinct ingredient only once (deduplicate). Always respond with valid JSON. All text in your response must be in Simplified Chinese (简体中文), regardless of the input language.",
        'en': "You are a helpful health and wellness assistant that analyzes product ingredients. Extract and analyze EVERY ingredient from the list. Count each distinct ingredient only once (deduplicate). Always respond with valid JSON. All text in your response must be in English, regardless of the input language.",
        'es': "Eres un asistente de salud y bienestar que analiza ingredientes de productos. Extrae y analiza TODOS los ingredientes de la lista. Cuenta cada ingrediente distinto solo una vez (deduplica). Siempre responde con JSON válido. Todo el texto en tu respuesta debe estar en español, sin importar el idioma de entrada."
      };
      const systemMessage = systemMessages[userLanguage as keyof typeof systemMessages] || systemMessages['en'];
      
      // Adjust max_tokens based on estimated ingredient count and language
      // With GPT-4o, use moderate limits for speed while ensuring completeness
      // Each ingredient needs ~120-150 tokens (name, risk, concise summary/details) in English/Spanish
      // Chinese needs ~100-120 tokens per ingredient due to higher token density
      const tokensPerIngredient = userLanguage === 'zh' ? 110 : 140;
      const baseTokens = userLanguage === 'zh' ? 600 : 800;
      const maxCap = userLanguage === 'zh' ? 4500 : 6000; // Lower cap for Chinese to improve speed
      
      const estimatedTokensNeeded = Math.min(estimatedIngredientCount * tokensPerIngredient + baseTokens, maxCap);
      const maxTokens = Math.max(2500, estimatedTokensNeeded);
      
      console.log(`[ANALYZER] Using max_completion_tokens: ${maxTokens} for language: ${userLanguage} (estimated ${estimatedIngredientCount} ingredients)`);
      
      // Use GPT-5.1 for superior ingredient analysis
      console.log('[ANALYZER] Calling GPT-5.1 for analysis');
      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
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
        max_completion_tokens: maxTokens,
        temperature: 0.3
      });
      console.log('[ANALYZER] GPT-5.1 succeeded');

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
      
      // Cache the result before returning (pass original OCR text for fuzzy matching)
      cacheAnalysis(cacheKey, validatedResult.data, ingredientsText);
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
        'permission_denied',
        'insufficient_quota',
        'quota'
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
  console.error('[ANALYZER] Final error:', lastError);
  
  // Provide user-friendly error messages based on error type
  if (lastError) {
    const errorStatus = (lastError as any).status || (lastError as any).code;
    const errorType = (lastError as any).type || '';
    const errorMessage = lastError.message || '';
    
    console.error('[ANALYZER] Error details for user:', {
      status: errorStatus,
      type: errorType,
      message: errorMessage
    });
    
    // Check for API key / auth errors first (most common issue)
    if (errorMessage.toLowerCase().includes('api key') || 
        errorMessage.toLowerCase().includes('unauthorized') ||
        errorMessage.toLowerCase().includes('authentication') ||
        errorStatus === 401) {
      throw new Error(`OpenAI API key issue: ${errorMessage}. Please verify your API key is valid and has appropriate permissions.`);
    }
    
    // Check for quota/billing errors
    if (errorMessage.toLowerCase().includes('quota') || 
        errorMessage.toLowerCase().includes('insufficient') ||
        errorStatus === 429) {
      throw new Error(`OpenAI account issue: ${errorMessage}. Please check your OpenAI account quota and billing status.`);
    }
    
    // Check for model not found
    if (errorMessage.toLowerCase().includes('model') || 
        errorMessage.toLowerCase().includes('gpt-5.1') ||
        errorStatus === 404) {
      throw new Error(`Model error: ${errorMessage}. GPT-5.1 may not be available in your OpenAI account. Contact OpenAI support or use a different model.`);
    }
    
    // Check for server errors (500, 502, 503)
    if (errorStatus === 500 || errorStatus === 502 || errorStatus === 503 || errorType === 'server_error') {
      throw new Error(`OpenAI server error (${errorStatus}). Please try again in a few moments.`);
    }
    
    // Check for timeout errors
    if (errorMessage.includes('timeout') || errorStatus === 'ETIMEDOUT') {
      throw new Error('Analysis timed out. OpenAI is experiencing high load. Please try again in a few moments.');
    }
    
    // Check for network errors
    if (errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
      throw new Error('Network error connecting to OpenAI. Please check your internet connection and try again.');
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
    
    // Generic fallback - include the actual error for debugging
    throw new Error(`Analysis failed: ${errorMessage}. This may be due to an API key issue, insufficient quota, or the GPT-5.1 model not being available in your account.`);
  }
  
  throw new Error('Failed to analyze ingredients after multiple attempts. Please try again.');
}

/**
 * Analyzes ingredients directly from an image using GPT-5.1 vision capability
 * Much faster than OCR + text analysis (single API call instead of two)
 * Caches results by image hash for instant repeat scans
 */
/**
 * Analyzes a SINGLE ingredient with risk assessment
 * This is used for streaming - one GPT call per ingredient
 * Checks cache first, calls GPT if needed, streams result immediately
 */
export async function analyzeSingleIngredient(
  ingredientName: string,
  productType: ProductType,
  userLanguage: string
): Promise<{ analysis: Ingredient; fromCache: boolean }> {
  // Create cache key for this specific ingredient
  const cacheKey = crypto.createHash('sha256')
    .update(`${ingredientName.toLowerCase().trim()}__${productType}__${userLanguage}`)
    .digest('hex');
  
  // Check cache first
  const cached = analysisCache.get(cacheKey);
  if (cached && isCacheFresh(cached.timestamp)) {
    console.log(`[SINGLE-INGREDIENT-CACHE] HIT: ${ingredientName}`);
    // Extract the first ingredient from cached result (should be this one ingredient)
    return {
      analysis: cached.result.ingredients[0] || {
        name: ingredientName,
        riskLevel: 'low',
        summary: 'Cached result',
        details: 'Previously analyzed'
      },
      fromCache: true
    };
  }
  
  console.log(`[SINGLE-INGREDIENT-ANALYZER] Analyzing: ${ingredientName}`);
  
  const context = PRODUCT_TYPE_CONTEXTS[productType];
  const languageInstruction = LANGUAGE_INSTRUCTIONS[userLanguage as keyof typeof LANGUAGE_INSTRUCTIONS] || LANGUAGE_INSTRUCTIONS['en'];
  
  const systemMessage = `You are a health and safety expert analyzing a single ingredient for a ${productType} product.
${languageInstruction}

Respond ONLY with valid JSON matching this exact structure:
{
  "name": "ingredient name",
  "riskLevel": "low" | "moderate" | "high",
  "summary": "2-3 sentence health summary",
  "details": "5-7 sentences with specific concerns and recommendations"
}`;

  const prompt = `Analyze this single ingredient for a ${productType} product:

Ingredient: ${ingredientName}

${context}

IMPORTANT: 
- Assess health/safety risks (allergies, toxins, hormonal effects, etc.)
- Be specific and factual
- If safe, explain why
- If concerning, explain the specific health risks`;

  try {
    console.log(`[SINGLE-INGREDIENT-ANALYZER] Calling GPT-5.1 for: ${ingredientName}`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
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
      max_completion_tokens: 500,
      temperature: 0.3
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from GPT');
    }
    
    const parsed = JSON.parse(content);
    const validatedResult = analysisResultSchema.pick({ ingredients: true }).parse({
      ingredients: [{ ...parsed, name: ingredientName }]
    });
    
    const ingredient = validatedResult.ingredients[0];
    console.log(`[SINGLE-INGREDIENT-ANALYZER] ✓ Analyzed: ${ingredientName} (${ingredient.riskLevel})`);
    
    // Cache the result
    const fullResult: AnalysisResult = {
      productType,
      ingredients: [ingredient],
      overallRisk: ingredient.riskLevel,
      analyzedAt: new Date().toISOString()
    };
    
    analysisCache.set(cacheKey, {
      result: fullResult,
      timestamp: Date.now(),
      ocrText: ingredientName
    });
    saveCacheToDisk();
    
    return {
      analysis: ingredient,
      fromCache: false
    };
    
  } catch (error: any) {
    console.error(`[SINGLE-INGREDIENT-ANALYZER] Error analyzing ${ingredientName}:`, error.message);
    // Return a safe default on error
    return {
      analysis: {
        name: ingredientName,
        riskLevel: 'moderate',
        summary: 'Unable to analyze this ingredient. Please check with product manufacturer.',
        details: 'Analysis temporarily unavailable. Please try again later.'
      },
      fromCache: false
    };
  }
}

export async function analyzeIngredientsFromImage(
  imageData: string,
  productType: ProductType,
  userLanguage: string
): Promise<AnalysisResult> {
  // Extract base64 if imageData includes the data URL prefix
  // Handle both "data:image/jpeg;base64,xxx" and just "xxx" formats
  let base64Only = imageData;
  let mimeType = 'image/jpeg'; // default
  
  if (imageData.startsWith('data:')) {
    // Parse data URL: "data:image/jpeg;base64,xxx"
    const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      base64Only = match[2];
      console.log(`[VISION-ANALYZER] Extracted base64 from data URL, mime type: ${mimeType}`);
    } else {
      console.warn('[VISION-ANALYZER] Malformed data URL, attempting to use as-is');
    }
  }
  
  // Create cache key from image hash
  const imageHash = crypto.createHash('sha256')
    .update(`${base64Only}__${productType}__${userLanguage}`)
    .digest('hex');
  
  // Check cache first
  const cached = analysisCache.get(imageHash);
  if (cached && isCacheFresh(cached.timestamp)) {
    console.log(`[VISION-CACHE] HIT: returning cached analysis (${cached.result.ingredients.length} ingredients)`);
    return cached.result;
  }
  console.log(`[VISION-CACHE] Miss: will perform fresh analysis`);
  
  const context = PRODUCT_TYPE_CONTEXTS[productType];
  const languageInstruction = LANGUAGE_INSTRUCTIONS[userLanguage as keyof typeof LANGUAGE_INSTRUCTIONS] || LANGUAGE_INSTRUCTIONS['en'];
  
  const prompt = `You are a health-focused ingredient analyst. Analyze the ingredient list visible in this product image for a ${productType} product.

${languageInstruction}

Product Type Context: ${context}

CRITICAL EXTRACTION RULES:
1. Extract EVERY SINGLE ingredient visible in the image
2. If an ingredient appears multiple times, count it only ONCE (deduplicate)
3. Include ALL: additives, vitamins, minerals, preservatives, colors, emulsifiers, starches, sweeteners, oils, and flavorings
4. If an ingredient name is unclear due to image quality, correct it to the proper chemical/ingredient name

For each ingredient, determine:
1. The ingredient name (clean, standardized format) - MUST be in the user's language
2. Risk level: "low" (safe), "moderate" (limited evidence/moderate concern), or "high" (known health risks)
3. A brief summary (1-2 sentences) explaining what it is and why it's flagged - MUST be in the user's language
4. Detailed explanation (2-3 sentences) with more context about health impacts - MUST be in the user's language

INGREDIENT NAME TRANSLATION REQUIREMENTS:
- ALWAYS translate ingredient names to the user's language accurately
- Use proper chemical/scientific names when translating
- Examples: "水" → "Water" (English) or "Agua" (Spanish), "甘油" → "Glycerin" (English) or "Glicerina" (Spanish)
- For unclear text, correct to the nearest valid ingredient name based on context
- NEVER leave ingredient names in the original language from the label
- NEVER invent ingredients that don't exist in the image

OTHER IMPORTANT NOTES:
- ALL text output (name, summary, details) must be in the user's selected language
- Extract the product name if visible (product name can stay in original language)
- Determine overall product risk (low/moderate/high) based on the worst ingredients
- Be friendly and clear in explanations, not alarmist
- If an ingredient is generally safe, mark it as "low" risk

Return your analysis as JSON with this structure:
{
  "productName": "Product name if visible or null",
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

  let lastError: Error | null = null;
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`[VISION-ANALYZER] Retry attempt ${attempt}/${maxRetries} due to: ${lastError?.message || 'unknown error'}`);
      }
      
      console.log('[TIMING] Sending image to GPT-5.1 Vision for direct analysis...');
      const aiStartTime = Date.now();
      
      const systemMessages = {
        'zh': "You are a helpful health and wellness assistant that analyzes product ingredients from images. Extract and analyze EVERY ingredient from the image. Count each distinct ingredient only once (deduplicate). Always respond with valid JSON. All text in your response must be in Simplified Chinese (简体中文), regardless of the input language.",
        'en': "You are a helpful health and wellness assistant that analyzes product ingredients from images. Extract and analyze EVERY ingredient from the image. Count each distinct ingredient only once (deduplicate). Always respond with valid JSON. All text in your response must be in English, regardless of the input language.",
        'es': "Eres un asistente de salud y bienestar que analiza ingredientes de productos desde imágenes. Extrae y analiza TODOS los ingredientes de la imagen. Cuenta cada ingrediente distinto solo una vez (deduplica). Siempre responde con JSON válido. Todo el texto en tu respuesta debe estar en español, sin importar el idioma de entrada."
      };
      const systemMessage = systemMessages[userLanguage as keyof typeof systemMessages] || systemMessages['en'];
      
      const tokensPerIngredient = userLanguage === 'zh' ? 110 : 140;
      const baseTokens = userLanguage === 'zh' ? 600 : 800;
      const maxCap = userLanguage === 'zh' ? 4500 : 6000;
      const estimatedTokensNeeded = Math.min(40 * tokensPerIngredient + baseTokens, maxCap); // Assume ~40 ingredients
      const maxTokens = Math.max(2500, estimatedTokensNeeded);
      
      console.log(`[VISION-ANALYZER] Using max_completion_tokens: ${maxTokens} for language: ${userLanguage}`);
      
      console.log('[VISION-ANALYZER] Calling GPT-5.1 Vision analysis');
      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          {
            role: "system",
            content: systemMessage
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Only}`
                }
              },
              {
                type: "text",
                text: prompt
              }
            ]
          }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: maxTokens,
        temperature: 0.3
      });
      console.log('[VISION-ANALYZER] GPT-5.1 Vision succeeded');
      
      const aiDuration = ((Date.now() - aiStartTime) / 1000).toFixed(2);
      const tokensUsed = response.usage?.total_tokens || 0;
      const completionTokens = response.usage?.completion_tokens || 0;
      console.log(`[TIMING] GPT-5.1 Vision analysis completed in ${aiDuration}s (${tokensUsed} tokens, ${completionTokens} completion)`);
      
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
        originalText: `[Image-based analysis - ${imageData.length} bytes]`
      });
      
      if (!validatedResult.success) {
        console.error('Validation failed:', validatedResult.error);
        console.error(`Received ${analysis.ingredients?.length || 0} ingredients before validation failed`);
        throw new Error('AI response did not match expected format');
      }
      
      const detectedCount = validatedResult.data.ingredients.length;
      console.log(`[VISION-ANALYZER] Successfully analyzed ${detectedCount} ingredients`);
      console.log(`[VISION-ANALYZER] Product name: ${validatedResult.data.productName || 'Not detected'}`);
      console.log(`[VISION-ANALYZER] Overall risk: ${validatedResult.data.overallRisk}`);
      
      // Cache the result (use extracted base64 for consistent cache key)
      analysisCache.set(imageHash, {
        result: validatedResult.data,
        timestamp: Date.now(),
        ocrText: `[Image-based analysis - ${base64Only.length} bytes]`
      });
      saveCacheToDisk();
      
      return validatedResult.data;
      
    } catch (error: any) {
      lastError = error;
      console.error(`[VISION-ANALYZER] Attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      const nonRetryableErrors = [
        'API key',
        'unauthorized',
        'forbidden',
        'invalid_request_error',
        'authentication_error',
        'permission_denied',
        'insufficient_quota',
        'quota'
      ];
      
      const shouldNotRetry = nonRetryableErrors.some(msg => 
        error.message.toLowerCase().includes(msg.toLowerCase())
      );
      
      if (shouldNotRetry) {
        console.log(`[VISION-ANALYZER] Non-retryable error detected, failing immediately`);
        break;
      }
      
      if (attempt < maxRetries) {
        const waitTime = 2000 * Math.pow(2, attempt - 1);
        console.log(`[VISION-ANALYZER] Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  console.error('[VISION-ANALYZER] All retry attempts exhausted');
  
  if (lastError) {
    const errorStatus = (lastError as any).status || (lastError as any).code;
    const errorMessage = lastError.message || '';
    
    console.error('[VISION-ANALYZER] Error details:', { status: errorStatus, message: errorMessage });
    
    // Check for API key / auth errors
    if (errorMessage.toLowerCase().includes('api key') || 
        errorMessage.toLowerCase().includes('unauthorized') ||
        errorStatus === 401) {
      throw new Error(`OpenAI API key issue: ${errorMessage}. Please verify your API key is valid.`);
    }
    
    // Check for quota/billing errors
    if (errorMessage.toLowerCase().includes('quota') || 
        errorMessage.toLowerCase().includes('insufficient')) {
      throw new Error(`OpenAI account issue: ${errorMessage}. Please check your quota and billing status.`);
    }
    
    // Check for model not found
    if (errorMessage.toLowerCase().includes('gpt-5.1') || errorStatus === 404) {
      throw new Error(`GPT-5.1 model error: ${errorMessage}. This model may not be available in your account.`);
    }
    
    if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      throw new Error('Image analysis is taking longer than expected. Please try again in a few moments.');
    }
    
    if (errorMessage.includes('rate limit')) {
      throw new Error('The AI service is currently busy. Please wait a minute and try again.');
    }
    
    if (errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
      throw new Error('Unable to connect to the AI service. Please check your internet connection and try again.');
    }
    
    throw new Error(`Image analysis failed: ${errorMessage}. This may be due to an API key issue or GPT-5.1 not being available in your account.`);
  }
  
  throw new Error('Failed to analyze image after multiple attempts. Please try again.');
}
