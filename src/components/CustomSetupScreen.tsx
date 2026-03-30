/**
 * CustomSetupScreen — Setup screen for Custom Assistant mode.
 * User provides their own system prompt/instructions.
 */

import React, { useState } from 'react';
import { useTheme } from '../hooks/useTheme';

interface CustomSetupScreenProps {
  onComplete: (systemPrompt: string) => void;
  onBack: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

const CustomSetupScreen: React.FC<CustomSetupScreenProps> = ({ onComplete, onBack, onMinimize, onClose }) => {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [error, setError] = useState('');
  const { isDark, toggle: toggleTheme } = useTheme();

  const handleStart = () => {
    if (!systemPrompt.trim()) {
      setError('Please enter your custom instructions');
      return;
    }
    setError('');
    onComplete(systemPrompt.trim());
  };

  const charLimit = 15000;

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
              Custom Setup
            </h1>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Define your AI assistant behavior</p>
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
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(254,243,199,1)', border: `1px solid ${isDark ? 'rgba(245,158,11,0.25)' : '#fde68a'}` }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span className="text-[12px] font-semibold text-amber-500">Custom Mode</span>
          </div>
        </div>

        {/* System prompt */}
        <div className="flex-1 flex flex-col min-h-0">
          <label className="text-[12px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
            System Instructions
          </label>
          <p className="text-[10px] mb-2" style={{ color: 'var(--text-muted)' }}>
            Define how your AI assistant should behave. Write detailed instructions for the best results.
          </p>
          <textarea
            value={systemPrompt}
            onChange={(e) => { setSystemPrompt(e.target.value); setError(''); }}
            placeholder="You are an expert code reviewer. When I share code snippets or discuss programming topics, provide:&#10;&#10;1. Detailed analysis of code quality&#10;2. Potential bugs or security issues&#10;3. Performance improvement suggestions&#10;4. Best practice recommendations&#10;&#10;Always explain your reasoning and provide code examples when relevant."
            className="flex-1 px-3 py-2.5 rounded-xl text-[12px] resize-none focus:outline-none transition-all leading-relaxed"
            style={{
              background: 'var(--surface-input)',
              border: `1px solid ${error ? '#ef4444' : 'var(--glass-border-strong)'}`,
              color: 'var(--text-primary)',
            }}
            onFocus={e => { e.currentTarget.style.background = 'var(--surface-input-focus)'; e.currentTarget.style.borderColor = error ? '#ef4444' : '#f59e0b'; }}
            onBlur={e => { e.currentTarget.style.background = 'var(--surface-input)'; e.currentTarget.style.borderColor = error ? '#ef4444' : 'var(--glass-border-strong)'; }}
            maxLength={charLimit}
          />
          <div className="flex justify-between mt-1.5">
            {error ? (
              <p className="text-[10px] text-red-500 animate-fade-in">{error}</p>
            ) : (
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Cmd/Ctrl+V to paste</p>
            )}
            <p className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{systemPrompt.length}/{charLimit}</p>
          </div>
        </div>

        {/* Templates */}
        <div className="mt-3 mb-3">
          <p className="text-[10px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Quick Templates</p>
          <div className="flex gap-2 flex-wrap">
            {[
              { label: 'Code Reviewer', prompt: 'You are an expert code reviewer. Analyze any code or technical discussion for bugs, security issues, performance problems, and best practices. Provide specific, actionable feedback with code examples.' },
              { label: 'Study Tutor', prompt: 'You are a patient and encouraging study tutor. Help the student understand concepts by breaking them down into simple explanations. Ask guiding questions to check understanding. Provide examples and analogies.' },
              { label: 'Sales Coach', prompt: 'You are a sales coaching assistant. Listen to sales conversations and provide real-time suggestions for objection handling, closing techniques, and rapport building. Identify buying signals and suggest next steps.' },
            ].map(t => (
              <button
                key={t.label}
                onClick={() => { setSystemPrompt(t.prompt); setError(''); }}
                className="px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all"
                style={{
                  background: 'var(--glass-bg-subtle)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-secondary)',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={handleStart}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white text-[13px] font-semibold hover:from-amber-500 hover:to-orange-500 active:from-amber-700 active:to-orange-700 transition-all duration-200 shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Start Custom Assistant
        </button>
      </div>
    </div>
  );
};

export default CustomSetupScreen;
