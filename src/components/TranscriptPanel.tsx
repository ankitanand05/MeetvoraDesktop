/**
 * TranscriptPanel — Live meeting transcript display
 */

import React, { useRef, useEffect } from 'react';
import type { TranscriptEntry } from '../types';
import { useTheme } from '../hooks/useTheme';

interface TranscriptPanelProps {
  transcripts: TranscriptEntry[];
  isListening: boolean;
}

function formatTime(isoTimestamp: string): string {
  try {
    const date = new Date(isoTimestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return '--:--:--';
  }
}

const TranscriptPanel: React.FC<TranscriptPanelProps> = ({ transcripts, isListening }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  return (
    <div
      className="flex flex-col h-full backdrop-blur-sm rounded-xl overflow-hidden transition-colors duration-300"
      style={{ background: 'var(--glass-bg-subtle)', border: '1px solid var(--glass-border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 transition-colors duration-300"
        style={{ borderBottom: '1px solid var(--glass-border)', background: 'var(--glass-bg-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-emerald-500/15 flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Transcript
          </span>
        </div>
        {transcripts.length > 0 && (
          <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
            {transcripts.length} {transcripts.length === 1 ? 'entry' : 'entries'}
          </span>
        )}
      </div>

      {/* Content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-1"
        style={{ minHeight: 0 }}
      >
        {transcripts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 opacity-40">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-faint)' }}>
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
            </svg>
            <p className="text-[11px] text-center" style={{ color: 'var(--text-muted)' }}>
              {isListening ? 'Listening for audio...' : 'Click Start to begin'}
            </p>
          </div>
        ) : (
          transcripts.map((entry, index) => (
            <div
              key={`${entry.timestamp}-${index}`}
              className="group flex gap-2 py-1.5 px-2 rounded-lg transition-colors animate-fade-in"
              style={{ }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span className="text-[10px] font-mono whitespace-nowrap mt-0.5 shrink-0" style={{ color: 'var(--text-faint)' }}>
                {formatTime(entry.timestamp)}
              </span>
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {entry.text}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Listening indicator */}
      {isListening && (
        <div className="px-3 py-1.5" style={{ borderTop: '1px solid var(--glass-border)', background: isDark ? 'rgba(16,185,129,0.1)' : 'rgba(209,250,229,0.8)' }}>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              <span className="w-1 h-3 bg-emerald-500/60 rounded-full animate-sound-bar-1" />
              <span className="w-1 h-3 bg-emerald-500/60 rounded-full animate-sound-bar-2" />
              <span className="w-1 h-3 bg-emerald-500/60 rounded-full animate-sound-bar-3" />
            </div>
            <span className="text-[10px] text-emerald-500/70">Capturing audio...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TranscriptPanel;
