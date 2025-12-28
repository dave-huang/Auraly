import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cacheDbPath = path.join(__dirname, '..', 'ingredient_cache.json');

// In-memory cache with file-based persistence
interface CacheEntry {
  analysis: string;
  lastUpdated: number;
  createdAt: number;
}

interface CacheData {
  [key: string]: CacheEntry;
}

let cacheData: CacheData = {};

// Runtime hit/miss counters (reset on server restart)
let cacheHitCount = 0;
let cacheMissCount = 0;

// Load cache from disk on startup
function loadCache(): void {
  try {
    if (fs.existsSync(cacheDbPath)) {
      const data = fs.readFileSync(cacheDbPath, 'utf-8');
      cacheData = JSON.parse(data);
      console.log(`[CACHE] Loaded ${Object.keys(cacheData).length} entries from disk`);
    }
  } catch (error) {
    console.error('[CACHE] Error loading cache from disk:', error);
    cacheData = {};
  }
}

// Save cache to disk
function saveCache(): void {
  try {
    fs.writeFileSync(cacheDbPath, JSON.stringify(cacheData, null, 2), 'utf-8');
  } catch (error) {
    console.error('[CACHE] Error saving cache to disk:', error);
  }
}

// Initialize cache
loadCache();

// Normalize ingredient name for cache keys
function normalizeIngredient(ingredient: string): string {
  return ingredient
    .toLowerCase()
    .trim()
    .replace(/[,;]/g, '')
    .replace(/\s+/g, ' ');
}

// Generate cache key including language for language-specific caching
function getCacheKey(ingredient: string, category: string, language: string = 'en'): string {
  return `${normalizeIngredient(ingredient)}__${category}__${language}`;
}

// Check if cache entry needs refresh (older than 12 months)
function shouldRefreshCache(lastUpdatedTimestamp: number): boolean {
  const now = Date.now();
  const twelveMonthsMs = 365 * 24 * 60 * 60 * 1000;
  return (now - lastUpdatedTimestamp) > twelveMonthsMs;
}

// Get cached ingredient analysis with language support
export function getCachedIngredientAnalysis(
  ingredient: string,
  category: string,
  language: string = 'en'
): { analysis: string; fromCache: boolean } | null {
  const key = getCacheKey(ingredient, category, language);
  const entry = cacheData[key];
  
  if (!entry) {
    console.log(`[CACHE] Miss: ${key}`);
    cacheMissCount++;
    return null;
  }
  
  // Check if cache is stale
  if (shouldRefreshCache(entry.lastUpdated)) {
    console.log(`[CACHE] Stale (12+ months): ${key}`);
    cacheMissCount++;
    return null;
  }
  
  console.log(`[CACHE] Hit: ${key}`);
  cacheHitCount++;
  return {
    analysis: entry.analysis,
    fromCache: true
  };
}

// Set/update cached ingredient analysis with language support
export function setCachedIngredientAnalysis(
  ingredient: string,
  category: string,
  analysis: string,
  language: string = 'en'
): void {
  const key = getCacheKey(ingredient, category, language);
  const now = Date.now();
  
  cacheData[key] = {
    analysis,
    lastUpdated: now,
    createdAt: cacheData[key]?.createdAt || now
  };
  
  // Persist to disk asynchronously
  setImmediate(() => saveCache());
  console.log(`[CACHE] Stored: ${key}`);
}

// Batch get/set with caching logic
export async function batchAnalyzeIngredientsWithCache(
  ingredients: string[],
  category: string,
  analyzeFunction: (ingredient: string) => Promise<string>
): Promise<Array<{ ingredient: string; analysis: string; fromCache: boolean }>> {
  // Deduplicate and normalize ingredients
  const uniqueIngredients = Array.from(new Set(ingredients.map(normalizeIngredient)));
  
  console.log(`[CACHE-BATCH] Processing ${uniqueIngredients.length} unique ingredients for category: ${category}`);
  
  // Process all ingredients in parallel
  const results = await Promise.all(
    uniqueIngredients.map(async (ingredient) => {
      try {
        // Check cache first
        const cached = getCachedIngredientAnalysis(ingredient, category);
        if (cached) {
          return {
            ingredient,
            analysis: cached.analysis,
            fromCache: true
          };
        }
        
        // Not cached or stale - analyze with AI
        console.log(`[CACHE-BATCH] Analyzing: ${ingredient}`);
        const analysis = await analyzeFunction(ingredient);
        
        // Store in cache for future use
        setCachedIngredientAnalysis(ingredient, category, analysis);
        
        return {
          ingredient,
          analysis,
          fromCache: false
        };
      } catch (error) {
        console.error(`[CACHE-BATCH] Error analyzing ${ingredient}:`, error);
        throw new Error(`Failed to analyze ingredient "${ingredient}": ${(error as any).message}`);
      }
    })
  );
  
  return results;
}

// Clear expired cache entries
export function clearExpiredCache(): number {
  const twelveMonthsMs = 365 * 24 * 60 * 60 * 1000;
  const cutoffTime = Date.now() - twelveMonthsMs;
  
  let deletedCount = 0;
  for (const [key, entry] of Object.entries(cacheData)) {
    if (entry.lastUpdated < cutoffTime) {
      delete cacheData[key];
      deletedCount++;
    }
  }
  
  if (deletedCount > 0) {
    saveCache();
    console.log(`[CACHE-MAINTENANCE] Cleared ${deletedCount} expired entries`);
  }
  
  return deletedCount;
}

// Get cache statistics (matching frontend CacheStats interface)
export function getCacheStats(): { 
  totalEntries: number; 
  hitCount: number; 
  missCount: number; 
  hitRate: string;
} {
  const totalEntries = Object.keys(cacheData).length;
  const totalLookups = cacheHitCount + cacheMissCount;
  const hitRate = totalLookups > 0 
    ? ((cacheHitCount / totalLookups) * 100).toFixed(2) + '%' 
    : '100.00%';
  
  return {
    totalEntries,
    hitCount: cacheHitCount,
    missCount: cacheMissCount,
    hitRate
  };
}

// Get detailed cache statistics (legacy)
export function getDetailedCacheStats(): { total: number; fresh: number; stale: number } {
  const twelveMonthsMs = 365 * 24 * 60 * 60 * 1000;
  const cutoffTime = Date.now() - twelveMonthsMs;
  
  let fresh = 0;
  let stale = 0;
  
  for (const entry of Object.values(cacheData)) {
    if (entry.lastUpdated > cutoffTime) {
      fresh++;
    } else {
      stale++;
    }
  }
  
  return {
    total: Object.keys(cacheData).length,
    fresh,
    stale
  };
}

// Clear ALL cache entries (for admin use when prompts change)
export function clearAllCache(): number {
  const count = Object.keys(cacheData).length;
  cacheData = {};
  saveCache();
  console.log(`[CACHE-ADMIN] Cleared all ${count} cache entries`);
  return count;
}

// Get all cache entries for admin viewing
export function getAllCacheEntries(): Array<{
  key: string;
  ingredient: string;
  category: string;
  language: string;
  analysis: string;
  createdAt: number;
  lastUpdated: number;
}> {
  return Object.entries(cacheData).map(([key, entry]) => {
    // Parse key format: ingredient__category__language
    const parts = key.split('__');
    const ingredient = parts[0] || key;
    const category = parts[1] || 'unknown';
    const language = parts[2] || 'en';
    
    return {
      key,
      ingredient,
      category,
      language,
      analysis: entry.analysis,
      createdAt: entry.createdAt,
      lastUpdated: entry.lastUpdated
    };
  });
}
