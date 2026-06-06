import React, { useCallback, useEffect, useState } from 'react';
import Header from './components/Header';
import ChatPanel from './components/ChatPanel';
import Controls from './components/Controls';
import SetupScreen from './components/SetupScreen';
import SettingsPanel from './components/SettingsPanel';
import { useSession } from './hooks/useSession';
import { useIPC } from './hooks/useIPC';
import { ThemeProvider, useTheme } from './hooks/useTheme';
import { useSettings } from './hooks/useSettings';
import ChatGPTPanel from './components/ChatGPTPanel';
import GhostCursor from './components/GhostCursor';
import ErrorBoundary from './components/ErrorBoundary';

/** Inner component that reads the theme */
const AppInner: React.FC = () => {
  const session = useSession();
  const { isDark } = useTheme();
  const { settings } = useSettings();
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [screen, setScreen] = useState<'setup' | 'main'>('setup');
  const [isStealth, setIsStealth] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [isTeleprompter, setIsTeleprompter] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChatGPT, setShowChatGPT] = useState(false);

  // Wire up IPC event listeners
  useIPC(session, setIsStealth);

  // Check API key on mount
  useEffect(() => {
    window.electronAPI.hasApiKey().then(exists => setHasApiKey(exists)).catch(() => setHasApiKey(false));
  }, []);

  // Ghost cursor — two side-effects that must always stay in sync:
  //   1. Inject cursor:none CSS so the system cursor is hidden on screen.
  //   2. Tell the main process to setContentProtection(true) so the DOM cursor
  //      elements are invisible to screen-sharing / recording tools (they're
  //      still fully visible on the user's own display).
  useEffect(() => {
    // ── CSS: hide system cursor ──────────────────────────────────────────────
    // Dynamic <style> inside @layer base beats the Tailwind reset's
    // `* { cursor: default !important }` because within the same layer the
    // LATER declaration wins, even for !important.
    const STYLE_ID = 'gc-cursor-override';
    if (settings.ghostCursor) {
      if (!document.getElementById(STYLE_ID)) {
        const el = document.createElement('style');
        el.id = STYLE_ID;
        el.textContent = '@layer base { *, *::before, *::after { cursor: none !important; } }';
        document.head.appendChild(el);
      }
    } else {
      document.getElementById(STYLE_ID)?.remove();
    }

    // ── IPC: enable / disable content protection ─────────────────────────────
    window.electronAPI.setGhostCursorProtection(settings.ghostCursor)
      .catch(() => { /* non-fatal — cursor still works, just not protection-gated */ });

    return () => { document.getElementById(STYLE_ID)?.remove(); };
  }, [settings.ghostCursor]);


  /** Interview setup complete — enter session (no going back) */
  const handleInterviewSetupComplete = async (profile: string, jobDescription: string) => {
    try {
      await window.electronAPI.setInterviewContext({ profile, jobDescription });
      setScreen('main');
    } catch (err) {
      console.error('Failed to set interview context:', err);
    }
  };

  const handleToggleStealth = async () => {
    try {
      const newVal = await window.electronAPI.toggleStealth();
      setIsStealth(newVal);
    } catch (err) {
      console.error('Failed to toggle stealth:', err);
    }
  };

  const minHandler = () => window.electronAPI.minimizeWindow();
  const closeHandler = () => window.electronAPI.closeWindow();

  // ── Global keyboard shortcuts (active on main screen) ──
  const handleScreenshot = useCallback(() => {
    window.electronAPI.captureScreenshot();
  }, []);

  useEffect(() => {
    if (screen !== 'main') return;

    const handler = (e: KeyboardEvent) => {
      // Skip shortcuts when typing in input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // ── Single-key shortcuts (no modifier) ──
      switch (e.key.toUpperCase()) {
        case ' ': // Spacebar — voice recording shortcut
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('shortcut:spacebar', { detail: { mode: settings.spacebarMode } }));
          return;
        case 'F':
          e.preventDefault();
          window.electronAPI.positionWindow('fullscreen');
          return;
        case 'R':
          e.preventDefault();
          window.electronAPI.positionWindow('right');
          return;
        case 'L':
          e.preventDefault();
          window.electronAPI.positionWindow('left');
          return;
        case 'C':
          e.preventDefault();
          window.electronAPI.positionWindow('center-top');
          return;
        case 'B':
          e.preventDefault();
          window.electronAPI.positionWindow('bottom');
          return;
        case 'ESCAPE':
          e.preventDefault();
          if (showSettings) {
            setShowSettings(false);
          } else if (session.isAlwaysOnTop) {
            window.electronAPI.minimizeWindow();
          } else {
            window.electronAPI.toggleVisibility();
          }
          return;
        case 'G': // Toggle teleprompter mode
          e.preventDefault();
          window.electronAPI.toggleTeleprompter().then(active => setIsTeleprompter(active));
          return;
        case 'W': // Toggle ChatGPT webview
          e.preventDefault();
          setShowChatGPT(prev => !prev);
          return;
        case 'S': // Shrink / restore window — but let Ctrl+Shift+S fall through to Start/Stop
          if (!e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            window.electronAPI.shrinkWindow();
            return;
          }
          break; // Ctrl+Shift+S handled in the modifier section below
        case 'M': // Medium window size / restore
          if (!e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            window.electronAPI.mediumWindow();
            return;
          }
          break;
      }

      // ── Number keys 1-5: select follow-up suggestion ──
      if (['1','2','3','4','5'].includes(e.key)) {
        const num = parseInt(e.key);
        if (num === 1 && session.chatMessages.length > 0) {
          // "Explain" — always available
          e.preventDefault();
          session.setSuggestions([]);
          window.electronAPI.sendTextQuestion('Explain the above answer in more detail with examples');
          return;
        }
        if (num >= 2 && session.suggestions.length > 0) {
          const idx = num - 2; // key 2 → index 0, key 3 → index 1, etc.
          if (idx < session.suggestions.length) {
            e.preventDefault();
            const suggestion = session.suggestions[idx];
            session.setSuggestions([]);
            window.electronAPI.sendTextQuestion(suggestion);
            return;
          }
        }
      }

      // ── Arrow key scrolling ──
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const chatScroll = document.querySelector('[data-chat-scroll]');
        if (chatScroll) {
          chatScroll.scrollBy({
            top: e.key === 'ArrowDown' ? 80 : -80,
            behavior: 'smooth',
          });
        }
        return;
      }

      // Ctrl+Shift combos
      if (e.ctrlKey && e.shiftKey) {
        switch (e.key.toUpperCase()) {
          case 'S': // Start / Stop
            e.preventDefault();
            if (session.status === 'idle' || session.status === 'error') {
              session.startSession();
            } else {
              session.stopSession();
            }
            break;
          case 'M': // Mic voice question
            e.preventDefault();
            // Handled via Controls ref — dispatch custom event
            window.dispatchEvent(new CustomEvent('shortcut:mic'));
            break;
          case 'T': // Toggle text input
            e.preventDefault();
            setShowTextInput(prev => !prev);
            break;
          case 'X': // Clear
            e.preventDefault();
            session.clearSession();
            break;
          case 'P': // Screenshot
            e.preventDefault();
            handleScreenshot();
            break;
          case 'H': // Toggle stealth
            e.preventDefault();
            handleToggleStealth();
            break;
          case 'A': // Toggle always-on-top
            e.preventDefault();
            session.toggleAlwaysOnTop();
            break;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [screen, session.status, session.suggestions, settings.spacebarMode, showSettings, session.isAlwaysOnTop]);

  // ── Main copilot view ──
  const mainView = (
    <div
      className="relative flex flex-col h-screen overflow-hidden rounded-xl backdrop-blur-xl transition-colors duration-300"
      style={{
        background: 'var(--glass-bg)',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: 'var(--glass-border)',
      }}
    >
      {/* Custom titlebar — no back button during active session */}
      <Header
        status={session.status}
        isAlwaysOnTop={session.isAlwaysOnTop}
        isStealth={isStealth}
        onToggleAlwaysOnTop={session.toggleAlwaysOnTop}
        onToggleStealth={handleToggleStealth}
        onMinimize={() => window.electronAPI.minimizeWindow()}
        onClose={() => window.electronAPI.closeWindow()}
      />

      {/* API key warning banner */}
      {hasApiKey === false && session.status === 'idle' && (
        <div className="px-3 py-1.5 border-b" style={{ background: isDark ? 'rgba(120,53,15,0.25)' : 'rgba(254,243,199,0.8)', borderColor: 'var(--glass-border)' }}>
          <p className="text-[11px] text-center" style={{ color: isDark ? '#fbbf24' : '#92400e' }}>
            No API key set — click ⚙ Settings or add to .env file
          </p>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col p-2 overflow-hidden min-h-0">
        <ChatPanel
          messages={session.chatMessages}
          isListening={session.status === 'listening'}
          isProcessing={session.status === 'processing'}
          showTextInput={showTextInput}
          onCloseTextInput={() => setShowTextInput(false)}
          onSendMessage={(text) => {
            window.electronAPI.sendTextQuestion(text);
          }}
          isTeleprompter={isTeleprompter}
          suggestions={session.suggestions}
          onSelectSuggestion={(suggestion) => {
            session.setSuggestions([]);
            window.electronAPI.sendTextQuestion(suggestion);
          }}
          chatTextSize={settings.chatTextSize}
        />
      </div>

      {/* Control bar */}
      <Controls
        status={session.status}
        onStart={session.startSession}
        onStop={session.stopSession}
        onClear={session.clearSession}
        onToggleText={() => setShowTextInput(prev => !prev)}
        isTextOpen={showTextInput}
        error={session.error}
        onOpenSettings={() => setShowSettings(true)}
        onToggleChatGPT={() => setShowChatGPT(prev => !prev)}
        isChatGPTOpen={showChatGPT}
        spacebarMode={settings.spacebarMode}
        audioDeviceId={settings.audioDeviceId}
      />

      {/* Settings panel overlay — rendered last so it's above everything in DOM order */}
      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          onViewHistory={() => {}}
        />
      )}

      {/* ChatGPT webview overlay — stealth-protected */}
      {showChatGPT && (
        <ChatGPTPanel onClose={() => setShowChatGPT(false)} />
      )}
    </div>
  );

  // Ghost cursor is rendered via createPortal into document.body — it must be
  // mounted on EVERY screen (setup + main) so it's visible from the very first
  // frame the app opens.
  return (
    <>
      {screen === 'setup' ? (
        <SetupScreen
          onComplete={handleInterviewSetupComplete}
          onBack={minHandler}
          onMinimize={minHandler}
          onClose={closeHandler}
        />
      ) : (
        mainView
      )}

      {/* Always-on ghost cursor — portal renders into <body>, works on all screens */}
      {settings.ghostCursor && <GhostCursor />}
    </>
  );
};

/** Root component with theme provider */
const App: React.FC = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
