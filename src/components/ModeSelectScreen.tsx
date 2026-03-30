/**
 * ModeSelectScreen — First screen shown when app opens.
 * User picks one of: Interview, Meeting Assistant, Custom Assistant.
 */

import React from 'react';
import { useTheme } from '../hooks/useTheme';

export type AppMode = 'interview' | 'meeting' | 'custom' | 'conductor';

interface ModeSelectScreenProps {
  onSelect: (mode: AppMode) => void;
  onBack: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

const modes: { id: AppMode; title: string; subtitle: string; icon: React.ReactNode; gradient: string }[] = [
  {
    id: 'interview',
    title: 'Interview Assistant',
    subtitle: 'Real-time interview answers tailored to your profile and job description',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    gradient: 'from-violet-500 to-indigo-600',
  },
  {
    id: 'meeting',
    title: 'Meeting Assistant',
    subtitle: 'Live transcription, action items, and smart summaries for any meeting',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    gradient: 'from-cyan-500 to-blue-600',
  },
  {
    id: 'custom',
    title: 'Custom Assistant',
    subtitle: 'Define your own AI behavior with a custom system prompt for any use case',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
    gradient: 'from-amber-500 to-orange-600',
  },
  {
    id: 'conductor',
    title: 'Interview Conductor',
    subtitle: 'Take interviews as an interviewer — AI evaluates candidate answers with ratings and scoring',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
    gradient: 'from-rose-500 to-pink-600',
  },
];

const ModeSelectScreen: React.FC<ModeSelectScreenProps> = ({ onSelect, onBack, onMinimize, onClose }) => {
  const { isDark, toggle: toggleTheme } = useTheme();

  return (
    <div
      className="flex flex-col h-screen overflow-hidden rounded-xl backdrop-blur-xl transition-colors duration-300"
      style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
    >
      {/* Titlebar */}
      <header
        className="titlebar-drag flex items-center justify-between px-3 py-2 select-none transition-colors duration-300"
        style={{ borderBottom: '1px solid var(--glass-border)', background: 'var(--glass-bg-strong)' }}
      >
        <div className="titlebar-no-drag flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1.5 rounded-md transition-all duration-200"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            title="Back"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[13px] font-semibold leading-none tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Meetvora
            </h1>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Select your assistant mode</p>
          </div>
        </div>

        <div className="titlebar-no-drag flex items-center gap-0.5">
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
                <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <button onClick={onMinimize} className="p-1.5 rounded-md transition-colors" style={{ color: 'var(--text-muted)' }} title="Minimize">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="2" y="5.5" width="8" height="1" rx="0.5" fill="currentColor" />
            </svg>
          </button>
          <button onClick={onClose} className="p-1.5 rounded-md transition-colors" style={{ color: 'var(--text-muted)' }} title="Close">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col p-4 overflow-y-auto">
        <p className="text-[12px] font-medium mb-4 text-center" style={{ color: 'var(--text-secondary)' }}>
          Choose how you want your AI assistant to behave
        </p>

        <div className="flex flex-col gap-3">
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => onSelect(mode.id)}
              className="group flex items-start gap-3 p-4 rounded-xl text-left transition-all duration-200 cursor-pointer"
              style={{
                background: 'var(--glass-bg-subtle)',
                border: '1px solid var(--glass-border)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--glass-bg-strong)';
                e.currentTarget.style.borderColor = 'var(--glass-border-strong)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--glass-bg-subtle)';
                e.currentTarget.style.borderColor = 'var(--glass-border)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${mode.gradient} flex items-center justify-center text-white shrink-0 shadow-lg`}>
                {mode.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[13px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  {mode.title}
                </h3>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {mode.subtitle}
                </p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-1 shrink-0 opacity-30 group-hover:opacity-70 transition-opacity" style={{ color: 'var(--text-muted)' }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ))}
        </div>

        <p className="text-[10px] text-center mt-4" style={{ color: 'var(--text-faint)' }}>
          You can change modes by restarting the app
        </p>

        {/* Quick shortcuts reference */}
        <div
          className="mt-4 p-3 rounded-xl animate-fade-in"
          style={{ background: 'var(--glass-bg-subtle)', border: '1px solid var(--glass-border)' }}
        >
          <p className="text-[10px] font-semibold mb-2 text-center" style={{ color: 'var(--text-secondary)' }}>
            Quick Shortcuts
          </p>
          <div className="grid grid-cols-2 gap-1">
            {[
              { keys: 'F', label: 'Fullscreen' },
              { keys: 'R', label: 'Snap right' },
              { keys: 'L', label: 'Snap left' },
              { keys: 'C', label: 'Center top' },
              { keys: 'Esc', label: 'Hide window' },
              { keys: '↑ ↓', label: 'Scroll' },
              { keys: 'Ctrl+Shift+S', label: 'Start/Stop' },
              { keys: 'Ctrl+Shift+P', label: 'Screenshot' },
            ].map((s) => (
              <div key={s.keys} className="flex items-center justify-between py-0.5 px-2 rounded-md" style={{ background: 'var(--surface-hover)' }}>
                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                <kbd className="text-[8px] font-mono px-1 py-0.5 rounded ml-1" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border-strong)', color: 'var(--text-primary)' }}>{s.keys}</kbd>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-center mt-2" style={{ color: 'var(--text-faint)' }}>
            Press <kbd className="text-[8px] font-mono px-1 py-0.5 rounded" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border-strong)', color: 'var(--text-primary)' }}>Ctrl+Shift+`</kbd> to show/hide from anywhere
          </p>
        </div>
      </div>
    </div>
  );
};

export default ModeSelectScreen;
