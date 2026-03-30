import React, { useCallback, useEffect, useState } from 'react';
import Header from './components/Header';
import ChatPanel from './components/ChatPanel';
import Controls from './components/Controls';
import ModeSelectScreen, { AppMode } from './components/ModeSelectScreen';
import SetupScreen from './components/SetupScreen';
import MeetingSetupScreen from './components/MeetingSetupScreen';
import CustomSetupScreen from './components/CustomSetupScreen';
import ConductorSetupScreen from './components/ConductorSetupScreen';
import WelcomeScreen from './components/WelcomeScreen';
import DashboardScreen from './components/DashboardScreen';
import SettingsPanel from './components/SettingsPanel';
import { useSession } from './hooks/useSession';
import { useIPC } from './hooks/useIPC';
import { ThemeProvider, useTheme } from './hooks/useTheme';
import { useSettings } from './hooks/useSettings';
import ErrorBoundary from './components/ErrorBoundary';

/** Inner component that reads the theme */
const AppInner: React.FC = () => {
  const session = useSession();
  const { isDark } = useTheme();
  const { settings } = useSettings();
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [screen, setScreen] = useState<'welcome' | 'dashboard' | 'mode-select' | 'setup' | 'main'>('welcome');
  const [selectedMode, setSelectedMode] = useState<AppMode | null>(null);
  const [isStealth, setIsStealth] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [isTeleprompter, setIsTeleprompter] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [user, setUser] = useState<{ email: string; name: string; role: string } | null>(null);

  // Wire up IPC event listeners
  useIPC(session, setIsStealth);

  // On mount, validate token with backend. If valid → dashboard, else → welcome
  // [OFFLINE_MODE] — If user is offline, skip backend validation and go to dashboard
  useEffect(() => {
    const checkUser = async () => {
      try {
        const u = await window.electronAPI.getUser();
        if (!u) return; // no stored user, stay on welcome

        // [OFFLINE_MODE] — Skip backend validation for offline user
        if (u.email === 'offline@meetvora.local') {
          setUser(u);
          setScreen('dashboard');
          return;
        }

        // Validate token is still valid by calling backend
        const profile = await window.electronAPI.getUserProfile();
        if (profile.success) {
          setUser(u);
          setScreen('dashboard');
        } else {
          // Token expired/invalid — clear stale auth
          await window.electronAPI.signOut();
        }
      } catch {
        // not signed in or backend unreachable — stay on welcome
      }
    };
    checkUser();
  }, []);

  // Check API key on mount
  useEffect(() => {
    window.electronAPI.hasApiKey().then(exists => setHasApiKey(exists)).catch(() => setHasApiKey(false));
  }, []);

  // Apply transparency/opacity based on settings
  useEffect(() => {
    const root = document.documentElement;
    if (settings.seeThrough) {
      // Full see-through: nearly invisible
      root.style.setProperty('--glass-bg', 'rgba(0,0,0,0.02)');
      root.style.setProperty('--glass-bg-strong', 'rgba(0,0,0,0.03)');
      root.style.setProperty('--glass-bg-subtle', 'rgba(0,0,0,0.01)');
    } else {
      const opacity = settings.transparencyLevel / 100;
      const opacityStrong = Math.min(opacity + 0.1, 0.95);
      const opacitySubtle = Math.max(opacity - 0.1, 0.05);
      if (isDark) {
        root.style.setProperty('--glass-bg', `rgba(15,15,20,${opacity})`);
        root.style.setProperty('--glass-bg-strong', `rgba(15,15,20,${opacityStrong})`);
        root.style.setProperty('--glass-bg-subtle', `rgba(15,15,20,${opacitySubtle})`);
      } else {
        root.style.setProperty('--glass-bg', `rgba(245,245,248,${opacity})`);
        root.style.setProperty('--glass-bg-strong', `rgba(245,245,248,${opacityStrong})`);
        root.style.setProperty('--glass-bg-subtle', `rgba(245,245,248,${opacitySubtle})`);
      }
    }
  }, [settings.seeThrough, settings.transparencyLevel, isDark]);

  /** Mode selection */
  const handleModeSelect = (mode: AppMode) => {
    setSelectedMode(mode);
    setScreen('setup');
  };

  /** Back to mode selection */
  const handleBackToModes = () => {
    setSelectedMode(null);
    setScreen('mode-select');
  };

  /** Interview setup complete */
  const handleInterviewSetupComplete = async (profile: string, jobDescription: string) => {
    try {
      await window.electronAPI.setInterviewContext({ profile, jobDescription });
      setScreen('main');
    } catch (err) {
      console.error('Failed to set interview context:', err);
    }
  };

  /** Meeting setup complete */
  const handleMeetingSetupComplete = async (agenda: string, attendees: string) => {
    try {
      await window.electronAPI.setMeetingContext({ agenda, attendees });
      setScreen('main');
    } catch (err) {
      console.error('Failed to set meeting context:', err);
    }
  };

  /** Custom setup complete */
  const handleCustomSetupComplete = async (systemPrompt: string) => {
    try {
      await window.electronAPI.setCustomContext({ systemPrompt });
      setScreen('main');
    } catch (err) {
      console.error('Failed to set custom context:', err);
    }
  };

  /** Conductor setup complete */
  const handleConductorSetupComplete = async (resume: string, jobDescription: string, difficulty: string, questionCount: number, focusAreas: string) => {
    try {
      await window.electronAPI.setConductorContext({ resume, jobDescription, difficulty, questionCount, focusAreas });
      setScreen('main');
      // Automatically generate the first interview question
      setTimeout(() => window.electronAPI.conductorNextQuestion(), 500);
    } catch (err) {
      console.error('Failed to set conductor context:', err);
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
  }, [screen, session.status, session.suggestions, settings.spacebarMode]);

  const MEETVORA_URL = 'http://localhost:5173';

  const handleBuyCredits = () => {
    window.electronAPI.openExternal(`${MEETVORA_URL}/pricing`).catch(() => {});
  };

  const handleSignOut = async () => {
    await window.electronAPI.signOut();
    setUser(null);
    setScreen('welcome');
  };

  // Navigate to dashboard after auth (fetches user from main process)
  const goToDashboard = async (authUser?: { email: string; name: string; role: string }) => {
    if (authUser) {
      setUser(authUser);
    } else {
      try {
        const u = await window.electronAPI.getUser();
        if (u) setUser(u);
      } catch { /* ignore */ }
    }
    setScreen('dashboard');
  };

  // ── Welcome screen ──
  if (screen === 'welcome') {
    return (
      <WelcomeScreen
        onContinue={goToDashboard}
        onMinimize={minHandler}
        onClose={closeHandler}
        user={user}
      />
    );
  }

  // ── Dashboard screen (after login, before mode select) ──
  if (screen === 'dashboard') {
    if (!user) {
      setScreen('welcome');
      return null;
    }
    return (
      <DashboardScreen
        onContinue={() => setScreen('mode-select')}
        onBuyCredits={handleBuyCredits}
        onSignOut={handleSignOut}
        onAuthExpired={handleSignOut}
        onBack={handleSignOut}
        onMinimize={minHandler}
        onClose={closeHandler}
        user={user}
      />
    );
  }

  // ── Mode selection screen ──
  if (screen === 'mode-select') {
    return (
      <ModeSelectScreen
        onSelect={handleModeSelect}
        onBack={() => setScreen('dashboard')}
        onMinimize={minHandler}
        onClose={closeHandler}
      />
    );
  }

  // ── Setup screens per mode ──
  if (screen === 'setup') {
    if (selectedMode === 'interview') {
      return (
        <SetupScreen
          onComplete={handleInterviewSetupComplete}
          onBack={handleBackToModes}
          onMinimize={minHandler}
          onClose={closeHandler}
        />
      );
    }
    if (selectedMode === 'meeting') {
      return (
        <MeetingSetupScreen
          onComplete={handleMeetingSetupComplete}
          onBack={handleBackToModes}
          onMinimize={minHandler}
          onClose={closeHandler}
        />
      );
    }
    if (selectedMode === 'custom') {
      return (
        <CustomSetupScreen
          onComplete={handleCustomSetupComplete}
          onBack={handleBackToModes}
          onMinimize={minHandler}
          onClose={closeHandler}
        />
      );
    }
    if (selectedMode === 'conductor') {
      return (
        <ConductorSetupScreen
          onComplete={handleConductorSetupComplete}
          onBack={handleBackToModes}
          onMinimize={minHandler}
          onClose={closeHandler}
        />
      );
    }
  }

  // ── Main copilot view ──
  return (
    <div
      className="relative flex flex-col h-screen overflow-hidden rounded-xl backdrop-blur-xl transition-colors duration-300"
      style={{
        background: 'var(--glass-bg)',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: 'var(--glass-border)',
      }}
    >
      {/* Custom titlebar */}
      <Header
        status={session.status}
        isAlwaysOnTop={session.isAlwaysOnTop}
        isStealth={isStealth}
        onToggleAlwaysOnTop={session.toggleAlwaysOnTop}
        onToggleStealth={handleToggleStealth}
        onBack={() => { setSelectedMode(null); setScreen('dashboard'); }}
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
        spacebarMode={settings.spacebarMode}
        audioDeviceId={settings.audioDeviceId}
      />

      {/* Settings panel overlay — rendered last so it's above everything in DOM order */}
      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          onSignOut={handleSignOut}
          onViewHistory={() => {}}
        />
      )}
    </div>
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
