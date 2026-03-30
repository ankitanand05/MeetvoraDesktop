/**
 * Audio Transcription Client
 *
 * Handles audio transcription using OpenAI's Audio models.
 * Primary: gpt-4o-mini-transcribe-2025-12-15
 * Fallback: whisper-1
 *
 * Input: webm/opus audio (captured via Electron desktopCapturer + MediaRecorder)
 * Output: Transcribed text
 */

import OpenAI from 'openai';

/** Maximum number of retry attempts for transient errors */
const MAX_RETRIES = 2;

/** Base delay for exponential backoff (ms) */
const BASE_DELAY = 1000;

/**
 * Detect audio format from buffer header bytes.
 * Returns correct filename and MIME type for OpenAI API.
 */
function detectAudioFormat(buffer: Buffer): { filename: string; mimeType: string } {
  // Check for RIFF/WAV header (0x52 0x49 0x46 0x46 = "RIFF")
  if (buffer.length >= 4 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 &&
      buffer[2] === 0x46 && buffer[3] === 0x46) {
    return { filename: 'audio.wav', mimeType: 'audio/wav' };
  }
  // Default to webm (covers EBML/WebM and other formats)
  return { filename: 'audio.webm', mimeType: 'audio/webm' };
}

/**
 * Transcribe audio using GPT transcription model.
 * Auto-detects audio format (WAV or WebM) from buffer headers.
 */
async function transcribeWithModel(
  openai: OpenAI,
  audioBuffer: Buffer,
  language: string,
  model: string
): Promise<string> {

  const { filename, mimeType } = detectAudioFormat(audioBuffer);
  const file = new File(
    [new Uint8Array(audioBuffer)],
    filename,
    { type: mimeType }
  );

  const response = await openai.audio.transcriptions.create({
    model,
    file: file,
    language: language,
    prompt: 'Transcribe the following audio in English.',
  });

  return response.text?.trim() || '';
}

/**
 * Transcribe audio using whisper-1 via dedicated Transcriptions endpoint.
 * Auto-detects audio format (WAV or WebM) from buffer headers.
 */
async function transcribeWithWhisper(
  openai: OpenAI,
  audioBuffer: Buffer,
  language: string
): Promise<string> {

  const { filename, mimeType } = detectAudioFormat(audioBuffer);
  const file = new File(
    [new Uint8Array(audioBuffer)],
    filename,
    { type: mimeType }
  );

  const response = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file: file,
    language: language,
    prompt: 'Transcribe the following audio in English.',
  });

  return response.text?.trim() || '';
}

/**
 * Transcribe an audio buffer using OpenAI audio models.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  apiKey: string,
  language: string = 'en',
  model = 'gpt-4o-mini-transcribe-2025-12-15'
): Promise<string> {

  const openai = new OpenAI({ apiKey });

  // Build strategy list based on selected model; always fall back to whisper-1
  const isWhisper = model === 'whisper-1';
  const strategies = isWhisper
    ? [{ name: 'whisper-1', fn: () => transcribeWithWhisper(openai, audioBuffer, language) }]
    : [
        { name: model, fn: () => transcribeWithModel(openai, audioBuffer, language, model) },
        { name: 'whisper-1', fn: () => transcribeWithWhisper(openai, audioBuffer, language) },
      ];

  for (const strategy of strategies) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {

        const text = await strategy.fn();

        if (text.length > 0) {
          console.log(`[Transcribe:${strategy.name}] (${text.length} chars): "${text.substring(0, 80)}..."`);
        }

        return text;

      } catch (error: any) {

        const statusCode = error?.status || error?.response?.status;

        if (statusCode === 401) {
          throw new Error('Invalid OpenAI API key.');
        }

        if (statusCode === 403) {
          console.warn(`[Transcribe:${strategy.name}] 403 access denied, trying next strategy...`);
          break;
        }

        if (statusCode === 400) {
          console.warn(`[Transcribe:${strategy.name}] 400 bad request: ${error.message}, trying next strategy...`);
          break;
        }

        if (statusCode === 429) {
          const delay = BASE_DELAY * Math.pow(2, attempt - 1);
          console.warn(`[Transcribe:${strategy.name}] Rate limited. Retrying in ${delay}ms`);
          await sleep(delay);
          continue;
        }

        if (statusCode && statusCode >= 500) {
          const delay = BASE_DELAY * Math.pow(2, attempt - 1);
          console.warn(`[Transcribe:${strategy.name}] Server error ${statusCode}. Retrying in ${delay}ms`);
          await sleep(delay);
          continue;
        }

        if (attempt === MAX_RETRIES) {
          console.error(`[Transcribe:${strategy.name}] Failed after ${MAX_RETRIES} attempts:`, error.message);
          break;
        }

        const delay = BASE_DELAY * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }
  }

  console.error('[Transcribe] All transcription strategies failed');
  return '';
}

/**
 * Utility: Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
