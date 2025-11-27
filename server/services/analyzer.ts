import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { openai } from '../openai';
import { analysisResultSchema, type ProductType, type AnalysisResult, type RiskLevel, type Ingredient } from '@shared/schema';
import { getCachedIngredientAnalysis, setCachedIngredientAnalysis } from './cache';

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

// Normalize ingredient name capitalization to title case for consistency
// For English/Spanish: "Title Case Format"
// For Chinese: leave as-is since it doesn't have capitalization rules
function normalizeIngredientCapitalization(name: string, language: string = 'en'): string {
  // Skip normalization for Chinese
  if (language === 'zh') {
    return name;
  }
  
  // For English and Spanish, convert to title case
  // Handle special cases like Roman numerals, abbreviations, etc.
  return name
    .toLowerCase()
    .split(' ')
    .map((word: string) => {
      // Skip very small connector words but capitalize most words
      const skipCapitalization = ['a', 'an', 'the', 'or', 'y', 'e', 'de', 'del', 'la', 'el'];
      if (skipCapitalization.includes(word) && word.length <= 2) {
        return word;
      }
      // Capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ')
    .replace(/^./, (char: string) => char.toUpperCase()); // Ensure first letter is always capitalized
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
// DISABLED: Full-result caching was causing stale risk data. Use ingredient-level caching only.
function cacheAnalysis(cacheKey: string, result: AnalysisResult, ocrText: string): void {
  // NO-OP: Caching disabled due to stale data issues with overallRisk calculation
  console.log(`[CACHE] Skipping full-result cache (using ingredient-level cache only)`);
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
    console.log('[EXPANDER] Starting SELECTIVE parenthetical expansion');
    console.log(`[EXPANDER] Input text length: ${text.length} chars`);
    
    if (!text || text.length === 0) {
      console.log('[EXPANDER] Empty input, returning as-is');
      return text;
    }
    
    let result = '';
    let stack: string[] = [];
    let expansionCount = 0;
    let skippedCount = 0;
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
        
        if (innerContent.length > 0) {
          const trimmedInner = innerContent.trim();
          
          // SELECTIVE EXPANSION: Only expand if it contains MULTIPLE items (has commas)
          // This is the key optimization - we're being conservative to avoid unnecessary processing
          const hasMultipleItems = /[,，、;；]/.test(trimmedInner);
          
          // Check if inner is a known alias/qualifier pattern (vitamin, certification, code, etc)
          const isVitaminAlias = /^(?:vitamin\s+[A-K][\d]*|vitamina\s+[A-K][\d]*|维生素\s*[A-K][\d]*)$/i.test(trimmedInner);
          const isCertification = /^(?:RSPO\s+certified|fair\s+trade(?:\s+certified)?|non-GMO(?:\s+project\s+verified)?|organic|bio|ecológico|有机|certified|kosher|halal)$/i.test(trimmedInner);
          const isNumberCode = /^[E\d]+$/i.test(trimmedInner);
          const isPercentage = /^\d+%$/.test(trimmedInner);
          const isKnownAlias = isVitaminAlias || isCertification || isNumberCode || isPercentage;
          
          // ONLY expand if:
          // 1. Has multiple items (contains comma/separator), OR
          // 2. Is a known non-alias pattern that adds ingredient info
          // Otherwise, keep as-is to save processing and avoid false expansions
          
          if (hasMultipleItems && !isKnownAlias) {
            // Expand: multiple items detected
            expansionCount++;
            result = restOfText + (restOfText && !restOfText.endsWith(',') && !restOfText.endsWith('，') ? ', ' : '') + innerContent;
            console.log(`[EXPANDER #${expansionCount}] Expanded (multiple items): "${parentToken}" → "${trimmedInner.substring(0, 40)}..."`);
          } else {
            // Skip: single item or known alias - keep parenthetical as-is
            skippedCount++;
            result = beforeParenTrimmed + '(' + innerContent + ')';
            console.log(`[EXPANDER] Skipped #${skippedCount}: "${parentToken}(...)" kept as-is (single item or known alias)`);
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
    
    console.log(`[EXPANDER] Completed: expanded ${expansionCount}, skipped ${skippedCount}`);
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
      
      console.log(`[ANALYZER] Using max_tokens: ${maxTokens} for language: ${userLanguage} (estimated ${estimatedIngredientCount} ingredients)`);
      console.log('[ANALYZER] Calling GPT-5.1 for fast analysis');
      
      // Use GPT-5.1 with no reasoning effort for fastest analysis
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
        reasoning_effort: "none"
      } as any);
      console.log('[ANALYZER] GPT-5.1 Instant mode succeeded');

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

/**
 * Parallel micro-batched ingredient analysis with intelligent caching
 * - Parses ingredients from OCR text
 * - Splits into batches of 5 ingredients
 * - Checks cache before calling GPT
 * - Processes all batches in parallel
 * - Merges cached + fresh results
 */
export async function analyzeIngredientsParallel(
  productType: ProductType,
  ingredientsText: string,
  userLanguage: string = 'en'
): Promise<AnalysisResult> {
  const startTime = Date.now();
  console.log(`[PARALLEL-ANALYZER] Starting micro-batched analysis for ${productType} in ${userLanguage}`);
  
  // Check full-text cache first (fastest path)
  const cacheKey = getCacheKey(ingredientsText, productType, userLanguage);
  const cachedResult = getCachedAnalysis(cacheKey, ingredientsText, productType, userLanguage);
  if (cachedResult) {
    console.log(`[PARALLEL-ANALYZER] Full-text cache HIT, returning immediately`);
    return cachedResult;
  }
  
  // Pre-process text
  const expandedText = expandParentheticalIngredients(ingredientsText);
  console.log(`[PARALLEL-ANALYZER] After expanding parentheticals: ${expandedText.length} chars`);
  
  // Extract ingredients section
  let textToAnalyze = expandedText;
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
      textToAnalyze = expandedText.substring(match.index + match[0].length);
      // Only trim at CONTAINS/ALLERGENS if it's clearly a separate section with enough content before it
      const endMarkers = [
        /MADE\s+IN\s+A\s+FACILITY/i, // "MADE IN A FACILITY..."
        /MAY\s+CONTAIN/i,              // "MAY CONTAIN..."
        /MADE\s+IN\s+/i,               // "MADE IN..." (generic)
        /CONTAINS\s+(SOYBEANS|WHEAT|MILK|EGG|PEANUT|TREE|NUT|FISH|SHELLFISH|SESAME|SOY)\s*[,:]/i, // Allergen declarations
        /ALLERGENS?\s*[:：]/i, /DIRECTIONS?\s*[:：]/i,
        /INSTRUCTIONS?\s*[:：]/i, /NUTRITION\s+FACTS?\s*[:：]/i, /MANUFACTURED BY/i,
        /PRODUCT OF/i, /含\s*[:：]/, /过敏原\s*[:：]/, /使用方法\s*[:：]/,
        /CONTIENE\s*[:：]/i, /MODO DE USO\s*[:：]/i
      ];
      for (const endMarker of endMarkers) {
        const endMatch = textToAnalyze.match(endMarker);
        // Require much longer content (100+ chars) before cutting to avoid premature truncation
        if (endMatch && endMatch.index !== undefined && endMatch.index > 100) {
          textToAnalyze = textToAnalyze.substring(0, endMatch.index);
          break;
        }
      }
      break;
    }
  }
  
  // Estimate ingredient count for better GPT context
  const commaCount = (textToAnalyze.match(/[,，]/g) || []).length + 1;
  const chineseSeparatorCount = (textToAnalyze.match(/[、]/g) || []).length + 1;
  const semicolonCount = (textToAnalyze.match(/[;；]/g) || []).length + 1;
  const validCounts = [
    commaCount > 1 ? commaCount : 0,
    chineseSeparatorCount > 1 ? chineseSeparatorCount : 0,
    semicolonCount > 1 ? semicolonCount : 0
  ].filter(c => c > 0);
  const estimatedCount = validCounts.length > 0 ? Math.min(Math.max(...validCounts), 150) : 20;
  console.log(`[PARALLEL-ANALYZER] Estimated ${estimatedCount} ingredients from separators`);
  
  // Helper function to join wrapped lines
  // Join lines that look like wrapped text (current ends with word, next starts lowercase/fragment)
  function joinWrappedLines(text: string): string {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const result: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const current = lines[i];
      
      // Skip structural markers and empty lines
      if (!current || isStructuralMarker(current)) {
        result.push(current);
        continue;
      }
      
      // Check if next line should be joined with current line
      let merged = current;
      let j = i + 1;
      
      while (j < lines.length) {
        const nextLine = lines[j];
        if (!nextLine) {
          j++;
          continue; // Skip empty lines
        }
        
        // Stop joining if we hit a structural marker, percentage, or bullet point
        if (isStructuralMarker(nextLine) || 
            nextLine.match(/^[\d.]+%/) ||
            nextLine.match(/^[•·∙\*]\s/)) {
          break;
        }
        
        // Join if current line ends with word/digit/CJK AND next line looks like continuation
        const endsWithWord = /[a-zA-Z0-9\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]$/.test(merged); // Support CJK endings too
        
        // Next line is a continuation if:
        // 1. Starts with a letter, digit, or CJK character - most wrapped words
        // 2. Is NOT a structural keyword or new ingredient marker
        // 3. Doesn't look like a label section (all caps with 2+ words is usually a new section)
        const nextStartsWithLetterOrDigit = /^[a-zA-Z0-9\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/.test(nextLine); // ASCII, CJK, Hiragana, Katakana
        const isNotKeyword = !nextLine.match(/^(AND|OR|WITH|CONTAINS|MADE|MAY|DIRECTIONS?|INSTRUCTIONS?|NUTRITION|INGREDIENTS?|ALLERGENS?|成分|其他|方向|说明)/i);
        const isNotAllCapsSection = !(nextLine.match(/^[A-Z\s]{4,}$/) && nextLine.split(/\s+/).length > 1);
        
        // Check: if it's longer than 2 chars and mostly word characters (ASCII, CJK, hyphens, apostrophes), it's likely a continued word
        // This regex now supports Chinese, Japanese, and ASCII letters
        const looksLikeContinuedWord = nextLine.length <= 50 && /^[\w\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\-'()（）]+(\s[\w\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\-'()（）]+)?$/.test(nextLine);
        
        const nextLooksLikeContinuation = nextStartsWithLetterOrDigit && isNotKeyword && (looksLikeContinuedWord || isNotAllCapsSection);
        
        // Only join if current ends with word AND next looks like continuation
        if (endsWithWord && nextLooksLikeContinuation) {
          merged = merged + ' ' + nextLine;
          j++;
        } else {
          break;
        }
      }
      
      result.push(merged);
      i = j - 1; // Skip the lines we merged
    }
    
    return result.join('\n');
  }
  
  // Helper function to filter out structural markers
  function isStructuralMarker(line: string): boolean {
    const upperLine = line.toUpperCase();
    
    // Filter out percent/quantity markers and section headers
    const structuralPatterns = [
      /^CONTAINS\s+[\d.]+%\s+(OR|LESS)/i,  // "CONTAINS 2% OR", "CONTAINS 1% LESS"
      /^LESS\s+OF:/i,                       // "LESS OF:"
      /^OF:\s+/i,                           // "OF:" alone
      /^OR\s+(LESS|MORE)/i,                 // "OR LESS", "OR MORE"
      /^CONTAINS\s+(EGG|MILK|SOY|WHEAT|PEANUT|TREE|NUT|FISH|SHELLFISH|SESAME)/i, // Allergen declarations
      /^CONTAINS:\s+(EGG|MILK|SOY|WHEAT)/i, // CONTAINS: declarations
      /^\d+%\s*(OR|AND|LESS)?\s*(MORE|LESS)?$/i, // Pure percentage
      /^(INGREDIENTS?|ALLERGENS?|DIRECTIONS?|INSTRUCTIONS?|MADE IN|MANUFACTURED)\.?$/i // Section headers
    ];
    
    return structuralPatterns.some(pattern => pattern.test(line));
  }
  
  // Pre-process to join wrapped lines
  const joinedText = joinWrappedLines(textToAnalyze);
  console.log(`[PARALLEL-ANALYZER] After joining wrapped lines: ${joinedText.length} chars`);
  console.log(`[PARALLEL-ANALYZER] Text preview: ${joinedText.substring(0, 200)}...`);
  
  // Parse individual ingredients by splitting on common separators
  // But NOT on any comma/separator between digits (e.g., "1,4-dicarboxylic" in chemical names)
  let textForSplitting = joinedText;
  
  // Temporarily replace all commas/separators between digits with a placeholder
  // Handles: ASCII comma, Arabic comma (،), Chinese comma (、), and spaces around them
  const digitSeparatorPattern = /(\d)\s*[,،、]\s*(?=\d)/g;  // digit + optional space + any comma + optional space + lookahead digit
  const placeholder = '\x00COMMA_PLACEHOLDER\x00';
  textForSplitting = textForSplitting.replace(digitSeparatorPattern, `$1${placeholder}`);
  
  const rawIngredients = textForSplitting
    .split(/[,،、;；\n]/)
    .map(ing => {
      // Restore the preserved commas/separators as ASCII commas
      return ing.replace(new RegExp(placeholder, 'g'), ',').trim();
    })
    .filter(ing => {
      // Exclude structural markers and non-ingredients
      if (ing.length < 2) return false;
      if (ing.match(/^[\d.]+%?$/)) return false; // Pure numbers/percentages
      if (isStructuralMarker(ing)) return false;
      if (ing.match(/^(and|or|with)$/i)) return false; // Common connectors
      
      // Remove section headers attached to ingredients (e.g., "其他微量成分:异丙醇" → "异丙醇")
      // Match patterns like "SectionHeader:ingredient" or "SectionHeader：ingredient" 
      const cleanedIng = ing.replace(/^[^:：]*([:：])\s*/, '').trim();
      if (cleanedIng.length < 2) return false;
      
      // Exclude facility/allergen statements (long phrases with "facility", "processes", "may contain", etc.)
      if (cleanedIng.match(/facility|process|manufacture|made in|may contain|allergen|cross-contact|equipment/i)) return false;
      if (cleanedIng.length > 40 && cleanedIng.match(/\s.{20,}/)) return false; // Very long phrases (usually not ingredients)
      
      return true;
    })
    .map(ing => ing.replace(/^[^:：]*([:：])\s*/, '').trim()) // Apply the same cleaning to returned ingredients
    .slice(0, 200); // Increase cap to 200 to handle larger ingredient lists
  
  if (rawIngredients.length === 0) {
    throw new Error('No valid ingredients found to analyze');
  }
  
  const uniqueIngredients = Array.from(new Set(rawIngredients));
  console.log(`[PARALLEL-ANALYZER] Extracted ${rawIngredients.length} raw ingredients, ${uniqueIngredients.length} unique`);
  console.log(`[PARALLEL-ANALYZER] ALL EXTRACTED INGREDIENTS:`);
  uniqueIngredients.forEach((ing, idx) => {
    console.log(`  ${idx + 1}. ${ing}`);
  });
  console.log(`[PARALLEL-ANALYZER] Sample ingredients: ${uniqueIngredients.slice(0, 5).join(', ')}`);
  
  // Create micro-batches of 5 ingredients
  const BATCH_SIZE = 5;
  const batches: string[][] = [];
  for (let i = 0; i < uniqueIngredients.length; i += BATCH_SIZE) {
    batches.push(uniqueIngredients.slice(i, i + BATCH_SIZE));
  }
  console.log(`[PARALLEL-ANALYZER] Created ${batches.length} batches of max ${BATCH_SIZE} ingredients each`);
  
  // Process all batches in parallel
  const context = PRODUCT_TYPE_CONTEXTS[productType];
  const languageInstruction = LANGUAGE_INSTRUCTIONS[userLanguage as keyof typeof LANGUAGE_INSTRUCTIONS] || LANGUAGE_INSTRUCTIONS['en'];
  
  const systemMessages = {
    'zh': "You are a helpful health and wellness assistant that analyzes product ingredients. Always respond with valid JSON. All text in your response must be in Simplified Chinese (简体中文).",
    'en': "You are a helpful health and wellness assistant that analyzes product ingredients. Always respond with valid JSON. All text in your response must be in English.",
    'es': "Eres un asistente de salud y bienestar que analiza ingredientes de productos. Siempre responde con JSON válido. Todo el texto en tu respuesta debe estar en español."
  };
  const systemMessage = systemMessages[userLanguage as keyof typeof systemMessages] || systemMessages['en'];
  
  const batchPromises = batches.map(async (batch, batchIdx) => {
    const batchStartTime = Date.now();
    console.log(`[PARALLEL-BATCH-${batchIdx}] Processing batch: ${batch.join(', ')}`);
    
    // Check cache for each ingredient
    const cachedResults: Array<{ name: string; cached: true; data: Ingredient }> = [];
    const missingIngredients: string[] = [];
    
    for (const ingredient of batch) {
      const cached = getCachedIngredientAnalysis(ingredient, productType);
      if (cached) {
        cachedResults.push({
          name: ingredient,
          cached: true,
          data: JSON.parse(cached.analysis)
        });
        console.log(`[PARALLEL-BATCH-${batchIdx}] Cache HIT: ${ingredient}`);
      } else {
        missingIngredients.push(ingredient);
        console.log(`[PARALLEL-BATCH-${batchIdx}] Cache MISS: ${ingredient}`);
      }
    }
    
    // If all cached, return immediately
    if (missingIngredients.length === 0) {
      console.log(`[PARALLEL-BATCH-${batchIdx}] All ingredients cached, returning ${cachedResults.length} results`);
      return cachedResults.map(r => r.data);
    }
    
    // Query GPT only for missing ingredients using Auraly framework
    const missingList = missingIngredients.map((ing, idx) => `${idx + 1}. ${ing}`).join('\n');
    
    // SIMPLIFIED prompt that GPT handles better
    // Get language code for display
    const languageMap: { [key: string]: string } = {
      'en': 'English',
      'zh': 'Chinese',
      'es': 'Spanish'
    };
    const displayLanguage = languageMap[userLanguage] || 'English';
    
    const batchPrompt = `The ingredient names below are in their source language (Chinese, Spanish, English, etc). Analyze each ingredient and TRANSLATE the ingredient name to ${displayLanguage}. Respond ONLY with the JSON array, nothing else:

[
  {
    "ingredient": "ingredient name translated to ${displayLanguage}",
    "category": "${productType}",
    "healthRisk": "High|Medium|Low",
    "allergen": true or false,
    "summary": "1-2 sentence explanation in ${displayLanguage}"
  }
]

Ingredients to analyze:
${missingList}`;
    
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: batchPrompt }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: Math.min(4000, missingIngredients.length * 400),
        reasoning_effort: "none"
      } as any);
      
      const content = response.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty GPT response');
      
      console.log(`[PARALLEL-BATCH-${batchIdx}] RAW GPT RESPONSE (first 500 chars):`, content.substring(0, 500));
      
      // Parse response - try both array and object with array key
      let freshResults: Ingredient[] = [];
      try {
        const parsed = JSON.parse(content);
        console.log(`[PARALLEL-BATCH-${batchIdx}] Parsed JSON type: ${typeof parsed}, is array: ${Array.isArray(parsed)}`);
        
        if (Array.isArray(parsed)) {
          freshResults = parsed;
          console.log(`[PARALLEL-BATCH-${batchIdx}] Using direct array: ${freshResults.length} items`);
        } else if (typeof parsed === 'object' && parsed !== null) {
          // Try to find array in object
          const keys = Object.keys(parsed);
          console.log(`[PARALLEL-BATCH-${batchIdx}] Object keys: ${keys.join(', ')}`);
          
          for (const key of keys) {
            const val = parsed[key];
            if (Array.isArray(val)) {
              freshResults = val as Ingredient[];
              console.log(`[PARALLEL-BATCH-${batchIdx}] Found array in key '${key}': ${freshResults.length} items`);
              break;
            }
          }
          if (freshResults.length === 0) {
            console.error(`[PARALLEL-BATCH-${batchIdx}] No array found in object. Using object as is.`);
            // Treat object as single-item array if it has ingredient field
            if (parsed.ingredient) {
              freshResults = [parsed];
              console.log(`[PARALLEL-BATCH-${batchIdx}] Treated object as single ingredient`);
            }
          }
        }
        
        console.log(`[PARALLEL-BATCH-${batchIdx}] After extraction: ${freshResults.length} items. First item:`, JSON.stringify(freshResults[0] || {}).substring(0, 100));
        
        if (freshResults.length === 0) {
          console.error(`[PARALLEL-BATCH-${batchIdx}] CRITICAL: No ingredients extracted from response`);
          console.error(`[PARALLEL-BATCH-${batchIdx}] Full parsed content:`, JSON.stringify(parsed).substring(0, 1000));
          throw new Error(`GPT returned empty array (${missingIngredients.length} ingredients to analyze)`);
        }
      } catch (parseError: any) {
        console.error(`[PARALLEL-BATCH-${batchIdx}] JSON parse FAILED:`, parseError.message);
        console.error(`[PARALLEL-BATCH-${batchIdx}] Full response content:`, content);
        throw new Error(`Invalid JSON from GPT: ${parseError.message}`);
      }
      
      // Map Auraly response fields: normalize and add legacy fields for backward compatibility
      freshResults = freshResults
        .filter(result => result && (result.ingredient || result.name)) // Filter invalid entries
        .map(result => {
          const ingredientName = normalizeIngredientCapitalization(
            (result.ingredient || result.name || '').trim(), 
            userLanguage
          );
          
          if (!ingredientName) {
            console.warn(`[PARALLEL-BATCH-${batchIdx}] Skipping empty ingredient`);
            return null;
          }
          
          // Convert healthRisk (High/Medium/Low) to legacy riskLevel (high/moderate/low)
          const healthRiskMap: Record<string, RiskLevel> = {
            'High': 'high',
            'Medium': 'moderate',
            'Low': 'low'
          };
          const legacyRiskLevel: RiskLevel = healthRiskMap[result.healthRisk as keyof typeof healthRiskMap] || 'moderate';
          
          return {
            ingredient: ingredientName,
            name: ingredientName,
            category: result.category || productType,
            healthRisk: result.healthRisk || 'Medium',
            riskLevel: legacyRiskLevel,
            allergen: result.allergen || false,
            dietaryFlags: result.dietaryFlags || {
              vegan: false,
              vegetarian: false,
              containsAnimalProducts: false,
              containsGluten: false,
              containsLactose: false,
              containsAddedSugars: false,
              ultraProcessedAdditive: false
            },
            summary: result.summary || 'No summary available',
            sourcesOrNotes: result.sourcesOrNotes,
            details: result.summary || 'No details available'
          };
        })
        .filter(result => result !== null) as Ingredient[];
      
      console.log(`[PARALLEL-BATCH-${batchIdx}] Mapped and filtered: ${freshResults.length} valid ingredients from ${cachedResults.length + missingIngredients.length} requested`);
      
      // Cache fresh results
      for (const result of freshResults) {
        const cacheKey = result.ingredient || result.name || '';
        setCachedIngredientAnalysis(cacheKey, productType, JSON.stringify(result));
        console.log(`[PARALLEL-BATCH-${batchIdx}] Cached: ${cacheKey}`);
      }
      
      const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(2);
      console.log(`[PARALLEL-BATCH-${batchIdx}] Completed in ${batchDuration}s: ${cachedResults.length} cached + ${freshResults.length} fresh`);
      
      // Return all results for this batch
      return [...cachedResults.map(r => r.data), ...freshResults];
    } catch (error) {
      console.error(`[PARALLEL-BATCH-${batchIdx}] Error:`, error);
      // Return at least cached results on error
      return cachedResults.map(r => r.data);
    }
  });
  
  // Wait for all batches to complete in parallel
  const allBatchResults = await Promise.all(batchPromises);
  const allIngredients = allBatchResults.flat();
  
  console.log(`[PARALLEL-ANALYZER] Merged ${allIngredients.length} total ingredients from ${batches.length} batches`);
  
  // Determine overall risk based on healthRisk field (ignore allergens per Auraly framework)
  const hasHigh = allIngredients.some(i => {
    const healthRisk = (i as any).healthRisk;
    return healthRisk === 'High' || i.riskLevel === 'high';
  });
  const hasModerate = allIngredients.some(i => {
    const healthRisk = (i as any).healthRisk;
    return healthRisk === 'Medium' || i.riskLevel === 'moderate';
  });
  const overallRisk: RiskLevel = hasHigh ? 'high' : (hasModerate ? 'moderate' : 'low');
  
  // Build final result
  const result: AnalysisResult = {
    productType,
    productName: null,
    ingredients: allIngredients,
    overallRisk,
    analyzedAt: new Date().toISOString(),
    originalText: ingredientsText
  };
  
  // Validate result
  const validated = analysisResultSchema.safeParse(result);
  if (!validated.success) {
    console.error('[PARALLEL-ANALYZER] Validation failed:', validated.error);
    throw new Error('AI response did not match expected format');
  }
  
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[PARALLEL-ANALYZER] Completed in ${totalDuration}s: ${allIngredients.length} ingredients, risk: ${overallRisk}`);
  
  // Cache full result before returning
  cacheAnalysis(cacheKey, validated.data, ingredientsText);
  return validated.data;
}
