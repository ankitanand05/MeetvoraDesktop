/**
 * Session Repository
 *
 * Data access layer for sessions and messages using a JSON file store.
 * No native addons required — pure Node.js.
 * All public methods remain async so callers need no changes.
 */

import { v4 as uuidv4 } from 'uuid';
import { getStore, flushStore } from './db';
import type { SessionRow, MessageRow } from './db';

/** Re-export row types under the original names for backward compat */
export type Session = SessionRow;
export type Message = MessageRow;

/**
 * Session Repository — async methods for CRUD operations on sessions and messages.
 */
export class SessionRepo {
  /**
   * Create a new recording session.
   * @returns The new session ID
   */
  static async createSession(): Promise<string> {
    const id = uuidv4();
    const now = new Date().toISOString();

    getStore().sessions.push({
      id,
      start_time: now,
      end_time: null,
      created_at: now,
    });
    flushStore();

    console.log(`[SessionRepo] Created session: ${id}`);
    return id;
  }

  /**
   * End a recording session by setting its end_time.
   */
  static async endSession(sessionId: string): Promise<void> {
    const session = getStore().sessions.find((s) => s.id === sessionId);
    if (session) {
      session.end_time = new Date().toISOString();
      flushStore();
    }
    console.log(`[SessionRepo] Ended session: ${sessionId}`);
  }

  /**
   * Get all sessions, ordered by most recent first.
   */
  static async getAllSessions(): Promise<Session[]> {
    return [...getStore().sessions].sort(
      (a, b) => b.start_time.localeCompare(a.start_time)
    );
  }

  /**
   * Get a single session by ID.
   */
  static async getSession(sessionId: string): Promise<Session | undefined> {
    return getStore().sessions.find((s) => s.id === sessionId);
  }

  /**
   * Delete a session and all its messages.
   */
  static async deleteSession(sessionId: string): Promise<void> {
    const store = getStore();
    store.sessions = store.sessions.filter((s) => s.id !== sessionId);
    store.messages = store.messages.filter((m) => m.session_id !== sessionId);
    flushStore();
    console.log(`[SessionRepo] Deleted session: ${sessionId}`);
  }

  /**
   * Add a message (transcript or AI response) to a session.
   * @returns The new message ID
   */
  static async addMessage(
    sessionId: string,
    type: 'transcript' | 'ai',
    content: string,
    timestamp: string
  ): Promise<string> {
    const id = uuidv4();

    getStore().messages.push({
      id,
      session_id: sessionId,
      type,
      content,
      timestamp,
      created_at: new Date().toISOString(),
    });
    flushStore();

    return id;
  }

  /**
   * Get all messages for a session, ordered by timestamp.
   */
  static async getMessages(sessionId: string): Promise<Message[]> {
    return getStore()
      .messages.filter((m) => m.session_id === sessionId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /**
   * Get messages of a specific type for a session.
   */
  static async getMessagesByType(
    sessionId: string,
    type: 'transcript' | 'ai'
  ): Promise<Message[]> {
    return getStore()
      .messages.filter((m) => m.session_id === sessionId && m.type === type)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /**
   * Get the total count of messages in a session.
   */
  static async getMessageCount(sessionId: string): Promise<number> {
    return getStore().messages.filter((m) => m.session_id === sessionId).length;
  }
}
