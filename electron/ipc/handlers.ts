/**
 * IPC Handlers
 *
 * Central registration point for all IPC communication between
 * the main process and the renderer process.
 */

import { ipcMain, BrowserWindow, desktopCapturer, screen, shell } from 'electron';
import { transcribeAudio } from '../ai/whisperClient';
import { streamGptResponse, clearCachedClient } from '../ai/gptClient';
import {
  buildConversationPrompt,
  buildInterviewPrompt,
  buildInterviewTeleprompterPrompt,
  buildMeetingAssistantPrompt,
  buildCustomPrompt,
  buildConductorQuestionPrompt,
  buildConductorEvaluatePrompt,
  buildFollowUpSuggestionsPrompt,
  buildSummaryPrompt,
  InterviewContext,
  MeetingContext,
  CustomContext,
  ConductorContext,
  type PromptPair,
} from '../ai/promptBuilder';
import { analyzeScreenshot } from '../ai/visionClient';
import { SessionRepo } from '../storage/sessionRepo';
import { getConfig, setConfig } from '../storage/config';

// Track active session
let activeSessionId: string | null = null;

// Processing queue to prevent overlapping GPT calls
let isProcessingChunk = false;
const processingQueue: Array<{ buffer: Buffer; sessionId: string }> = [];
let isProcessingQueue = false;

async function drainQueue(): Promise<void> {
  if (isProcessingQueue) return;
  isProcessingQueue = true;
  try {
    while (processingQueue.length > 0) {
      const item = processingQueue.shift()!;
      try {
        await processAudioChunk(item.buffer, item.sessionId);
      } catch (err) {
        console.error('[Queue] Chunk processing failed:', err);
      }
    }
  } finally {
    isProcessingQueue = false;
  }
}

// Interview context (set via SetupScreen)
let interviewContext: InterviewContext | null = null;
let meetingContext: MeetingContext | null = null;
let customContext: CustomContext | null = null;
let conductorContext: ConductorContext | null = null;
let teleprompterActive = false;

// ─── USER PREFERENCES (persisted via settings:save-prefs) ──────────────────
interface UserPrefs {
  answerSize: 'small' | 'medium' | 'big';
  screenshotMode: 'simple' | 'coding' | 'custom';
  customScreenshotPrompt: string;
  interviewLanguage: string;
  chatModel: string;
  visionModel: string;
  transcriptModel: string;
}

let userPrefs: UserPrefs = {
  answerSize: 'medium',
  screenshotMode: 'simple',
  customScreenshotPrompt: '',
  interviewLanguage: 'en',
  chatModel: 'gpt-4o-mini',
  visionModel: 'gpt-4o',
  transcriptModel: 'gpt-4o-mini-transcribe-2025-12-15',
};

/** Answer-size suffix injected into system prompts */
function answerSizeInstruction(): string {
  switch (userPrefs.answerSize) {
    case 'small': return '\n\nIMPORTANT: Be very concise. Limit answers to 2-3 sentences max.';
    case 'big':   return '\n\nIMPORTANT: Give comprehensive, detailed answers with examples and thorough explanations.';
    default:      return '';
  }
}

// ─── IN-MEMORY CONVERSATION HISTORY (per session) ─────────

interface HistoryEntry {
  role: 'user' | 'assistant';
  text: string;
}

/** Summary-backed conversation memory — keyed by sessionId */
interface SessionMemory {
  summary: string;
  recentEntries: HistoryEntry[];
  /** Prevents concurrent summarization races */
  isSummarizing: boolean;
}

const sessionMemory = new Map<string, SessionMemory>();

/** Summarize after every 6 turns (12 entries) */
const SUMMARIZE_AFTER_ENTRIES = 6;
/** Max chars stored per assistant entry (shorter = cheaper context) */
const MAX_ENTRY_CHARS = 300;
/** Hard cap on recentEntries — protects against summarization backlog */
const MAX_RECENT_ENTRIES = 14;
/** Cap the running summary to avoid unbounded growth */
const MAX_SUMMARY_CHARS = 1200;
/** Cap the total history string injected into each GPT prompt */
const MAX_HISTORY_CHARS = 3000;
/** Shared session for voice/text questions that have no active audio session */
const EPHEMERAL_SESSION = 'ephemeral';

function getMemory(sessionId: string): SessionMemory {
  let mem = sessionMemory.get(sessionId);
  if (!mem) {
    mem = { summary: '', recentEntries: [], isSummarizing: false };
    sessionMemory.set(sessionId, mem);
  }
  return mem;
}

function addToHistory(sessionId: string, role: 'user' | 'assistant', text: string): void {
  if (!sessionId) return;
  const mem = getMemory(sessionId);
  // Truncate long assistant responses before storing
  const stored = role === 'assistant' && text.length > MAX_ENTRY_CHARS
    ? text.slice(0, MAX_ENTRY_CHARS) + '…'
    : text;
  mem.recentEntries.push({ role, text: stored });

  // Hard cap: drop oldest entries if summarization can't keep up
  if (mem.recentEntries.length > MAX_RECENT_ENTRIES) {
    mem.recentEntries = mem.recentEntries.slice(-(Math.floor(MAX_RECENT_ENTRIES * 0.6)));
    console.log(`[Memory] Hard-capped recentEntries for ${sessionId}`);
  }
}

/**
 * Auto-summarize older entries when the buffer grows too large.
 * Call AFTER adding the assistant response so both user+assistant are present.
 * Guarded against concurrent calls to prevent race conditions.
 */
async function maybeSummarize(sessionId: string): Promise<void> {
  const mem = getMemory(sessionId);
  // Guard: skip if already summarizing or below threshold
  if (mem.isSummarizing || mem.recentEntries.length < SUMMARIZE_AFTER_ENTRIES) return;

  const apiKey = getApiKey();
  if (!apiKey) return;

  mem.isSummarizing = true;

  // Keep the most recent 2 entries (1 turn), summarize the rest
  const toSummarize = mem.recentEntries.slice(0, -2);
  const toKeep = mem.recentEntries.slice(-2);

  const block = (mem.summary ? `Previous context: ${mem.summary}\n\n` : '') +
    toSummarize.map(e => `${e.role === 'user' ? 'User' : 'Assistant'}: ${e.text}`).join('\n');

  try {
    const prompt = buildSummaryPrompt(block);
    let result = '';

    await streamGptResponse(prompt, apiKey, {
      onChunk: (chunk: string) => { result += chunk; },
      onComplete: () => {
        // Cap summary to prevent runaway growth
        mem.summary = result.trim().slice(0, MAX_SUMMARY_CHARS);
        mem.recentEntries = toKeep;
        mem.isSummarizing = false;
        console.log(`[Summary] Compressed history for ${sessionId} (${block.length} → ${mem.summary.length} chars)`);
      },
      onError: (err: Error) => {
        mem.isSummarizing = false;
        console.warn('[Summary] Failed, keeping raw entries:', err.message);
      },
    });
  } catch (err: any) {
    mem.isSummarizing = false;
    console.warn('[Summary] Error:', err.message);
  }
}

function getHistoryString(sessionId: string): string {
  const mem = sessionMemory.get(sessionId);
  if (!mem) return '';

  const parts: string[] = [];
  if (mem.summary) parts.push(`[Context] ${mem.summary}`);
  if (mem.recentEntries.length > 0) {
    parts.push(
      mem.recentEntries
        .map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`)
        .join('\n')
    );
  }
  const full = parts.join('\n\n');
  // Cap total history injected into GPT context to prevent token overflow
  return full.length > MAX_HISTORY_CHARS ? full.slice(-MAX_HISTORY_CHARS) : full;
}

function clearHistory(sessionId: string): void {
  sessionMemory.delete(sessionId);
}

/** Build the correct prompt based on which mode context is active */
function buildPromptForMode(text: string, history: string = '') {
  const sizeSuffix = answerSizeInstruction();
  const applySize = (pair: PromptPair): PromptPair => ({
    ...pair,
    instructions: pair.instructions + sizeSuffix,
  });
  if (interviewContext && teleprompterActive) return applySize(buildInterviewTeleprompterPrompt(text, interviewContext, history));
  if (interviewContext) return applySize(buildInterviewPrompt(text, interviewContext, history));
  if (meetingContext) return applySize(buildMeetingAssistantPrompt(text, meetingContext, history));
  if (customContext) return applySize(buildCustomPrompt(text, customContext, history));
  if (conductorContext) return applySize(buildConductorEvaluatePrompt(text, conductorContext, history));
  return applySize(buildConversationPrompt(text, history));
}

/**
 * Get the OpenAI API key.
 * Priority: config store (UI-saved) > process.env.OPENAI_API_KEY
 */
function getApiKey(): string | null {
  // UI-saved key always takes priority
  const storedKey = (getConfig('openai-api-key') as string | undefined)?.replace(/\s+/g, '');
  if (storedKey) {
    console.log(`[ApiKey] Using stored key: ${storedKey.substring(0, 7)}...${storedKey.slice(-4)} (${storedKey.length} chars)`);
    return storedKey;
  }
  // Fallback to environment variable
  const envKey = process.env.OPENAI_API_KEY;
  if (envKey && envKey.trim().length > 0) {
    console.log(`[ApiKey] Using env key: ${envKey.substring(0, 7)}...${envKey.slice(-4)} (${envKey.length} chars)`);
    return envKey.trim();
  }
  console.log('[ApiKey] No key found');
  return null;
}

/**
 * Helper: Get focused window
 */
function getWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows();
  return windows.length > 0 ? windows[0] : null;
}

/**
 * Helper: Send event to renderer (with destroyed-window guard)
 */
function sendToRenderer(channel: string, data: any): void {
  try {
    const win = getWindow();
    if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  } catch (err) {
    console.warn('[sendToRenderer] Failed to send', channel, err);
  }
}

/**
 * Update UI status
 */
function setStatus(status: 'idle' | 'listening' | 'processing' | 'error'): void {
  sendToRenderer('status:change', { status });
}

/**
 * Send error to renderer
 */
function sendError(message: string, code?: string): void {
  sendToRenderer('error:occurred', { message, code });
  console.error(`[IPC Error] ${code || 'UNKNOWN'}: ${message}`);
}

/**
 * Generate 4 follow-up suggestions after an AI response completes.
 * Runs in background — does not block the main response flow.
 */
async function generateFollowUpSuggestions(question: string, answer: string): Promise<void> {
  try {
    const apiKey = getApiKey();
    if (!apiKey) return;

    const prompt = buildFollowUpSuggestionsPrompt(question, answer);
    let raw = '';
    const suggestStart = Date.now();

    await streamGptResponse(prompt, apiKey, {
      onChunk: (chunk: string) => { raw += chunk; },
      onComplete: () => {
        console.log(`[Suggestions] Response time: ${((Date.now() - suggestStart) / 1000).toFixed(2)}s`);
        const trimmed = raw.trim();

        // Skip only if response is empty or clearly broken
        if (trimmed.length < 5) {
          console.log('[Suggestions] Skipped — empty response');
          return;
        }

        // Parse numbered lines: "1. ...", "2. ...", etc.
        const suggestions = trimmed
          .split('\n')
          .map(line => line.replace(/^\d+[\.)\-]\s*/, '').trim())
          .filter(line => line.length > 3 && !line.toUpperCase().startsWith('NONE'))
          .slice(0, 4);

        if (suggestions.length >= 2) {
          sendToRenderer('ai:suggestions', { suggestions });
          console.log('[Suggestions]', suggestions);
        } else {
          console.log('[Suggestions] Skipped — too few valid suggestions');
        }
      },
      onError: (err: Error) => {
        console.warn('[Suggestions] Failed:', err.message);
      },
    }, userPrefs.chatModel);
  } catch (err: any) {
    console.warn('[Suggestions] Error:', err.message);
  }
}

/** Max size for a single Whisper API call (24 MB safe limit) */
const MAX_WHISPER_BYTES = 24 * 1024 * 1024;

/**
 * Split a WAV buffer into segments that each fit within Whisper's size limit.
 * Each segment gets a proper WAV header.
 */
function splitWavBuffer(wavBuffer: Buffer): Buffer[] {
  // WAV header is 44 bytes; rest is PCM data
  if (wavBuffer.length <= MAX_WHISPER_BYTES) return [wavBuffer];

  const header = wavBuffer.subarray(0, 44);
  const pcmData = wavBuffer.subarray(44);
  const maxPcmPerSegment = MAX_WHISPER_BYTES - 44;
  const segments: Buffer[] = [];

  for (let offset = 0; offset < pcmData.length; offset += maxPcmPerSegment) {
    const chunk = pcmData.subarray(offset, Math.min(offset + maxPcmPerSegment, pcmData.length));
    // Build a new WAV header with correct data length
    const segHeader = Buffer.from(header);
    segHeader.writeUInt32LE(chunk.length + 36, 4);  // RIFF size
    segHeader.writeUInt32LE(chunk.length, 40);       // data size
    segments.push(Buffer.concat([segHeader, chunk]));
  }

  return segments;
}

// ─── Backend API helpers (module-level for use in processAudioChunk) ─────

const BACKEND_URL = process.env.MEETVORA_API_URL || 'http://localhost:5001/api';

/** Helper: make authenticated GET request to backend */
async function backendGet(endpoint: string): Promise<any> {
  const token = getConfig('auth-token') as string | undefined;
  if (!token) throw new Error('Not authenticated');

  const { net } = require('electron');
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'GET',
      url: `${BACKEND_URL}${endpoint}`,
    });
    request.setHeader('Authorization', `Bearer ${token}`);
    request.setHeader('Content-Type', 'application/json');

    let body = '';
    request.on('response', (response: any) => {
      response.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      response.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (response.statusCode >= 400) {
            reject(new Error(data.message || `HTTP ${response.statusCode}`));
          } else {
            resolve(data);
          }
        } catch {
          reject(new Error(`Invalid JSON from backend (${response.statusCode})`));
        }
      });
    });
    request.on('error', (err: Error) => reject(err));
    request.end();
  });
}

/** Helper: make authenticated POST request to backend */
async function backendPost(endpoint: string, payload: Record<string, unknown> = {}): Promise<any> {
  const token = getConfig('auth-token') as string | undefined;
  if (!token) throw new Error('Not authenticated');

  const { net } = require('electron');
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'POST',
      url: `${BACKEND_URL}${endpoint}`,
    });
    request.setHeader('Authorization', `Bearer ${token}`);
    request.setHeader('Content-Type', 'application/json');

    let body = '';
    request.on('response', (response: any) => {
      response.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      response.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (response.statusCode >= 400) {
            const err = new Error(data.message || `HTTP ${response.statusCode}`);
            (err as any).statusCode = response.statusCode;
            reject(err);
          } else {
            resolve(data);
          }
        } catch {
          reject(new Error(`Invalid JSON from backend (${response.statusCode})`));
        }
      });
    });
    request.on('error', (err: Error) => reject(err));
    const jsonBody = JSON.stringify(payload);
    request.write(jsonBody);
    request.end();
  });
}

/** Helper: make unauthenticated POST request to backend (for login/register) */
async function backendPostNoAuth(endpoint: string, payload: Record<string, unknown> = {}): Promise<any> {
  const { net } = require('electron');
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'POST',
      url: `${BACKEND_URL}${endpoint}`,
    });
    request.setHeader('Content-Type', 'application/json');

    let body = '';
    request.on('response', (response: any) => {
      response.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      response.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (response.statusCode >= 400) {
            const err = new Error(data.message || `HTTP ${response.statusCode}`);
            (err as any).statusCode = response.statusCode;
            reject(err);
          } else {
            resolve(data);
          }
        } catch {
          reject(new Error(`Invalid JSON from backend (${response.statusCode})`));
        }
      });
    });
    request.on('error', (err: Error) => reject(err));
    const jsonBody = JSON.stringify(payload);
    request.write(jsonBody);
    request.end();
  });
}

/** Check if the current user is an admin (no credit restrictions) */
function isAdmin(): boolean {
  const role = getConfig('user-role') as string | undefined;
  return role === 'admin';
}

/** Check if user has credits available (returns credits count, or -1 if check fails) */
async function checkCredits(): Promise<number> {
  // Admin users have unlimited credits
  if (isAdmin()) return -1;
  try {
    const resp = await backendGet('/users/me');
    const payload = resp.data ?? resp;
    return payload.totalCredits ?? 0;
  } catch {
    return -1; // allow usage if backend is unreachable
  }
}

/** Deduct 1 credit after a successful AI response */
async function deductCredit(description: string): Promise<void> {
  // Admin users don't consume credits
  if (isAdmin()) return;
  try {
    await backendPost('/users/me/credits/use', { description });
  } catch (err: any) {
    console.error('[Credits] Failed to deduct credit:', err.message);
  }
}

/**
 * Process audio chunk → Transcribe → Simplify
 */
async function processAudioChunk(audioBuffer: Buffer, sessionId: string): Promise<void> {
  if (!audioBuffer || audioBuffer.length === 0) return;
  try {
    // Check credits before processing
    const credits = await checkCredits();
    if (credits === 0) {
      sendError('You have no credits remaining. Please purchase a plan to continue.', 'NO_CREDITS');
      return;
    }

    const apiKey = getApiKey();

    if (!apiKey) {
      sendError('No API key configured. Please set it in Settings or .env file.', 'NO_API_KEY');
      return;
    }

    setStatus('processing');

    // Step 1: Transcription (split large audio for parallel processing)
    const segments = splitWavBuffer(audioBuffer);
    let transcript: string;

    const lang = userPrefs.interviewLanguage || 'en';
    if (segments.length === 1) {
      transcript = await transcribeAudio(segments[0], apiKey, lang, userPrefs.transcriptModel);
    } else {
      console.log(`[processAudioChunk] Large audio: splitting into ${segments.length} segments for parallel transcription`);
      const results = await Promise.all(
        segments.map(seg => transcribeAudio(seg, apiKey, lang, userPrefs.transcriptModel))
      );
      transcript = results.filter(t => t.length > 0).join(' ');
    }

    if (!transcript || transcript.trim().length === 0) {
      setStatus('idle');
      return;
    }

    const timestamp = new Date().toISOString();

    await SessionRepo.addMessage(sessionId, 'transcript', transcript, timestamp);

    sendToRenderer('transcript:new', { text: transcript, timestamp });

    // Record user message in conversation history
    addToHistory(sessionId, 'user', transcript);

    // Step 2: GPT Simplification (streaming)
    let fullResponse = '';
    const gptStart = Date.now();
    let firstTokenTime: number | null = null;

    const history = getHistoryString(sessionId);
    const prompt = buildPromptForMode(transcript, history);

    await streamGptResponse(prompt, apiKey, {
      onChunk: (chunk: string) => {
        if (!firstTokenTime) { firstTokenTime = Date.now(); console.log(`[Audio→GPT] First token: ${((firstTokenTime - gptStart) / 1000).toFixed(2)}s`); }
        fullResponse += chunk;
        sendToRenderer('ai:response-chunk', { chunk, sessionId });
      },

      onComplete: async () => {
        console.log(`[Audio→GPT] Total response time: ${((Date.now() - gptStart) / 1000).toFixed(2)}s | Length: ${fullResponse.length} chars`);
        const responseTimestamp = new Date().toISOString();

        // Record assistant response in conversation history
        addToHistory(sessionId, 'assistant', fullResponse);
        maybeSummarize(sessionId);

        await SessionRepo.addMessage(sessionId, 'ai', fullResponse, responseTimestamp);

        sendToRenderer('ai:response-complete', {
          fullText: fullResponse,
          sessionId,
        });

        // Deduct 1 credit after successful AI response
        deductCredit('Desktop AI response – audio');

        setStatus('idle');

        // Generate follow-up suggestions in background
        generateFollowUpSuggestions(transcript, fullResponse);
      },

      onError: (error: Error) => {
        console.log(`[Audio→GPT] Error after ${((Date.now() - gptStart) / 1000).toFixed(2)}s`);
        sendError(`GPT Error: ${error.message}`, 'GPT_ERROR');
        setStatus('idle');
      },
    }, userPrefs.chatModel);

    setStatus('idle');

  } catch (error: any) {
    console.error('[processAudioChunk] Error:', error);
    sendError(error.message || 'Failed to process audio chunk', 'PROCESS_ERROR');
    setStatus('idle');
  }
}

/**
 * Register all IPC handlers
 */
/** Check if stealth mode is currently active (used by main.ts) */
export function isStealthActive(): boolean {
  return _stealthEnabled;
}

let _stealthEnabled = false;

export function registerIpcHandlers(): void {

  // Load persisted user preferences on startup
  userPrefs.answerSize = (getConfig('pref-answer-size') as UserPrefs['answerSize']) || 'medium';
  userPrefs.screenshotMode = (getConfig('pref-screenshot-mode') as UserPrefs['screenshotMode']) || 'simple';
  userPrefs.customScreenshotPrompt = (getConfig('pref-screenshot-prompt') as string) || '';
  userPrefs.interviewLanguage = (getConfig('pref-interview-language') as string) || 'en';
  userPrefs.chatModel = (getConfig('pref-chat-model') as string) || 'gpt-4o-mini';
  userPrefs.visionModel = (getConfig('pref-vision-model') as string) || 'gpt-4o';
  userPrefs.transcriptModel = (getConfig('pref-transcript-model') as string) || 'gpt-4o-mini-transcribe-2025-12-15';
  console.log('[Prefs] Loaded on startup:', userPrefs);

  // ─── AUDIO START ────────────────────────────────────────────

  ipcMain.handle('audio:start', async () => {
    try {
      const apiKey = getApiKey();

      if (!apiKey) {
        throw new Error('Please set your OpenAI API key in Settings or .env file.');
      }

      const sessionId = await SessionRepo.createSession();
      activeSessionId = sessionId;

      setStatus('listening');
      console.log('[IPC] Session started:', sessionId);

      return sessionId;

    } catch (error: any) {
      setStatus('error');
      sendError(error.message || 'Failed to start session', 'AUDIO_START_ERROR');
      throw error;
    }
  });

  // ─── AUDIO CHUNK RECEIVED ───────────────────────────────────

  ipcMain.on('audio:chunk', async (_event, audioBuffer: ArrayBuffer) => {

    if (!activeSessionId) return;

    const buffer = Buffer.from(audioBuffer);

    if (buffer.length < 1000) {
      console.log('[IPC] Skipping tiny chunk:', buffer.length);
      return;
    }

    console.log('[IPC] Received audio chunk:', buffer.length);

    // Queue instead of dropping — prevents crashes from overlapping calls
    processingQueue.push({ buffer, sessionId: activeSessionId });
    drainQueue();
  });

  // ─── VOICE QUESTION (mic) ──────────────────────────────────

  ipcMain.on('voice:question', async (_event, audioBuffer: ArrayBuffer) => {
    const buffer = Buffer.from(audioBuffer);

    if (buffer.length < 500) {
      console.log('[IPC] Skipping tiny voice question:', buffer.length);
      return;
    }

    console.log('[IPC] Received voice question:', buffer.length, 'bytes');

    try {
      // Check credits before processing
      const credits = await checkCredits();
      if (credits === 0) {
        sendError('You have no credits remaining. Please purchase a plan to continue.', 'NO_CREDITS');
        return;
      }

      const apiKey = getApiKey();
      if (!apiKey) {
        sendError('No API key configured. Set it in Settings or .env file.', 'NO_API_KEY');
        return;
      }

      setStatus('processing');

      // Transcribe mic audio (use user's preferred interview language)
      const question = await transcribeAudio(buffer, apiKey, userPrefs.interviewLanguage || 'en', userPrefs.transcriptModel);

      if (!question || question.trim().length === 0) {
        sendError('Could not understand audio. Please try again.', 'EMPTY_QUESTION');
        setStatus(activeSessionId ? 'listening' : 'idle');
        return;
      }

      const timestamp = new Date().toISOString();

      // Show the transcribed question in the transcript panel
      sendToRenderer('transcript:new', { text: `${question}`, timestamp });

      // Save to DB if there's an active session
      if (activeSessionId) {
        await SessionRepo.addMessage(activeSessionId, 'transcript', `[Voice Question] ${question}`, timestamp);
      }

      // Record in conversation history
      const historySessionId = activeSessionId || EPHEMERAL_SESSION;
      addToHistory(historySessionId, 'user', question);

      // Send to GPT for an answer (streaming) — use active mode context
      let fullResponse = '';
      const sessionId = activeSessionId || EPHEMERAL_SESSION;
      const voiceGptStart = Date.now();
      let voiceFirstToken: number | null = null;

      const history = getHistoryString(sessionId);
      const prompt = buildPromptForMode(question, history);

      console.log(`[Voice→GPT] Question: "${question.slice(0, 80)}${question.length > 80 ? '...' : ''}"`);

      await streamGptResponse(prompt, apiKey, {
        onChunk: (chunk: string) => {
          if (!voiceFirstToken) { voiceFirstToken = Date.now(); console.log(`[Voice→GPT] First token: ${((voiceFirstToken - voiceGptStart) / 1000).toFixed(2)}s`); }
          fullResponse += chunk;
          sendToRenderer('ai:response-chunk', { chunk, sessionId });
        },
        onComplete: async () => {
          console.log(`[Voice→GPT] Total response time: ${((Date.now() - voiceGptStart) / 1000).toFixed(2)}s | Length: ${fullResponse.length} chars`);
          const responseTimestamp = new Date().toISOString();
          addToHistory(sessionId, 'assistant', fullResponse);
          maybeSummarize(sessionId);
          if (activeSessionId) {
            await SessionRepo.addMessage(activeSessionId, 'ai', fullResponse, responseTimestamp);
          }
          sendToRenderer('ai:response-complete', { fullText: fullResponse, sessionId });

          // Deduct 1 credit after successful AI response
          deductCredit('Desktop AI response – voice question');

          // Generate follow-up suggestions in background
          generateFollowUpSuggestions(question, fullResponse);
        },
        onError: (error: Error) => {
          console.log(`[Voice→GPT] Error after ${((Date.now() - voiceGptStart) / 1000).toFixed(2)}s`);
          sendError(`GPT Error: ${error.message}`, 'GPT_ERROR');
        },
      }, userPrefs.chatModel);

      setStatus(activeSessionId ? 'listening' : 'idle');

    } catch (err: any) {
      console.error('[Voice Question] Error:', err);
      sendError(err.message || 'Voice question failed', 'VOICE_ERROR');
      setStatus(activeSessionId ? 'listening' : 'idle');
    }
  });

  // ─── TEXT QUESTION (typed chat) ─────────────────────────────

  ipcMain.on('text:question', async (_event, question: string) => {
    if (!question || typeof question !== 'string' || !question.trim()) return;

    const trimmed = question.trim();
    console.log('[IPC] Received text question:', trimmed.slice(0, 60) + (trimmed.length > 60 ? '...' : ''));

    try {
      // Check credits before processing
      const credits = await checkCredits();
      if (credits === 0) {
        sendError('You have no credits remaining. Please purchase a plan to continue.', 'NO_CREDITS');
        return;
      }

      const apiKey = getApiKey();
      if (!apiKey) {
        sendError('No API key configured. Set it in Settings or .env file.', 'NO_API_KEY');
        return;
      }

      setStatus('processing');

      const timestamp = new Date().toISOString();

      // Show the typed question in the chat
      sendToRenderer('transcript:new', { text: trimmed, timestamp });

      // Save to DB if there's an active session
      if (activeSessionId) {
        await SessionRepo.addMessage(activeSessionId, 'transcript', `[Text Question] ${trimmed}`, timestamp);
      }

      // Record in conversation history
      const historySessionId = activeSessionId || EPHEMERAL_SESSION;
      addToHistory(historySessionId, 'user', trimmed);

      // Send to GPT — use active mode context
      let fullResponse = '';
      const sessionId = activeSessionId || EPHEMERAL_SESSION;
      const textGptStart = Date.now();
      let textFirstToken: number | null = null;

      const history = getHistoryString(sessionId);
      const prompt = buildPromptForMode(trimmed, history);

      console.log(`[Text→GPT] Question: "${trimmed.slice(0, 80)}${trimmed.length > 80 ? '...' : ''}"`);

      await streamGptResponse(prompt, apiKey, {
        onChunk: (chunk: string) => {
          if (!textFirstToken) { textFirstToken = Date.now(); console.log(`[Text→GPT] First token: ${((textFirstToken - textGptStart) / 1000).toFixed(2)}s`); }
          fullResponse += chunk;
          sendToRenderer('ai:response-chunk', { chunk, sessionId });
        },
        onComplete: async () => {
          console.log(`[Text→GPT] Total response time: ${((Date.now() - textGptStart) / 1000).toFixed(2)}s | Length: ${fullResponse.length} chars`);
          const responseTimestamp = new Date().toISOString();
          addToHistory(sessionId, 'assistant', fullResponse);
          maybeSummarize(sessionId);
          if (activeSessionId) {
            await SessionRepo.addMessage(activeSessionId, 'ai', fullResponse, responseTimestamp);
          }
          sendToRenderer('ai:response-complete', { fullText: fullResponse, sessionId });

          // Deduct 1 credit after successful AI response
          deductCredit('Desktop AI response – text question');

          // Generate follow-up suggestions in background
          generateFollowUpSuggestions(trimmed, fullResponse);
        },
        onError: (error: Error) => {
          console.log(`[Text→GPT] Error after ${((Date.now() - textGptStart) / 1000).toFixed(2)}s`);
          sendError(`GPT Error: ${error.message}`, 'GPT_ERROR');
        },
      }, userPrefs.chatModel);

      setStatus(activeSessionId ? 'listening' : 'idle');

    } catch (err: any) {
      console.error('[Text Question] Error:', err);
      sendError(err.message || 'Text question failed', 'TEXT_ERROR');
      setStatus(activeSessionId ? 'listening' : 'idle');
    }
  });

  // ─── SCREENSHOT ANALYSIS ────────────────────────────────────

  ipcMain.on('screenshot:capture', async () => {
    try {
      // Check credits before processing
      const credits = await checkCredits();
      if (credits === 0) {
        sendError('You have no credits remaining. Please purchase a plan to continue.', 'NO_CREDITS');
        return;
      }

      const apiKey = getApiKey();
      if (!apiKey) {
        sendError('No API key configured. Set it in Settings or .env file.', 'NO_API_KEY');
        return;
      }

      setStatus('processing');

      // Capture the primary display at native resolution (HiDPI-aware)
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.size;
      const scaleFactor = primaryDisplay.scaleFactor || 1;

      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: Math.round(width * scaleFactor),
          height: Math.round(height * scaleFactor),
        },
      });

      if (!sources || sources.length === 0) {
        sendError('Could not capture screen.', 'SCREENSHOT_ERROR');
        setStatus(activeSessionId ? 'listening' : 'idle');
        return;
      }

      // Get the primary screen source
      const source = sources[0];
      const screenshot = source.thumbnail;

      if (screenshot.isEmpty()) {
        sendError('Screenshot is empty.', 'SCREENSHOT_ERROR');
        setStatus(activeSessionId ? 'listening' : 'idle');
        return;
      }

      const base64 = screenshot.toPNG().toString('base64');

      console.log('[IPC] Screenshot captured, size:', base64.length, 'chars');

      const timestamp = new Date().toISOString();
      sendToRenderer('transcript:new', { text: '📸 Screenshot captured — analyzing...', timestamp });

      if (activeSessionId) {
        await SessionRepo.addMessage(activeSessionId, 'transcript', '[Screenshot captured]', timestamp);
        addToHistory(activeSessionId, 'user', '[Screenshot captured and analyzed]');
      }

      // Send to vision model (streaming)
      let fullResponse = '';
      const sessionId = activeSessionId || 'screenshot';
      const visionStart = Date.now();
      let visionFirstToken: number | null = null;

      console.log('[Screenshot→Vision] Analyzing screenshot...');

      // Build screenshot user prompt based on user's screenshotMode preference
      let screenshotUserPrompt: string | undefined;
      if (userPrefs.screenshotMode === 'coding') {
        screenshotUserPrompt = 'This appears to be a coding challenge or technical interview question. Provide a complete, working solution with clean code, time/space complexity analysis, and a brief explanation.';
      } else if (userPrefs.screenshotMode === 'custom' && userPrefs.customScreenshotPrompt.trim()) {
        screenshotUserPrompt = userPrefs.customScreenshotPrompt.trim();
      }

      await analyzeScreenshot(base64, apiKey, {
        onChunk: (chunk: string) => {
          if (!visionFirstToken) { visionFirstToken = Date.now(); console.log(`[Screenshot→Vision] First token: ${((visionFirstToken - visionStart) / 1000).toFixed(2)}s`); }
          fullResponse += chunk;
          sendToRenderer('ai:response-chunk', { chunk, sessionId });
        },
        onComplete: async () => {
          console.log(`[Screenshot→Vision] Total response time: ${((Date.now() - visionStart) / 1000).toFixed(2)}s | Length: ${fullResponse.length} chars`);
          const responseTimestamp = new Date().toISOString();
          if (activeSessionId) {
            addToHistory(activeSessionId, 'assistant', fullResponse);
            maybeSummarize(activeSessionId);
            await SessionRepo.addMessage(activeSessionId, 'ai', fullResponse, responseTimestamp);
          }
          sendToRenderer('ai:response-complete', { fullText: fullResponse, sessionId });

          // Deduct 1 credit after successful AI response
          deductCredit('Desktop AI response – screenshot');
        },
        onError: (error: Error) => {
          console.log(`[Screenshot→Vision] Error after ${((Date.now() - visionStart) / 1000).toFixed(2)}s`);
          sendError(`Vision Error: ${error.message}`, 'VISION_ERROR');
        },
      }, screenshotUserPrompt, userPrefs.visionModel);

      setStatus(activeSessionId ? 'listening' : 'idle');

    } catch (err: any) {
      console.error('[Screenshot] Error:', err);
      sendError(err.message || 'Screenshot failed', 'SCREENSHOT_ERROR');
      setStatus(activeSessionId ? 'listening' : 'idle');
    }
  });

  // ─── INTERVIEW CONTEXT ──────────────────────────────────────

  ipcMain.handle('context:set-interview', async (_event, data: { profile: string; jobDescription: string }) => {
    meetingContext = null;
    customContext = null;
    conductorContext = null;
    interviewContext = {
      profile: data.profile,
      jobDescription: data.jobDescription,
    };
    console.log('[IPC] Interview context set — profile:', data.profile.length, 'chars, JD:', data.jobDescription.length, 'chars');

    // Auto-enable stealth in interview mode
    const win = getWindow();
    if (win) enableStealth(win);

    return true;
  });

  ipcMain.handle('context:clear-interview', async () => {
    interviewContext = null;
    console.log('[IPC] Interview context cleared');
    return true;
  });

  // ─── MEETING CONTEXT ────────────────────────────────────────

  ipcMain.handle('context:set-meeting', async (_event, data: { agenda: string; attendees: string }) => {
    interviewContext = null;
    customContext = null;
    conductorContext = null;
    meetingContext = {
      agenda: data.agenda,
      attendees: data.attendees,
    };
    console.log('[IPC] Meeting context set — agenda:', data.agenda.length, 'chars, attendees:', data.attendees.length, 'chars');
    return true;
  });

  // ─── CUSTOM CONTEXT ─────────────────────────────────────────

  ipcMain.handle('context:set-custom', async (_event, data: { systemPrompt: string }) => {
    interviewContext = null;
    meetingContext = null;
    conductorContext = null;
    customContext = {
      systemPrompt: data.systemPrompt,
    };
    console.log('[IPC] Custom context set — prompt:', data.systemPrompt.length, 'chars');
    return true;
  });

  // ─── CONDUCTOR CONTEXT ──────────────────────────────────────

  ipcMain.handle('context:set-conductor', async (_event, data: {
    resume: string;
    jobDescription: string;
    difficulty: string;
    questionCount: number;
    focusAreas: string;
  }) => {
    interviewContext = null;
    meetingContext = null;
    customContext = null;
    conductorContext = {
      resume: data.resume,
      jobDescription: data.jobDescription,
      difficulty: data.difficulty,
      questionCount: data.questionCount,
      focusAreas: data.focusAreas,
      currentQuestion: 1,
      totalQuestions: data.questionCount,
    };
    console.log('[IPC] Conductor context set — difficulty:', data.difficulty, ', questions:', data.questionCount);

    // Auto-enable stealth in conductor mode
    const win = getWindow();
    if (win) enableStealth(win);

    return true;
  });

  // ─── CONDUCTOR: GENERATE NEXT QUESTION ──────────────────────

  ipcMain.on('conductor:next-question', async () => {
    if (!conductorContext) {
      sendError('No conductor context set.', 'CONDUCTOR_ERROR');
      return;
    }

    try {
      // Check credits before processing
      const credits = await checkCredits();
      if (credits === 0) {
        sendError('You have no credits remaining. Please purchase a plan to continue.', 'NO_CREDITS');
        return;
      }

      const apiKey = getApiKey();
      if (!apiKey) {
        sendError('No API key configured.', 'NO_API_KEY');
        return;
      }

      setStatus('processing');

      const sessionId = activeSessionId || 'conductor';
      const history = getHistoryString(sessionId);
      const prompt = buildConductorQuestionPrompt(conductorContext, history);

      let fullResponse = '';
      const conductorStart = Date.now();
      let conductorFirstToken: number | null = null;

      console.log(`[Conductor→GPT] Generating question #${conductorContext.currentQuestion}`);

      await streamGptResponse(prompt, apiKey, {
        onChunk: (chunk: string) => {
          if (!conductorFirstToken) { conductorFirstToken = Date.now(); console.log(`[Conductor→GPT] First token: ${((conductorFirstToken - conductorStart) / 1000).toFixed(2)}s`); }
          fullResponse += chunk;
          sendToRenderer('ai:response-chunk', { chunk, sessionId });
        },
        onComplete: async () => {
          console.log(`[Conductor→GPT] Total response time: ${((Date.now() - conductorStart) / 1000).toFixed(2)}s | Length: ${fullResponse.length} chars`);
          const timestamp = new Date().toISOString();
          addToHistory(sessionId, 'assistant', fullResponse);
          maybeSummarize(sessionId);
          if (activeSessionId) {
            await SessionRepo.addMessage(activeSessionId, 'ai', `[Q${conductorContext!.currentQuestion}] ${fullResponse}`, timestamp);
          }
          sendToRenderer('ai:response-complete', { fullText: fullResponse, sessionId });

          // Deduct 1 credit after successful AI response
          deductCredit('Desktop AI response – conductor');

          // Advance question counter
          conductorContext!.currentQuestion++;
        },
        onError: (error: Error) => {
          console.log(`[Conductor→GPT] Error after ${((Date.now() - conductorStart) / 1000).toFixed(2)}s`);
          sendError(`GPT Error: ${error.message}`, 'GPT_ERROR');
        },
      }, userPrefs.chatModel);

      setStatus(activeSessionId ? 'listening' : 'idle');

    } catch (err: any) {
      console.error('[Conductor] Error generating question:', err);
      sendError(err.message || 'Failed to generate question', 'CONDUCTOR_ERROR');
      setStatus(activeSessionId ? 'listening' : 'idle');
    }
  });

  // ─── AUDIO STOP ─────────────────────────────────────────────

  ipcMain.handle('audio:stop', async (_event, sessionId: string) => {
    try {
      if (sessionId) {
        await SessionRepo.endSession(sessionId);
        clearHistory(sessionId);
      }

      activeSessionId = null;
      setStatus('idle');

      console.log('[IPC] Session stopped:', sessionId);

    } catch (error: any) {
      sendError(error.message || 'Failed to stop session', 'AUDIO_STOP_ERROR');
      throw error;
    }
  });

  // ─── SESSION MANAGEMENT ─────────────────────────────────────

  ipcMain.handle('session:create', async () => {
    return await SessionRepo.createSession();
  });

  ipcMain.handle('session:end', async (_event, sessionId: string) => {
    await SessionRepo.endSession(sessionId);
  });

  ipcMain.handle('session:get-all', async () => {
    return await SessionRepo.getAllSessions();
  });

  ipcMain.handle('session:get-messages', async (_event, sessionId: string) => {
    return await SessionRepo.getMessages(sessionId);
  });

  // ─── SETTINGS ───────────────────────────────────────────────

  ipcMain.handle('settings:set-api-key', async (_event, key: string) => {

    if (!key || typeof key !== 'string') {
      throw new Error('Invalid API key format');
    }

    const trimmedKey = key.replace(/\s+/g, '');

    if (!trimmedKey.startsWith('sk-')) {
      throw new Error('Invalid API key: must start with "sk-"');
    }

    console.log(`[ApiKey] Saving key: ${trimmedKey.substring(0, 7)}...${trimmedKey.slice(-4)} (${trimmedKey.length} chars)`);

    // Save to encrypted config
    setConfig('openai-api-key', trimmedKey);

    // Verify roundtrip: read back and compare
    const readBack = (getConfig('openai-api-key') as string | undefined)?.replace(/\s+/g, '');
    if (readBack !== trimmedKey) {
      console.error('[ApiKey] ROUNDTRIP MISMATCH — saved key does not match read-back!');
      throw new Error('Failed to save API key (encryption error). Please try again.');
    }
    console.log(`[ApiKey] Roundtrip OK`);

    // Clear cached OpenAI client so next call uses the new key
    clearCachedClient();

    // Quick validation: make a lightweight API call to verify the key works
    try {
      const { default: OpenAI } = await import('openai');
      const testClient = new OpenAI({ apiKey: trimmedKey });
      await testClient.models.list({ limit: 1 } as any);
      console.log('[ApiKey] Validation OK — key is valid');
    } catch (err: any) {
      const status = err?.status || err?.response?.status;
      if (status === 401) {
        // Remove the invalid key
        setConfig('openai-api-key', '');
        clearCachedClient();
        throw new Error('This API key is invalid. OpenAI rejected it. Please check and try again.');
      }
      // Other errors (network, rate limit) — key might still be valid, keep it
      console.warn('[ApiKey] Validation request failed (key kept):', err.message);
    }
  });

  ipcMain.handle('settings:has-api-key', async () => {
    const key = getApiKey();
    return !!(key && key.length > 0);
  });

  // ─── MODEL PREFERENCES ─────────────────────────────────────

  ipcMain.handle('settings:save-model-prefs', async (_event, prefs: {
    chatModel?: string;
    visionModel?: string;
    transcriptModel?: string;
  }) => {
    if (prefs.chatModel) { userPrefs.chatModel = prefs.chatModel; setConfig('pref-chat-model', prefs.chatModel); }
    if (prefs.visionModel) { userPrefs.visionModel = prefs.visionModel; setConfig('pref-vision-model', prefs.visionModel); }
    if (prefs.transcriptModel) { userPrefs.transcriptModel = prefs.transcriptModel; setConfig('pref-transcript-model', prefs.transcriptModel); }
    // Reset client so model change takes effect immediately
    clearCachedClient();
    console.log('[ModelPrefs] Saved:', prefs);
    return true;
  });

  ipcMain.handle('settings:load-model-prefs', async () => {
    return {
      chatModel: (getConfig('pref-chat-model') as string) || 'gpt-4o-mini',
      visionModel: (getConfig('pref-vision-model') as string) || 'gpt-4o',
      transcriptModel: (getConfig('pref-transcript-model') as string) || 'gpt-4o-mini-transcribe-2025-12-15',
    };
  });

  // ─── USER PREFERENCES (answer size, screenshot mode, language) ──────────

  ipcMain.handle('settings:save-prefs', async (_event, prefs: {
    answerSize?: string;
    screenshotMode?: string;
    customScreenshotPrompt?: string;
    interviewLanguage?: string;
  }) => {
    // Update in-memory prefs immediately (affects next AI call)
    if (prefs.answerSize) userPrefs.answerSize = prefs.answerSize as UserPrefs['answerSize'];
    if (prefs.screenshotMode) userPrefs.screenshotMode = prefs.screenshotMode as UserPrefs['screenshotMode'];
    if (prefs.customScreenshotPrompt !== undefined) userPrefs.customScreenshotPrompt = prefs.customScreenshotPrompt;
    if (prefs.interviewLanguage) userPrefs.interviewLanguage = prefs.interviewLanguage;
    // Persist to config store
    if (prefs.answerSize) setConfig('pref-answer-size', prefs.answerSize);
    if (prefs.screenshotMode) setConfig('pref-screenshot-mode', prefs.screenshotMode);
    if (prefs.customScreenshotPrompt !== undefined) setConfig('pref-screenshot-prompt', prefs.customScreenshotPrompt);
    if (prefs.interviewLanguage) setConfig('pref-interview-language', prefs.interviewLanguage);
    console.log('[Prefs] Saved:', prefs);
    return true;
  });

  ipcMain.handle('settings:load-prefs', async () => {
    return {
      answerSize: getConfig('pref-answer-size') as string || 'medium',
      screenshotMode: getConfig('pref-screenshot-mode') as string || 'simple',
      customScreenshotPrompt: getConfig('pref-screenshot-prompt') as string || '',
      interviewLanguage: getConfig('pref-interview-language') as string || 'en',
    };
  });

  // ─── WINDOW CONTROLS ────────────────────────────────────────

  ipcMain.handle('window:toggle-aot', async () => {
    const win = getWindow();
    if (win) {
      const current = win.isAlwaysOnTop();
      // Use 'screen-saver' level so the window stays above ALL other apps
      win.setAlwaysOnTop(!current, 'screen-saver');
      return !current;
    }
    return false;
  });

  // ─── STEALTH MODE (hide from screen sharing + Alt+Tab) ─────

  // Use module-level _stealthEnabled so isStealthActive() can read it
  let blurHandler: (() => void) | null = null;
  // Alias for readability inside this scope
  const getStealthEnabled = () => _stealthEnabled;
  const setStealthEnabled = (v: boolean) => { _stealthEnabled = v; };

  /**
   * Re-apply all stealth window properties.
   * Called on enableStealth AND every time the window is shown/restored
   * so that stealth cannot be broken by minimize→restore or hide→show cycles.
   */
  function applyStealthProps(win: BrowserWindow) {
    if (!win || win.isDestroyed()) return;
    win.setContentProtection(true);
    win.setSkipTaskbar(true);
    win.setTitle(' ');
    win.setAlwaysOnTop(true, 'screen-saver');
  }

  let showHandler: (() => void) | null = null;
  let restoreHandler: (() => void) | null = null;

  function enableStealth(win: BrowserWindow) {
    if (getStealthEnabled()) return; // already on
    setStealthEnabled(true);
    applyStealthProps(win);

    // Auto-hide when window loses focus → vanishes from Alt+Tab
    blurHandler = () => {
      if (getStealthEnabled() && win && !win.isDestroyed()) {
        win.hide();
      }
    };
    win.on('blur', blurHandler);

    // Re-apply stealth every time the window is shown or restored
    // This is critical: Windows can lose content protection after minimize/restore
    showHandler = () => {
      if (getStealthEnabled() && win && !win.isDestroyed()) {
        applyStealthProps(win);
      }
    };
    restoreHandler = () => {
      if (getStealthEnabled() && win && !win.isDestroyed()) {
        applyStealthProps(win);
      }
    };
    win.on('show', showHandler);
    win.on('restore', restoreHandler);

    // Notify renderer so the UI icon updates
    win.webContents.send('stealth:changed', true);
    console.log('[IPC] Stealth mode: ON');
  }

  function disableStealth(win: BrowserWindow) {
    if (!getStealthEnabled()) return;
    setStealthEnabled(false);
    win.setContentProtection(false);
    win.setSkipTaskbar(false);
    win.setTitle('Meetvora');

    if (blurHandler) {
      win.removeListener('blur', blurHandler);
      blurHandler = null;
    }
    if (showHandler) {
      win.removeListener('show', showHandler);
      showHandler = null;
    }
    if (restoreHandler) {
      win.removeListener('restore', restoreHandler);
      restoreHandler = null;
    }

    win.webContents.send('stealth:changed', false);
    console.log('[IPC] Stealth mode: OFF');
  }

  ipcMain.handle('window:toggle-stealth', async () => {
    const win = getWindow();
    if (win) {
      if (getStealthEnabled()) {
        disableStealth(win);
      } else {
        enableStealth(win);
      }
      return getStealthEnabled();
    }
    return false;
  });

  ipcMain.on('window:minimize', () => {
    const win = getWindow();
    if (!win) return;
    // In stealth mode, hide instead of minimize — minimize shows in taskbar
    // and can break content protection on restore
    if (getStealthEnabled()) {
      win.hide();
    } else {
      win.minimize();
    }
  });

  ipcMain.on('window:close', () => {
    getWindow()?.close();
  });

  // ─── WINDOW POSITIONING (F/R/L/C shortcuts) ─────────────────

  ipcMain.on('window:position', (_event, position: string) => {
    const win = getWindow();
    if (!win) return;

    const { screen: electronScreen } = require('electron');
    const display = electronScreen.getPrimaryDisplay();
    const { width: sw, height: sh } = display.workAreaSize;
    const [ww, wh] = win.getSize();

    switch (position) {
      case 'fullscreen': {
        // Toggle maximized / restore
        if (win.isMaximized()) {
          win.unmaximize();
        } else {
          win.maximize();
        }
        break;
      }
      case 'right': {
        // Right side, vertically centered
        const x = sw - ww - 12;
        const y = Math.round((sh - wh) / 2);
        win.setBounds({ x, y, width: ww, height: wh });
        break;
      }
      case 'left': {
        // Left side, vertically centered
        const x = 12;
        const y = Math.round((sh - wh) / 2);
        win.setBounds({ x, y, width: ww, height: wh });
        break;
      }
      case 'center-top': {
        // Center top
        const x = Math.round((sw - ww) / 2);
        const y = 12;
        win.setBounds({ x, y, width: ww, height: wh });
        break;
      }
    }
    console.log('[IPC] Window positioned:', position);
  });

  // ─── WINDOW HIDE / SHOW TOGGLE ─────────────────────────────

  ipcMain.on('window:toggle-visibility', () => {
    const win = getWindow();
    if (!win) return;
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
      win.focus();
    }
  });

  // ─── OPEN EXTERNAL URL ─────────────────────────────────────

  ipcMain.handle('shell:open-external', async (_event, url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        await shell.openExternal(url);
      }
    } catch {
      console.warn('[IPC] Blocked invalid URL for openExternal:', url);
    }
  });

  // ─── AUTH ──────────────────────────────────────────────────

  ipcMain.handle('auth:get-user', async () => {
    const email = getConfig('user-email') as string | undefined;
    if (!email) return null;
    const name = (getConfig('user-name') as string) || '';
    const role = (getConfig('user-role') as string) || 'admin';
    return { email, name, role };
  });

  ipcMain.handle('auth:sign-out', async () => {
    setConfig('auth-token', '');
    setConfig('user-email', '');
    setConfig('user-name', '');
    setConfig('user-role', '');
    setConfig('offline-mode', '');
    console.log('[Auth] Signed out');
  });

  // [OFFLINE_MODE] — Continue without backend authentication.
  // Stores a local-only user with admin role (no credit restrictions).
  ipcMain.handle('auth:continue-offline', async () => {
    setConfig('auth-token', '');
    setConfig('user-email', 'offline@meetvora.local');
    setConfig('user-name', 'Offline User');
    setConfig('user-role', 'admin');
    setConfig('offline-mode', 'true');
    console.log('[Auth] Continuing in offline mode');
    return { success: true, user: { email: 'offline@meetvora.local', name: 'Offline User', role: 'admin' } };
  });

  ipcMain.handle('auth:login', async (_event, data: { email: string; password: string }) => {
    try {
      const resp = await backendPostNoAuth('/auth/login', { email: data.email, password: data.password });
      const payload = resp.data ?? resp;
      const user = payload.user;
      const token = payload.accessToken;
      if (!token) throw new Error('No access token received');
      setConfig('auth-token', token);
      setConfig('user-email', user?.email || data.email);
      setConfig('user-name', user?.name || '');
      setConfig('user-role', user?.role || 'admin');
      console.log('[Auth] Login successful:', user?.email, 'role:', user?.role);
      return { success: true, user: { email: user?.email || data.email, name: user?.name || '', role: user?.role || 'admin' } };
    } catch (err: any) {
      console.error('[Auth] Login failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('auth:register', async (_event, data: { name: string; email: string; password: string }) => {
    try {
      const resp = await backendPostNoAuth('/auth/register', { name: data.name, email: data.email, password: data.password });
      const payload = resp.data ?? resp;
      const user = payload.user;
      const token = payload.accessToken;
      if (!token) throw new Error('No access token received');
      setConfig('auth-token', token);
      setConfig('user-email', user?.email || data.email);
      setConfig('user-name', user?.name || data.name);
      setConfig('user-role', user?.role || 'admin');
      console.log('[Auth] Registration successful:', user?.email, 'role:', user?.role);
      return { success: true, user: { email: user?.email || data.email, name: user?.name || data.name, role: user?.role || 'admin' } };
    } catch (err: any) {
      console.error('[Auth] Registration failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ─── USER PROFILE & CREDITS (Backend API) ─────────────────

  ipcMain.handle('user:get-profile', async () => {
    try {
      const resp = await backendGet('/users/me');
      const payload = resp.data ?? resp;
      return {
        success: true,
        user: payload.user,
        subscription: payload.subscription || null,
        totalCredits: payload.totalCredits ?? 0,
      };
    } catch (err: any) {
      console.error('[IPC] Failed to fetch user profile:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('user:get-credits', async () => {
    try {
      const resp = await backendGet('/users/me');
      const payload = resp.data ?? resp;
      return { success: true, credits: payload.totalCredits ?? 0 };
    } catch (err: any) {
      console.error('[IPC] Failed to fetch credits:', err.message);
      return { success: false, credits: 0, error: err.message };
    }
  });

  // ─── TELEPROMPTER MODE ──────────────────────────────────────

  ipcMain.handle('window:toggle-teleprompter', () => {
    const win = getWindow();
    if (!win) return false;

    teleprompterActive = !teleprompterActive;

    if (teleprompterActive) {
      const { screen: electronScreen } = require('electron');
      const display = electronScreen.getPrimaryDisplay();
      const sw = display.workAreaSize.width;
      // Thin bar at top-center, near webcam
      const barWidth = Math.min(sw - 40, 900);
      const barHeight = 140;
      const x = Math.round((sw - barWidth) / 2);
      win.setBounds({ x, y: 4, width: barWidth, height: barHeight });
      win.setAlwaysOnTop(true, 'screen-saver');
    } else {
      // Restore default size
      win.setBounds({ x: 100, y: 100, width: 420, height: 720 });
    }

    console.log('[IPC] Teleprompter mode:', teleprompterActive);
    return teleprompterActive;
  });
}
