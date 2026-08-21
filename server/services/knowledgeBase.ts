import fs from 'fs';
import path from 'path';
import { normalizeIngredientName } from './allergenMatcher';

// Cited ingredient knowledge base — the evidence layer behind risk claims.
// Loaded from server/data/knowledge-base.json (see its _metadata.reviewPolicy:
// ai_seeded entries need human review before marketing claims cite them).
// Distinct from services/substances, which decides population-level risk from
// regulatory evidence. That corpus answers "what level, and by which rule";
// this one supplies readable, cited claims to show alongside the answer. Neither
// overrides the other, and only the policy engine sets a level.

export interface KbSource {
  org: string;
  title: string;
  year?: number;
  url?: string;
}

export interface KbClaim {
  statement: string;
  riskContext: string; // 'general' | 'pregnancy' | 'children' | 'celiac' | ...
  sources: KbSource[];
}

export interface KbEntry {
  id: string;
  names: string[];
  category: string;
  appliesTo: string[];
  claims: KbClaim[];
  reviewStatus: 'ai_seeded' | 'human_reviewed';
  reviewedBy: string | null;
}

export interface Citation {
  entryId: string;
  statement: string;
  riskContext: string;
  sources: KbSource[];
  reviewStatus: KbEntry['reviewStatus'];
}

let entries: KbEntry[] = [];
const lookup = new Map<string, KbEntry>();

function load(): void {
  try {
    const kbPath = path.join(process.cwd(), 'server/data/knowledge-base.json');
    if (!fs.existsSync(kbPath)) {
      console.warn(`[KNOWLEDGE-BASE] Not found at ${kbPath}`);
      return;
    }
    const data = JSON.parse(fs.readFileSync(kbPath, 'utf-8'));
    entries = data.entries as KbEntry[];
    lookup.clear();
    for (const entry of entries) {
      for (const name of entry.names) {
        lookup.set(normalizeIngredientName(name), entry);
      }
    }
    console.log(`[KNOWLEDGE-BASE] Loaded ${entries.length} entries (${lookup.size} name variants), version ${data._metadata?.version}`);
    const unreviewed = entries.filter(e => e.reviewStatus !== 'human_reviewed').length;
    if (unreviewed > 0) {
      console.warn(`[KNOWLEDGE-BASE] ${unreviewed}/${entries.length} entries are ai_seeded and pending human review`);
    }
  } catch (error) {
    console.error('[KNOWLEDGE-BASE] Failed to load:', error);
  }
}

load();

export function findKbEntry(ingredientName: string): KbEntry | undefined {
  const n = normalizeIngredientName(ingredientName);
  if (!n) return undefined;

  const direct = lookup.get(n);
  if (direct) return direct;

  // Word-boundary containment: "titanium dioxide (ci 77891)" or
  // "retinyl palmitate ester" should still hit their entries. Longest-name
  // variants win to avoid overly generic matches.
  let best: { entry: KbEntry; len: number } | undefined;
  for (const [variant, entry] of Array.from(lookup.entries())) {
    if (variant.length < 3) continue;
    const rx = new RegExp(`(^| )${variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`);
    if (rx.test(n) && (!best || variant.length > best.len)) {
      best = { entry, len: variant.length };
    }
  }
  return best?.entry;
}

/**
 * Citations for an ingredient, optionally filtered to risk contexts
 * (e.g. ['general','pregnancy'] when a pregnancy profile is active).
 * Without a filter, only 'general' and 'children' claims are returned —
 * condition-specific claims (pregnancy, celiac) attach via profile flags.
 */
export function getCitations(ingredientName: string, contexts?: string[]): Citation[] {
  const entry = findKbEntry(ingredientName);
  if (!entry) return [];
  const allowed = contexts ?? ['general', 'children'];
  return entry.claims
    .filter(c => allowed.includes(c.riskContext))
    .map(c => ({
      entryId: entry.id,
      statement: c.statement,
      riskContext: c.riskContext,
      sources: c.sources,
      reviewStatus: entry.reviewStatus,
    }));
}
