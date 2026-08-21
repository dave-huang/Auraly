import { GoogleGenAI } from "@google/genai";

// Prefers a direct Gemini API key (GEMINI_API_KEY). Falls back to the legacy
// Replit AI-integrations proxy vars if they are the only ones configured.
const directApiKey = process.env.GEMINI_API_KEY;
const proxyApiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
const proxyBaseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;

if (!directApiKey && !(proxyApiKey && proxyBaseUrl)) {
  console.warn('[GEMINI] No Gemini credentials configured (set GEMINI_API_KEY) — Gemini OCR fallback will fail');
}

export const gemini = directApiKey
  ? new GoogleGenAI({ apiKey: directApiKey })
  : new GoogleGenAI({
      apiKey: proxyApiKey!,
      httpOptions: {
        apiVersion: "",
        baseUrl: proxyBaseUrl!,
      },
    });
