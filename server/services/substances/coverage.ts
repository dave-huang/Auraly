import { substanceCoverageMisses } from '@shared/schema';
import { sql } from 'drizzle-orm';

/**
 * Coverage telemetry — the part that makes the corpus improve from use rather
 * than from heroic curation.
 *
 * Every ingredient we could not resolve, or resolved but hold no evidence on,
 * lands here with the name exactly as the label printed it. Ranked by how often
 * real people photograph it, this becomes the curation queue: you are always
 * working on the ingredients that actually appear in front of users, instead of
 * guessing which corner of the additive index to fill in next.
 *
 * Writes are best-effort and never block a scan. A telemetry failure must not
 * cost someone their answer.
 *
 * The database handle is imported lazily inside the flush, not at module load.
 * Classification is a pure function of the corpus and the rules, and it should
 * stay runnable without a database — that is what lets `substances:check` and
 * the eval harness classify ingredients offline.
 */

export interface CoverageMiss {
  inputName: string;
  domain: 'food' | 'cosmetic';
  reason: 'unresolved' | 'no_evidence';
  /** Set when identity resolved but the evidence corpus was empty. */
  substanceId?: string;
}

/** In-process buffer, flushed on an interval so a scan never waits on a write. */
const buffer: CoverageMiss[] = [];
let flushTimer: NodeJS.Timeout | null = null;
const FLUSH_INTERVAL_MS = 15_000;
const MAX_BUFFER = 500;

export function recordCoverageMiss(miss: CoverageMiss): void {
  // A pathological label should not grow the buffer without bound.
  if (buffer.length >= MAX_BUFFER) return;
  buffer.push(miss);
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flushCoverageMisses();
    }, FLUSH_INTERVAL_MS);
    // Never hold the process open for telemetry.
    flushTimer.unref?.();
  }
}

export async function flushCoverageMisses(): Promise<void> {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, buffer.length);

  // Collapse the batch so one scan of a 30-ingredient label is one row per
  // distinct name, with a count, rather than 30 near-identical inserts.
  const grouped = new Map<string, { miss: CoverageMiss; count: number }>();
  for (const miss of batch) {
    const key = `${miss.inputName.toLowerCase().trim()}|${miss.domain}|${miss.reason}`;
    const existing = grouped.get(key);
    if (existing) existing.count += 1;
    else grouped.set(key, { miss, count: 1 });
  }

  try {
    const { db } = await import('../../db');
    for (const { miss, count } of grouped.values()) {
      await db
        .insert(substanceCoverageMisses)
        .values({
          inputName: miss.inputName.trim(),
          normalizedName: miss.inputName.toLowerCase().trim(),
          domain: miss.domain,
          reason: miss.reason,
          substanceId: miss.substanceId ?? null,
          seenCount: count,
        })
        .onConflictDoUpdate({
          target: [
            substanceCoverageMisses.normalizedName,
            substanceCoverageMisses.domain,
            substanceCoverageMisses.reason,
          ],
          set: {
            seenCount: sql`${substanceCoverageMisses.seenCount} + ${count}`,
            lastSeenAt: new Date(),
          },
        });
    }
  } catch (error: any) {
    // Swallowed on purpose. Losing telemetry is acceptable; failing a scan is
    // not, and this runs detached from the request.
    console.warn(`[COVERAGE] Flush failed, dropping ${grouped.size} rows: ${error.message}`);
  }
}

/**
 * The curation queue: what to add to the corpus next, most-photographed first.
 */
export async function getCurationQueue(limit = 100): Promise<
  { inputName: string; domain: string; reason: string; seenCount: number; lastSeenAt: Date }[]
> {
  const { db } = await import('../../db');
  const rows = await db
    .select({
      inputName: substanceCoverageMisses.inputName,
      domain: substanceCoverageMisses.domain,
      reason: substanceCoverageMisses.reason,
      seenCount: substanceCoverageMisses.seenCount,
      lastSeenAt: substanceCoverageMisses.lastSeenAt,
    })
    .from(substanceCoverageMisses)
    .orderBy(sql`${substanceCoverageMisses.seenCount} DESC`)
    .limit(limit);
  return rows as any;
}
