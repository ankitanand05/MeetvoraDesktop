/**
 * SettingsPanel — Full-screen settings overlay with 4 tabs.
 *
 * General  │ Audio  │ Shortcuts  │ Appearance
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  useSettings,
  LANGUAGE_NAMES,
  LANGUAGE_MAP,
  languageCodeToName,
  type AnswerSize,
  type ScreenshotMode,
  type SpacebarMode,
  type ChatTextSize,
} from '../hooks/useSettings';

/* ──────────────────────────────────────────────────── */
/* Props                                               */
/* ──────────────────────────────────────────────────── */

interface SettingsPanelProps {
  onClose: () => void;
  onViewHistory: () => void;
}

type Tab = 'general' | 'audio' | 'shortcuts' | 'appearance';

/* ──────────────────────────────────────────────────── */
/* Helpers — small reusable pieces                     */
/* ──────────────────────────────────────────────────── */

const Label: React.FC<{ title: string; desc: string }> = ({ title, desc }) => (
  <div>
    <p className="sp-label-title">{title}</p>
    <p className="sp-label-desc">{desc}</p>
  </div>
);

const Select: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  width?: string;
  label?: string;
}> = ({ value, onChange, options, width = 'w-44', label }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    aria-label={label ?? options.find(o => o.value === value)?.label ?? 'Select option'}
    className={`sp-select ${width}`}
  >
    {options.map(o => (
      <option key={o.value} value={o.value} className="sp-option">
        {o.label}
      </option>
    ))}
  </select>
);

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label?: string }> = ({ checked, onChange, label }) => (
  <button
    onClick={() => onChange(!checked)}
    aria-label={label ?? (checked ? 'Disable' : 'Enable')}
    aria-pressed={checked}
    className={`sp-toggle relative inline-flex h-5 w-9 shrink-0 rounded-full${checked ? ' sp-toggle--on' : ''}`}
  >
    <span className={`sp-toggle-knob absolute top-0.5 h-4 w-4 rounded-full${checked ? ' sp-toggle-knob--on' : ' sp-toggle-knob--off'}`} />
  </button>
);

const Row: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`sp-row flex items-center justify-between gap-3 py-3 ${className}`}>
    {children}
  </div>
);

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; desc: string }> = ({ icon, title, desc }) => (
  <div className="sp-section-header flex items-start gap-2.5 p-3">
    <span className="sp-section-header-icon">{icon}</span>
    <div>
      <p className="sp-section-header-title">{title}</p>
      <p className="sp-section-header-desc">{desc}</p>
    </div>
  </div>
);

/* ──────────────────────────────────────────────────── */
/* Tab icons                                          */
/* ──────────────────────────────────────────────────── */

const TabIcons: Record<Tab, React.ReactNode> = {
  general: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ),
  audio: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  ),
  shortcuts: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10" />
    </svg>
  ),
  appearance: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" stroke="none" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" stroke="none" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125 0-.967.78-1.75 1.75-1.75h2.064c3.078 0 5.413-2.418 5.413-5.437 0-4.963-4.445-9-9.94-9z" />
    </svg>
  ),
};

/* ──────────────────────────────────────────────────── */
/* Audio Device Picker                                */
/* ──────────────────────────────────────────────────── */

interface AudioDevice {
  deviceId: string;
  label: string;
  kind: string;
}

const SYSTEM_AUDIO_DEVICES: AudioDevice[] = [
  { deviceId: 'default', label: 'System Default (auto)', kind: 'audioinput' },
  { deviceId: 'system-auto', label: 'System Audio (auto-detect best method)', kind: 'audioinput' },
  { deviceId: 'system-capture', label: 'System Audio (screen capture method)', kind: 'audioinput' },
];

function useAudioDevices() {
  const [devices, setDevices] = useState<AudioDevice[]>(SYSTEM_AUDIO_DEVICES);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      // Request mic permission first so labels are available
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach(t => t.stop());
      } catch { /* can continue without labels */ }

      const all = await navigator.mediaDevices.enumerateDevices();
      const mics = all
        .filter(d => d.kind === 'audioinput')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone (${d.deviceId.slice(0, 8)}…)`,
          kind: d.kind,
        }));

      setDevices([...SYSTEM_AUDIO_DEVICES, ...mics]);
    } catch (err) {
      console.warn('[Audio devices] Failed to enumerate:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  return { devices, loading, refresh };
}

/* ──────────────────────────────────────────────────── */
/* SHORTCUTS DATA                                     */
/* ──────────────────────────────────────────────────── */

const SHORTCUTS = [
  { keys: 'Space', action: 'Record voice / get answer', icon: '🎤' },
  { keys: 'F', action: 'Fullscreen / Restore', icon: '⛶' },
  { keys: 'R', action: 'Snap to right', icon: '→' },
  { keys: 'L', action: 'Snap to left', icon: '←' },
  { keys: 'C', action: 'Center top', icon: '↑' },
  { keys: 'G', action: 'Teleprompter mode', icon: '📝' },
  { keys: 'Esc', action: 'Hide / Show window', icon: '👁' },
  { keys: '↑ / ↓', action: 'Scroll chat content', icon: '↕' },
  { keys: '1–5', action: 'Pick follow-up suggestion', icon: '#' },
  { keys: 'Ctrl+Shift+S', action: 'Start / Stop recording', icon: '▶' },
  { keys: 'Ctrl+Shift+M', action: 'Voice question', icon: '🎙' },
  { keys: 'Ctrl+Shift+T', action: 'Type a question', icon: '✏' },
  { keys: 'Ctrl+Shift+X', action: 'Clear chat', icon: '🗑' },
  { keys: 'Ctrl+Shift+P', action: 'Screenshot', icon: '📸' },
  { keys: 'Ctrl+Shift+A', action: 'Pin / Unpin on top', icon: '📌' },
  { keys: 'Ctrl+Shift+H', action: 'Stealth mode', icon: '🔒' },
  { keys: 'Ctrl+Shift+`', action: 'Global Show / Hide', icon: '👻' },
];

/* ──────────────────────────────────────────────────── */
/* Main Component                                      */
/* ──────────────────────────────────────────────────── */

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  onClose,
  onViewHistory,
}) => {
  const { settings, update } = useSettings();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [testingAudio, setTestingAudio] = useState(false);
  const audioTestRef = useRef<MediaStream | null>(null);

  /* ── API Key ── */
  const [apiKey, setApiKey] = useState('');
  const [apiKeyStatus, setApiKeyStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [apiKeyHasExisting, setApiKeyHasExisting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    window.electronAPI.hasApiKey()
      .then(has => setApiKeyHasExisting(has))
      .catch(() => {});
  }, []);

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) return;
    try {
      await window.electronAPI.setApiKey(apiKey.trim());
      setApiKeyHasExisting(true);
      setApiKeyStatus('saved');
      setApiKey('');
      setTimeout(() => setApiKeyStatus('idle'), 3000);
    } catch (_err: unknown) {
      setApiKeyStatus('error');
      setTimeout(() => setApiKeyStatus('idle'), 4000);
    }
  };

  /* ── Model preferences ── */
  const [chatModel, setChatModel] = useState('gpt-5-mini');
  const [visionModel, setVisionModel] = useState('gpt-4o-mini');
  const [transcriptModel, setTranscriptModel] = useState('gpt-4o-mini-transcribe-2025-12-15');

  useEffect(() => {
    try {
      window.electronAPI.loadModelPrefs()
        .then(prefs => {
          setChatModel(prefs.chatModel);
          setVisionModel(prefs.visionModel);
          setTranscriptModel(prefs.transcriptModel);
        })
        .catch(() => {});
    } catch { /* preload not yet rebuilt */ }
  }, []);

  const handleModelChange = (key: 'chatModel' | 'visionModel' | 'transcriptModel', value: string) => {
    if (key === 'chatModel') setChatModel(value);
    else if (key === 'visionModel') setVisionModel(value);
    else setTranscriptModel(value);
    try {
      window.electronAPI.saveModelPrefs({ [key]: value }).catch(() => {});
    } catch { /* preload not yet rebuilt */ }
  };

  /* ── Audio device list ── */
  const { devices, loading: loadingDevices, refresh: refreshDevices } = useAudioDevices();

  /* ── Test audio device ── */
  const handleTestAudio = async () => {
    if (testingAudio) {
      audioTestRef.current?.getTracks().forEach(t => t.stop());
      audioTestRef.current = null;
      setTestingAudio(false);
      return;
    }
    try {
      const constraints: MediaStreamConstraints = {
        audio: settings.audioDeviceId === 'default' || settings.audioDeviceId.startsWith('system')
          ? true
          : { deviceId: { exact: settings.audioDeviceId } },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      audioTestRef.current = stream;
      setTestingAudio(true);
      // Auto-stop after 5 s
      setTimeout(() => {
        stream.getTracks().forEach(t => t.stop());
        audioTestRef.current = null;
        setTestingAudio(false);
      }, 5000);
    } catch (err: any) {
      alert(`Audio test failed: ${err.message}`);
    }
  };

  // Cleanup on unmount
  useEffect(() => () => {
    audioTestRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  /* ── Tab label map for the header title ── */
  const tabTitle: Record<Tab, string> = {
    general: 'Settings',
    audio: 'Audio Settings',
    shortcuts: 'Keyboard Shortcuts',
    appearance: 'Appearance',
  };
  const tabDesc: Record<Tab, string> = {
    general: 'Meetvora AI preferences',
    audio: 'Configure audio input and troubleshoot issues',
    shortcuts: 'All keyboard shortcuts for quick control',
    appearance: "Customize Meetvora's look and feel",
  };

  return (
    <div className="sp-overlay absolute inset-0 z-50 flex flex-col rounded-xl overflow-hidden animate-fade-in">
      {/* ── Header ── */}
      <div className="sp-header flex-shrink-0 flex items-start justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="sp-icon-pill w-8 h-8 rounded-xl flex items-center justify-center shadow-lg">
            {TabIcons[activeTab]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="sp-header-title">{tabTitle[activeTab]}</h2>
            </div>
            <p className="sp-header-desc">{tabDesc[activeTab]}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="sp-close-btn w-8 h-8 flex items-center justify-center rounded-xl mt-0.5"
          aria-label="Close settings"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="sp-tabs-bar flex-shrink-0 flex items-center px-3 py-1.5 gap-0.5">
        {(['general', 'audio', 'shortcuts', 'appearance'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            role="tab"
            aria-label={tab.charAt(0).toUpperCase() + tab.slice(1)}
            aria-selected={activeTab === tab}
            className={`sp-tab-btn flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg capitalize${activeTab === tab ? ' sp-tab-btn--active' : ''}`}
          >
            {TabIcons[tab]}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">

        {/* ══ GENERAL TAB ══ */}
        {activeTab === 'general' && (
          <div>

            {/* ── API Key ── */}
            <div className="sp-row flex-col items-start gap-2 py-3">
              <div className="flex items-center justify-between w-full">
                <Label
                  title="OpenAI API Key"
                  desc={apiKeyHasExisting ? '✓ Key saved — enter a new one to replace it' : 'Required to use all AI features'}
                />
                {apiKeyHasExisting && (
                  <span className="sp-credit-indigo text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Saved
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 w-full mt-1">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveApiKey(); }}
                  placeholder={apiKeyHasExisting ? 'sk-… (enter new key to replace)' : 'sk-…'}
                  className="sp-textarea sp-api-input flex-1"
                  aria-label="OpenAI API key input"
                />
                <button
                  onClick={() => setShowApiKey(v => !v)}
                  className="sp-btn-icon w-8 h-8 flex items-center justify-center rounded-lg"
                  aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                >
                  {showApiKey ? (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
                <button
                  onClick={handleSaveApiKey}
                  disabled={!apiKey.trim()}
                  className="sp-btn-history flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all disabled:opacity-40"
                  aria-label="Save API key"
                >
                  {apiKeyStatus === 'saved' ? '✓ Saved' : apiKeyStatus === 'error' ? '✗ Invalid key' : 'Save'}
                </button>
              </div>
            </div>

            {/* ── Model Selection ── */}
            <Row>
              <Label
                title="Chat / AI Model"
                desc="Model used for all voice, text, and interview responses"
              />
              <Select
                value={chatModel}
                onChange={v => handleModelChange('chatModel', v)}
                options={[
                  { value: 'gpt-5-mini', label: 'GPT-5 Mini (recommended)' },
                  { value: 'gpt-5-pro', label: 'GPT-5 Pro' },
                  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (fast)' },
                  { value: 'gpt-4o', label: 'GPT-4o' },
                  { value: 'gpt-4.1', label: 'GPT-4.1' },
                  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
                ]}
                label="Chat Model"
              />
            </Row>

            <Row>
              <Label
                title="Vision Model"
                desc="Model used for screenshot analysis"
              />
              <Select
                value={visionModel}
                onChange={v => handleModelChange('visionModel', v)}
                options={[
                  { value: 'gpt-4o', label: 'GPT-4o (best quality)' },
                  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (fast)' },
                  { value: 'gpt-4.1', label: 'GPT-4.1' },
                ]}
                label="Vision Model"
              />
            </Row>

            <Row>
              <Label
                title="Transcription Model"
                desc="Model used to convert your speech to text"
              />
              <Select
                value={transcriptModel}
                onChange={v => handleModelChange('transcriptModel', v)}
                options={[
                  { value: 'gpt-4o-mini-transcribe-2025-12-15', label: 'GPT-4o Mini Transcribe' },
                  { value: 'gpt-4o-transcribe', label: 'GPT-4o Transcribe (best)' },
                  { value: 'whisper-1', label: 'Whisper-1 (classic)' },
                ]}
                label="Transcription Model"
              />
            </Row>

            <Row>
              <Label
                title="Answer Size"
                desc="How Big/Small your Answers should be"
              />
              <Select
                value={settings.answerSize}
                onChange={v => update('answerSize', v as AnswerSize)}
                options={[
                  { value: 'small', label: 'Small' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'big', label: 'Big' },
                ]}
                label="Answer Size"
              />
            </Row>

            <Row>
              <Label
                title="Screenshot Reply Mode"
                desc="How Meetvora should answer when you capture a screenshot"
              />
              <Select
                value={settings.screenshotMode}
                onChange={v => update('screenshotMode', v as ScreenshotMode)}
                options={[
                  { value: 'simple', label: 'Simple Answer' },
                  { value: 'coding', label: 'Coding challenges' },
                  { value: 'custom', label: 'Custom prompt…' },
                ]}
                label="Screenshot Reply Mode"
              />
            </Row>

            {settings.screenshotMode === 'custom' && (
              <div className="sp-custom-prompt-wrap pb-3">
                <textarea
                  value={settings.customScreenshotPrompt}
                  onChange={e => update('customScreenshotPrompt', e.target.value)}
                  placeholder="Enter your custom screenshot analysis prompt…"
                  rows={3}
                  className="sp-textarea"
                  aria-label="Custom screenshot prompt"
                />
              </div>
            )}

            <Row>
              <Label
                title="Interview language"
                desc="Language you will speak during voice interviews. Used for transcription."
              />
              <Select
                value={languageCodeToName(settings.interviewLanguage)}
                onChange={v => update('interviewLanguage', LANGUAGE_MAP[v] ?? 'en')}
                options={LANGUAGE_NAMES.map(name => ({ value: name, label: name }))}
                label="Interview Language"
              />
            </Row>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-3 pb-1 flex-wrap">
              <button
                onClick={onViewHistory}
                className="sp-btn-history flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M12 7v5l4 2" />
                </svg>
                View History
              </button>
            </div>
          </div>
        )}

        {/* ══ AUDIO TAB ══ */}
        {activeTab === 'audio' && (
          <div>
            <SectionHeader
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              }
              title="Audio Troubleshooting"
              desc="Having problems with audio? Adjust these settings to fix audio input issues."
            />

            {/* Audio Input Device */}
            <div className="sp-audio-device-wrap py-3">
              <Label
                title="Audio Input Device"
                desc="Select your microphone or audio input device"
              />
              <div className="flex items-center gap-1.5 mt-2">
                <select
                  value={settings.audioDeviceId}
                  onChange={e => update('audioDeviceId', e.target.value)}
                  aria-label="Audio Input Device"
                  className="sp-select flex-1"
                >
                  {SYSTEM_AUDIO_DEVICES.map(d => (
                    <option key={d.deviceId} value={d.deviceId} className="sp-option">{d.label}</option>
                  ))}
                  <option disabled>── Microphones (External Audio Only) ──</option>
                  {devices
                    .filter(d => !d.deviceId.startsWith('system') && d.deviceId !== 'default')
                    .map(d => (
                      <option key={d.deviceId} value={d.deviceId} className="sp-option">{d.label}</option>
                    ))}
                </select>

                {/* Refresh */}
                <button
                  onClick={refreshDevices}
                  disabled={loadingDevices}
                  className="sp-btn-icon w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-50"
                  aria-label="Refresh audio devices"
                >
                  <svg
                    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={loadingDevices ? 'animate-spin' : ''}
                  >
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                </button>

                {/* Test */}
                <button
                  onClick={handleTestAudio}
                  aria-label={testingAudio ? 'Stop audio test' : 'Test audio device'}
                  className={`sp-btn-test flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg${testingAudio ? ' sp-btn-test--active' : ''}`}
                >
                  {testingAudio ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                      Stop
                    </>
                  ) : (
                    <>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                      </svg>
                      Test
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Spacebar Mode */}
            <Row>
              <Label
                title="Spacebar Mode"
                desc="Choose how spacebar controls recording"
              />
              <Select
                value={settings.spacebarMode}
                onChange={v => update('spacebarMode', v as SpacebarMode)}
                options={[
                  { value: 'click', label: 'Click to Record/get Answer' },
                  { value: 'hold', label: 'Hold to Record, release to get answer' },
                ]}
                width="w-52"
                label="Spacebar Mode"
              />
            </Row>
          </div>
        )}

        {/* ══ SHORTCUTS TAB ══ */}
        {activeTab === 'shortcuts' && (
          <div className="space-y-0.5 pt-1">
            {SHORTCUTS.map(s => (
              <div key={s.keys} className="sp-shortcut-row flex items-center justify-between py-2 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px]">{s.icon}</span>
                  <span className="sp-shortcut-action">{s.action}</span>
                </div>
                <span className="sp-shortcut-key">{s.keys}</span>
              </div>
            ))}
          </div>
        )}

        {/* ══ APPEARANCE TAB ══ */}
        {activeTab === 'appearance' && (
          <div>
            {/* Transparency Mode */}
            <SectionHeader
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              }
              title="Transparency Mode"
              desc="Make Meetvora see-through for screen sharing and presentations."
            />

            <Row>
              <Label
                title="See-through Mode"
                desc="Enable transparency to make Meetvora invisible during screen sharing"
              />
              <Toggle
                checked={settings.seeThrough}
                onChange={v => update('seeThrough', v)}
                label="See-through mode"
              />
            </Row>

            {settings.seeThrough && (
              <div className="sp-active-badge flex items-center gap-2 py-2 px-3">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="sp-active-badge-icon">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="sp-active-badge-text">Transparency Mode Active</span>
              </div>
            )}

            {/* Opacity slider — visible when NOT in full see-through mode */}
            {!settings.seeThrough && (
              <div className="sp-opacity-section py-3">
                <div className="flex items-center justify-between mb-2">
                  <Label
                    title="Window Opacity"
                    desc="Control how transparent the window panels are"
                  />
                  <span className="sp-opacity-value">{settings.transparencyLevel}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={95}
                  value={settings.transparencyLevel}
                  onChange={e => update('transparencyLevel', parseInt(e.target.value))}
                  aria-label="Window opacity"
                  className="sp-range-slider w-full"
                  /* stylelint-disable-next-line */
                  ref={el => { if (el) el.style.setProperty('--range-pct', `${settings.transparencyLevel}%`); }}
                />
                <div className="flex justify-between mt-1">
                  <span className="sp-opacity-hint">10% (nearly transparent)</span>
                  <span className="sp-opacity-hint">95% (solid)</span>
                </div>
              </div>
            )}

            {/* Chat Text Size */}
            <SectionHeader
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="4 7 4 4 20 4 20 7" />
                  <line x1="9" y1="20" x2="15" y2="20" />
                  <line x1="12" y1="4" x2="12" y2="20" />
                </svg>
              }
              title="Chat Text Size"
              desc="Adjust the size of chat message text."
            />

            <Row>
              <Label
                title="Text Size"
                desc="Choose text size for chat messages (Small, Normal, or Big)"
              />
              <Select
                value={settings.chatTextSize}
                onChange={v => update('chatTextSize', v as ChatTextSize)}
                options={[
                  { value: 'small', label: 'Small' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'big', label: 'Big' },
                ]}
                label="Chat Text Size"
              />
            </Row>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="sp-footer flex-shrink-0 px-4 py-2 text-center">
        <button
          onClick={() => window.electronAPI.openExternal('https://meetvora.com/guide').catch(() => {})}
          className="sp-footer-link"
          aria-label="Open complete guide to Meetvora"
        >
          Complete guide to Meetvora&apos;s features, settings, and capabilities
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;
