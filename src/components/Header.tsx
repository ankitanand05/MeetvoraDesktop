/**
 * Header Component — Sleek custom titlebar
 */

import React, { useState } from 'react';
import type { AppStatus } from '../types';
import { useTheme } from '../hooks/useTheme';

interface HeaderProps {
  status: AppStatus;
  isAlwaysOnTop: boolean;
  isStealth: boolean;
  onToggleAlwaysOnTop: () => void;
  onToggleStealth: () => void;
  onBack: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: 'F', action: 'Fullscreen / Restore', icon: '⛶' },
  { keys: 'R', action: 'Snap to right', icon: '→' },
  { keys: 'L', action: 'Snap to left', icon: '←' },
  { keys: 'C', action: 'Center top', icon: '↑' },
  { keys: 'Esc', action: 'Hide / Show window', icon: '👁' },
  { keys: '↑ ↓', action: 'Scroll content', icon: '↕' },
  { keys: 'Ctrl+Shift+S', action: 'Start / Stop', icon: '▶' },
  { keys: 'Ctrl+Shift+M', action: 'Voice question', icon: '🎤' },
  { keys: 'Ctrl+Shift+T', action: 'Type a question', icon: '✏' },
  { keys: 'Ctrl+Shift+X', action: 'Clear chat', icon: '🗑' },
  { keys: 'Ctrl+Shift+P', action: 'Screenshot', icon: '📸' },
  { keys: 'Ctrl+Shift+A', action: 'Pin / Unpin', icon: '📌' },
  { keys: 'Ctrl+Shift+H', action: 'Stealth mode', icon: '🔒' },
  { keys: 'G', action: 'Teleprompter mode', icon: '📝' },
  { keys: 'Ctrl+Shift+`', action: 'Show/Hide (global)', icon: '👻' },
];

const Header: React.FC<HeaderProps> = ({
  status,
  isAlwaysOnTop,
  isStealth,
  onToggleAlwaysOnTop,
  onToggleStealth,
  onBack,
  onMinimize,
  onClose,
}) => {
  const { isDark, toggle: toggleTheme } = useTheme();
  const [showShortcuts, setShowShortcuts] = useState(false);

  const getStatusDisplay = () => {
    switch (status) {
      case 'listening':
        return (
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[11px] text-emerald-400 font-medium">Listening</span>
          </div>
        );
      case 'processing':
        return (
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            <span className="text-[11px] text-amber-400 font-medium">Processing</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-[11px] text-red-400 font-medium">Error</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: 'var(--text-faint)' }} />
            <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Ready</span>
          </div>
        );
    }
  };

  return (
    <>
    <header
      className="titlebar-drag flex items-center justify-between px-3 py-2 select-none transition-colors duration-300"
      style={{ background: 'var(--glass-bg-strong)', borderBottom: '1px solid var(--glass-border)' }}
    >
      {/* Left: App branding */}
      <div className="titlebar-no-drag flex items-center gap-2">
        <button
          onClick={onBack}
          className="p-1.5 rounded-md transition-all duration-200"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          title="Back to dashboard"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </div>
        <div className="flex flex-col gap-0.5">
          <h1 className="text-[13px] font-semibold leading-none tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Meetvora
          </h1>
          {getStatusDisplay()}
        </div>
      </div>

      {/* Right: Window controls */}
      <div className="titlebar-no-drag flex items-center gap-0.5">
        {/* Dark / Light toggle */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-md transition-all duration-200"
          style={{
            background: isDark ? 'rgba(250,204,21,0.15)' : 'rgba(99,102,241,0.10)',
            color: isDark ? '#facc15' : '#6366f1',
          }}
          title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
        >
          {isDark ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        <button
          onClick={onToggleAlwaysOnTop}
          className="p-1.5 rounded-md transition-all duration-200"
          style={{
            background: isAlwaysOnTop ? (isDark ? 'rgba(6,182,212,0.2)' : 'rgba(6,182,212,0.12)') : 'transparent',
            color: isAlwaysOnTop ? '#06b6d4' : 'var(--text-muted)',
          }}
          title={isAlwaysOnTop ? 'Unpin (Ctrl+Shift+A)' : 'Pin on top (Ctrl+Shift+A)'}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill={isAlwaysOnTop ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 17v5" /><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
          </svg>
        </button>
        <button
          onClick={onToggleStealth}
          className="p-1.5 rounded-md transition-all duration-200"
          style={{
            background: isStealth ? (isDark ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.12)') : 'transparent',
            color: isStealth ? '#8b5cf6' : 'var(--text-muted)',
          }}
          title={isStealth ? 'Visible to screen share (Ctrl+Shift+H)' : 'Hide from screen share (Ctrl+Shift+H)'}
        >
          {isStealth ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>

        {/* Shortcuts help */}
        <button
          onClick={() => setShowShortcuts(prev => !prev)}
          className="p-1.5 rounded-md transition-all duration-200"
          style={{
            background: showShortcuts ? (isDark ? 'rgba(245,158,11,0.2)' : 'rgba(254,243,199,1)') : 'transparent',
            color: showShortcuts ? '#f59e0b' : 'var(--text-muted)',
          }}
          title="Keyboard shortcuts"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10" />
          </svg>
        </button>

        <button
          onClick={onMinimize}
          className="p-1.5 rounded-md transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          title="Minimize"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="2" y="5.5" width="8" height="1" rx="0.5" fill="currentColor" />
          </svg>
        </button>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = isDark ? 'rgba(239,68,68,0.15)' : 'rgba(254,226,226,1)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
          title="Close"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </header>

    {/* Keyboard Shortcuts Panel */}
    {showShortcuts && (
      <div
        className="px-3 py-2.5 animate-slide-up select-none"
        style={{
          background: 'var(--glass-bg-strong)',
          borderBottom: '1px solid var(--glass-border)',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            Keyboard Shortcuts
          </p>
          <button
            onClick={() => setShowShortcuts(false)}
            className="p-0.5 rounded transition-colors"
            style={{ color: 'var(--text-muted)' }}
            title="Close shortcuts"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {SHORTCUTS.map((s) => (
            <div
              key={s.keys}
              className="flex items-center justify-between py-1 px-2 rounded-lg"
              style={{ background: 'var(--surface-hover)' }}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] shrink-0">{s.icon}</span>
                <span className="text-[9px] font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
                  {s.action}
                </span>
              </div>
              <kbd
                className="text-[8px] font-mono px-1 py-0.5 rounded ml-1 shrink-0"
                style={{
                  background: 'var(--glass-bg-subtle)',
                  border: '1px solid var(--glass-border-strong)',
                  color: 'var(--text-primary)',
                }}
              >
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
        <p className="text-[9px] mt-2 text-center" style={{ color: 'var(--text-muted)' }}>
          Ctrl+Shift+` to show/hide from anywhere
        </p>
      </div>
    )}
    </>
  );
};

export default Header;
