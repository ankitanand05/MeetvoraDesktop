/**
 * Database Module — JSON File Store
 *
 * Embedded JSON-file database stored in the user's app data directory.
 * No native addons or external dependencies — pure Node.js, works offline.
 *
 * DB file location:  <userData>/meetvora-data.json
 *   Windows: %APPDATA%\Meetvora\meetvora-data.json
 *   macOS:   ~/Library/Application Support/Meetvora/meetvora-data.json
 *   Linux:   ~/.config/Meetvora/meetvora-data.json
 */

import { app } from 'electron';
import fs from 'fs';
import path from 'path';

/** Shape of the on-disk JSON store */
export interface StoreData {
  sessions: SessionRow[];
  messages: MessageRow[];
}

export interface SessionRow {
  id: string;
  start_time: string;
  end_time: string | null;
  created_at: string;
}

export interface MessageRow {
  id: string;
  session_id: string;
  type: 'transcript' | 'ai';
  content: string;
  timestamp: string;
  created_at: string;
}

/** Singleton store */
let store: StoreData | null = null;
let storePath = '';

/** Debounce / auto-save state */
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let autoSaveInterval: ReturnType<typeof setInterval> | null = null;
let dirty = false;

const FLUSH_DEBOUNCE_MS = 2_000;   // coalesce rapid writes — flush at most every 2 s
const AUTO_SAVE_MS      = 30_000;  // safety-net: flush every 30 s if dirty

function defaultStore(): StoreData {
  return { sessions: [], messages: [] };
}

/**
 * Persist the current store to disk atomically (write-then-rename).
 * Wrapped in try-catch so a single disk error never crashes the app.
 */
function writeStoreToDisk(): void {
  if (!store) return;
  try {
    const tmp = storePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(store), 'utf-8');
    fs.renameSync(tmp, storePath);
    dirty = false;
  } catch (err) {
    console.error('[DB] Failed to flush store to disk:', err);
  }
}

/**
 * Mark the store as dirty and schedule a debounced flush.
 * Call this after every in-memory mutation instead of writing immediately.
 */
export function flushStore(): void {
  dirty = true;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    writeStoreToDisk();
  }, FLUSH_DEBOUNCE_MS);
}

/**
 * Force an immediate synchronous flush (used at shutdown).
 */
export function flushStoreSync(): void {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (dirty) writeStoreToDisk();
}

/**
 * Initialize the JSON file store.
 * Call this once during app startup.
 */
export function initializeDatabase(): void {
  storePath = path.join(app.getPath('userData'), 'meetvora-data.json');

  if (fs.existsSync(storePath)) {
    try {
      const raw = fs.readFileSync(storePath, 'utf-8');
      store = JSON.parse(raw) as StoreData;
      // Ensure both arrays exist (defensive)
      if (!Array.isArray(store.sessions)) store.sessions = [];
      if (!Array.isArray(store.messages)) store.messages = [];
    } catch {
      console.warn('[DB] Corrupt store file — starting fresh');
      store = defaultStore();
      writeStoreToDisk();
    }
  } else {
    store = defaultStore();
    writeStoreToDisk();
  }

  // Periodic safety-net: flush every 30 s if there are unsaved changes
  autoSaveInterval = setInterval(() => {
    if (dirty) writeStoreToDisk();
  }, AUTO_SAVE_MS);

  console.log(`[DB] JSON store ready: ${storePath}`);
}

/**
 * Get the store data.
 * Throws if initializeDatabase() hasn't been called yet.
 */
export function getStore(): StoreData {
  if (!store) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return store;
}

/**
 * Close / flush the store gracefully.
 * Call this during app shutdown.
 */
export function closeDatabase(): void {
  if (autoSaveInterval) { clearInterval(autoSaveInterval); autoSaveInterval = null; }
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (store) {
    if (dirty) writeStoreToDisk();
    store = null;
    console.log('[DB] Store flushed and closed');
  }
}
