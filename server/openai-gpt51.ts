import OpenAI from "openai";

// GPT-5.1 client using user's provided API key for superior analysis
// No fallback models - if GPT-5.1 fails, error is reported directly
const openaiGPT51 = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY_GPT51
});

export { openaiGPT51 };
