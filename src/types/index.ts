/**
 * Shared Type Definitions
 *
 * TypeScript interfaces used across the renderer process.
 * These mirror the database structures from the main process.
 */

/** A recording session */
export interface Session {
  id: string;
  start_time: string;
  end_time: string | null;
  created_at: string;
}

/** A message (transcript or AI response) within a session */
export interface Message {
  id: string;
  session_id: string;
  type: 'transcript' | 'ai';
  content: string;
  timestamp: string;
  created_at: string;
}

/** Transcript entry displayed in the UI */
export interface TranscriptEntry {
  text: string;
  timestamp: string;
}

/** AI response entry displayed in the UI */
export interface AIResponse {
  text: string;
  isStreaming: boolean;
}

/** A single message in the chat view */
export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: string;
  isStreaming?: boolean;
}

/** Application status */
export type AppStatus = 'idle' | 'listening' | 'processing' | 'error';
