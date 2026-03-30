/**
 * WelcomeScreen — In-app authentication.
 *
 * Provides Sign In and Sign Up forms that call the backend API
 * directly via IPC (no browser redirect).
 */

import React, { useState } from 'react';
import { useTheme } from '../hooks/useTheme';

interface WelcomeScreenProps {
  onContinue: (user: { email: string; name: string; role: string }) => void;
  onMinimize: () => void;
  onClose: () => void;
  /** If already signed in, caller passes user info */
  user?: { email: string; name: string; role: string } | null;
}

const features = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    gradient: 'from-violet-500 to-indigo-600',
    title: 'Interview Assistant',
    desc: 'Real-time AI answers tailored to your profile — invisible to screen share.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
    gradient: 'from-cyan-500 to-blue-600',
    title: 'Meeting Assistant',
    desc: 'Live transcription, smart summaries, and action items for any meeting.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    gradient: 'from-emerald-500 to-teal-600',
    title: 'Stealth Mode',
    desc: 'Completely hidden from screen recording and video conferencing tools.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    gradient: 'from-amber-500 to-orange-500',
    title: 'Custom AI',
    desc: 'Define any system prompt and use your own AI copilot for any task.',
  },
];

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onContinue, onMinimize, onClose, user: initialUser }) => {
  const { isDark } = useTheme();
  const [user, setUser] = useState(initialUser ?? null);
  const [mode, setMode] = useState<'hero' | 'signin' | 'signup'>('hero');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const handleSignOut = async () => {
    await window.electronAPI.signOut();
    setUser(null);
    setMode('hero');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) { setError('Please fill in all fields'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await window.electronAPI.login(loginEmail.trim(), loginPassword);
      if (result.success && result.user) {
        setUser(result.user);
        onContinue(result.user);
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword.trim()) { setError('Please fill in all fields'); return; }
    if (regPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await window.electronAPI.register(regName.trim(), regEmail.trim(), regPassword);
      if (result.success && result.user) {
        setUser(result.user);
        onContinue(result.user);
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
    color: isDark ? '#e2e8f0' : '#1e293b',
  };

  return (
    <div
      className="flex flex-col h-screen overflow-hidden rounded-xl select-none"
      style={{
        background: isDark
          ? 'linear-gradient(160deg, rgba(15,23,42,0.96) 0%, rgba(30,27,75,0.96) 100%)'
          : 'linear-gradient(160deg, rgba(255,255,255,0.97) 0%, rgba(237,233,254,0.97) 100%)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(124,58,237,0.15)'}`,
      }}
    >
      {/* Titlebar drag region */}
      <div
        className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span
          className="text-xs font-bold tracking-widest uppercase"
          style={{ color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)' }}
        >
          Meetvora
        </span>
        <div
          className="flex gap-1.5"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={onMinimize}
            className="h-3 w-3 rounded-full bg-yellow-400 hover:bg-yellow-300 transition-colors"
            title="Minimize"
          />
          <button
            onClick={onClose}
            className="h-3 w-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors"
            title="Close"
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 pb-5">

        {/* Brand hero */}
        <div className="text-center pt-4 pb-5">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl mb-3"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              boxShadow: '0 8px 24px rgba(124,58,237,0.35)',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <h1
            className="text-2xl font-extrabold tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 60%, #06b6d4 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Meetvora
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Your invisible AI copilot — always ready, always hidden.
          </p>
        </div>

        {/* HERO VIEW (features + auth buttons) */}
        {mode === 'hero' && !user && (
          <>
            {/* Feature cards */}
            <div className="grid grid-cols-2 gap-2 mb-5">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl p-3 flex flex-col gap-2"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.75)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
                  }}
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${f.gradient} text-white flex-shrink-0`}
                  >
                    {f.icon}
                  </div>
                  <div>
                    <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                      {f.title}
                    </p>
                    <p className="text-[10px] leading-snug mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {f.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Auth CTAs */}
            <div className="flex flex-col gap-2 mb-3">
              <button
                onClick={() => { setMode('signup'); setError(''); }}
                className="w-full rounded-xl py-2.5 text-sm font-bold text-white transition-all active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  boxShadow: '0 4px 16px rgba(124,58,237,0.30)',
                }}
              >
                Create Free Account
              </button>
              <button
                onClick={() => { setMode('signin'); setError(''); }}
                className="w-full rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-[0.98]"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(124,58,237,0.08)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(124,58,237,0.25)'}`,
                  color: isDark ? '#c4b5fd' : '#6d28d9',
                }}
              >
                Sign In
              </button>
            </div>
            <p className="text-center text-[10px] mt-3 leading-snug px-4" style={{ color: 'var(--text-faint)' }}>
              Sign in or create a free account to start using Meetvora.
            </p>

            {/* [OFFLINE_MODE] — Remove this block when backend is hosted */}
            <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
              <button
                onClick={async () => {
                  setLoading(true);
                  setError('');
                  try {
                    const result = await window.electronAPI.continueOffline();
                    if (result.success && result.user) {
                      setUser(result.user);
                      onContinue(result.user);
                    }
                  } catch (err: any) {
                    setError(err.message || 'Failed to start offline mode');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="w-full rounded-xl py-2 text-xs font-medium transition-all active:scale-[0.98]"
                style={{
                  background: 'transparent',
                  border: `1px dashed ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                  color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                }}
              >
                {loading ? 'Starting...' : 'Continue without account (offline)'}
              </button>
              <p className="text-center text-[9px] mt-1.5" style={{ color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)' }}>
                Requires your own OpenAI API key. No credits needed.
              </p>
            </div>
            {/* [/OFFLINE_MODE] */}
          </>
        )}

        {/* SIGNED IN STATE */}
        {user && (
          <div className="rounded-xl p-3 text-center" style={{
            background: isDark ? 'rgba(34,197,94,0.10)' : 'rgba(34,197,94,0.08)',
            border: `1px solid ${isDark ? 'rgba(34,197,94,0.25)' : 'rgba(34,197,94,0.3)'}`,
          }}>
            <p className="text-sm font-semibold" style={{ color: isDark ? '#4ade80' : '#16a34a' }}>
              &#10003; Signed in as {user.name || user.email}
              {user.role === 'admin' && (
                <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">ADMIN</span>
              )}
            </p>
            <div className="flex items-center justify-center gap-3 mt-2">
              <button
                onClick={() => onContinue(user)}
                className="text-xs font-bold px-4 py-1.5 rounded-lg text-white transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
              >
                Get Started →
              </button>
              <button
                onClick={handleSignOut}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* SIGN IN FORM */}
        {mode === 'signin' && !user && (
          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <h2 className="text-base font-bold text-center" style={{ color: 'var(--text-primary)' }}>
              Sign In
            </h2>

            {error && (
              <div className="rounded-lg px-3 py-2 text-xs text-center" style={{
                background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(254,226,226,0.8)',
                color: '#ef4444',
                border: `1px solid ${isDark ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.2)'}`,
              }}>
                {error}
              </div>
            )}

            <input
              type="email"
              placeholder="Email"
              value={loginEmail}
              onChange={e => setLoginEmail(e.target.value)}
              className="rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500/40 transition"
              style={inputStyle}
              autoFocus
            />
            <input
              type="password"
              placeholder="Password"
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              className="rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500/40 transition"
              style={inputStyle}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-2.5 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                boxShadow: '0 4px 16px rgba(124,58,237,0.30)',
              }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => { setMode('hero'); setError(''); }}
              className="text-xs text-center transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              ← Back
            </button>
            <p className="text-center text-[10px] mt-1" style={{ color: 'var(--text-faint)' }}>
              Don't have an account?{' '}
              <button type="button" onClick={() => { setMode('signup'); setError(''); }} className="underline" style={{ color: isDark ? '#c4b5fd' : '#6d28d9' }}>
                Sign Up
              </button>
            </p>
          </form>
        )}

        {/* SIGN UP FORM */}
        {mode === 'signup' && !user && (
          <form onSubmit={handleRegister} className="flex flex-col gap-3">
            <h2 className="text-base font-bold text-center" style={{ color: 'var(--text-primary)' }}>
              Create Account
            </h2>

            {error && (
              <div className="rounded-lg px-3 py-2 text-xs text-center" style={{
                background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(254,226,226,0.8)',
                color: '#ef4444',
                border: `1px solid ${isDark ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.2)'}`,
              }}>
                {error}
              </div>
            )}

            <input
              type="text"
              placeholder="Full Name"
              value={regName}
              onChange={e => setRegName(e.target.value)}
              className="rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500/40 transition"
              style={inputStyle}
              autoFocus
            />
            <input
              type="email"
              placeholder="Email"
              value={regEmail}
              onChange={e => setRegEmail(e.target.value)}
              className="rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500/40 transition"
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Password (min 8 chars, 1 uppercase, 1 digit)"
              value={regPassword}
              onChange={e => setRegPassword(e.target.value)}
              className="rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500/40 transition"
              style={inputStyle}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-2.5 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                boxShadow: '0 4px 16px rgba(124,58,237,0.30)',
              }}
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
            <button
              type="button"
              onClick={() => { setMode('hero'); setError(''); }}
              className="text-xs text-center transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              ← Back
            </button>
            <p className="text-center text-[10px] mt-1" style={{ color: 'var(--text-faint)' }}>
              Already have an account?{' '}
              <button type="button" onClick={() => { setMode('signin'); setError(''); }} className="underline" style={{ color: isDark ? '#c4b5fd' : '#6d28d9' }}>
                Sign In
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default WelcomeScreen;
