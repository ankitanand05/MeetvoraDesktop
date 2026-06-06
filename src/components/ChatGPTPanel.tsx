/**
 * ChatGPTPanel — Embedded ChatGPT webview with:
 *  • SS button  — capture screen → paste image into chat
 *  • Live button — listen to system audio → auto-type transcript into chat
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTheme } from '../hooks/useTheme';

interface ChatGPTPanelProps {
  onClose: () => void;
}

const ChatGPTPanel: React.FC<ChatGPTPanelProps> = ({ onClose }) => {
  useTheme();
  const webviewRef = useRef<HTMLElement>(null);
  const [isLoading, setIsLoading]         = useState(true);
  const [url]                             = useState('https://chatgpt.com');

  // ── SS (screenshot-to-chat) state ──────────────────────────
  const [isCapturing, setIsCapturing]     = useState(false);
  const [captureStatus, setCaptureStatus] = useState<'idle' | 'ok' | 'err'>('idle');

  // ── Live audio-listen state ─────────────────────────────────
  const [isListening, setIsListening]     = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false); // flicker when chunk is being processed
  const isListeningRef  = useRef(false);   // mutable flag that survives re-renders
  const audioStreamRef  = useRef<MediaStream | null>(null);

  /* ── Webview loading events + shortcut forwarding ───────── */
  useEffect(() => {
    const wv = webviewRef.current as any;
    if (!wv) return;
    const onStart = () => setIsLoading(true);
    const onStop  = () => {
      setIsLoading(false);
      // Hide the real system cursor inside the webview — ghost cursor handles the
      // visual, and is invisible to screen-capture tools via content protection.
      wv.insertCSS('*, *::before, *::after { cursor: none !important; }').catch(() => {});
    };
    // Forward keyboard shortcuts from the webview to the parent renderer.
    // Key events consumed by the webview never reach App.tsx's handler otherwise.
    const SINGLE_KEY_SHORTCUTS = new Set(['f', 'r', 'l', 'c', 'b', 'g', 'w', 's', 'm']);
    const onKeyInWebview = (event: any) => {
      const input = event.input;
      if (!input || input.type !== 'keyDown') return;
      const hasCtrl  = !!input.control;
      const hasShift = !!input.shift;
      const hasAlt   = !!input.alt;
      const hasMeta  = !!input.meta;

      // ── Ctrl+Shift combos — always safe to forward (no typing conflict) ──
      if (hasCtrl && hasShift) {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: input.key, ctrlKey: true, shiftKey: true,
          altKey: hasAlt, metaKey: hasMeta, bubbles: true,
        }));
        return;
      }

      // ── Single-key position/mode shortcuts — only when no text input focused ──
      if (!hasCtrl && !hasShift && !hasAlt && !hasMeta &&
          SINGLE_KEY_SHORTCUTS.has(input.key?.toLowerCase())) {
        (wv.executeJavaScript(
          `!!(document.activeElement && document.activeElement.matches('input,textarea,[contenteditable],[contenteditable] *'))`
        ) as Promise<boolean>).then((isInputFocused: boolean) => {
          if (!isInputFocused) {
            window.dispatchEvent(new KeyboardEvent('keydown', {
              key: input.key, ctrlKey: false, shiftKey: false,
              altKey: false, metaKey: false, bubbles: true,
            }));
          }
        }).catch(() => {});
      }
    };
    wv.addEventListener('did-start-loading',  onStart);
    wv.addEventListener('did-stop-loading',   onStop);
    wv.addEventListener('before-input-event', onKeyInWebview);
    return () => {
      wv.removeEventListener('did-start-loading',  onStart);
      wv.removeEventListener('did-stop-loading',   onStop);
      wv.removeEventListener('before-input-event', onKeyInWebview);
    };
  }, []);

  /* ── Subscribe to transcripts from main process ─────────── */
  useEffect(() => {
    const unsub = window.electronAPI.onChatGptTranscript(async ({ text }) => {
      const wv = webviewRef.current as any;
      if (!wv || !text) return;
      setIsTranscribing(true);
      try {
        const wcId: number = wv.getWebContentsId();
        // Append transcript + space so next chunk doesn't merge with previous
        await window.electronAPI.insertTextToWebview(wcId, text + ' ');
      } finally {
        setIsTranscribing(false);
      }
    });
    return unsub;
  }, []);

  /* ── Cleanup audio on unmount / panel close ─────────────── */
  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(t => t.stop());
        audioStreamRef.current = null;
      }
    };
  }, []);

  /* ── Nav helpers ─────────────────────────────────────────── */
  const handleBack    = () => { const wv = webviewRef.current as any; if (wv?.canGoBack())    wv.goBack(); };
  const handleForward = () => { const wv = webviewRef.current as any; if (wv?.canGoForward()) wv.goForward(); };
  const handleReload  = () => { const wv = webviewRef.current as any; wv?.reload(); };

  /* ── SS: capture screen → paste image into chat ─────────── */
  const handleScreenshotPaste = async () => {
    const wv = webviewRef.current as any;
    if (!wv || isCapturing) return;
    setIsCapturing(true);
    setCaptureStatus('idle');
    try {
      const wcId: number = wv.getWebContentsId();
      const result = await window.electronAPI.screenshotPasteToWebview(wcId);
      setCaptureStatus(result.success ? 'ok' : 'err');
    } catch {
      setCaptureStatus('err');
    } finally {
      setIsCapturing(false);
      setTimeout(() => setCaptureStatus('idle'), 1300);
    }
  };

  /* ── Live: one recording cycle → WAV blob → transcribe ─── */
  const runRecordingCycle = useCallback(async (stream: MediaStream): Promise<void> => {
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : 'audio/webm';

    // Extract only audio tracks
    const audioStream = new MediaStream(stream.getAudioTracks());

    while (isListeningRef.current) {
      try {
        // Record a clean 5-second clip (stop-and-restart for a valid standalone file)
        const blob = await new Promise<Blob>((resolve, reject) => {
          const chunks: Blob[] = [];
          const recorder = new MediaRecorder(audioStream, { mimeType });
          recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
          recorder.onerror = () => reject(new Error('MediaRecorder error'));
          recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
          recorder.start();
          // Stop after 5 s (or immediately if listening stopped mid-cycle)
          setTimeout(() => {
            if (recorder.state !== 'inactive') recorder.stop();
          }, 5000);
        });

        if (blob.size > 500 && isListeningRef.current) {
          const buffer = await blob.arrayBuffer();
          window.electronAPI.sendChatGptAudioChunk(buffer);
        }
      } catch (err) {
        console.error('[ChatGPT Live] Cycle error:', err);
        // Short pause before retrying to avoid tight error loops
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }, []);

  /* ── Live: start / restart (also called on device-change) ── */
  const handleLiveStart = async () => {
    if (isListening) return;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        // Disable processing so raw loopback audio is captured correctly
        // with any output device (speakers OR headphones)
        audio: {
          echoCancellation:   false,
          noiseSuppression:   false,
          autoGainControl:    false,
          sampleRate:         { ideal: 44100 },
          channelCount:       { ideal: 2 },
        },
        video: true, // required by the API — video tracks are stopped immediately
      });

      // Drop video tracks straight away — we only need audio
      stream.getVideoTracks().forEach(t => t.stop());

      if (!stream.getAudioTracks().length) {
        console.error('[ChatGPT Live] No audio track — make sure "Share system audio" is checked');
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      audioStreamRef.current = stream;
      isListeningRef.current = true;
      setIsListening(true);

      // When the audio device changes (e.g. headphones plugged in/out),
      // Windows kills the capture track. Auto-restart instead of stopping.
      stream.getAudioTracks()[0].onended = () => {
        console.log('[ChatGPT Live] Audio track ended — device changed, restarting…');
        // Clean up old stream then re-acquire
        stream.getTracks().forEach(t => t.stop());
        audioStreamRef.current = null;
        isListeningRef.current = false;
        setIsListening(false);          // briefly reset UI
        setTimeout(() => handleLiveStart(), 800); // re-trigger after OS settles
      };

      // Kick off the recording loop (non-blocking)
      runRecordingCycle(stream).catch(err => {
        console.error('[ChatGPT Live] Recording loop crashed:', err);
        handleLiveStop();
      });
    } catch (err: any) {
      console.error('[ChatGPT Live] getDisplayMedia error:', err);
    }
  };

  /* ── Live: stop ──────────────────────────────────────────── */
  const handleLiveStop = useCallback(() => {
    isListeningRef.current = false;
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;
    }
    setIsListening(false);
    setIsTranscribing(false);
  }, []);

  /* ── Derived style helpers ───────────────────────────────── */
  const ssBtnClass = [
    'flex items-center gap-0.5 px-1.5 h-6 rounded transition-all select-none border bg-transparent',
    captureStatus === 'ok'  ? 'text-cyan-400 border-cyan-400' :
    captureStatus === 'err' ? 'text-red-500  border-red-500'  :
    'cgpt-ss-btn',
    isCapturing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
  ].join(' ');

  return (
    <div className="absolute inset-0 z-50 flex flex-col cgpt-panel">

      {/* ── Top bar ──────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-2 py-1 shrink-0 cgpt-topbar">

        {/* ── LEFT: Nav buttons + loading ────────────────────── */}
        <button type="button" onClick={handleBack}
          className="w-6 h-6 flex items-center justify-center rounded transition-colors cgpt-nav-btn"
          aria-label="Back">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <button type="button" onClick={handleForward}
          className="w-6 h-6 flex items-center justify-center rounded transition-colors cgpt-nav-btn"
          aria-label="Forward">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <button type="button" onClick={handleReload}
          className="w-6 h-6 flex items-center justify-center rounded transition-colors cgpt-nav-btn"
          aria-label="Reload">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>

        {isLoading && (
          <div className="flex items-center gap-1 ml-1">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[9px] cgpt-muted">Loading…</span>
          </div>
        )}

        {/* ── CENTRE spacer ──────────────────────────────────── */}
        <div className="flex-1" />

        {/* ── CENTRE: SS + Live/mike buttons ─────────────────── */}
        <button
          type="button"
          onClick={handleScreenshotPaste}
          disabled={isCapturing}
          title="Take screenshot & paste into ChatGPT chat"
          aria-label="Screenshot to ChatGPT"
          className={ssBtnClass}
        >
          {isCapturing ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" className="animate-spin">
              <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
              <path d="M12 3a9 9 0 0 1 9 9" />
            </svg>
          ) : captureStatus === 'ok' ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : captureStatus === 'err' ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          )}
          <span className="text-[8px] font-semibold uppercase tracking-wide leading-none">SS</span>
        </button>

        {/* Live / Stop (mike) button */}
        {!isListening ? (
          <button
            type="button"
            onClick={handleLiveStart}
            title="Start listening to system audio — transcript auto-types into ChatGPT"
            aria-label="Start live audio listen"
            className="flex items-center gap-0.5 px-1.5 h-6 rounded border bg-transparent cursor-pointer transition-all select-none cgpt-ss-btn"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
            </svg>
            <span className="text-[8px] font-semibold uppercase tracking-wide leading-none">Live</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleLiveStop}
            title="Stop live audio listen"
            aria-label="Stop live audio listen"
            className="relative flex items-center gap-0.5 px-1.5 h-6 rounded border bg-transparent cursor-pointer transition-all select-none text-red-500 border-red-500"
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="text-[8px] font-semibold uppercase tracking-wide leading-none">
              {isTranscribing ? '…' : 'Stop'}
            </span>
          </button>
        )}

        {/* ── RIGHT spacer ───────────────────────────────────── */}
        <div className="flex-1" />

        {/* ── RIGHT: label + close ───────────────────────────── */}
        <span className="text-[9px] font-semibold uppercase tracking-wider mr-1 cgpt-muted">
          ChatGPT
        </span>

        <button type="button" onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded transition-colors cgpt-close-btn"
          aria-label="Close ChatGPT">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Webview */}
      {/* @ts-ignore — webview is an Electron-specific HTML tag */}
      <webview
        ref={webviewRef as any}
        src={url}
        className="flex-1 w-full h-full"
        /* @ts-ignore */
        allowpopups="true"
      />
    </div>
  );
};

export default ChatGPTPanel;
