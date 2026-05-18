/**
 * ChatGPTPanel — Embedded ChatGPT webview inside the stealth-protected window.
 * Uses Electron's <webview> tag so the content inherits setContentProtection.
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTheme } from '../hooks/useTheme';

interface ChatGPTPanelProps {
  onClose: () => void;
}

const ChatGPTPanel: React.FC<ChatGPTPanelProps> = ({ onClose }) => {
  const { isDark } = useTheme();
  const webviewRef = useRef<HTMLElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [url, setUrl] = useState('https://chatgpt.com');

  useEffect(() => {
    const wv = webviewRef.current as any;
    if (!wv) return;

    const onStartLoad = () => setIsLoading(true);
    const onStopLoad = () => setIsLoading(false);

    wv.addEventListener('did-start-loading', onStartLoad);
    wv.addEventListener('did-stop-loading', onStopLoad);

    return () => {
      wv.removeEventListener('did-start-loading', onStartLoad);
      wv.removeEventListener('did-stop-loading', onStopLoad);
    };
  }, []);

  const handleBack = () => {
    const wv = webviewRef.current as any;
    if (wv?.canGoBack()) wv.goBack();
  };

  const handleForward = () => {
    const wv = webviewRef.current as any;
    if (wv?.canGoForward()) wv.goForward();
  };

  const handleReload = () => {
    const wv = webviewRef.current as any;
    wv?.reload();
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col" style={{ background: 'var(--glass-bg-strong)' }}>
      {/* Top bar */}
      <div
        className="flex items-center gap-1 px-2 py-1 shrink-0"
        style={{ borderBottom: '1px solid var(--glass-border)', background: 'var(--glass-bg-strong)' }}
      >
        {/* Nav buttons */}
        <button onClick={handleBack} className="w-6 h-6 flex items-center justify-center rounded transition-colors" style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          aria-label="Back">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <button onClick={handleForward} className="w-6 h-6 flex items-center justify-center rounded transition-colors" style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          aria-label="Forward">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
        <button onClick={handleReload} className="w-6 h-6 flex items-center justify-center rounded transition-colors" style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          aria-label="Reload">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
        </button>

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center gap-1 ml-1">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Loading…</span>
          </div>
        )}

        <div className="flex-1" />

        {/* Label */}
        <span className="text-[9px] font-semibold uppercase tracking-wider mr-1" style={{ color: 'var(--text-muted)' }}>
          ChatGPT
        </span>

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          aria-label="Close ChatGPT"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Webview */}
      {/* @ts-ignore — webview is an Electron-specific HTML tag */}
      <webview
        ref={webviewRef as any}
        src={url}
        className="flex-1"
        style={{ width: '100%', height: '100%' }}
        /* @ts-ignore */
        allowpopups="true"
      />
    </div>
  );
};

export default ChatGPTPanel;
