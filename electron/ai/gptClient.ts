/**
 * GPT Client
 *
 * Handles AI responses using OpenAI Chat Completions API with streaming.
 * Uses chat.completions (NOT the slower Responses API) for minimal
 * first-token latency.
 */

import OpenAI from 'openai';
import type { PromptPair } from './promptBuilder';
import { buildMeetingPrompt } from './promptBuilder';

const MAX_RETRIES = 3;
const BASE_DELAY = 1000;

/** Cache the OpenAI client per API key to avoid re-init overhead */
let cachedClient: OpenAI | null = null;
let cachedKey = '';

function getClient(apiKey: string): OpenAI {
  if (cachedClient && cachedKey === apiKey) return cachedClient;
  cachedClient = new OpenAI({ apiKey });
  cachedKey = apiKey;
  return cachedClient;
}

/** Clear the cached client so the next call creates a fresh one. */
export function clearCachedClient(): void {
  cachedClient = null;
  cachedKey = '';
}

export interface GptStreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

/**
 * Stream a GPT response using Chat Completions API.
 *
 * @param textOrPrompt  Either a plain transcript string (auto-wrapped in
 *                      meeting-summary prompt) OR a pre-built PromptPair.
 * @param apiKey        OpenAI API key.
 * @param callbacks     Streaming event callbacks.
 */
export async function streamGptResponse(
  textOrPrompt: string | PromptPair,
  apiKey: string,
  callbacks: GptStreamCallbacks,
  model = 'gpt-4o-mini'
): Promise<void> {

  const openai = getClient(apiKey);

  // If caller passed a plain string, wrap it in the meeting-summary prompt
  const prompt: PromptPair =
    typeof textOrPrompt === 'string'
      ? buildMeetingPrompt(textOrPrompt)
      : textOrPrompt;

  const maxCompletionTokens = prompt.maxCompletionTokens ?? 320;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {

      console.log(
        `[GPT] prompt=${prompt.promptTag || 'default'} chars=${prompt.instructions.length + prompt.input.length} maxCompletionTokens=${maxCompletionTokens}`
      );

      const stream = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: prompt.instructions },
          { role: 'user', content: prompt.input },
        ],
        max_completion_tokens: maxCompletionTokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          callbacks.onChunk(delta);
        }
      }

      callbacks.onComplete();
      return;

    } catch (error: any) {

      const statusCode = error?.status || error?.response?.status;

      if (statusCode === 403) {
        callbacks.onError(
          new Error('OpenAI API access denied.')
        );
        return;
      }

      if (statusCode === 401) {
        callbacks.onError(
          new Error('Invalid OpenAI API key.')
        );
        return;
      }

      if (statusCode === 429 || (statusCode && statusCode >= 500)) {
        const delay = BASE_DELAY * Math.pow(2, attempt - 1);

        if (attempt < MAX_RETRIES) {
          await sleep(delay);
          continue;
        }
      }

      if (attempt === MAX_RETRIES) {
        callbacks.onError(
          new Error(`Failed to get AI response: ${error.message}`)
        );
        return;
      }

      const delay = BASE_DELAY * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
