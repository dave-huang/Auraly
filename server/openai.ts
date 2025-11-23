import OpenAI from "openai";

// Using OpenAI API with user-provided API key for GPT-5.1 access
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export { openai };
