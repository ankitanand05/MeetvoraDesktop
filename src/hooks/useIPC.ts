/**
 * useIPC Hook
 *
 * Sets up IPC event listeners for incoming events from the main process.
 * Automatically cleans up listeners on unmount.
 */

import { useEffect } from 'react';
import type { UseSessionReturn } from './useSession';

/**
 * Subscribe to IPC events from the main process and route them
 * to the session state handlers.
 *
 * @param session - The session state and actions from useSession hook
 */
export function useIPC(session: UseSessionReturn, onStealthChanged?: (enabled: boolean) => void): void {
  useEffect(() => {
    // Listen for new transcript chunks from Whisper
    const unsubTranscript = window.electronAPI.onTranscript((data) => {
      session.addTranscript({
        text: data.text,
        timestamp: data.timestamp,
      });
    });

    // Listen for streaming GPT response tokens
    const unsubAIChunk = window.electronAPI.onAIResponseChunk((data) => {
      session.appendAIChunk(data.chunk);
    });

    // Listen for complete GPT response
    const unsubAIComplete = window.electronAPI.onAIResponseComplete((data) => {
      session.completeAIResponse(data.fullText);
    });

    // Listen for status changes from the main process
    const unsubStatus = window.electronAPI.onStatusChange((data) => {
      session.setStatus(data.status as any);
    });

    // Listen for errors from the main process
    const unsubError = window.electronAPI.onError((data) => {
      session.setError(data.message);
    });

    // Listen for follow-up suggestions
    const unsubSuggestions = window.electronAPI.onSuggestions((data) => {
      session.setSuggestions(data.suggestions);
    });

    // Listen for stealth mode changes from backend (auto-enabled for interview/conductor)
    const unsubStealth = window.electronAPI.onStealthChanged((enabled) => {
      onStealthChanged?.(enabled);
    });

    // Cleanup all listeners on unmount
    return () => {
      unsubTranscript();
      unsubAIChunk();
      unsubAIComplete();
      unsubStatus();
      unsubError();
      unsubSuggestions();
      unsubStealth();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount
}
