import zlib from 'zlib';

/**
 * Just enough of ZIP and XLSX to read a published spreadsheet, with no
 * dependency.
 *
 * The same reasoning as the CSV reader in adapter.ts. A snapshot script runs
 * by hand, a few times a year, over files a regulator publishes — and the cost
 * of a dependency that can reach the corpus is higher than the cost of the
 * hundred lines below. This reads; it never writes a spreadsheet.
 *
 * EFSA publishes OpenFoodTox as a single workbook with an 18-sheet relational
 * schema inside it, which is why this exists at all: there is no CSV to fetch.
 */

interface ZipEntry {
  name: string;
  data: Buffer;
}

/**
 * Read a ZIP archive from its central directory.
 *
 * Reading the directory rather than scanning local headers matters here: the
 * OpenFoodTox workbook streams its entries with sizes deferred to a data
 * descriptor, so the local headers carry zeroes and a naive scan reads nothing.
 */
export function readZip(buffer: Buffer): Map<string, Buffer> {
  const EOCD = 0x06054b50;
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0 && i > buffer.length - 66_000; i--) {
    if (buffer.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a ZIP archive: no end-of-central-directory record.');

  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map<string, Buffer>();

  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error(`Corrupt central directory at entry ${i}.`);
    }
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf-8');

    // The local header repeats the name and extra fields, at its own lengths.
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const raw = buffer.subarray(start, start + compressedSize);

    entries.set(name, method === 0 ? raw : zlib.inflateRawSync(raw, { maxOutputLength: 1 << 30 }));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function decodeXmlText(raw: string): string {
  return raw
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, '&');
}

/** The workbook's shared string table, indexed as cells reference it. */
function sharedStrings(entries: Map<string, Buffer>): string[] {
  const xml = entries.get('xl/sharedStrings.xml')?.toString('utf-8');
  if (!xml) return [];
  const out: string[] = [];
  for (const [, si] of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    // A shared string can be split across runs; the cell's value is all of them.
    let text = '';
    for (const [, t] of si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) text += t;
    out.push(decodeXmlText(text));
  }
  return out;
}

/** Sheet name → part path, from the workbook and its relationships. */
export function sheetIndex(entries: Map<string, Buffer>): Map<string, string> {
  const workbook = entries.get('xl/workbook.xml')?.toString('utf-8') ?? '';
  const rels = entries.get('xl/_rels/workbook.xml.rels')?.toString('utf-8') ?? '';
  const targets = new Map<string, string>();
  for (const [, id, target] of rels.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    targets.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target}`);
  }
  const sheets = new Map<string, string>();
  for (const [, name, id] of workbook.matchAll(/<sheet name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    const target = targets.get(id);
    if (target) sheets.set(decodeXmlText(name), target);
  }
  return sheets;
}

/**
 * Rows of one sheet, keyed by the header row's own labels.
 *
 * Cells are addressed by column letter rather than by position, because a
 * spreadsheet omits empty cells entirely — reading them in order silently
 * shifts every value after the first gap into the wrong column.
 */
export function readSheet(entries: Map<string, Buffer>, path: string): Record<string, string>[] {
  const xml = entries.get(path)?.toString('utf-8');
  if (!xml) throw new Error(`Sheet part not found: ${path}`);
  const strings = sharedStrings(entries);

  const parsed: Map<string, string>[] = [];
  for (const [, row] of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = new Map<string, string>();
    for (const [, attrs, body] of row.matchAll(/<c([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attrs.match(/r="([A-Z]+)\d+"/)?.[1];
      if (!ref) continue;
      const type = attrs.match(/t="([^"]+)"/)?.[1];
      const content = body ?? '';
      let value: string;
      if (type === 'inlineStr') {
        value = Array.from(content.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g), (m) => m[1]).join('');
        value = decodeXmlText(value);
      } else {
        const v = content.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '';
        value = type === 's' ? (strings[Number(v)] ?? '') : decodeXmlText(v);
      }
      if (value !== '') cells.set(ref, value);
    }
    parsed.push(cells);
  }

  const header = parsed.shift();
  if (!header) return [];
  return parsed.map((cells) => {
    const record: Record<string, string> = {};
    for (const [column, label] of header) {
      const value = cells.get(column);
      if (value !== undefined) record[label] = value;
    }
    return record;
  });
}
