/**
 * Config Module (Secure Version)
 *
 * Stores config securely using AES-256 encryption.
 * Cross-platform locations:
 *   Windows: %APPDATA%/Meetvora/config.json
 *   macOS:   ~/Library/Application Support/Meetvora/config.json
 *   Linux:   ~/.config/Meetvora/config.json
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app } from 'electron';

let configData: Record<string, any> = {};
let configFilePath = '';
let isLoaded = false;

const ENCRYPTION_SECRET = 'ai-copilot-super-secret-key-v1';

function getEncryptionKey(): Buffer {
  return crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();
}

/* ─────────────────────────────────────────────── */
/* ENCRYPT / DECRYPT                              */
/* ─────────────────────────────────────────────── */

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final(),
  ]);

  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(encryptedText: string): string {
  // Validate format before decrypting
  if (typeof encryptedText !== 'string' || !encryptedText.includes(':')) {
    throw new Error('Invalid encrypted format');
  }

  const parts = encryptedText.split(':');

  if (parts.length !== 2) {
    throw new Error('Malformed encrypted value');
  }

  const [ivHex, encryptedHex] = parts;

  if (!ivHex || !encryptedHex) {
    throw new Error('Missing IV or encrypted payload');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-cbc', getEncryptionKey(), iv);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/* ─────────────────────────────────────────────── */
/* FILE HANDLING                                  */
/* ─────────────────────────────────────────────── */

function getConfigPath(): string {
  if (configFilePath) return configFilePath;

  const userDataPath = app.getPath('userData');

  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  configFilePath = path.join(userDataPath, 'config.json');
  return configFilePath;
}

function loadConfig(): void {
  if (isLoaded) return;

  const filePath = getConfigPath();

  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      configData = JSON.parse(raw);
    }
  } catch (error) {
    console.error('[Config] Failed to load config:', error);
    configData = {};
  }

  isLoaded = true;
}

function saveConfig(): void {
  const filePath = getConfigPath();
  const tempPath = filePath + '.tmp';

  try {
    fs.writeFileSync(tempPath, JSON.stringify(configData, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    console.error('[Config] Failed to save config:', error);
  }
}

/* ─────────────────────────────────────────────── */
/* PUBLIC API                                     */
/* ─────────────────────────────────────────────── */

const SENSITIVE_KEYS = ['openai-api-key', 'auth-token'];

export function getConfig(key: string): any {
  loadConfig();

  const value = configData[key];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (SENSITIVE_KEYS.includes(key)) {
    try {
      return decrypt(value);
    } catch (err) {
      console.warn('[Config] Invalid encrypted value. Clearing corrupted key.');
      
      // Auto-clean corrupted key
      delete configData[key];
      saveConfig();
      
      return undefined;
    }
  }

  return value;
}

export function setConfig(key: string, value: any): void {
  loadConfig();

  if (SENSITIVE_KEYS.includes(key)) {
    if (typeof value !== 'string' || value.length === 0) {
      delete configData[key];
    } else {
      configData[key] = encrypt(value);
    }
  } else {
    configData[key] = value;
  }

  saveConfig();
}

export function hasConfig(key: string): boolean {
  const value = getConfig(key);
  return value !== undefined && value !== null && value !== '';
}
