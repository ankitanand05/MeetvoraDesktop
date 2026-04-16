/**
 * Vision Client
 *
 * Sends screenshots to OpenAI's vision-capable model for analysis.
 * Used for: reading coding questions from screen, analyzing diagrams,
 * extracting text from images, solving visible problems, etc.
 *
 * Model: gpt-5-mini (vision-capable, fast, cheap)
 */

import OpenAI from 'openai';

const MAX_RETRIES = 3;
const BASE_DELAY = 1000;

export interface VisionStreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

/**
 * Analyze a screenshot with GPT vision model (streaming).
 *
 * @param screenshotBase64 - The screenshot as a base64-encoded PNG string
 * @param apiKey           - OpenAI API key
 * @param callbacks        - Streaming callbacks
 * @param userPrompt       - Optional extra instruction from the user
 */
export async function analyzeScreenshot(
  screenshotBase64: string,
  apiKey: string,
  callbacks: VisionStreamCallbacks,
  userPrompt?: string,
  model = process.env.VISION_MODEL ?? 'gpt-4o'
): Promise<void> {

  const openai = new OpenAI({ apiKey });

  const systemPrompt = `You are an expert AI assistant that analyzes screenshots.

Your capabilities:
• Read and solve coding questions, algorithm problems, and technical challenges visible on screen.
• Extract text, code, or data from the screenshot.
• Explain diagrams, UI layouts, error messages, or terminal output.
• Provide complete, working code solutions when a coding question is detected.

Guidelines:
• If you see a coding/interview question: provide a clear, complete solution with code and brief explanation.
• If you see an error message: explain what's wrong and how to fix it.
• If you see general content: summarize the key information.
• Use proper code formatting with language labels.
• Be direct and concise — no unnecessary preamble.
• If the image is unclear, describe what you can see and ask for clarification.`;

  const userMessage = userPrompt?.trim()
    ? `${userPrompt.trim()}\n\nAnalyze the attached screenshot.`
    : 'Analyze this screenshot. If it contains a coding question or problem, provide a complete solution with code. If it contains an error, explain and fix it. Otherwise, summarize the key content.';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {

      const stream = await openai.chat.completions.create({
        model,
        stream: true,
        max_completion_tokens: 2048,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userMessage },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${screenshotBase64}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
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
        // If the requested model is denied, fall back to gpt-4o-mini (supports vision via chat completions)
        const FALLBACK = process.env.VISION_FALLBACK_MODEL ?? 'gpt-4o-mini';
        if (model !== FALLBACK) {
          console.log(`[Vision] 403 on model "${model}", falling back to "${FALLBACK}"`);
          return analyzeScreenshot(screenshotBase64, apiKey, callbacks, userPrompt, FALLBACK);
        }
        callbacks.onError(new Error('OpenAI API access denied for vision model. Check your API key permissions.'));
        return;
      }
      if (statusCode === 401) {
        callbacks.onError(new Error('Invalid OpenAI API key.'));
        return;
      }

      if (attempt === MAX_RETRIES) {
        callbacks.onError(new Error(`Vision analysis failed: ${error.message}`));
        return;
      }

      const delay = BASE_DELAY * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
