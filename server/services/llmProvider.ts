import { openai } from '../openai';
import { gemini } from '../gemini';

export type LLMProvider = 'openai' | 'gemini';

export function getLLMProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER?.toLowerCase() || 'openai';
  if (provider === 'gemini') return 'gemini';
  return 'openai';
}

export function getModelName(): string {
  const provider = getLLMProvider();
  if (provider === 'gemini') {
    return 'gemini-3-flash-preview';
  }
  return 'gpt-5.2';
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMResponse {
  content: string;
  usage?: {
    total_tokens: number;
    completion_tokens: number;
    prompt_tokens: number;
  };
}

interface CompletionOptions {
  maxTokens?: number;
  jsonMode?: boolean;
}

export async function createChatCompletion(
  messages: ChatMessage[],
  options: CompletionOptions = {}
): Promise<LLMResponse> {
  const provider = getLLMProvider();
  const startTime = Date.now();
  
  console.log(`[LLM-PROVIDER] Using ${provider} (${getModelName()})`);
  
  if (provider === 'gemini') {
    return createGeminiCompletion(messages, options);
  }
  
  return createOpenAICompletion(messages, options);
}

async function createOpenAICompletion(
  messages: ChatMessage[],
  options: CompletionOptions
): Promise<LLMResponse> {
  const { maxTokens = 4000, jsonMode = false } = options;
  
  const response = await openai.chat.completions.create({
    model: 'gpt-5.2',
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    max_completion_tokens: maxTokens,
    ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    reasoning_effort: "none"
  } as any);
  
  const content = response.choices?.[0]?.message?.content || '';
  
  return {
    content,
    usage: {
      total_tokens: response.usage?.total_tokens || 0,
      completion_tokens: response.usage?.completion_tokens || 0,
      prompt_tokens: response.usage?.prompt_tokens || 0
    }
  };
}

async function createGeminiCompletion(
  messages: ChatMessage[],
  options: CompletionOptions
): Promise<LLMResponse> {
  const { maxTokens = 4000, jsonMode = false } = options;
  
  const systemMessage = messages.find(m => m.role === 'system')?.content || '';
  const userMessages = messages.filter(m => m.role !== 'system');
  const userContent = userMessages.map(m => m.content).join('\n\n');
  
  const fullPrompt = systemMessage 
    ? `INSTRUCTIONS:\n${systemMessage}\n\n---\n\nUSER REQUEST:\n${userContent}${jsonMode ? '\n\nIMPORTANT: You MUST respond with valid JSON only. No markdown, no explanations.' : ''}`
    : userContent;
  
  const response = await gemini.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{
      role: 'user',
      parts: [{ text: fullPrompt }]
    }],
    config: {
      maxOutputTokens: maxTokens,
      ...(jsonMode ? { responseMimeType: 'application/json' } : {})
    }
  } as any);
  
  let content = response.text || '';
  
  if (jsonMode && content) {
    content = content.trim();
    if (content.startsWith('```json')) {
      content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (content.startsWith('```')) {
      content = content.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
  }
  
  const usageMetadata = (response as any).usageMetadata;
  const estimatedPromptLength = fullPrompt.length;
  const promptTokens = usageMetadata?.promptTokenCount || Math.ceil(estimatedPromptLength / 4);
  const completionTokens = usageMetadata?.candidatesTokenCount || Math.ceil(content.length / 4);
  
  return {
    content,
    usage: {
      total_tokens: promptTokens + completionTokens,
      completion_tokens: completionTokens,
      prompt_tokens: promptTokens
    }
  };
}
