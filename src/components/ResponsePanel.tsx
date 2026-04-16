/**
 * ResponsePanel — Beautiful AI response display with code highlighting
 */

import React, { useRef, useEffect } from 'react';
import type { AIResponse } from '../types';
import { useTheme } from '../hooks/useTheme';

interface ResponsePanelProps {
  response: AIResponse;
}

/**
 * Parse AI response text into structured blocks: paragraphs, bullets, actions, code blocks.
 */
function parseResponseBlocks(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line → spacer
    if (!trimmed) {
      nodes.push(<div key={`spacer-${i}`} className="h-2" />);
      i++;
      continue;
    }

    // Code block start: ```
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim() || 'code';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```

      nodes.push(
        <div key={`code-${i}`} className="my-2 rounded-lg overflow-hidden" style={{ border: '1px solid var(--glass-border-strong)' }}>
          <div className="flex items-center justify-between px-3 py-1.5" style={{ background: 'var(--surface-code-header)', borderBottom: '1px solid var(--glass-border-strong)' }}>
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--syn-function)' }}>{lang}</span>
            <button
              className="text-[10px] transition-colors cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => navigator.clipboard?.writeText(codeLines.join('\n'))}
            >
              Copy
            </button>
          </div>
          <pre className="px-3 py-2.5 overflow-hidden whitespace-pre-wrap break-all text-[11px] leading-[1.6]" style={{ background: 'var(--surface-code)' }}>
            <code className="font-mono" style={{ color: 'var(--syn-string)' }}>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      continue;
    }

    // Inline code in regular lines: `code`
    const renderInlineCode = (text: string, keyPrefix: string): React.ReactNode[] => {
      const parts: React.ReactNode[] = [];
      const regex = /`([^`]+)`/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          parts.push(<span key={`${keyPrefix}-text-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>);
        }
        parts.push(
          <code key={`${keyPrefix}-code-${match.index}`} className="px-1.5 py-0.5 rounded text-[11px] font-mono" style={{ background: 'var(--accent-inline-code-bg)', color: 'var(--accent-inline-code-text)' }}>
            {match[1]}
          </code>
        );
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < text.length) {
        parts.push(<span key={`${keyPrefix}-text-end`}>{text.slice(lastIndex)}</span>);
      }
      return parts.length > 0 ? parts : [<span key={`${keyPrefix}-plain`}>{text}</span>];
    };

    // Action items: → prefix
    if (trimmed.startsWith('→') || trimmed.startsWith('->')) {
      const content = trimmed.replace(/^(→|->)\s*/, '');
      nodes.push(
        <div key={`action-${i}`} className="flex gap-2 py-1 px-2.5 my-0.5 rounded-lg bg-amber-500/[0.08] border border-amber-500/[0.12]">
          <span className="text-amber-400 mt-0.5 shrink-0">→</span>
          <span className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {renderInlineCode(content, `action-${i}`)}
          </span>
        </div>
      );
      i++;
      continue;
    }

    // Bullet points: • or - or *
    if (trimmed.startsWith('•') || (trimmed.startsWith('-') && trimmed.length > 1 && trimmed[1] === ' ') || (trimmed.startsWith('*') && trimmed.length > 1 && trimmed[1] === ' ')) {
      const content = trimmed.replace(/^[•\-\*]\s*/, '');
      nodes.push(
        <div key={`bullet-${i}`} className="flex gap-2 py-0.5 pl-1">
          <span className="text-cyan-500/70 mt-0.5 shrink-0 text-[10px]">●</span>
          <span className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {renderInlineCode(content, `bullet-${i}`)}
          </span>
        </div>
      );
      i++;
      continue;
    }

    // Numbered list: 1. 2. etc.
    if (/^\d+[\.\)]\s/.test(trimmed)) {
      const match = trimmed.match(/^(\d+[\.\)])\s*(.*)/);
      if (match) {
        nodes.push(
          <div key={`num-${i}`} className="flex gap-2 py-0.5 pl-1">
            <span className="text-cyan-500/60 text-[11px] font-mono mt-0.5 shrink-0 min-w-[16px]">{match[1]}</span>
            <span className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {renderInlineCode(match[2], `num-${i}`)}
            </span>
          </div>
        );
        i++;
        continue;
      }
    }

    // Bold text: **text**
    const renderBold = (text: string, keyPrefix: string): React.ReactNode[] => {
      const parts: React.ReactNode[] = [];
      const regex = /\*\*([^*]+)\*\*/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          parts.push(...renderInlineCode(text.slice(lastIndex, match.index), `${keyPrefix}-pre-${match.index}`));
        }
        parts.push(<strong key={`${keyPrefix}-bold-${match.index}`} className="font-semibold" style={{ color: 'var(--text-primary)' }}>{match[1]}</strong>);
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < text.length) {
        parts.push(...renderInlineCode(text.slice(lastIndex), `${keyPrefix}-rest`));
      }
      return parts.length > 0 ? parts : renderInlineCode(text, keyPrefix);
    };

    // Regular paragraph
    nodes.push(
      <p key={`p-${i}`} className="text-[12px] leading-relaxed py-0.5" style={{ color: 'var(--text-secondary)' }}>
        {renderBold(trimmed, `p-${i}`)}
      </p>
    );
    i++;
  }

  return nodes;
}

const ResponsePanel: React.FC<ResponsePanelProps> = ({ response }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();

  useEffect(() => {
    if (scrollRef.current && response.isStreaming) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [response.text, response.isStreaming]);

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
          <div className="w-5 h-5 rounded-md bg-cyan-500/15 flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            AI Response
          </span>
        </div>
        <div className="flex items-center gap-2">
          {response.isStreaming && (
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-[10px] text-cyan-400/70">Generating</span>
            </div>
          )}
          {response.text && !response.isStreaming && (
            <button
              className="text-[10px] transition-colors cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => navigator.clipboard?.writeText(response.text)}
            >
              Copy all
            </button>
          )}
        </div>
      </div>

      {/* Response content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-2.5"
        style={{ minHeight: 0 }}
      >
        {!response.text ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-30">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-faint)' }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>AI responses appear here</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>Start listening, ask a question, or take a screenshot</p>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5">
            {parseResponseBlocks(response.text)}

            {/* Streaming cursor */}
            {response.isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-cyan-400 rounded-sm animate-pulse ml-0.5 align-middle" />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResponsePanel;
