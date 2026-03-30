/**
 * useSettings — App-wide user preferences
 *
 * Persists to localStorage so choices survive between sessions.
 * Also syncs preferences that affect AI behaviour to the main process
 * via electronAPI.savePreferences().
 */

import { useState, useEffect, useCallback } from 'react';

/* ────────────────────────────────────────── */
/* Types                                      */
/* ────────────────────────────────────────── */

export type AnswerSize = 'small' | 'medium' | 'big';
export type ScreenshotMode = 'simple' | 'coding' | 'custom';
export type SpacebarMode = 'click' | 'hold';
export type ChatTextSize = 'small' | 'normal' | 'big';

export interface AppSettings {
  /** How verbose AI answers should be */
  answerSize: AnswerSize;
  /** How to analyse a captured screenshot */
  screenshotMode: ScreenshotMode;
  /** Freeform prompt used when screenshotMode === 'custom' */
  customScreenshotPrompt: string;
  /** BCP-47 language code sent to Whisper (e.g. 'en', 'hi', 'te') */
  interviewLanguage: string;
  /** deviceId from MediaDevices API — 'default' = system default */
  audioDeviceId: string;
  /** How spacebar triggers recording */
  spacebarMode: SpacebarMode;
  /** When true the window is made nearly invisible (for screen-share stealth) */
  seeThrough: boolean;
  /** Opacity of UI panels when seeThrough is off — 10 to 95 (%) */
  transparencyLevel: number;
  /** Font-size class for chat messages */
  chatTextSize: ChatTextSize;
}

/* ────────────────────────────────────────── */
/* Defaults                                   */
/* ────────────────────────────────────────── */

const STORAGE_KEY = 'meetvora-settings-v1';

export const DEFAULTS: AppSettings = {
  answerSize: 'medium',
  screenshotMode: 'simple',
  customScreenshotPrompt: '',
  interviewLanguage: 'en',
  audioDeviceId: 'default',
  spacebarMode: 'click',
  seeThrough: false,
  transparencyLevel: 55,
  chatTextSize: 'normal',
};

/** Language display name → BCP-47 code */
export const LANGUAGE_MAP: Record<string, string> = {
  English: 'en',
  Hindi: 'hi',
  Telugu: 'te',
  Kannada: 'kn',
  Tamil: 'ta',
  Marathi: 'mr',
  Bhojpuri: 'bho',
  Bengali: 'bn',
  Gujarati: 'gu',
  Malayalam: 'ml',
  German: 'de',
  'Chinese (Simplified)': 'zh',
  Russian: 'ru',
  Spanish: 'es',
  Arabic: 'ar',
};

export const LANGUAGE_NAMES = Object.keys(LANGUAGE_MAP);

/** BCP-47 code → display name */
export function languageCodeToName(code: string): string {
  const entry = Object.entries(LANGUAGE_MAP).find(([, v]) => v === code);
  return entry ? entry[0] : 'English';
}

/* ────────────────────────────────────────── */
/* Hook                                       */
/* ────────────────────────────────────────── */

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });

  /** Persist to localStorage on every change */
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch { /* ignore */ }
  }, [settings]);

  /** Sync AI-affecting preferences to main process */
  useEffect(() => {
    const prefs = {
      answerSize: settings.answerSize,
      screenshotMode: settings.screenshotMode,
      customScreenshotPrompt: settings.customScreenshotPrompt,
      interviewLanguage: settings.interviewLanguage,
    };
    window.electronAPI.savePreferences?.(prefs).catch(() => { /* offline ok */ });
  }, [
    settings.answerSize,
    settings.screenshotMode,
    settings.customScreenshotPrompt,
    settings.interviewLanguage,
  ]);

  const update = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings(prev => ({ ...prev, [key]: value }));
    },
    []
  );

  const reset = useCallback(() => setSettings(DEFAULTS), []);

  return { settings, update, reset };
}
