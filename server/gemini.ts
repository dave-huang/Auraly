import { GoogleGenAI } from "@google/genai";

// Using Replit's AI Integrations for Gemini - no API key required, billed to credits
export const gemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
  },
});
