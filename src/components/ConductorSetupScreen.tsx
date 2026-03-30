/**
 * ConductorSetupScreen — Setup screen for Interview Conductor mode.
 * User provides resume, JD, difficulty, question count, and optional focus areas.
 * AI will conduct the interview and evaluate candidate answers.
 */

import React, { useState } from 'react';
import { useTheme } from '../hooks/useTheme';

interface ConductorSetupScreenProps {
  onComplete: (resume: string, jobDescription: string, difficulty: string, questionCount: number, focusAreas: string) => void;
  onBack: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

const ConductorSetupScreen: React.FC<ConductorSetupScreenProps> = ({ onComplete, onBack, onMinimize, onClose }) => {
  const [resume, setResume] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [difficulty, setDifficulty] = useState('mid');
  const [questionCount, setQuestionCount] = useState(5);
  const [focusAreas, setFocusAreas] = useState('');
  const [error, setError] = useState('');
  const { isDark, toggle: toggleTheme } = useTheme();

  const handleStart = () => {
    if (!resume.trim()) {
      setError('Please paste the candidate resume');
      return;
    }
    if (!jobDescription.trim()) {
      setError('Please paste the job description');
      return;
    }
    setError('');
    onComplete(resume.trim(), jobDescription.trim(), difficulty, questionCount, focusAreas.trim());
  };

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
              Conductor Setup
            </h1>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Configure interview evaluation parameters</p>
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

        {/* Mode label */}
        <div className="flex justify-center mb-3">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: isDark ? 'rgba(244,63,94,0.15)' : 'rgba(255,228,230,1)', border: `1px solid ${isDark ? 'rgba(244,63,94,0.25)' : '#fecdd3'}` }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            <span className="text-[12px] font-semibold text-rose-500">Interview Conductor</span>
          </div>
        </div>

        {/* Resume */}
        <div className="mb-3">
          <label className="text-[12px] font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>
            Candidate Resume
          </label>
          <textarea
            value={resume}
            onChange={(e) => setResume(e.target.value)}
            placeholder="Paste the candidate's resume here..."
            rows={4}
            className="w-full rounded-lg px-3 py-2 text-[12px] resize-none focus:outline-none transition-colors"
            style={{
              background: 'var(--glass-bg-subtle)',
              color: 'var(--text-primary)',
              border: '1px solid var(--glass-border)',
            }}
          />
        </div>

        {/* Job Description */}
        <div className="mb-3">
          <label className="text-[12px] font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>
            Job Description
          </label>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job description here..."
            rows={4}
            className="w-full rounded-lg px-3 py-2 text-[12px] resize-none focus:outline-none transition-colors"
            style={{
              background: 'var(--glass-bg-subtle)',
              color: 'var(--text-primary)',
              border: '1px solid var(--glass-border)',
            }}
          />
        </div>

        {/* Difficulty + Question Count row */}
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="text-[12px] font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>
              Difficulty Level
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              title="Difficulty Level"
              className="w-full rounded-lg px-3 py-2 text-[12px] focus:outline-none transition-colors"
              style={{
                background: 'var(--glass-bg-subtle)',
                color: 'var(--text-primary)',
                border: '1px solid var(--glass-border)',
              }}
            >
              <option value="junior">Junior</option>
              <option value="mid">Mid-Level</option>
              <option value="senior">Senior</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[12px] font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>
              Questions
            </label>
            <select
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              title="Number of Questions"
              className="w-full rounded-lg px-3 py-2 text-[12px] focus:outline-none transition-colors"
              style={{
                background: 'var(--glass-bg-subtle)',
                color: 'var(--text-primary)',
                border: '1px solid var(--glass-border)',
              }}
            >
              <option value={5}>5 Questions</option>
              <option value={10}>10 Questions</option>
              <option value={15}>15 Questions</option>
            </select>
          </div>
        </div>

        {/* Focus Areas (optional) */}
        <div className="mb-3">
          <label className="text-[12px] font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>
            Focus Areas <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(optional)</span>
          </label>
          <input
            value={focusAreas}
            onChange={(e) => setFocusAreas(e.target.value)}
            placeholder="e.g. system design, React hooks, SQL optimization..."
            className="w-full rounded-lg px-3 py-2 text-[12px] focus:outline-none transition-colors"
            style={{
              background: 'var(--glass-bg-subtle)',
              color: 'var(--text-primary)',
              border: '1px solid var(--glass-border)',
            }}
          />
        </div>

        {/* Error message */}
        {error && (
          <p className="text-[11px] text-red-500 mb-2">{error}</p>
        )}

        {/* Start button */}
        <button
          onClick={handleStart}
          className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all duration-200 hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #f43f5e, #ec4899)' }}
        >
          Start Interview
        </button>
      </div>
    </div>
  );
};

export default ConductorSetupScreen;
