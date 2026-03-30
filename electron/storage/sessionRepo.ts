/**
 * Session Repository
 *
 * Data access layer for sessions and messages using SQLite (better-sqlite3).
 * All public methods remain async so callers need no changes.
 * Internals use synchronous prepared statements for simplicity and performance.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db';

/** Session record from the database */
export interface Session {
  id: string;
  start_time: string;
  end_time: string | null;
  created_at: string;
}

/** Message record from the database */
export interface Message {
  id: string;
  session_id: string;
  type: 'transcript' | 'ai';
  content: string;
  timestamp: string;
  created_at: string;
}

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
    const startTime = new Date().toISOString();

    getDb()
      .prepare('INSERT INTO sessions (id, start_time) VALUES (?, ?)')
      .run(id, startTime);

    console.log(`[SessionRepo] Created session: ${id}`);
    return id;
  }

  /**
   * End a recording session by setting its end_time.
   */
  static async endSession(sessionId: string): Promise<void> {
    const endTime = new Date().toISOString();

    getDb()
      .prepare('UPDATE sessions SET end_time = ? WHERE id = ?')
      .run(endTime, sessionId);

    console.log(`[SessionRepo] Ended session: ${sessionId}`);
  }

  /**
   * Get all sessions, ordered by most recent first.
   */
  static async getAllSessions(): Promise<Session[]> {
    return getDb()
      .prepare('SELECT id, start_time, end_time, created_at FROM sessions ORDER BY start_time DESC')
      .all() as Session[];
  }

  /**
   * Get a single session by ID.
   */
  static async getSession(sessionId: string): Promise<Session | undefined> {
    return getDb()
      .prepare('SELECT id, start_time, end_time, created_at FROM sessions WHERE id = ?')
      .get(sessionId) as Session | undefined;
  }

  /**
   * Delete a session and all its messages (cascades via FK).
   */
  static async deleteSession(sessionId: string): Promise<void> {
    getDb()
      .prepare('DELETE FROM sessions WHERE id = ?')
      .run(sessionId);

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

    getDb()
      .prepare('INSERT INTO messages (id, session_id, type, content, timestamp) VALUES (?, ?, ?, ?, ?)')
      .run(id, sessionId, type, content, timestamp);

    return id;
  }

  /**
   * Get all messages for a session, ordered by timestamp.
   */
  static async getMessages(sessionId: string): Promise<Message[]> {
    return getDb()
      .prepare(
        `SELECT id, session_id, type, content, timestamp, created_at
         FROM messages WHERE session_id = ? ORDER BY timestamp ASC`
      )
      .all(sessionId) as Message[];
  }

  /**
   * Get messages of a specific type for a session.
   */
  static async getMessagesByType(
    sessionId: string,
    type: 'transcript' | 'ai'
  ): Promise<Message[]> {
    return getDb()
      .prepare(
        `SELECT id, session_id, type, content, timestamp, created_at
         FROM messages WHERE session_id = ? AND type = ? ORDER BY timestamp ASC`
      )
      .all(sessionId, type) as Message[];
  }

  /**
   * Get the total count of messages in a session.
   */
  static async getMessageCount(sessionId: string): Promise<number> {
    const result = getDb()
      .prepare('SELECT COUNT(*) as count FROM messages WHERE session_id = ?')
      .get(sessionId) as { count: number } | undefined;

    return result?.count ?? 0;
  }
}
