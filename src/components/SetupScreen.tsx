/**
 * SetupScreen — First screen shown when app opens
 *
 * Collects candidate's profile (resume/about) and job description
 * before starting the interview assistant.
 * Styled like the Angel AI setup interface.
 */

import React, { useState } from 'react';
import { useTheme } from '../hooks/useTheme';

interface SetupScreenProps {
  onComplete: (profile: string, jobDescription: string) => void;
  onBack?: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

const SetupScreen: React.FC<SetupScreenProps> = ({ onComplete, onBack, onMinimize, onClose }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'jd'>('profile');
  const [profile, setProfile] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [error, setError] = useState('');
  const { isDark, toggle: toggleTheme } = useTheme();

  const handleStart = () => {
    if (!profile.trim()) {
      setError('Please add your profile / resume summary');
      return;
    }
    if (!jobDescription.trim()) {
      setError('Please add the job description');
      return;
    }
    setError('');
    onComplete(profile.trim(), jobDescription.trim());
  };

  const charLimit = 20000;

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
          {onBack && (
            <button
              onClick={onBack}
              className="titlebar-no-drag w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: 'var(--glass-bg-subtle)', color: 'var(--text-muted)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[13px] font-semibold leading-none tracking-tight" style={{ color: 'var(--text-primary)' }}>
              AiAgent Setup
            </h1>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Configure your stealth assistant</p>
          </div>
        </div>

        <div className="titlebar-no-drag flex items-center gap-0.5">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md transition-all duration-200"
            style={{
              background: isDark ? 'rgba(250,204,21,0.15)' : 'rgba(99,102,241,0.10)',
              color: isDark ? '#facc15' : '#6366f1',
            }}
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
          <button onClick={onMinimize} className="p-1.5 rounded-md transition-colors" style={{ color: 'var(--text-muted)' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="2" y="5.5" width="8" height="1" rx="0.5" fill="currentColor" />
            </svg>
          </button>
          <button onClick={onClose} className="p-1.5 rounded-md transition-colors" style={{ color: 'var(--text-muted)' }}>
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
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: isDark ? 'rgba(139,92,246,0.15)' : 'rgba(237,233,254,1)', border: `1px solid ${isDark ? 'rgba(139,92,246,0.25)' : '#ddd6fe'}` }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span className="text-[12px] font-semibold text-violet-500">Interview Mode</span>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-lg p-0.5 mb-4" style={{ background: 'var(--surface-hover)', border: '1px solid var(--glass-border)' }}>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-2 px-3 rounded-md text-[12px] font-semibold transition-all duration-200`}
            style={{
              background: activeTab === 'profile' ? 'var(--glass-bg-strong)' : 'transparent',
              color: activeTab === 'profile' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: activeTab === 'profile' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('jd')}
            className={`flex-1 py-2 px-3 rounded-md text-[12px] font-semibold transition-all duration-200`}
            style={{
              background: activeTab === 'jd' ? 'var(--glass-bg-strong)' : 'transparent',
              color: activeTab === 'jd' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: activeTab === 'jd' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            Job Description
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 flex flex-col min-h-0">
          {activeTab === 'profile' ? (
            <div className="flex-1 flex flex-col">
              <label className="text-[12px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                About You <span className="text-red-500">*</span>
              </label>
              <p className="text-[10px] mb-2" style={{ color: 'var(--text-muted)' }}>
                LinkedIn About or resume summary — helps AI give answers matching your experience
              </p>
              <textarea
                value={profile}
                onChange={(e) => { setProfile(e.target.value); setError(''); }}
                placeholder="Product Manager with 6+ years of experience in B2B SaaS...&#10;&#10;Key skills: Product strategy, data analytics, stakeholder management...&#10;&#10;Previous: Led a team of 12 at Company X, launched 3 products..."
                className="flex-1 px-3 py-2.5 rounded-xl text-[12px] resize-none focus:outline-none transition-all leading-relaxed"
                style={{
                  background: 'var(--surface-input)',
                  border: '1px solid var(--glass-border-strong)',
                  color: 'var(--text-primary)',
                }}
                onFocus={e => { e.currentTarget.style.background = 'var(--surface-input-focus)'; e.currentTarget.style.borderColor = '#8b5cf6'; }}
                onBlur={e => { e.currentTarget.style.background = 'var(--surface-input)'; e.currentTarget.style.borderColor = 'var(--glass-border-strong)'; }}
                maxLength={charLimit}
              />
              <div className="flex justify-between mt-1.5">
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Cmd/Ctrl+V to paste</p>
                <p className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{profile.length}/{charLimit}</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              <label className="text-[12px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                Job Description <span className="text-red-500">*</span>
              </label>
              <p className="text-[10px] mb-2" style={{ color: 'var(--text-muted)' }}>
                Paste the JD — AI will tailor answers to match what the company is looking for
              </p>
              <textarea
                value={jobDescription}
                onChange={(e) => { setJobDescription(e.target.value); setError(''); }}
                placeholder="We are looking for a Senior Software Engineer...&#10;&#10;Responsibilities:&#10;- Design and build scalable services&#10;- Lead technical decisions...&#10;&#10;Requirements:&#10;- 5+ years experience in Python/Java&#10;- Experience with distributed systems..."
                className="flex-1 px-3 py-2.5 rounded-xl text-[12px] resize-none focus:outline-none transition-all leading-relaxed"
                style={{
                  background: 'var(--surface-input)',
                  border: '1px solid var(--glass-border-strong)',
                  color: 'var(--text-primary)',
                }}
                onFocus={e => { e.currentTarget.style.background = 'var(--surface-input-focus)'; e.currentTarget.style.borderColor = '#8b5cf6'; }}
                onBlur={e => { e.currentTarget.style.background = 'var(--surface-input)'; e.currentTarget.style.borderColor = 'var(--glass-border-strong)'; }}
                maxLength={charLimit}
              />
              <div className="flex justify-between mt-1.5">
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Cmd/Ctrl+V to paste</p>
                <p className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{jobDescription.length}/{charLimit}</p>
              </div>
            </div>
          )}
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-3 mt-3 mb-3">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${profile.trim() ? 'bg-emerald-500' : ''}`} style={profile.trim() ? {} : { background: 'var(--text-faint)' }} />
            <span className="text-[10px]" style={{ color: profile.trim() ? '#10b981' : 'var(--text-muted)' }}>Profile</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${jobDescription.trim() ? 'bg-emerald-500' : ''}`} style={jobDescription.trim() ? {} : { background: 'var(--text-faint)' }} />
            <span className="text-[10px]" style={{ color: jobDescription.trim() ? '#10b981' : 'var(--text-muted)' }}>Job Description</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-[11px] text-red-500 mb-2 animate-fade-in">{error}</p>
        )}

        {/* Start button */}
        <button
          onClick={handleStart}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[13px] font-semibold hover:from-violet-500 hover:to-indigo-500 active:from-violet-700 active:to-indigo-700 transition-all duration-200 shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Start Interview Assistant
        </button>
      </div>
    </div>
  );
};

export default SetupScreen;
