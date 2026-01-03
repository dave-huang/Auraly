import { db } from '../db';
import { ingredientCache } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

let cacheHitCount = 0;
let cacheMissCount = 0;

function normalizeIngredient(ingredient: string): string {
  return ingredient
    .toLowerCase()
    .trim()
    .replace(/[,;]/g, '')
    .replace(/\s+/g, ' ');
}

function shouldRefreshCache(lastUpdated: Date | string): boolean {
  const now = Date.now();
  const twelveMonthsMs = 365 * 24 * 60 * 60 * 1000;
  const timestamp = lastUpdated instanceof Date ? lastUpdated.getTime() : new Date(lastUpdated).getTime();
  return (now - timestamp) > twelveMonthsMs;
}

export async function getCachedIngredientAnalysis(
  ingredient: string,
  category: string,
  language: string = 'en'
): Promise<{ analysis: string; fromCache: boolean } | null> {
  const normalizedIngredient = normalizeIngredient(ingredient);
  
  try {
    const result = await db.select()
      .from(ingredientCache)
      .where(and(
        eq(ingredientCache.ingredient, normalizedIngredient),
        eq(ingredientCache.category, category),
        eq(ingredientCache.language, language)
      ))
      .limit(1);
    
    if (result.length === 0) {
      console.log(`[CACHE] Miss: ${normalizedIngredient}__${category}__${language}`);
      cacheMissCount++;
      return null;
    }
    
    const entry = result[0];
    
    if (shouldRefreshCache(entry.lastUpdated)) {
      console.log(`[CACHE] Stale (12+ months): ${normalizedIngredient}__${category}__${language}`);
      cacheMissCount++;
      return null;
    }
    
    console.log(`[CACHE] Hit: ${normalizedIngredient}__${category}__${language}`);
    cacheHitCount++;
    return {
      analysis: entry.analysis,
      fromCache: true
    };
  } catch (error) {
    console.error('[CACHE] Error reading from database:', error);
    cacheMissCount++;
    return null;
  }
}

export async function setCachedIngredientAnalysis(
  ingredient: string,
  category: string,
  analysis: string,
  language: string = 'en'
): Promise<void> {
  const normalizedIngredient = normalizeIngredient(ingredient);
  const now = new Date();
  
  try {
    const existing = await db.select({ id: ingredientCache.id })
      .from(ingredientCache)
      .where(and(
        eq(ingredientCache.ingredient, normalizedIngredient),
        eq(ingredientCache.category, category),
        eq(ingredientCache.language, language)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      await db.update(ingredientCache)
        .set({ 
          analysis,
          lastUpdated: now
        })
        .where(eq(ingredientCache.id, existing[0].id));
    } else {
      await db.insert(ingredientCache).values({
        ingredient: normalizedIngredient,
        category,
        language,
        analysis,
        createdAt: now,
        lastUpdated: now
      });
    }
    
    console.log(`[CACHE] Stored: ${normalizedIngredient}__${category}__${language}`);
  } catch (error) {
    console.error('[CACHE] Error writing to database:', error);
  }
}

export async function batchAnalyzeIngredientsWithCache(
  ingredients: string[],
  category: string,
  analyzeFunction: (ingredient: string) => Promise<string>
): Promise<Array<{ ingredient: string; analysis: string; fromCache: boolean }>> {
  const uniqueIngredients = Array.from(new Set(ingredients.map(normalizeIngredient)));
  
  console.log(`[CACHE-BATCH] Processing ${uniqueIngredients.length} unique ingredients for category: ${category}`);
  
  const results = await Promise.all(
    uniqueIngredients.map(async (ingredient) => {
      try {
        const cached = await getCachedIngredientAnalysis(ingredient, category);
        if (cached) {
          return {
            ingredient,
            analysis: cached.analysis,
            fromCache: true
          };
        }
        
        console.log(`[CACHE-BATCH] Analyzing: ${ingredient}`);
        const analysis = await analyzeFunction(ingredient);
        
        await setCachedIngredientAnalysis(ingredient, category, analysis);
        
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

export async function clearExpiredCache(): Promise<number> {
  const twelveMonthsMs = 365 * 24 * 60 * 60 * 1000;
  const cutoffTime = new Date(Date.now() - twelveMonthsMs);
  
  try {
    const result = await db.delete(ingredientCache)
      .where(sql`${ingredientCache.lastUpdated} < ${cutoffTime}`)
      .returning({ id: ingredientCache.id });
    
    const deletedCount = result.length;
    if (deletedCount > 0) {
      console.log(`[CACHE-MAINTENANCE] Cleared ${deletedCount} expired entries`);
    }
    return deletedCount;
  } catch (error) {
    console.error('[CACHE] Error clearing expired entries:', error);
    return 0;
  }
}

export async function getCacheStats(): Promise<{ 
  totalEntries: number; 
  hitCount: number; 
  missCount: number; 
  hitRate: string;
}> {
  try {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(ingredientCache);
    
    const totalEntries = result[0]?.count ?? 0;
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
  } catch (error) {
    console.error('[CACHE] Error getting stats:', error);
    return {
      totalEntries: 0,
      hitCount: cacheHitCount,
      missCount: cacheMissCount,
      hitRate: '0.00%'
    };
  }
}

export async function getDetailedCacheStats(): Promise<{ total: number; fresh: number; stale: number }> {
  const twelveMonthsMs = 365 * 24 * 60 * 60 * 1000;
  const cutoffTime = new Date(Date.now() - twelveMonthsMs);
  
  try {
    const [totalResult, freshResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(ingredientCache),
      db.select({ count: sql<number>`count(*)` })
        .from(ingredientCache)
        .where(sql`${ingredientCache.lastUpdated} >= ${cutoffTime}`)
    ]);
    
    const total = totalResult[0]?.count ?? 0;
    const fresh = freshResult[0]?.count ?? 0;
    const stale = total - fresh;
    
    return { total, fresh, stale };
  } catch (error) {
    console.error('[CACHE] Error getting detailed stats:', error);
    return { total: 0, fresh: 0, stale: 0 };
  }
}

export async function clearAllCache(): Promise<number> {
  try {
    const result = await db.delete(ingredientCache)
      .returning({ id: ingredientCache.id });
    
    const count = result.length;
    console.log(`[CACHE-ADMIN] Cleared all ${count} cache entries`);
    return count;
  } catch (error) {
    console.error('[CACHE] Error clearing all cache:', error);
    return 0;
  }
}

export async function getAllCacheEntries(): Promise<Array<{
  key: string;
  ingredient: string;
  category: string;
  language: string;
  analysis: string;
  createdAt: number;
  lastUpdated: number;
}>> {
  try {
    const entries = await db.select().from(ingredientCache);
    
    return entries.map(entry => ({
      key: `${entry.ingredient}__${entry.category}__${entry.language}`,
      ingredient: entry.ingredient,
      category: entry.category,
      language: entry.language,
      analysis: entry.analysis,
      createdAt: entry.createdAt.getTime(),
      lastUpdated: entry.lastUpdated.getTime()
    }));
  } catch (error) {
    console.error('[CACHE] Error getting all entries:', error);
    return [];
  }
}

export async function getCacheEntryCount(): Promise<number> {
  try {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(ingredientCache);
    return result[0]?.count ?? 0;
  } catch (error) {
    console.error('[CACHE] Error getting entry count:', error);
    return 0;
  }
}
