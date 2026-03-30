/**
 * useSession Hook (FIXED STABLE VERSION)
 *
 * Buffers MediaRecorder chunks manually to ensure
 * complete valid audio blobs before sending to main.
 */

import { useState, useCallback, useRef } from 'react';
import type { TranscriptEntry, AIResponse, AppStatus, Session, ChatMessage } from '../types';

export interface UseSessionReturn {
  sessionId: string | null;
  status: AppStatus;
  transcripts: TranscriptEntry[];
  aiResponse: AIResponse;
  chatMessages: ChatMessage[];
  suggestions: string[];
  error: string | null;
  isAlwaysOnTop: boolean;
  sessions: Session[];

  startSession: () => Promise<void>;
  stopSession: () => Promise<void>;
  clearSession: () => void;
  toggleAlwaysOnTop: () => Promise<void>;
  loadSessions: () => Promise<void>;
  setError: (error: string | null) => void;
  setStatus: (status: AppStatus) => void;
  addTranscript: (entry: TranscriptEntry) => void;
  appendAIChunk: (chunk: string) => void;
  completeAIResponse: (fullText: string) => void;
  setSuggestions: (suggestions: string[]) => void;
}

/* ---------------- WAV CONVERSION ---------------- */

async function convertBlobToWav(blob: Blob): Promise<ArrayBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext({ sampleRate: 16000 });

  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const samples = audioBuffer.getChannelData(0);

    const int16 = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    const wavHeader = 44;
    const dataLength = int16.length * 2;
    const buffer = new ArrayBuffer(wavHeader + dataLength);
    const view = new DataView(buffer);

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');

    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 16000, true);
    view.setUint32(28, 16000 * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);

    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    const output = new Int16Array(buffer, wavHeader);
    output.set(int16);

    return buffer;
  } finally {
    await audioCtx.close();
  }
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/** Max chat messages to keep in memory — prevents OOM over long sessions */
const MAX_CHAT_MESSAGES = 50;
/** Max transcript entries to keep — older ones are dropped */
const MAX_TRANSCRIPTS = 50;

/* ---------------- HOOK ---------------- */

export function useSession(): UseSessionReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<AppStatus>('idle');
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [aiResponse, setAiResponse] = useState<AIResponse>({ text: '', isStreaming: false });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [error, setErrorRaw] = useState<string | null>(null);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null);

  /** Set error with auto-dismiss after 5 seconds */
  const setError = useCallback((msg: string | null) => {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    setErrorRaw(msg);
    if (msg) {
      errorTimerRef.current = setTimeout(() => {
        setErrorRaw(null);
        errorTimerRef.current = null;
      }, 5000);
    }
  }, []);
  const [sessions, setSessions] = useState<Session[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const capturingRef = useRef<boolean>(false);
  const accumulatedChunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>('audio/webm');

  /* ---------------- START SESSION ---------------- */

  const startSession = useCallback(async () => {
    try {
      setError(null);
      setTranscripts([]);
      setAiResponse({ text: '', isStreaming: false });
      setChatMessages([]);

      const newSessionId = await window.electronAPI.startCapture();
      setSessionId(newSessionId);

      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: true,
      });

      const audioTracks = stream.getAudioTracks();
      if (!audioTracks.length) {
        throw new Error('System audio not available. Make sure to check "Share system audio" in the screen picker.');
      }

      mediaStreamRef.current = stream;
      capturingRef.current = true;
      accumulatedChunksRef.current = [];

      const audioStream = new MediaStream(audioTracks);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      mimeTypeRef.current = mimeType;

      const recorder = new MediaRecorder(audioStream, { mimeType });

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          accumulatedChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setError('Audio recording error.');
        setStatus('error');
        capturingRef.current = false;
      };

      // Use timeslice to get periodic data events (safety against data loss)
      recorder.start(30000);
      mediaRecorderRef.current = recorder;

      setStatus('listening');
      console.log('[useSession] Audio capture started (continuous — processes on Stop)');
    } catch (err: any) {
      capturingRef.current = false;
      setError(err.message || 'Failed to start session');
      setStatus('error');
    }
  }, []);

  /* ---------------- STOP SESSION ---------------- */

  const stopSession = useCallback(async () => {
    capturingRef.current = false;
    const currentSessionId = sessionId;

    // Stop recorder and wait for final data
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      const recorder = mediaRecorderRef.current;

      await new Promise<void>((resolve) => {
        const originalOnData = recorder.ondataavailable;
        recorder.ondataavailable = (event: BlobEvent) => {
          if (event.data.size > 0) {
            accumulatedChunksRef.current.push(event.data);
          }
        };
        recorder.onstop = () => resolve();
        recorder.stop();
      });
    }
    mediaRecorderRef.current = null;

    // Stop media tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }

    // Process accumulated audio
    const chunks = accumulatedChunksRef.current;
    accumulatedChunksRef.current = [];

    if (chunks.length > 0) {
      const fullBlob = new Blob(chunks, { type: mimeTypeRef.current });

      if (fullBlob.size > 1000) {
        setStatus('processing');
        try {
          const wavBuffer = await convertBlobToWav(fullBlob);
          window.electronAPI.sendAudioChunk(wavBuffer);
        } catch {
          console.warn('[useSession] WAV conversion failed, sending raw webm');
          const buffer = await fullBlob.arrayBuffer();
          window.electronAPI.sendAudioChunk(buffer);
        }
      }
    }

    if (currentSessionId) {
      await window.electronAPI.stopCapture(currentSessionId);
    }

    setSessionId(null);
    // Status will be set to 'idle' after GPT response completes via IPC
    // If no audio was captured, set idle immediately
    if (chunks.length === 0 || new Blob(chunks).size <= 1000) {
      setStatus('idle');
    }
  }, [sessionId]);

  /* ---------------- REST UNCHANGED ---------------- */

  const clearSession = useCallback(() => {
    setTranscripts([]);
    setAiResponse({ text: '', isStreaming: false });
    setChatMessages([]);
    setSuggestions([]);
    setError(null);
  }, []);

  const toggleAlwaysOnTop = useCallback(async () => {
    const newState = await window.electronAPI.toggleAlwaysOnTop();
    setIsAlwaysOnTop(newState);
  }, []);

  const loadSessions = useCallback(async () => {
    const allSessions = await window.electronAPI.getSessions();
    setSessions(allSessions);
  }, []);

  const addTranscript = useCallback((entry: TranscriptEntry) => {
    setTranscripts(prev => {
      const next = [...prev, entry];
      return next.length > MAX_TRANSCRIPTS ? next.slice(-MAX_TRANSCRIPTS) : next;
    });
    setSuggestions([]);
    // Push a user chat message (cap size)
    setChatMessages(prev => {
      const next = [
        ...prev,
        {
          id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role: 'user' as const,
          text: entry.text,
          timestamp: entry.timestamp,
        },
      ];
      return next.length > MAX_CHAT_MESSAGES ? next.slice(-MAX_CHAT_MESSAGES) : next;
    });
  }, []);

  // Ref to track the current AI message id for streaming
  const currentAiMsgId = useRef<string | null>(null);
  // Mutable streaming buffer — avoids copying the entire chatMessages array on every token
  const streamBufRef = useRef('');
  const flushTimerRef = useRef<number | null>(null);

  /** Flush accumulated chunks into React state (called at ~200ms intervals) */
  const flushStreamBuffer = useCallback(() => {
    const buffered = streamBufRef.current;
    if (!buffered) return;
    streamBufRef.current = '';

    setAiResponse(prev => ({
      text: prev.text + buffered,
      isStreaming: true,
    }));

    setChatMessages(prev => {
      const last = prev[prev.length - 1];
      if (last && last.role === 'ai' && last.id === currentAiMsgId.current) {
        const updated = [...prev];
        updated[updated.length - 1] = { ...last, text: last.text + buffered, isStreaming: true };
        return updated;
      }
      // Start a new AI message
      const newId = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      currentAiMsgId.current = newId;
      const next = [
        ...prev,
        { id: newId, role: 'ai' as const, text: buffered, timestamp: new Date().toISOString(), isStreaming: true },
      ];
      return next.length > MAX_CHAT_MESSAGES ? next.slice(-MAX_CHAT_MESSAGES) : next;
    });
  }, []);

  const appendAIChunk = useCallback((chunk: string) => {
    streamBufRef.current += chunk;
    // Schedule a flush if one isn't already pending (~200ms batching)
    if (flushTimerRef.current === null) {
      flushTimerRef.current = window.setTimeout(() => {
        flushTimerRef.current = null;
        flushStreamBuffer();
      }, 200);
    }
  }, [flushStreamBuffer]);

  const completeAIResponse = useCallback((fullText: string) => {
    // Cancel any pending flush and drain the buffer
    if (flushTimerRef.current !== null) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    streamBufRef.current = '';

    setAiResponse({
      text: fullText,
      isStreaming: false,
    });
    // Finalize the current AI chat message
    setChatMessages(prev => {
      const last = prev[prev.length - 1];
      if (last && last.role === 'ai' && last.id === currentAiMsgId.current) {
        const updated = [...prev];
        updated[updated.length - 1] = { ...last, text: fullText, isStreaming: false };
        return updated;
      }
      return prev;
    });
    currentAiMsgId.current = null;
  }, []);

  return {
    sessionId,
    status,
    transcripts,
    aiResponse,
    chatMessages,
    suggestions,
    error,
    isAlwaysOnTop,
    sessions,
    startSession,
    stopSession,
    clearSession,
    toggleAlwaysOnTop,
    loadSessions,
    setError,
    setStatus,
    addTranscript,
    appendAIChunk,
    completeAIResponse,
    setSuggestions,
  };
}
