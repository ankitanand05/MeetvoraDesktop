/**
 * MeetingSetupScreen — Setup screen for Meeting Assistant mode.
 * Collects meeting agenda and attendees list.
 */

import React, { useState } from 'react';
import { useTheme } from '../hooks/useTheme';

interface MeetingSetupScreenProps {
  onComplete: (agenda: string, attendees: string) => void;
  onBack: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

const MeetingSetupScreen: React.FC<MeetingSetupScreenProps> = ({ onComplete, onBack, onMinimize, onClose }) => {
  const [activeTab, setActiveTab] = useState<'agenda' | 'attendees'>('agenda');
  const [agenda, setAgenda] = useState('');
  const [attendees, setAttendees] = useState('');
  const [error, setError] = useState('');
  const { isDark, toggle: toggleTheme } = useTheme();

  const handleStart = () => {
    // Meeting mode: agenda is optional, can start with empty fields
    setError('');
    onComplete(agenda.trim(), attendees.trim());
  };

  const charLimit = 10000;

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
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="titlebar-no-drag w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'var(--glass-bg-subtle)', color: 'var(--text-muted)' }}
            title="Back to mode selection"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[13px] font-semibold leading-none tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Meeting Setup
            </h1>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Configure your meeting assistant</p>
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
      <div className="flex-1 flex flex-col p-4 overflow-hidden">

        {/* Mode label */}
        <div className="flex justify-center mb-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: isDark ? 'rgba(6,182,212,0.15)' : 'rgba(207,250,254,1)', border: `1px solid ${isDark ? 'rgba(6,182,212,0.25)' : '#a5f3fc'}` }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-500">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className="text-[12px] font-semibold text-cyan-500">Meeting Mode</span>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-lg p-0.5 mb-4" style={{ background: 'var(--surface-hover)', border: '1px solid var(--glass-border)' }}>
          <button
            onClick={() => setActiveTab('agenda')}
            className="flex-1 py-2 px-3 rounded-md text-[12px] font-semibold transition-all duration-200"
            style={{
              background: activeTab === 'agenda' ? 'var(--glass-bg-strong)' : 'transparent',
              color: activeTab === 'agenda' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: activeTab === 'agenda' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            Agenda
          </button>
          <button
            onClick={() => setActiveTab('attendees')}
            className="flex-1 py-2 px-3 rounded-md text-[12px] font-semibold transition-all duration-200"
            style={{
              background: activeTab === 'attendees' ? 'var(--glass-bg-strong)' : 'transparent',
              color: activeTab === 'attendees' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: activeTab === 'attendees' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            Attendees
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 flex flex-col min-h-0">
          {activeTab === 'agenda' ? (
            <div className="flex-1 flex flex-col">
              <label className="text-[12px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                Meeting Agenda <span className="text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>(optional)</span>
              </label>
              <p className="text-[10px] mb-2" style={{ color: 'var(--text-muted)' }}>
                Paste the meeting agenda or key topics — helps AI provide relevant summaries
              </p>
              <textarea
                value={agenda}
                onChange={(e) => { setAgenda(e.target.value); setError(''); }}
                placeholder="Sprint planning for Q2 release&#10;&#10;Topics:&#10;- Review outstanding bugs&#10;- Assign tasks for next sprint&#10;- Discuss deployment timeline&#10;&#10;Goal: Finalize task assignments and set deadlines"
                className="flex-1 px-3 py-2.5 rounded-xl text-[12px] resize-none focus:outline-none transition-all leading-relaxed"
                style={{
                  background: 'var(--surface-input)',
                  border: '1px solid var(--glass-border-strong)',
                  color: 'var(--text-primary)',
                }}
                onFocus={e => { e.currentTarget.style.background = 'var(--surface-input-focus)'; e.currentTarget.style.borderColor = '#06b6d4'; }}
                onBlur={e => { e.currentTarget.style.background = 'var(--surface-input)'; e.currentTarget.style.borderColor = 'var(--glass-border-strong)'; }}
                maxLength={charLimit}
              />
              <div className="flex justify-between mt-1.5">
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Cmd/Ctrl+V to paste</p>
                <p className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{agenda.length}/{charLimit}</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              <label className="text-[12px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                Attendees <span className="text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>(optional)</span>
              </label>
              <p className="text-[10px] mb-2" style={{ color: 'var(--text-muted)' }}>
                List the attendees and their roles — helps AI attribute discussion points
              </p>
              <textarea
                value={attendees}
                onChange={(e) => { setAttendees(e.target.value); setError(''); }}
                placeholder="John — Engineering Manager&#10;Sarah — Product Manager&#10;Mike — Backend Developer&#10;Lisa — QA Lead"
                className="flex-1 px-3 py-2.5 rounded-xl text-[12px] resize-none focus:outline-none transition-all leading-relaxed"
                style={{
                  background: 'var(--surface-input)',
                  border: '1px solid var(--glass-border-strong)',
                  color: 'var(--text-primary)',
                }}
                onFocus={e => { e.currentTarget.style.background = 'var(--surface-input-focus)'; e.currentTarget.style.borderColor = '#06b6d4'; }}
                onBlur={e => { e.currentTarget.style.background = 'var(--surface-input)'; e.currentTarget.style.borderColor = 'var(--glass-border-strong)'; }}
                maxLength={charLimit}
              />
              <div className="flex justify-between mt-1.5">
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Cmd/Ctrl+V to paste</p>
                <p className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{attendees.length}/{charLimit}</p>
              </div>
            </div>
          )}
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-3 mt-3 mb-3">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${agenda.trim() ? 'bg-emerald-500' : ''}`} style={agenda.trim() ? {} : { background: 'var(--text-faint)' }} />
            <span className="text-[10px]" style={{ color: agenda.trim() ? '#10b981' : 'var(--text-muted)' }}>Agenda</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${attendees.trim() ? 'bg-emerald-500' : ''}`} style={attendees.trim() ? {} : { background: 'var(--text-faint)' }} />
            <span className="text-[10px]" style={{ color: attendees.trim() ? '#10b981' : 'var(--text-muted)' }}>Attendees</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-[11px] text-red-500 mb-2 animate-fade-in">{error}</p>
        )}

        {/* Start button */}
        <button
          onClick={handleStart}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-[13px] font-semibold hover:from-cyan-500 hover:to-blue-500 active:from-cyan-700 active:to-blue-700 transition-all duration-200 shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Start Meeting Assistant
        </button>
      </div>
    </div>
  );
};

export default MeetingSetupScreen;
