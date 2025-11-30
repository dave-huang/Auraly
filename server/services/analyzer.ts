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

// Helper function to join wrapped lines (language-agnostic)
// Intelligently joins incomplete words/modifiers with next line
function joinWrappedLines(text: string): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const result: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i];
    
    // Skip if already added (was merged with previous)
    if (!currentLine) continue;
    
    // Check if this line should be merged with the next line
    if (i < lines.length - 1) {
      const nextLine = lines[i + 1];
      
      // Strip trailing punctuation for better detection logic
      const currentLineClean = currentLine.replace(/[,;:\[\]()]*$/, '').trim();
      
      // Case 1: Current line is a short modifier/adjective that should precede the next line
      // Examples: "DRIED" + "GARLIC FLAKE", "ROASTED" + "ONION POWDER", "FRESH" + "ORANGE"
      const shortModifiers = /^(DRIED|ROASTED|FRESH|GROUND|POWDERED|WHOLE|SLICED|CRUSHED|MINCED|COOKED|RAW|ORGANIC|NATURAL|PURE|LIQUID|EXTRACT|CONCENTRATE|SYRUP|JUICE|PASTE|PUREE|FLOUR|POWDER|FLAKES|CHIPS|BITS|GRANULES)$/i;
      if (shortModifiers.test(currentLineClean) && nextLine && !/^(CONTAINS|ALLERGENS|DIRECTIONS)/.test(nextLine)) {
        result.push(currentLine + ' ' + nextLine);
        i++; // Skip next line since we merged it
        continue;
      }
      
      // Case 2: Current line is very short (1-2 words) and doesn't look like a complete ingredient
      // Join with next line if next line looks like it could be continuation
      const wordCount = currentLineClean.split(/\s+/).length;
      const endsWithLetterOrNumber = /[a-zA-Z0-9]$/.test(currentLineClean);
      const nextStartsWithCapital = /^[A-Z]/.test(nextLine);
      
      if (wordCount <= 2 && endsWithLetterOrNumber && nextStartsWithCapital && 
          !/^(CONTAINS|ALLERGENS|DIRECTIONS|NUTRITION|MADE IN|PRODUCT OF)/.test(nextLine) &&
          !isStructuralMarker(currentLineClean)) {
        result.push(currentLine + ' ' + nextLine);
        i++; // Skip next line since we merged it
        continue;
      }
      
      // Case 3: Previous logic for lowercase continuations
      if (result.length > 0) {
        const lastLine = result[result.length - 1];
        const isWrappedContinuation = 
          /[a-zA-Z]$/.test(lastLine) && // Last line ends with letter
          /^[a-z]/.test(currentLine) && // Current line starts with lowercase
          !/^(CONTAINS|LESS|OF:|OR|AND|WITH|TO|IN|AS|IS)/.test(currentLine); // Not a structural marker
        
        if (isWrappedContinuation) {
          result[result.length - 1] = lastLine + ' ' + currentLine;
          continue;
        }
      }
    }
    
    // No merging needed, add line as-is
    if (currentLine) {
      result.push(currentLine);
    }
  }
  
  return result.join('\n');
}

// Helper function to filter out structural markers (language-agnostic)
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

// UNIFIED, LANGUAGE-AGNOSTIC ingredient extraction function
// Returns both the processed text for GPT and the extracted ingredients list
export function extractIngredientsFromText(ingredientsText: string): { ingredients: string[]; processedText: string; count: number } {
  console.log(`[EXTRACT] Starting language-agnostic ingredient extraction`);
  
  // Expand parenthetical ingredients
  const expandedText = expandParentheticalIngredients(ingredientsText);
  console.log(`[EXTRACT] After parenthetical expansion: ${expandedText.length} chars`);
  
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
      console.log(`[EXTRACT] Found marker: "${match[0]}"`);
      
      // Stop at next section markers (ONLY reliable section headers, not allergen statements)
      // CRITICAL: Don't use "CONTAINS" as end marker - allergen statements like "CONTAINS: SESAME" 
      // can appear mid-list and cause inconsistent ingredient extraction across languages
      const endMarkers = [
        /DIRECTIONS?\s*[:：]/i,
        /INSTRUCTIONS?\s*[:：]/i, 
        /NUTRITION\s+FACTS?\s*[:：]/i, 
        /MANUFACTURED\s+BY/i,
        /PRODUCT\s+OF/i, 
        /使用方法\s*[:：]/,
        /MODO\s+DE\s+USO\s*[:：]/i
      ];
      
      for (const endMarker of endMarkers) {
        const endMatch = textToAnalyze.match(endMarker);
        if (endMatch && endMatch.index !== undefined && endMatch.index > 20) {
          textToAnalyze = textToAnalyze.substring(0, endMatch.index);
          console.log(`[EXTRACT] Found end marker: "${endMatch[0]}"`);
          break;
        }
      }
      break;
    }
  }
  
  // Join wrapped lines
  const joinedText = joinWrappedLines(textToAnalyze);
  console.log(`[EXTRACT] After joining wrapped lines: ${joinedText.length} chars`);
  
  // Clean text before splitting: remove allergen fragments and bracket artifacts
  let cleanedText = joinedText;
  
  // Remove allergen statements that bled into ingredient list (e.g., ". CONTAINS: SOYBEANS")
  cleanedText = cleanedText.replace(/\.\s*CONTAINS\s*:\s*[^,;，；\n]+/gi, '');
  cleanedText = cleanedText.replace(/\.\s*含\s*[:：]\s*[^,;，；\n]+/, '');
  cleanedText = cleanedText.replace(/\.\s*CONTIENE\s*:\s*[^,;，；\n]+/gi, '');
  
  // CRITICAL FIX: Remove bracket specifiers that shouldn't create separate ingredients
  // Keep only the base ingredient name before brackets (e.g., "SOY SAUCE [SOYBEAN, WHEAT]" → "SOY SAUCE")
  // Also handle unclosed brackets: "SOY SAUCE [SOYBEAN, WHEAT" → "SOY SAUCE"
  // Only remove [...] patterns on single lines, don't remove entire sections
  cleanedText = cleanedText.replace(/\s*\[.*?\]/g, '');  // Remove complete [...] on same line
  cleanedText = cleanedText.replace(/\s*\[.*?$/gm, '');  // Remove unclosed [...text to line end 
  
  // Parse individual ingredients - CONSISTENT logic for all languages
  const rawIngredients = cleanedText
    .split(/[,，、;；\n]/)  // Split on common separators (English and Chinese)
    .map(ing => ing.trim())
    .map(ing => ing.replace(/^[.\s]+|[.\s]+$/g, ''))  // Remove leading/trailing dots and spaces
    .filter(ing => 
      ing.length > 2 && 
      !ing.match(/^[\d.]+%?$/) &&  // Filter out pure numbers/percentages
      !ing.match(/^(AND|OR)\s+\w+/) &&  // Filter out fragments like "AND MILK", "OR LESS"
      !isStructuralMarker(ing)     // Filter out structural markers
    )
    .slice(0, 150); // Cap at 150 to avoid huge batches
  
  if (rawIngredients.length === 0) {
    console.log(`[EXTRACT] No ingredients found`);
    return { ingredients: [], processedText: joinedText, count: 0 };
  }
  
  // Deduplicate
  const uniqueIngredients = Array.from(new Set(rawIngredients));
  console.log(`[EXTRACT] Extracted ${uniqueIngredients.length} unique ingredients (${rawIngredients.length} total before dedup)`);
  
  return { ingredients: uniqueIngredients, processedText: joinedText, count: uniqueIngredients.length };
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
    
    // CRITICAL: Strip all newlines from expanded text to prevent wrapped ingredient splitting
    // Example: "DRIED\nGARLIC" would be split into separate lines and extracted as two ingredients
    // Converting to "DRIED GARLIC" keeps them together as one ingredient
    return result.replace(/\n/g, ' ');
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
  
  // USE UNIFIED, LANGUAGE-AGNOSTIC EXTRACTION
  const extraction = extractIngredientsFromText(ingredientsText);
  if (extraction.count === 0) {
    throw new Error('No valid ingredients found to analyze. Please ensure the ingredient list is clearly visible.');
  }
  
  const estimatedIngredientCount = extraction.count;
  const processedText = extraction.processedText;
  console.log(`[ANALYZER] Extracted ${estimatedIngredientCount} unique ingredients for prompt`);
  
  const context = PRODUCT_TYPE_CONTEXTS[productType];
  const languageInstruction = LANGUAGE_INSTRUCTIONS[userLanguage as keyof typeof LANGUAGE_INSTRUCTIONS] || LANGUAGE_INSTRUCTIONS['en'];
  console.log(`[ANALYZER] Language instruction: ${languageInstruction.substring(0, 100)}...`);
  
  const prompt = `You are a health-focused ingredient analyst. Analyze the following ingredient list from a ${productType} product.

${languageInstruction}

Product Type Context: ${context}

Ingredient List (parenthetical groups have been pre-expanded):
${processedText}

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
      console.log(`[ANALYZER] Completeness check DISABLED. Detected: ${detectedCount}, Estimated: ${estimatedIngredientCount}`);
      
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
  userLanguage: string = 'en',
  preExtractedIngredients?: string[]
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
  
  // Use pre-extracted ingredients if provided (from extraction cache), otherwise extract now
  let uniqueIngredients: string[];
  if (preExtractedIngredients && preExtractedIngredients.length > 0) {
    console.log(`[PARALLEL-ANALYZER] Using ${preExtractedIngredients.length} pre-extracted ingredients (from extraction cache)`);
    uniqueIngredients = preExtractedIngredients;
  } else {
    console.log(`[PARALLEL-ANALYZER] Extracting ingredients on-demand (no pre-extraction provided)`);
    const extraction = extractIngredientsFromText(ingredientsText);
    if (extraction.count === 0) {
      throw new Error('No valid ingredients found to analyze');
    }
    uniqueIngredients = extraction.ingredients;
  }
  console.log(`[PARALLEL-ANALYZER] Using ${uniqueIngredients.length} unique ingredients for analysis`);
  
  // Reduce batch size for non-English languages (more prone to empty GPT responses)
  // Use batch size 1 for Chinese and Spanish to ensure success, batch size 3 for English
  const BATCH_SIZE = userLanguage === 'zh' || userLanguage === 'es' ? 1 : 3;
  const batches: string[][] = [];
  for (let i = 0; i < uniqueIngredients.length; i += BATCH_SIZE) {
    batches.push(uniqueIngredients.slice(i, i + BATCH_SIZE));
  }
  console.log(`[PARALLEL-ANALYZER] Created ${batches.length} batches of max ${BATCH_SIZE} ingredients each (batch size reduced for ${userLanguage})`);
  
  // Create fallback ingredient analysis function for failed batches
  // This ensures NO ingredients are lost, even if analysis fails
  // Provide language-appropriate fallback messages
  const fallbackMessages = {
    'en': {
      summary: 'Analysis temporarily unavailable',
      details: 'The ingredient analysis service is experiencing high load. This ingredient requires manual review.'
    },
    'es': {
      summary: 'Análisis temporalmente no disponible',
      details: 'El servicio de análisis de ingredientes está experimentando una carga alta. Este ingrediente requiere revisión manual.'
    },
    'zh': {
      summary: '分析暂时不可用',
      details: '成分分析服务目前负载较高。此成分需要人工审查。'
    }
  };
  
  function createFallbackIngredient(name: string): Ingredient {
    const msgs = fallbackMessages[userLanguage as keyof typeof fallbackMessages] || fallbackMessages['en'];
    return {
      name,
      riskLevel: 'moderate',
      summary: msgs.summary,
      details: msgs.details,
      category: productType
    };
  }
  
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
      const cached = getCachedIngredientAnalysis(ingredient, productType, userLanguage);
      if (cached) {
        cachedResults.push({
          name: ingredient,
          cached: true,
          data: JSON.parse(cached.analysis)
        });
        console.log(`[PARALLEL-BATCH-${batchIdx}] Cache HIT: ${ingredient} (${userLanguage})`);
      } else {
        missingIngredients.push(ingredient);
        console.log(`[PARALLEL-BATCH-${batchIdx}] Cache MISS: ${ingredient} (${userLanguage})`);
      }
    }
    
    // If all cached, return immediately
    if (missingIngredients.length === 0) {
      console.log(`[PARALLEL-BATCH-${batchIdx}] All ingredients cached, returning ${cachedResults.length} results`);
      return cachedResults.map(r => r.data);
    }
    
    // Query GPT only for missing ingredients
    const missingList = missingIngredients.map((ing, idx) => `${idx + 1}. ${ing}`).join('\n');
    const languageMap = { 'en': 'English', 'es': 'Spanish', 'zh': 'Simplified Chinese' };
    const targetLanguage = languageMap[userLanguage as keyof typeof languageMap] || 'English';
    
    const batchPrompt = `Analyze these ${missingIngredients.length} ingredients from a ${productType} product:

${missingList}

CRITICAL INSTRUCTIONS FOR ${targetLanguage.toUpperCase()}:
- ALL text (name, summary, details, category) MUST be in ${targetLanguage}
- Risk level MUST ALWAYS be exactly one of: "low" or "moderate" or "high" (ENGLISH ONLY, case sensitive, no translation)
- Return ONLY valid JSON array starting with [ and ending with ], no markdown, no code blocks, no extra text

For each ingredient provide these exact JSON fields:
{
  "name": "Ingredient Name in ${targetLanguage}",
  "riskLevel": "low",
  "summary": "1-2 sentences in ${targetLanguage}",
  "details": "2-3 sentences in ${targetLanguage}",
  "category": "Optional category in ${targetLanguage}"
}

${languageInstruction}

Product context: ${context}

IMPORTANT: Return ONLY this JSON array, nothing else:
[
  {
    "name": "Ingredient Name in ${targetLanguage}",
    "riskLevel": "low",
    "summary": "Brief explanation in ${targetLanguage}",
    "details": "Detailed explanation in ${targetLanguage}",
    "category": "Optional category in ${targetLanguage}"
  }
]`;
    
    // Retry logic for failed GPT calls
    const MAX_RETRIES = 3;
    let lastError: any = null;
    
    for (let retryAttempt = 0; retryAttempt < MAX_RETRIES; retryAttempt++) {
      try {
        // Allocate more tokens for non-English languages (need more space for detailed analysis)
        const tokensPerIngredient = (userLanguage === 'zh' || userLanguage === 'es') ? 350 : 200;
        const maxTokens = Math.min(3000, missingIngredients.length * tokensPerIngredient);
        
        const response = await openai.chat.completions.create({
          model: "gpt-5.1",
          messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: batchPrompt }
          ],
          max_completion_tokens: maxTokens,
          reasoning_effort: "none"
        } as any);
        
        const content = response.choices?.[0]?.message?.content;
        if (!content || content.trim().length === 0) {
          lastError = new Error('Empty GPT response');
          if (retryAttempt < MAX_RETRIES - 1) {
            console.log(`[PARALLEL-BATCH-${batchIdx}] Retry ${retryAttempt + 1}/${MAX_RETRIES} due to empty response`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryAttempt + 1))); // Exponential backoff
            continue;
          }
          throw lastError;
        }
        
        // Parse response - try both array and object with array key
        let freshResults: Ingredient[] = [];
        try {
          const parsed = JSON.parse(content);
          freshResults = Array.isArray(parsed) ? parsed : (Array.isArray(Object.values(parsed)[0]) ? Object.values(parsed)[0] as Ingredient[] : []);
          
          // Validate that we have results and all have required fields
          if (!freshResults || freshResults.length === 0) {
            console.error(`[PARALLEL-BATCH-${batchIdx}] GPT returned empty array`);
            throw new Error('GPT returned empty array');
          }
        } catch (parseError) {
          console.error(`[PARALLEL-BATCH-${batchIdx}] Failed to parse GPT response:`, content.substring(0, 200));
          throw new Error('Invalid JSON from GPT');
        }
        
        // Validate and normalize riskLevel to English enum (critical for Spanish fix)
        freshResults = freshResults.map(result => {
          let normalizedRiskLevel = result.riskLevel?.toLowerCase().trim() || 'moderate';
          
          // Map common Spanish values back to English
          if (normalizedRiskLevel === 'bajo') normalizedRiskLevel = 'low';
          if (normalizedRiskLevel === 'moderado') normalizedRiskLevel = 'moderate';
          if (normalizedRiskLevel === 'alto') normalizedRiskLevel = 'high';
          
          // Map common Chinese values back to English
          if (normalizedRiskLevel === '低') normalizedRiskLevel = 'low';
          if (normalizedRiskLevel === '中') normalizedRiskLevel = 'moderate';
          if (normalizedRiskLevel === '高') normalizedRiskLevel = 'high';
          
          // Ensure only English values
          if (!['low', 'moderate', 'high'].includes(normalizedRiskLevel)) {
            normalizedRiskLevel = 'moderate';
          }
          
          return {
            ...result,
            riskLevel: normalizedRiskLevel as 'low' | 'moderate' | 'high',
            name: normalizeIngredientCapitalization(result.name, userLanguage)
          };
        });
        
        // Cache fresh results with language tag
        for (const result of freshResults) {
          setCachedIngredientAnalysis(result.name, productType, JSON.stringify(result), userLanguage);
          console.log(`[PARALLEL-BATCH-${batchIdx}] Cached: ${result.name} (${userLanguage})`);
        }
        
        const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(2);
        console.log(`[PARALLEL-BATCH-${batchIdx}] Completed in ${batchDuration}s: ${cachedResults.length} cached + ${freshResults.length} fresh`);
        
        // Return all results for this batch
        return [...cachedResults.map(r => r.data), ...freshResults];
      } catch (error) {
        lastError = error;
        if (retryAttempt < MAX_RETRIES - 1) {
          console.log(`[PARALLEL-BATCH-${batchIdx}] Retry ${retryAttempt + 1}/${MAX_RETRIES}:`, (error as any).message);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryAttempt + 1))); // Exponential backoff
        }
      }
    }
    
    console.error(`[PARALLEL-BATCH-${batchIdx}] Failed after ${MAX_RETRIES} retries:`, lastError);
    // CRITICAL: Return cached + fallback for missing to ensure NO ingredients are lost
    const fallbackResults = missingIngredients.map(ing => createFallbackIngredient(ing));
    const allResults = [...cachedResults.map(r => r.data), ...fallbackResults];
    console.log(`[PARALLEL-BATCH-${batchIdx}] Returning ${cachedResults.length} cached + ${fallbackResults.length} fallback (total: ${allResults.length})`);
    return allResults;
  });
  
  // Wait for all batches to complete in parallel
  const allBatchResults = await Promise.all(batchPromises);
  const allIngredients = allBatchResults.flat();
  
  console.log(`[PARALLEL-ANALYZER] Merged ${allIngredients.length} total ingredients from ${batches.length} batches`);
  
  // Determine overall risk
  const hasHigh = allIngredients.some(i => i.riskLevel === 'high');
  const hasModerate = allIngredients.some(i => i.riskLevel === 'moderate');
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
