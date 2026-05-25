/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WEBAPP_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Type declarations for the Electron API exposed via preload script.
 * This is available on `window.electronAPI` in the renderer process.
 */
interface ElectronAPI {
  // Audio controls
  startCapture: () => Promise<string>;
  stopCapture: (sessionId: string) => Promise<void>;
  sendAudioChunk: (buffer: ArrayBuffer) => void;
  sendVoiceQuestion: (buffer: ArrayBuffer) => void;
  sendTextQuestion: (question: string) => void;
  captureScreenshot: () => void;
  captureScreenshotToClipboard: () => Promise<{ success: boolean; error?: string }>;
  screenshotPasteToWebview: (webContentsId: number) => Promise<{ success: boolean; error?: string }>;

  // ChatGPT audio-listen mode
  sendChatGptAudioChunk: (buffer: ArrayBuffer) => void;
  insertTextToWebview: (webContentsId: number, text: string) => Promise<boolean>;
  onChatGptTranscript: (callback: (data: { text: string }) => void) => () => void;
  setInterviewContext: (data: { profile: string; jobDescription: string }) => Promise<boolean>;
  clearInterviewContext: () => Promise<boolean>;

  // Session management
  createSession: () => Promise<string>;
  endSession: (sessionId: string) => Promise<void>;
  getSessions: () => Promise<import('./types').Session[]>;
  getSessionMessages: (sessionId: string) => Promise<import('./types').Message[]>;

  // Settings
  setApiKey: (key: string) => Promise<void>;
  hasApiKey: () => Promise<boolean>;
  saveModelPrefs: (prefs: {
    chatModel?: string;
    visionModel?: string;
    transcriptModel?: string;
  }) => Promise<boolean>;
  loadModelPrefs: () => Promise<{
    chatModel: string;
    visionModel: string;
    transcriptModel: string;
  }>;
  savePreferences: (prefs: {
    answerSize?: string;
    screenshotMode?: string;
    customScreenshotPrompt?: string;
    interviewLanguage?: string;
  }) => Promise<boolean>;
  loadPreferences: () => Promise<{
    answerSize: string;
    screenshotMode: string;
    customScreenshotPrompt: string;
    interviewLanguage: string;
  }>;

  // Window controls
  toggleAlwaysOnTop: () => Promise<boolean>;
  toggleStealth: () => Promise<boolean>;
  positionWindow: (position: string) => void;
  toggleVisibility: () => void;
  toggleTeleprompter: () => Promise<boolean>;
  minimizeWindow: () => void;
  closeWindow: () => void;
  openExternal: (url: string) => Promise<void>;

  // Event listeners (Main → Renderer)
  onTranscript: (callback: (data: { text: string; timestamp: string }) => void) => () => void;
  onAIResponseChunk: (callback: (data: { chunk: string; sessionId: string }) => void) => () => void;
  onAIResponseComplete: (callback: (data: { fullText: string; sessionId: string }) => void) => () => void;
  onSuggestions: (callback: (data: { suggestions: string[] }) => void) => () => void;
  onStealthChanged: (callback: (enabled: boolean) => void) => () => void;
  onStatusChange: (callback: (data: { status: string }) => void) => () => void;
  onError: (callback: (data: { message: string; code?: string }) => void) => () => void;
}

interface Window {
  electronAPI: ElectronAPI;
}
