/**
 * ChatGPTPanel — Embedded ChatGPT webview inside the stealth-protected window.
 * Uses Electron's <webview> tag so the content inherits setContentProtection.
 *
 * Extra features (parallel to main app flow — nothing shared):
 *  • Hold Space → record mic → release → transcribe → paste into ChatGPT input
 *  • Screenshot button → capture screen → clipboard → paste into ChatGPT input
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTheme } from '../hooks/useTheme';

interface ChatGPTPanelProps {
  onClose: () => void;
  isStealth?: boolean;
}

type VoiceState = 'idle' | 'recording' | 'transcribing';

const ChatGPTPanel: React.FC<ChatGPTPanelProps> = ({ onClose, isStealth = false }) => {
  const { isDark } = useTheme();
  const webviewRef = useRef<HTMLElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPasting, setIsPasting] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');

  // MediaRecorder refs — live only while recording
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // ── WebView load events ────────────────────────────────────
  useEffect(() => {
    const wv = webviewRef.current as any;
    if (!wv) return;
    const onStart = () => setIsLoading(true);
    const onStop = () => setIsLoading(false);
    wv.addEventListener('did-start-loading', onStart);
    wv.addEventListener('did-stop-loading', onStop);
    return () => {
      wv.removeEventListener('did-start-loading', onStart);
      wv.removeEventListener('did-stop-loading', onStop);
    };
  }, []);

  // ── Ghost cursor: inject cursor:none + visible cursor into webview when stealth is active ──
  const injectedCssKeyRef = useRef<string | null>(null);

  /** JS to inject into the webview that creates a ghost cursor inside it */
  const ghostCursorScript = `
(function() {
  if (document.getElementById('__ghost_cursor')) return;

  var style = document.createElement('style');
  style.textContent = \`
    * { cursor: none !important; }
    @keyframes __gc_pulse {
      0%, 100% { transform: scale(1); opacity: 0.7; }
      50% { transform: scale(1.25); opacity: 0.4; }
    }
  \`;
  document.head.appendChild(style);

  // Trailing ring
  var ring = document.createElement('div');
  ring.id = '__ghost_cursor_ring';
  Object.assign(ring.style, {
    position:'fixed',top:'0',left:'0',width:'32px',height:'32px',
    pointerEvents:'none',zIndex:'2147483646',opacity:'0',transition:'opacity 0.2s'
  });
  var ringInner = document.createElement('div');
  Object.assign(ringInner.style, {
    width:'32px',height:'32px',borderRadius:'50%',
    border:'2px solid rgba(34,211,238,0.7)',
    boxShadow:'0 0 12px 2px rgba(34,211,238,0.4), inset 0 0 6px rgba(34,211,238,0.15)',
    animation:'__gc_pulse 1.5s ease-in-out infinite'
  });
  ring.appendChild(ringInner);
  document.body.appendChild(ring);

  // Main cursor container
  var cur = document.createElement('div');
  cur.id = '__ghost_cursor';
  Object.assign(cur.style, {
    position:'fixed',top:'0',left:'0',width:'0',height:'0',
    pointerEvents:'none',zIndex:'2147483647',opacity:'0',transition:'opacity 0.15s'
  });

  // Dot
  var dot = document.createElement('div');
  Object.assign(dot.style, {
    position:'absolute',top:'-3px',left:'-3px',width:'6px',height:'6px',
    borderRadius:'50%',background:'#22d3ee',
    boxShadow:'0 0 8px 2px rgba(34,211,238,0.6)'
  });
  cur.appendChild(dot);

  // Arrow SVG
  var ns = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(ns,'svg');
  svg.setAttribute('width','22'); svg.setAttribute('height','22');
  svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('fill','none');
  Object.assign(svg.style, {
    position:'absolute',top:'-1px',left:'-1px',
    filter:'drop-shadow(0 0 6px rgba(34,211,238,0.7)) drop-shadow(0 1px 3px rgba(0,0,0,0.6))'
  });
  var path = document.createElementNS(ns,'path');
  path.setAttribute('d','M2 2L2 20L7 14.5L13 22L16 20L10.5 12.5L18 12L2 2Z');
  path.setAttribute('fill','rgba(255,255,255,0.95)');
  path.setAttribute('stroke','#0e7490');
  path.setAttribute('stroke-width','1.5');
  path.setAttribute('stroke-linejoin','round');
  svg.appendChild(path);
  cur.appendChild(svg);
  document.body.appendChild(cur);

  // Animation
  var tx=0,ty=0,cx=0,cy=0,vis=false;
  function tick() {
    tx += (cx - tx) * 0.18;
    ty += (cy - ty) * 0.18;
    ring.style.transform = 'translate(' + (tx-16) + 'px,' + (ty-16) + 'px)';
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  document.addEventListener('mousemove', function(e) {
    cx = e.clientX; cy = e.clientY;
    cur.style.transform = 'translate(' + cx + 'px,' + cy + 'px)';
    if (!vis) { vis=true; cur.style.opacity='1'; ring.style.opacity='1'; }
  });
  document.documentElement.addEventListener('mouseleave', function() {
    vis=false; cur.style.opacity='0'; ring.style.opacity='0';
  });
  document.documentElement.addEventListener('mouseenter', function() {
    vis=true; cur.style.opacity='1'; ring.style.opacity='1';
  });
})();
`;

  useEffect(() => {
    const wv = webviewRef.current as any;
    if (!wv) return;

    const injectOrRemove = async () => {
      try {
        // Remove previously injected CSS if any
        if (injectedCssKeyRef.current) {
          await wv.removeInsertedCSS(injectedCssKeyRef.current);
          injectedCssKeyRef.current = null;
        }
        if (isStealth) {
          // Inject cursor:none CSS
          const key = await wv.insertCSS('* { cursor: none !important; }');
          injectedCssKeyRef.current = key;
          // Inject ghost cursor JS
          await wv.executeJavaScript(ghostCursorScript);
        }
      } catch {
        // webview may not be ready yet — ignore
      }
    };

    // Run on stealth change and also after each page navigation
    injectOrRemove();
    const onNavFinish = () => injectOrRemove();
    wv.addEventListener('did-finish-load', onNavFinish);
    wv.addEventListener('did-navigate-in-page', onNavFinish);
    return () => {
      wv.removeEventListener('did-finish-load', onNavFinish);
      wv.removeEventListener('did-navigate-in-page', onNavFinish);
    };
  }, [isStealth]);

  // ── Helpers ────────────────────────────────────────────────
  const handleBack = () => { const wv = webviewRef.current as any; if (wv?.canGoBack()) wv.goBack(); };
  const handleForward = () => { const wv = webviewRef.current as any; if (wv?.canGoForward()) wv.goForward(); };
  const handleReload = () => { (webviewRef.current as any)?.reload(); };

  /** Type text into the ChatGPT webview input and focus it */
  const pasteTextIntoWebview = useCallback(async (text: string) => {
    const wv = webviewRef.current as any;
    if (!wv || !text) return;
    wv.focus();
    // Insert text via execCommand (works inside the webview's document)
    await wv.executeJavaScript(`
      (function(txt) {
        var el = document.querySelector('#prompt-textarea')
               || document.querySelector('[contenteditable="true"]')
               || document.querySelector('textarea');
        if (!el) return;
        el.focus();
        // contenteditable div needs insertText; textarea needs direct value set
        if (el.tagName === 'TEXTAREA') {
          var nativeSet = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
          nativeSet.call(el, (el.value ? el.value + ' ' : '') + txt);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          document.execCommand('insertText', false, txt);
        }
      })(${JSON.stringify(text)});
    `);
  }, []);

  // ── Screenshot → paste ─────────────────────────────────────
  const handleScreenshotPaste = useCallback(async () => {
    if (isPasting || voiceState !== 'idle') return;
    setIsPasting(true);
    try {
      const ok = await window.electronAPI.screenshotToClipboard();
      if (!ok) { console.error('[ChatGPT] Screenshot failed'); return; }
      const wv = webviewRef.current as any;
      if (!wv) return;
      wv.focus();
      await wv.executeJavaScript(`
        (function(){
          var el = document.querySelector('#prompt-textarea')
                 || document.querySelector('[contenteditable="true"]')
                 || document.querySelector('textarea');
          if (el) { el.focus(); el.click(); }
        })();
      `);
      // Paste clipboard image via Ctrl+V
      setTimeout(() => {
        wv.sendInputEvent({ type: 'keyDown', keyCode: 'V', modifiers: ['control'] });
        setTimeout(() => wv.sendInputEvent({ type: 'keyUp', keyCode: 'V', modifiers: ['control'] }), 50);
      }, 300);
    } catch (err) {
      console.error('[ChatGPT] Screenshot paste error:', err);
    } finally {
      setTimeout(() => setIsPasting(false), 1200);
    }
  }, [isPasting, voiceState]);

  // ── Voice: start recording ─────────────────────────────────
  const startRecording = useCallback(async () => {
    if (voiceState !== 'idle') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.start();
      recorderRef.current = recorder;
      setVoiceState('recording');
    } catch (err) {
      console.error('[ChatGPT Voice] Mic access error:', err);
    }
  }, [voiceState]);

  // ── Voice: stop recording → transcribe → paste ─────────────
  const stopRecordingAndTranscribe = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    recorder.onstop = async () => {
      const mimeType = recorder.mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];

      // Stop mic tracks
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      recorderRef.current = null;

      if (blob.size < 500) { setVoiceState('idle'); return; }

      setVoiceState('transcribing');
      try {
        const buffer = await blob.arrayBuffer();
        const text = await window.electronAPI.chatgptTranscribe(buffer);
        if (text) await pasteTextIntoWebview(text);
      } catch (err) {
        console.error('[ChatGPT Voice] Transcribe error:', err);
      } finally {
        setVoiceState('idle');
      }
    };

    recorder.stop();
  }, [pasteTextIntoWebview]);

  // ── Keyboard shortcuts (active only while panel is mounted) ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+S → screenshot paste
      if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'S') {
        e.preventDefault();
        e.stopPropagation();
        handleScreenshotPaste();
        return;
      }

      // Space (hold) → start recording — capture it so main app spacebar is blocked
      if (e.code === 'Space' && !e.repeat) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return; // don't block typed input
        e.preventDefault();
        e.stopPropagation();
        startRecording();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        e.stopPropagation();
        stopRecordingAndTranscribe();
      }
    };

    // useCapture:true so these fire BEFORE App.tsx's keydown handler
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
    };
  }, [handleScreenshotPaste, startRecording, stopRecordingAndTranscribe]);

  // ── Voice state display helpers ────────────────────────────
  const voiceColor = voiceState === 'recording' ? '#ef4444' : voiceState === 'transcribing' ? '#f59e0b' : 'var(--text-muted)';
  const voiceLabel = voiceState === 'recording' ? 'Listening…' : voiceState === 'transcribing' ? 'Transcribing…' : null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col" style={{ background: 'var(--glass-bg-strong)' }}>
      {/* Top bar */}
      <div
        className="flex items-center gap-1 px-2 py-1 shrink-0"
        style={{ borderBottom: '1px solid var(--glass-border)', background: 'var(--glass-bg-strong)' }}
      >
        {/* Nav */}
        <button onClick={handleBack} className="w-6 h-6 flex items-center justify-center rounded transition-colors" style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }} aria-label="Back">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <button onClick={handleForward} className="w-6 h-6 flex items-center justify-center rounded transition-colors" style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }} aria-label="Forward">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
        <button onClick={handleReload} className="w-6 h-6 flex items-center justify-center rounded transition-colors" style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }} aria-label="Reload">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
        </button>

        {/* Screenshot → paste */}
        <button
          onClick={handleScreenshotPaste}
          disabled={isPasting || voiceState !== 'idle'}
          className="w-6 h-6 flex items-center justify-center rounded transition-colors disabled:opacity-40"
          style={{ color: isPasting ? '#3b82f6' : 'var(--text-muted)' }}
          onMouseEnter={e => { if (!isPasting) e.currentTarget.style.color = '#3b82f6'; }}
          onMouseLeave={e => { if (!isPasting) e.currentTarget.style.color = 'var(--text-muted)'; }}
          aria-label="Screenshot to ChatGPT"
          title="Capture screen & paste into ChatGPT (Ctrl+Shift+S)"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
          </svg>
        </button>

        {/* Mic / voice-to-paste button */}
        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecordingAndTranscribe}
          onMouseLeave={() => { if (voiceState === 'recording') stopRecordingAndTranscribe(); }}
          disabled={voiceState === 'transcribing' || isPasting}
          className="relative w-6 h-6 flex items-center justify-center rounded transition-colors disabled:opacity-40"
          style={{ color: voiceColor }}
          title="Hold to speak, release to paste transcript (or hold Space)"
          aria-label="Voice to ChatGPT"
        >
          {voiceState === 'recording' && (
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
          )}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
          </svg>
        </button>

        {/* Status indicator (recording / transcribing) */}
        {(voiceLabel || isLoading) && (
          <div className="flex items-center gap-1 ml-1">
            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${voiceState === 'recording' ? 'bg-red-400' : voiceState === 'transcribing' ? 'bg-amber-400' : 'bg-cyan-400'}`} />
            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
              {voiceLabel || 'Loading…'}
            </span>
          </div>
        )}

        <div className="flex-1" />

        {/* Label */}
        <span className="text-[9px] font-semibold uppercase tracking-wider mr-1" style={{ color: 'var(--text-muted)' }}>
          ChatGPT
        </span>

        {/* Close */}
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
        src="https://chatgpt.com"
        className="flex-1"
        style={{ width: '100%', height: '100%' }}
        /* @ts-ignore */
        allowpopups="true"
      />

      {/* Recording overlay — full-width banner at bottom, unmissable indicator */}
      {voiceState !== 'idle' && (
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 py-2 pointer-events-none"
          style={{
            background: voiceState === 'recording'
              ? 'rgba(239,68,68,0.92)'
              : 'rgba(245,158,11,0.92)',
            zIndex: 60,
          }}
        >
          {voiceState === 'recording' ? (
            <>
              {/* Animated mic rings */}
              <span className="relative flex h-4 w-4 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-white items-center justify-center">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                  </svg>
                </span>
              </span>
              <span className="text-white text-[11px] font-semibold tracking-wide">
                Listening… release Space to paste
              </span>
            </>
          ) : (
            <>
              <span className="w-3 h-3 rounded-full bg-white animate-pulse shrink-0" />
              <span className="text-white text-[11px] font-semibold tracking-wide">
                Transcribing…
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatGPTPanel;
