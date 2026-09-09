import { db } from '../db';
import { ingredientCache } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * The shared ingredient cache. Cross-customer by design: an ingredient any
 * person scans is analysed once and read back by everybody after them.
 *
 * WHAT A ROW IS SAFE TO HOLD
 *
 * Population-level only. `applyProfileToAnalysis` runs later, in routes.ts,
 * never inside the analyzer, so nothing here has ever seen a profile and one
 * person's allergies cannot arrive in another person's verdict. Keep it that
 * way: the moment anything personal is cached under a shared key, this table
 * becomes a leak rather than a saving.
 *
 * WHY THE VERSION IS IN THE VALUE AND NOT THE KEY
 *
 * A cached level is only valid for the rules that decided it and the corpus
 * they read. The whole-label cache in analyzer.ts has always keyed on both;
 * this one did not, and for a long time a comment here and another in
 * policy.ts claimed otherwise. A rule change therefore retired one cache and
 * left the other serving the old answers for up to twelve months, which is
 * the precise failure the label key exists to prevent, with the added
 * unpleasantness that two people could get different levels for one
 * ingredient depending on who scanned it first.
 *
 * The version could have gone into the lookup key, which would have wanted a
 * column and a migration. It is in the stored value instead, and the read
 * treats a mismatch as a miss. That costs one indexed row read that gets
 * thrown away, and buys a table that heals itself: the miss falls through to
 * a fresh analysis, and the write UPDATEs the row in place. No generation of
 * orphans accumulates behind a version bump, which is what a key column would
 * have left to clean up.
 */

let cacheHitCount = 0;
let cacheMissCount = 0;

/**
 * The envelope a row's `analysis` column holds.
 *
 * Rows written before versioning hold a bare analysis string instead. They
 * parse as legacy, count as a miss, and are overwritten on the way past, so
 * there is nothing to migrate.
 */
interface CachedEnvelope {
  version: string;
  analysis: string;
}

function readEnvelope(stored: string): CachedEnvelope | null {
  try {
    const parsed = JSON.parse(stored);
    if (
      parsed && typeof parsed === 'object' &&
      typeof parsed.version === 'string' && typeof parsed.analysis === 'string'
    ) {
      return parsed as CachedEnvelope;
    }
  } catch {
    // Not JSON at all. Legacy, same as any other shape we do not recognise.
  }
  return null;
}

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
  language: string = 'en',
  /** POLICY_VERSION + corpus version. A row from any other is not a hit. */
  version?: string,
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
    
    const envelope = readEnvelope(entry.analysis);
    if (!envelope) {
      console.log(`[CACHE] Legacy (unversioned): ${normalizedIngredient}__${category}__${language}`);
      cacheMissCount++;
      return null;
    }
    if (version !== undefined && envelope.version !== version) {
      console.log(
        `[CACHE] Superseded: ${normalizedIngredient}__${category}__${language} ` +
        `(cached under ${envelope.version}, current ${version})`,
      );
      cacheMissCount++;
      return null;
    }

    console.log(`[CACHE] Hit: ${normalizedIngredient}__${category}__${language}`);
    cacheHitCount++;
    return {
      analysis: envelope.analysis,
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
  language: string = 'en',
  /** POLICY_VERSION + corpus version, stamped so a later read can check it. */
  version: string = 'unversioned',
): Promise<void> {
  const normalizedIngredient = normalizeIngredient(ingredient);
  const now = new Date();
  const stored = JSON.stringify({ version, analysis } satisfies CachedEnvelope);
  
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
          analysis: stored,
          lastUpdated: now
        })
        .where(eq(ingredientCache.id, existing[0].id));
    } else {
      await db.insert(ingredientCache).values({
        ingredient: normalizedIngredient,
        category,
        language,
        analysis: stored,
        createdAt: now,
        lastUpdated: now
      });
    }
    
    console.log(`[CACHE] Stored: ${normalizedIngredient}__${category}__${language}`);
  } catch (error) {
    console.error('[CACHE] Error writing to database:', error);
  }
}

/*
 * batchAnalyzeIngredientsWithCache lived here and nothing ever called it. It
 * was a second, simpler implementation of the read-then-analyse loop that
 * analyzer.ts already does properly, and it had drifted: no language in its
 * cache key and no version in it either, so anybody who had reached for it
 * would have got cross-language collisions on top of the staleness bug.
 * Deleted rather than repaired. One loop.
 */

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

/**
 * Every row, for the admin viewer.
 *
 * Unwraps the envelope so the viewer shows the analysis rather than the
 * storage format wrapped around it, and surfaces the version beside it, since
 * "which rules produced this" is the first thing worth knowing when a cached
 * level looks wrong. A row from before versioning reports itself as legacy.
 */
export async function getAllCacheEntries(): Promise<Array<{
  key: string;
  ingredient: string;
  category: string;
  language: string;
  version: string;
  analysis: string;
  createdAt: number;
  lastUpdated: number;
}>> {
  try {
    const entries = await db.select().from(ingredientCache);
    
    return entries.map(entry => {
      const envelope = readEnvelope(entry.analysis);
      return {
        key: `${entry.ingredient}__${entry.category}__${entry.language}`,
        ingredient: entry.ingredient,
        category: entry.category,
        language: entry.language,
        version: envelope ? envelope.version : 'legacy (unversioned)',
        analysis: envelope ? envelope.analysis : entry.analysis,
        createdAt: entry.createdAt.getTime(),
        lastUpdated: entry.lastUpdated.getTime()
      };
    });
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
