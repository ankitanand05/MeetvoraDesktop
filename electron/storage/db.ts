/**
 * Database Module — SQLite (better-sqlite3)
 *
 * Embedded SQLite database stored in the user's app data directory.
 * No external server or Docker required — zero-install, works offline.
 *
 * DB file location:  <userData>/meetvora.db
 *   Windows: %APPDATA%\Meetvora\meetvora.db
 *   macOS:   ~/Library/Application Support/Meetvora/meetvora.db
 *   Linux:   ~/.config/Meetvora/meetvora.db
 */

import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';

/** Singleton database instance */
let db: Database.Database | null = null;

/** SQLite schema — created on first launch if tables don't exist yet */
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    start_time TEXT NOT NULL,
    end_time   TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id         TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    type       TEXT NOT NULL CHECK (type IN ('transcript', 'ai')),
    content    TEXT NOT NULL,
    timestamp  TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_start_time        ON sessions (start_time DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_session_id        ON messages (session_id);
  CREATE INDEX IF NOT EXISTS idx_messages_type              ON messages (type);
  CREATE INDEX IF NOT EXISTS idx_messages_session_timestamp ON messages (session_id, timestamp ASC);
`;

/**
 * Initialize the SQLite database.
 * Synchronous — creates the DB file and schema on first run.
 * Call this once during app startup.
 */
export function initializeDatabase(): void {
  const dbPath = path.join(app.getPath('userData'), 'meetvora.db');

  db = new Database(dbPath);

  // Enable WAL mode for better write performance; enforce FK constraints
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables and indexes (idempotent — safe to run on every startup)
  db.exec(SCHEMA_SQL);

  console.log(`[DB] SQLite ready: ${dbPath}`);
}

/**
 * Get the database instance.
 * Throws if initializeDatabase() hasn't been called yet.
 */
export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Close the database connection gracefully.
 * Call this during app shutdown.
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log('[DB] Database closed');
  }
}
