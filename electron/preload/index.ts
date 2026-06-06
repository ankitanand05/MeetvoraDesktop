/**
 * Electron Preload — Context Bridge API
 * Exposes window.electronAPI to the renderer securely.
 */

import { contextBridge, ipcRenderer } from 'electron';

/* ─── Types ──────────────────────────────────── */

export type AppStatus = 'idle' | 'listening' | 'processing' | 'error';

export interface TranscriptEvent {
  text: string;
  timestamp: string;
}

export interface AIChunkEvent {
  chunk: string;
  sessionId: string;
}

export interface AICompleteEvent {
  fullText: string;
  sessionId: string;
}

export interface ErrorEvent {
  message: string;
  code?: string;
}

/* ─── API Object ──────────────────────────────── */

const electronAPI = {

  /* ─── Audio ───────────────────────────────── */

  startCapture: (): Promise<string> =>
    ipcRenderer.invoke('audio:start'),

  stopCapture: (sessionId: string): Promise<void> =>
    ipcRenderer.invoke('audio:stop', sessionId),

  sendAudioChunk: (buffer: ArrayBuffer): void => {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 1000) return;
    ipcRenderer.send('audio:chunk', buffer);
  },

  sendVoiceQuestion: (buffer: ArrayBuffer): void => {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 500) return;
    ipcRenderer.send('voice:question', buffer);
  },

  sendTextQuestion: (question: string): void => {
    if (!question || typeof question !== 'string' || !question.trim()) return;
    ipcRenderer.send('text:question', question.trim());
  },

  captureScreenshot: (): void => {
    ipcRenderer.send('screenshot:capture');
  },

  captureScreenshotToClipboard: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('screenshot:to-clipboard'),

  screenshotPasteToWebview: (webContentsId: number): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('screenshot:paste-to-webview', webContentsId),

  /* ─── ChatGPT Audio-Listen ────────────────────────────── */

  /** Send a raw WebM audio chunk for transcription (ChatGPT listen mode) */
  sendChatGptAudioChunk: (buffer: ArrayBuffer): void => {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 500) return;
    ipcRenderer.send('chatgpt:audio-chunk', buffer);
  },

  /** Insert plain text into the focused element of a webview */
  insertTextToWebview: (webContentsId: number, text: string): Promise<boolean> =>
    ipcRenderer.invoke('chatgpt:insert-text', { webContentsId, text }),

  /** Subscribe to transcripts produced by ChatGPT listen mode */
  onChatGptTranscript: (callback: (data: { text: string }) => void) => {
    const handler = (_: unknown, data: { text: string }) => callback(data);
    ipcRenderer.on('chatgpt:transcript', handler);
    return () => ipcRenderer.removeListener('chatgpt:transcript', handler);
  },

  /**
   * Ghost cursor — OS-level cursor position streamed from main process at ~60 fps.
   * Works even when the cursor is over a <webview> (which swallows DOM events).
   * Coordinates are window-relative DIPs.
   */
  onCursorPos: (callback: (pos: { x: number; y: number }) => void) => {
    const handler = (_: unknown, pos: { x: number; y: number }) => callback(pos);
    ipcRenderer.on('cursor:pos', handler);
    return () => ipcRenderer.removeListener('cursor:pos', handler);
  },

  /**
   * Tell the main process to enable / disable setContentProtection for the
   * ghost cursor.  When enabled the window content (including the DOM cursor
   * elements) is invisible to screen-sharing and recording tools while still
   * visible on the user's own screen.
   */
  setGhostCursorProtection: (enabled: boolean): Promise<boolean> =>
    ipcRenderer.invoke('window:set-ghost-cursor-protection', enabled),

  /* ─── Context ─────────────────────────────── */

  setInterviewContext: (data: { profile: string; jobDescription: string }): Promise<boolean> =>
    ipcRenderer.invoke('context:set-interview', data),

  clearInterviewContext: (): Promise<boolean> =>
    ipcRenderer.invoke('context:clear-interview'),

  /* ─── Sessions ─────────────────────────────── */

  createSession: (): Promise<string> =>
    ipcRenderer.invoke('session:create'),

  endSession: (sessionId: string): Promise<void> =>
    ipcRenderer.invoke('session:end', sessionId),

  getSessions: (): Promise<any[]> =>
    ipcRenderer.invoke('session:get-all'),

  getSessionMessages: (sessionId: string): Promise<any[]> =>
    ipcRenderer.invoke('session:get-messages', sessionId),

  /* ─── Settings ─────────────────────────────── */

  setApiKey: (key: string): Promise<void> => {
    if (!key || typeof key !== 'string') return Promise.reject(new Error('Invalid API key'));
    if (!key.startsWith('sk-')) return Promise.reject(new Error('API key must start with "sk-"'));
    return ipcRenderer.invoke('settings:set-api-key', key.replace(/\s+/g, ''));
  },

  hasApiKey: (): Promise<boolean> =>
    ipcRenderer.invoke('settings:has-api-key'),

  saveModelPrefs: (prefs: {
    chatModel?: string;
    visionModel?: string;
    transcriptModel?: string;
  }): Promise<boolean> =>
    ipcRenderer.invoke('settings:save-model-prefs', prefs),

  loadModelPrefs: (): Promise<{
    chatModel: string;
    visionModel: string;
    transcriptModel: string;
  }> =>
    ipcRenderer.invoke('settings:load-model-prefs'),

  savePreferences: (prefs: {
    answerSize?: string;
    screenshotMode?: string;
    customScreenshotPrompt?: string;
    interviewLanguage?: string;
  }): Promise<boolean> =>
    ipcRenderer.invoke('settings:save-prefs', prefs),

  loadPreferences: (): Promise<{
    answerSize: string;
    screenshotMode: string;
    customScreenshotPrompt: string;
    interviewLanguage: string;
  }> =>
    ipcRenderer.invoke('settings:load-prefs'),

  /* ─── Window ───────────────────────────────── */

  shrinkWindow: (): Promise<boolean> =>
    ipcRenderer.invoke('window:shrink-toggle'),

  mediumWindow: (): Promise<boolean> =>
    ipcRenderer.invoke('window:medium-toggle'),

  toggleAlwaysOnTop: (): Promise<boolean> =>
    ipcRenderer.invoke('window:toggle-aot'),

  toggleStealth: (): Promise<boolean> =>
    ipcRenderer.invoke('window:toggle-stealth'),

  positionWindow: (position: string): void =>
    ipcRenderer.send('window:position', position),

  toggleVisibility: (): void =>
    ipcRenderer.send('window:toggle-visibility'),

  toggleTeleprompter: (): Promise<boolean> =>
    ipcRenderer.invoke('window:toggle-teleprompter'),

  minimizeWindow: (): void =>
    ipcRenderer.send('window:minimize'),

  closeWindow: (): void =>
    ipcRenderer.send('window:close'),

  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('shell:open-external', url),

  /* ─── Events ───────────────────────────────── */

  onTranscript: (callback: (data: TranscriptEvent) => void) => {
    const handler = (_: unknown, data: TranscriptEvent) => callback(data);
    ipcRenderer.on('transcript:new', handler);
    return () => ipcRenderer.removeListener('transcript:new', handler);
  },

  onAIResponseChunk: (callback: (data: AIChunkEvent) => void) => {
    const handler = (_: unknown, data: AIChunkEvent) => callback(data);
    ipcRenderer.on('ai:response-chunk', handler);
    return () => ipcRenderer.removeListener('ai:response-chunk', handler);
  },

  onAIResponseComplete: (callback: (data: AICompleteEvent) => void) => {
    const handler = (_: unknown, data: AICompleteEvent) => callback(data);
    ipcRenderer.on('ai:response-complete', handler);
    return () => ipcRenderer.removeListener('ai:response-complete', handler);
  },

  onSuggestions: (callback: (data: { suggestions: string[] }) => void) => {
    const handler = (_: unknown, data: { suggestions: string[] }) => callback(data);
    ipcRenderer.on('ai:suggestions', handler);
    return () => ipcRenderer.removeListener('ai:suggestions', handler);
  },

  onStealthChanged: (callback: (enabled: boolean) => void) => {
    const handler = (_: unknown, enabled: boolean) => callback(enabled);
    ipcRenderer.on('stealth:changed', handler);
    return () => ipcRenderer.removeListener('stealth:changed', handler);
  },

  onStatusChange: (callback: (data: { status: AppStatus }) => void) => {
    const handler = (_: unknown, data: { status: AppStatus }) => callback(data);
    ipcRenderer.on('status:change', handler);
    return () => ipcRenderer.removeListener('status:change', handler);
  },

  onError: (callback: (data: ErrorEvent) => void) => {
    const handler = (_: unknown, data: ErrorEvent) => callback(data);
    ipcRenderer.on('error:occurred', handler);
    return () => ipcRenderer.removeListener('error:occurred', handler);
  },
};

Object.freeze(electronAPI);
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
