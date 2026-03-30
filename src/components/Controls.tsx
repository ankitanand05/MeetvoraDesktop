/**
 * Controls — Compact bottom action bar
 */

import React, { useState, useRef, useEffect } from 'react';
import type { AppStatus } from '../types';
import { useTheme } from '../hooks/useTheme';

interface ControlsProps {
  status: AppStatus;
  onStart: () => void;
  onStop: () => void;
  onClear: () => void;
  onToggleText: () => void;
  isTextOpen: boolean;
  error: string | null;
  onOpenSettings: () => void;
  spacebarMode: 'click' | 'hold';
  audioDeviceId: string;
}

const Controls: React.FC<ControlsProps> = ({
  status,
  onStart,
  onStop,
  onClear,
  onToggleText,
  isTextOpen,
  error,
  onOpenSettings,
  spacebarMode,
  audioDeviceId,
}) => {
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const micRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micChunksRef = useRef<Blob[]>([]);
  const { isDark } = useTheme();

  const isListening = status === 'listening' || status === 'processing';
  const isProcessing = status === 'processing';

  const handleMicToggle = async () => {
    if (isRecordingMic) {
      if (micRecorderRef.current && micRecorderRef.current.state !== 'inactive') {
        micRecorderRef.current.stop();
      }
      return;
    }
    try {
      // System-audio virtual IDs (system-*, default) can't be used with getUserMedia — fall back to default mic
      const isRealDeviceId = audioDeviceId &&
        audioDeviceId !== 'default' &&
        !audioDeviceId.startsWith('system-');
      const audioConstraints: boolean | MediaTrackConstraints = isRealDeviceId
        ? { deviceId: { exact: audioDeviceId } }
        : true;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      micStreamRef.current = stream;
      micChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) micChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(micChunksRef.current, { type: mimeType });
        micChunksRef.current = [];
        if (micStreamRef.current) {
          micStreamRef.current.getTracks().forEach(t => t.stop());
          micStreamRef.current = null;
        }
        setIsRecordingMic(false);
        if (blob.size > 500) {
          const buffer = await blob.arrayBuffer();
          window.electronAPI.sendVoiceQuestion(buffer);
        }
      };
      recorder.start();
      micRecorderRef.current = recorder;
      setIsRecordingMic(true);
    } catch (err: any) {
      console.error('Mic access error:', err);
      setIsRecordingMic(false);
    }
  };

  const handleScreenshot = () => {
    window.electronAPI.captureScreenshot();
  };

  // Listen for keyboard shortcut event for mic toggle
  useEffect(() => {
    const handler = () => handleMicToggle();
    window.addEventListener('shortcut:mic', handler);
    return () => window.removeEventListener('shortcut:mic', handler);
  }, [isRecordingMic, isProcessing]);

  // Spacebar → controls the main audio session (same as green Start / Stop button)
  useEffect(() => {
    const clickHandler = (e: Event) => {
      const ce = e as CustomEvent<{ mode: string }>;
      if (ce.detail?.mode === 'click') {
        // Toggle the main system-audio session
        if (isListening) {
          onStop();
        } else if (!isProcessing) {
          onStart();
        }
      }
    };
    window.addEventListener('shortcut:spacebar', clickHandler);

    // Hold mode: hold Space → start session, release → stop + process
    const keydownHandler = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || spacebarMode !== 'hold' || e.repeat) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!isListening && !isProcessing) onStart();
    };
    const keyupHandler = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || spacebarMode !== 'hold') return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (isListening) onStop();
    };

    window.addEventListener('keydown', keydownHandler);
    window.addEventListener('keyup', keyupHandler);

    return () => {
      window.removeEventListener('shortcut:spacebar', clickHandler);
      window.removeEventListener('keydown', keydownHandler);
      window.removeEventListener('keyup', keyupHandler);
    };
  }, [isListening, isProcessing, spacebarMode, onStart, onStop]);

  return (
    <>
      {/* Error banner */}
      {error && (
        <div className="px-3 py-1 animate-fade-in" style={{ background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(254,226,226,0.8)', borderTop: '1px solid var(--glass-border)' }}>
          <p className="text-[10px] text-red-500 truncate flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </p>
        </div>
      )}

      {/* Main control bar — all icons on one row */}
      <div
        className="flex items-center justify-center px-2 py-1.5 transition-colors duration-300"
        style={{ background: 'var(--glass-bg-strong)', borderTop: '1px solid var(--glass-border)' }}
      >
        <div className="flex items-center gap-1">

          {/* Clear */}
          <button
            onClick={onClear}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            title="Clear (Ctrl+Shift+X)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>

          {/* Mic */}
          <button
            onClick={handleMicToggle}
            disabled={isProcessing}
            className="relative w-7 h-7 flex items-center justify-center rounded-lg transition-all disabled:opacity-30"
            style={{
              background: isRecordingMic
                ? (isDark ? 'rgba(239,68,68,0.2)' : 'rgba(254,226,226,1)')
                : (isDark ? 'rgba(139,92,246,0.18)' : 'rgba(237,233,254,1)'),
              color: isRecordingMic ? '#ef4444' : '#8b5cf6',
              border: `1px solid ${isRecordingMic
                ? (isDark ? 'rgba(239,68,68,0.3)' : '#fecaca')
                : (isDark ? 'rgba(139,92,246,0.25)' : '#ddd6fe')}`,
            }}
            title={isRecordingMic ? 'Stop & send (Ctrl+Shift+M)' : 'Voice (Ctrl+Shift+M)'}
          >
            {isRecordingMic && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
            )}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
            </svg>
          </button>

          {/* Type text */}
          <button
            onClick={onToggleText}
            disabled={isProcessing}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all disabled:opacity-30"
            style={{
              background: isTextOpen
                ? (isDark ? 'rgba(6,182,212,0.2)' : 'rgba(207,250,254,1)')
                : (isDark ? 'rgba(6,182,212,0.12)' : 'rgba(236,254,255,0.7)'),
              color: isTextOpen ? '#06b6d4' : (isDark ? '#22d3ee' : '#0891b2'),
              border: `1px solid ${isDark ? 'rgba(6,182,212,0.25)' : '#a5f3fc'}`,
            }}
            title="Type a question (Ctrl+Shift+T)"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
          </button>

          {/* Start */}
          <button
            onClick={onStart}
            disabled={isListening}
            className="w-9 h-9 flex items-center justify-center rounded-xl transition-all shadow-sm disabled:opacity-30"
            style={{
              background: isDark ? 'rgba(16,185,129,0.2)' : 'rgba(209,250,229,1)',
              color: '#10b981',
              border: `1px solid ${isDark ? 'rgba(16,185,129,0.3)' : '#a7f3d0'}`,
            }}
            title="Start (Ctrl+Shift+S)"
          >
            <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor">
              <polygon points="3,1 10,6 3,11" />
            </svg>
          </button>

          {/* Stop */}
          <button
            onClick={onStop}
            disabled={!isListening}
            className="w-9 h-9 flex items-center justify-center rounded-xl transition-all shadow-sm disabled:opacity-30"
            style={{
              background: isDark ? 'rgba(239,68,68,0.2)' : 'rgba(254,226,226,1)',
              color: '#ef4444',
              border: `1px solid ${isDark ? 'rgba(239,68,68,0.3)' : '#fecaca'}`,
            }}
            title="Stop (Ctrl+Shift+S)"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
              <rect x="2" y="2" width="8" height="8" rx="1" />
            </svg>
          </button>

          {/* Screenshot */}
          <button
            onClick={handleScreenshot}
            disabled={isProcessing}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all disabled:opacity-30"
            style={{
              background: isDark ? 'rgba(59,130,246,0.18)' : 'rgba(219,234,254,1)',
              color: '#3b82f6',
              border: `1px solid ${isDark ? 'rgba(59,130,246,0.25)' : '#bfdbfe'}`,
            }}
            title="Screenshot (Ctrl+Shift+P)"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
            style={{
              background: 'transparent',
              color: 'var(--text-muted)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            title="Settings"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
};

export default Controls;
