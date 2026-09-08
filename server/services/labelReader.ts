import { z } from 'zod';
import { gemini } from '../gemini';
import { openai } from '../openai';
import { extractTextWithGoogleVision } from './googleVisionOcr';
import { extractIngredientsFromText } from './analyzer';

// Multimodal-first label reading: one vision-model call extracts, translates,
// and structures the ingredient list straight from the photo — replacing the
// legacy OCR → regex-extraction → translation chain. The analysis stage
// (analyzer.ts) is unchanged and consumes this service's English ingredient
// names, so its per-ingredient cache keys stay stable.
//
// Three readers are implemented here; only OpenAI is called. See
// DEFAULT_PROVIDER_CHAIN below for why, and for how to turn the others back on.

const VISION_MODEL_OPENAI = process.env.LABEL_VISION_MODEL_OPENAI || 'gpt-5.6-luna';
const VISION_MODEL_GEMINI = process.env.LABEL_VISION_MODEL_GEMINI || 'gemini-3-flash-preview';

export interface LabelReadResult {
  /** Verbatim transcription of the ingredient-list section (original language) */
  rawText: string;
  /** Canonical English ingredient names, in label order, deduplicated */
  ingredients: string[];
  /** Ingredient names as printed on the label (original language) */
  ingredientsOriginal: string[];
  productName?: string;
  /** BCP-47-ish language code of the label text, e.g. "en", "zh", "ja" */
  sourceLanguage?: string;
  confidence: 'high' | 'medium' | 'low';
  /**
   * The reader's own account of the ingredient block: how many printed lines
   * it saw, and how many it transcribed with full confidence. Self-reported —
   * a vision model counting its own work is the only source available — so it
   * must be presented as the reader describing itself, never as measurement.
   * Absent on the OCR fallback, which cannot report it.
   */
  lineCount?: { read: number; total: number };
  method: 'multimodal-gemini' | 'multimodal-openai' | 'ocr-fallback';
  /**
   * The label's OWN allergen declaration, kept separate from ingredients.
   * Critical: many labels declare an allergen that no ingredient name
   * reveals — e.g. "Lecithin" with a separate "contains soy" line. Reading
   * allergens from ingredient names alone silently misses those.
   * `mayContain` is cross-contamination only and must never be treated as
   * present.
   */
  declaredAllergens: { contains: string[]; mayContain: string[] };
}

const labelExtractionSchema = z.object({
  label_found: z.boolean(),
  product_name: z.string().nullish(),
  source_language: z.string().nullish(),
  raw_ingredients_text: z.string().default(''),
  ingredients: z.array(z.object({
    original: z.string(),
    english: z.string(),
  })).default([]),
  declared_allergens: z.object({
    contains: z.array(z.string()).default([]),
    may_contain: z.array(z.string()).default([]),
  }).default({ contains: [], may_contain: [] }),
  confidence: z.enum(['high', 'medium', 'low']).default('medium'),
  lines_total: z.number().int().min(0).nullish(),
  lines_read: z.number().int().min(0).nullish(),
});

export const EXTRACTION_PROMPT = `You are reading a photo of a consumer product (food, skincare, or personal care) to extract its ingredient list. The label may be curved, glossy, partially obscured, poorly lit, or in any language.

Return ONLY a JSON object with this exact shape:
{
  "label_found": boolean,        // true only if an ingredient list is actually legible in the image
  "product_name": string|null,   // product name if visible on packaging, else null
  "source_language": string|null,// ISO 639-1 code of the ingredient list text (e.g. "en", "zh", "ja", "es")
  "raw_ingredients_text": string,// verbatim transcription of the ingredient list section, original language, preserving order and parentheses
  "ingredients": [               // one entry per distinct ingredient, in label order
    { "original": string,        // name exactly as printed (original language)
      "english": string }        // canonical English name (translate if needed; expand common E-numbers to their name, e.g. "E330" -> "Citric Acid")
  ],
  "declared_allergens": {        // the label's OWN allergen statements, if any
    "contains": [string],        // declared as PRESENT, e.g. "Contains: milk, soy" / "含有大豆制品" / "過敏原資訊：本產品含有..."
    "may_contain": [string]      // cross-contamination only, e.g. "May contain traces of nuts" / "本生产线也生产..." / "может содержать"
  },
  "confidence": "high"|"medium"|"low", // how certain you are the transcription is complete and correct
  "lines_total": number,         // printed lines of text in the ingredient-list block, as laid out on the packaging
  "lines_read": number           // of those, how many you transcribed with FULL confidence (<= lines_total)
}

Rules:
- Extract ONLY ingredients. Exclude allergen statements ("Contains:", "May contain:"), nutrition facts, directions, addresses, marketing text, expiry dates, and net weight.
- Functional annotations and processing notes are NOT ingredients: skip standalone entries like "[Emulsifier]", "(Preservative)", "Processed with Alkali", "(Color)" — but keep the ingredient they describe.
- Flatten sub-ingredients in parentheses/brackets into their own entries (e.g. "Peanut Butter (Peanuts, Salt)" -> "Peanut Butter", "Peanuts", "Salt").
- Deduplicate: if the same ingredient appears twice, list it once.
- Do NOT guess ingredients that are not legible. If the list is cut off, transcribe what is visible and set confidence accordingly.
- If no ingredient list is legible anywhere in the image, set label_found=false and leave ingredients empty.
- Allergen statements stay OUT of "ingredients" and go in "declared_allergens" instead. Use lowercase canonical English allergen names where they map to common allergens (milk, egg, fish, shellfish, tree nuts, peanut, wheat, soy, sesame); otherwise use the plain English term.
- Distinguishing "contains" from "may contain" matters: only put an allergen in "contains" when the label states it is present, and in "may_contain" when the label hedges (traces, shared line/equipment, "may contain").
- If the same product's label is printed in more than one language, read them together and merge into ONE deduplicated result — do not list an ingredient twice because it appears in two scripts.
- Count lines as they are printed on the package, not as you reformat them. If a line is partly obscured, blurred, or cut off, it counts toward lines_total but NOT toward lines_read.
- No prose, no markdown fences — the JSON object only.`;

/**
 * Sanity-check the model's self-reported line counts.
 *
 * The model can and does return nonsense here — read greater than total, or
 * zeroes — and a confidence meter reading "31 of 4 lines" would discredit
 * everything around it. Anything incoherent is dropped rather than repaired,
 * so the meter simply omits counts instead of showing invented ones.
 */
function toLineCount(read?: number | null, total?: number | null): LabelReadResult['lineCount'] {
  if (typeof read !== 'number' || typeof total !== 'number') return undefined;
  if (total <= 0 || read < 0 || read > total) return undefined;
  return { read, total };
}

function parseModelJson(text: string): z.infer<typeof labelExtractionSchema> {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return labelExtractionSchema.parse(JSON.parse(cleaned));
}

function toResult(
  parsed: z.infer<typeof labelExtractionSchema>,
  method: LabelReadResult['method']
): LabelReadResult {
  if (!parsed.label_found || parsed.ingredients.length === 0) {
    throw new NoLabelFoundError();
  }
  const seen = new Set<string>();
  const ingredients: string[] = [];
  const ingredientsOriginal: string[] = [];
  for (const ing of parsed.ingredients) {
    const key = ing.english.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    ingredients.push(ing.english.trim());
    ingredientsOriginal.push(ing.original.trim());
  }
  return {
    rawText: parsed.raw_ingredients_text || ingredientsOriginal.join(', '),
    ingredients,
    ingredientsOriginal,
    productName: parsed.product_name || undefined,
    sourceLanguage: parsed.source_language || undefined,
    confidence: parsed.confidence,
    lineCount: toLineCount(parsed.lines_read, parsed.lines_total),
    method,
    declaredAllergens: {
      contains: parsed.declared_allergens.contains.map(a => a.trim()).filter(Boolean),
      mayContain: parsed.declared_allergens.may_contain.map(a => a.trim()).filter(Boolean),
    },
  };
}

// The one scan failure that is the user's to fix rather than ours, so it
// carries a machine-readable code. The message stays as an English fallback for
// logs and API consumers; the app matches on `code` and writes the sentence
// itself, in the user's language.
export class NoLabelFoundError extends Error {
  readonly code = 'no_label_found';
  constructor() {
    super('No ingredients found in image. Please ensure the ingredient list is clearly visible and try again.');
    this.name = 'NoLabelFoundError';
  }
}

function splitDataUrl(imageData: string): { mimeType: string; base64Data: string } {
  const match = imageData.match(/^data:(image\/\w+);base64,/);
  return {
    mimeType: match ? match[1] : 'image/jpeg',
    base64Data: imageData.replace(/^data:image\/\w+;base64,/, ''),
  };
}

const geminiConfigured = () =>
  Boolean(process.env.GEMINI_API_KEY ||
    (process.env.AI_INTEGRATIONS_GEMINI_API_KEY && process.env.AI_INTEGRATIONS_GEMINI_BASE_URL));

async function readWithGemini(imageData: string): Promise<LabelReadResult> {
  const { mimeType, base64Data } = splitDataUrl(imageData);
  const response = await gemini.models.generateContent({
    model: VISION_MODEL_GEMINI,
    contents: [{
      role: 'user',
      parts: [
        { text: EXTRACTION_PROMPT },
        { inlineData: { mimeType, data: base64Data } },
      ],
    }],
    config: {
      // Dense labels (60+ ingredients, dual-language) produce large JSON, and
      // Gemini 3 thinking tokens count against maxOutputTokens — budget both,
      // and cap thinking (transcription is perception-bound, not reasoning).
      maxOutputTokens: 16384,
      thinkingConfig: { thinkingBudget: 2048 },
      responseMimeType: 'application/json',
    },
  });
  // Gemini can return an empty body with a non-STOP finishReason — notably
  // RECITATION, which fires on long verbatim transcriptions (dense labels).
  // Surface it as a normal provider failure so the chain falls through.
  const finishReason = (response as any).candidates?.[0]?.finishReason;
  const text = response.text ?? '';
  if (!text) {
    throw new Error(`Gemini returned no content (finishReason: ${finishReason ?? 'unknown'})`);
  }
  if (finishReason && finishReason !== 'STOP') {
    throw new Error(`Gemini response incomplete (finishReason: ${finishReason})`);
  }
  return toResult(parseModelJson(text), 'multimodal-gemini');
}

async function readWithOpenAI(imageData: string): Promise<LabelReadResult> {
  const url = imageData.startsWith('data:')
    ? imageData
    : `data:image/jpeg;base64,${imageData}`;
  const response = await openai.chat.completions.create({
    model: VISION_MODEL_OPENAI,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: EXTRACTION_PROMPT },
        { type: 'image_url', image_url: { url } },
      ],
    }],
    response_format: { type: 'json_object' },
  });
  return toResult(parseModelJson(response.choices[0]?.message?.content ?? ''), 'multimodal-openai');
}

async function readWithLegacyOcr(imageData: string): Promise<LabelReadResult> {
  const ocr = await extractTextWithGoogleVision(imageData);
  if (!ocr.text || ocr.text.trim().length < 10) {
    throw new NoLabelFoundError();
  }
  const extraction = extractIngredientsFromText(ocr.text);
  if (extraction.count === 0) {
    throw new NoLabelFoundError();
  }
  return {
    rawText: ocr.text,
    ingredients: extraction.ingredients,
    ingredientsOriginal: extraction.ingredients,
    sourceLanguage: ocr.language,
    confidence: 'medium',
    method: 'ocr-fallback',
    // The heuristic extractor cannot reliably separate a "contains" line from
    // a "may contain" line, and guessing wrong in either direction is unsafe.
    declaredAllergens: { contains: [], mayContain: [] },
  };
}

export type LabelProvider = 'gemini' | 'openai' | 'ocr';

export interface ReadLabelOptions {
  /** Restrict the provider chain, e.g. ['openai'] to eval a single provider */
  providers?: LabelProvider[];
}

/**
 * Which providers run, in order.
 *
 * OpenAI only, as of 2026-08-22. The chain used to lead with Gemini, and a
 * measured scan showed what that cost: the Gemini project's prepayment credits
 * are depleted, so EVERY call returned 429 RESOURCE_EXHAUSTED after ~2.1s and
 * the chain fell through to OpenAI anyway. Two seconds of guaranteed failure
 * sat at the front of every scan, inside the "Reading the label…" phase.
 *
 * Google Cloud Vision came out with it. It was third, so it never ran while
 * OpenAI was healthy, and as the ONLY remaining fallback it would have been a
 * poor one: it is OCR plus regex heuristics, it cannot separate a "contains"
 * line from a "may contain" line, and so it reports NO declared allergens at
 * all (see readWithLegacyOcr). A silent fallback that drops the label's own
 * allergen declaration is worse than a failed scan the person can retry.
 *
 * The consequence, stated plainly: there is now no fallback. An OpenAI outage
 * is a total scanning outage. That is the deliberate trade — one fast path
 * over a slow path into a reader that answers less honestly.
 *
 * The provider code is kept rather than deleted, precisely because of that
 * trade: it is the recovery path, and deleting it would make the single point
 * of failure permanent. Both providers gate on their own env var and are inert
 * without one.
 *
 * As of 2026-08-24 neither key exists any more — GEMINI_API_KEY and
 * GOOGLE_CLOUD_VISION_API_KEY were removed from .env and unset as Fly secrets,
 * because a live credential behind unreachable code is a liability with no
 * upside. Restoring a fallback is therefore two steps and still no deploy: set
 * the provider's key, then set LABEL_PROVIDER_CHAIN, e.g. "gemini,openai".
 *
 * DOING SO CHANGES WHAT THE PRIVACY POLICY HAS TO SAY. Production runs OpenAI
 * alone, and both /privacy and /health-data-privacy name OpenAI as the only
 * company a label photo reaches. Putting gemini or ocr into the live chain
 * sends photographs to Google and makes those two documents false, so it is a
 * legal change before it is a config change: server/legal.ts first.
 */
const DEFAULT_PROVIDER_CHAIN: LabelProvider[] = ['openai'];

function configuredChain(): LabelProvider[] {
  const raw = process.env.LABEL_PROVIDER_CHAIN?.trim();
  if (!raw) return DEFAULT_PROVIDER_CHAIN;

  const known: LabelProvider[] = ['gemini', 'openai', 'ocr'];
  const requested = raw.split(',').map(name => name.trim().toLowerCase());
  const chain = requested.filter((name): name is LabelProvider =>
    (known as string[]).includes(name));
  const unknown = requested.filter(name => !(known as string[]).includes(name));

  if (unknown.length > 0) {
    console.warn(`[LABEL-READER] LABEL_PROVIDER_CHAIN names unknown provider(s): ${unknown.join(', ')}`);
  }
  // An env var that parses to nothing must not silently disable scanning.
  if (chain.length === 0) {
    console.warn(`[LABEL-READER] LABEL_PROVIDER_CHAIN="${raw}" named no known provider; using the default chain`);
    return DEFAULT_PROVIDER_CHAIN;
  }
  return chain;
}

/**
 * Read a product label photo into structured ingredients.
 * A definitive "no label in this image" from a multimodal model short-circuits
 * the chain — falling through to OCR would only produce garbage extractions.
 */
export async function readLabelFromImage(imageData: string, options?: ReadLabelOptions): Promise<LabelReadResult> {
  const available: Record<LabelProvider, { enabled: boolean; run: (d: string) => Promise<LabelReadResult> }> = {
    gemini: { enabled: geminiConfigured(), run: readWithGemini },
    openai: { enabled: Boolean(process.env.OPENAI_API_KEY), run: readWithOpenAI },
    ocr: { enabled: Boolean(process.env.GOOGLE_CLOUD_VISION_API_KEY), run: readWithLegacyOcr },
  };

  // `options.providers` REPLACES the configured chain rather than filtering it,
  // so `npm run eval -- --provider=gemini` can still exercise a provider that
  // production no longer calls. Filtering would have made that flag select
  // nothing the moment the default chain shrank to one entry.
  const names = options?.providers ?? configuredChain();
  const providers = names.map(name => ({ name, ...available[name] }));

  let lastError: Error | undefined;
  for (const provider of providers) {
    if (!provider.enabled) {
      console.log(`[LABEL-READER] ${provider.name} not configured, skipping`);
      continue;
    }
    const start = Date.now();
    try {
      const result = await provider.run(imageData);
      const duration = ((Date.now() - start) / 1000).toFixed(2);
      console.log(`[LABEL-READER] ${provider.name} succeeded in ${duration}s: ${result.ingredients.length} ingredients (${result.sourceLanguage || 'unknown'} label, ${result.confidence} confidence)`);
      return result;
    } catch (error: any) {
      if (error instanceof NoLabelFoundError) {
        throw error;
      }
      const duration = ((Date.now() - start) / 1000).toFixed(2);
      console.warn(`[LABEL-READER] ${provider.name} failed after ${duration}s: ${error.message}`);
      lastError = error;
    }
  }
  throw lastError ?? new Error('No label-reading provider is configured');
}
