import type { EvidenceRecord, EvidenceSource } from '../evidence';
import type { Substance } from '../identity';

/**
 * The ingestion contract.
 *
 * Every source adapter takes a LOCAL SNAPSHOT FILE and returns substances and
 * evidence records. Adapters do not fetch: the download is a separate, manual,
 * auditable step, and the snapshot is committed alongside the records it
 * produced. That means an ingestion is reproducible months later, and a
 * regulator quietly rewording a page cannot silently change a classification.
 *
 * Each source publishes in its own shape and those shapes change. Rather than
 * guess at column names, every adapter declares the columns it needs and fails
 * loudly with what it actually found when they are missing — so a format change
 * surfaces as an ingestion error rather than as thousands of silently empty
 * records.
 */

export interface SnapshotMeta {
  /** Version or edition string as the publisher labels it, e.g. "2026-06". */
  version: string;
  /** ISO date the file was downloaded. */
  fetchedAt: string;
  /** Where it came from, for the audit trail. */
  url?: string;
}

export interface IngestResult {
  /** Substances to merge into the identity registry. */
  substances: Substance[];
  /** Evidence records produced. */
  records: EvidenceRecord[];
  /** Rows the adapter could not use, with the reason. Never silently dropped. */
  skipped: { row: number; reason: string; raw?: string }[];
  /**
   * Rows that WERE ingested, but where the adapter declined to draw a
   * conclusion it could have drawn — text it could not classify confidently.
   *
   * Separate from `skipped` because nothing was dropped: the record exists and
   * is correct as far as it goes. These are the judgement calls a person
   * should make, printed rather than buried, so "the rule could not decide"
   * never looks the same as "there was nothing there".
   */
  review?: { row: number; note: string; raw: string }[];
}

export interface SourceAdapter {
  source: EvidenceSource;
  /** Human name for logs. */
  label: string;
  /** File extensions this adapter accepts, e.g. ['.csv']. */
  accepts: string[];
  /**
   * Columns the adapter requires. Checked before any parsing so a format change
   * fails with a clear message instead of producing empty records.
   */
  requiredColumns: string[];
  parse: (rows: Record<string, string>[], meta: SnapshotMeta) => IngestResult;
}

export class MissingColumnsError extends Error {
  constructor(
    public readonly label: string,
    public readonly missing: string[],
    public readonly found: string[],
  ) {
    super(
      `${label}: snapshot is missing required column(s) ${missing.join(', ')}. ` +
        `Found: ${found.join(', ')}. The publisher's format has probably changed — ` +
        `update the adapter rather than the snapshot.`,
    );
    this.name = 'MissingColumnsError';
  }
}

export function assertColumns(
  adapter: SourceAdapter,
  rows: Record<string, string>[],
): void {
  const found = Object.keys(rows[0] ?? {});
  const missing = adapter.requiredColumns.filter((c) => !found.includes(c));
  if (missing.length > 0) {
    throw new MissingColumnsError(adapter.label, missing, found);
  }
}

/**
 * Minimal, dependency-free CSV reader that handles quoted fields and CRLF.
 *
 * `headerMustInclude` finds the real header when the publisher ships a
 * preamble above it — and they do. The Prop 65 CSV opens with eleven lines of
 * agency letterhead and two paragraphs of statute before its column row; the
 * CosIng annex exports carry a file-creation date and the annex title. Scanning
 * for a row that contains the columns the adapter needs also means the preamble
 * can grow or shrink between editions without breaking the ingest.
 */
export function parseCsv(
  text: string,
  opts: { headerMustInclude?: string[] } = {},
): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((cell) => cell.trim() !== ''));

  let headerIndex = 0;
  if (opts.headerMustInclude?.length) {
    const found = nonEmpty.findIndex((r) => {
      const cells = r.map((c) => c.trim().replace(/^﻿/, ''));
      return opts.headerMustInclude!.every((c) => cells.includes(c));
    });
    // Falling back to row 0 rather than throwing: assertColumns then reports
    // what it actually found, which is the diagnostic worth reading.
    headerIndex = found >= 0 ? found : 0;
  }

  const header = nonEmpty[headerIndex];
  const body = nonEmpty.slice(headerIndex + 1);
  if (!header) return [];
  // The BOM rides on the first cell of the first row and would otherwise become
  // part of that column's name, so the lookup silently misses.
  const keys = header.map((h) => h.trim().replace(/^﻿/, ''));
  return body.map((cells) => {
    const record: Record<string, string> = {};
    keys.forEach((key, index) => {
      record[key] = (cells[index] ?? '').trim();
    });
    return record;
  });
}

/** Build a stable substance id from a name, for sources without their own ids. */
export function slugifySubstanceId(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}
