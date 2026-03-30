/**
 * DashboardScreen — Shown after login, before mode selection.
 * Displays user profile, credit balance, subscription, and quick actions.
 */

import React, { useEffect, useState } from 'react';
import { useTheme } from '../hooks/useTheme';

interface Subscription {
  plan_name?: string;
  credits_remaining?: number;
  billing_cycle?: string;
  status?: string;
  expires_at?: string;
}

interface DashboardScreenProps {
  onContinue: () => void;
  onBuyCredits: () => void;
  onSignOut: () => void;
  onBack: () => void;
  onMinimize: () => void;
  onClose: () => void;
  user: { email: string; name: string; role: string };
  onAuthExpired?: () => void;
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onContinue, onBuyCredits, onSignOut, onBack, onMinimize, onClose, user, onAuthExpired,
}) => {
  const { isDark, toggle: toggleTheme } = useTheme();
  const [credits, setCredits] = useState<number | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // [OFFLINE_MODE] — Detect offline user, skip backend calls
  const isOfflineUser = user.email === 'offline@meetvora.local';

  useEffect(() => {
    let cancelled = false;

    // [OFFLINE_MODE] — Skip profile fetch for offline user
    if (isOfflineUser) {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const result = await window.electronAPI.getUserProfile();
        if (cancelled) return;
        if (result.success) {
          setCredits(result.totalCredits ?? 0);
          setSubscription(result.subscription || null);
        } else {
          const msg = result.error || '';
          if (msg.includes('Authentication') || msg.includes('Unauthorized') || msg.includes('Not authenticated')) {
            onAuthExpired?.();
            return;
          }
          setError(msg || 'Failed to load profile');
        }
      } catch {
        if (!cancelled) setError('Could not connect to server');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchProfile();
    return () => { cancelled = true; };
  }, []);

  const retry = () => {
    setLoading(true);
    setError('');
    window.electronAPI.getUserProfile().then(r => {
      if (r.success) {
        setCredits(r.totalCredits ?? 0);
        setSubscription(r.subscription || null);
      } else {
        setError(r.error || 'Failed');
      }
      setLoading(false);
    }).catch(() => { setError('Connection failed'); setLoading(false); });
  };

  const planName = subscription?.plan_name || 'Free';
  const isAdminUser = user.role === 'admin' || isOfflineUser;  // [OFFLINE_MODE]
  const isLowCredits = !isAdminUser && credits !== null && credits > 0 && credits < 5;
  const isZeroCredits = !isAdminUser && credits !== null && credits === 0;
  const firstName = user.name?.split(' ')[0] || user.email.split('@')[0];

  const initials = user.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : user.email[0].toUpperCase();

  return (
    <div
      className="flex flex-col h-screen overflow-hidden rounded-xl backdrop-blur-xl transition-colors duration-300"
      style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
    >
      {/* Titlebar */}
      <header
        className="titlebar-drag flex items-center justify-between px-3 py-2 select-none transition-colors duration-300"
        style={{ borderBottom: '1px solid var(--glass-border)', background: 'var(--glass-bg-strong)' }}
      >
        <div className="titlebar-no-drag flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1.5 rounded-md transition-all duration-200"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            title="Back"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[13px] font-semibold leading-none tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Dashboard
            </h1>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Your account overview</p>
          </div>
        </div>

        <div className="titlebar-no-drag flex items-center gap-0.5">
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md transition-all duration-200"
            style={{
              background: isDark ? 'rgba(250,204,21,0.15)' : 'rgba(99,102,241,0.10)',
              color: isDark ? '#facc15' : '#6366f1',
            }}
            title={isDark ? 'Light mode' : 'Dark mode'}
          >
            {isDark ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <button onClick={onMinimize} className="p-1.5 rounded-md transition-colors" style={{ color: 'var(--text-muted)' }} title="Minimize">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="2" y="5.5" width="8" height="1" rx="0.5" fill="currentColor" /></svg>
          </button>
          <button
            onClick={onClose} className="p-1.5 rounded-md transition-colors" style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = isDark ? 'rgba(239,68,68,0.15)' : 'rgba(254,226,226,1)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
            title="Close"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">

        {/* User card */}
        <div className="flex items-center gap-3 mt-4 mb-5 p-3 rounded-xl" style={{
          background: 'var(--glass-bg-subtle)',
          border: '1px solid var(--glass-border)',
        }}>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-violet-500/20 flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {user.name || firstName}
              </p>
              {isAdminUser && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                  {isOfflineUser ? 'OFFLINE' : 'ADMIN'}
                </span>
              )}
            </div>
            <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
              {user.email}
            </p>
          </div>
          <button
            onClick={onSignOut}
            className="p-1.5 rounded-md transition-all duration-200 flex-shrink-0"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = isDark ? 'rgba(239,68,68,0.12)' : 'rgba(254,226,226,1)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
            title="Sign Out"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="animate-spin h-7 w-7 border-2 border-violet-500 border-t-transparent rounded-full" />
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Loading your account...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl p-5 text-center" style={{
            background: 'var(--glass-bg-subtle)', border: '1px solid var(--glass-border)',
          }}>
            <div className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(254,226,226,1)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Connection Failed</p>
            <p className="text-[11px] mb-3" style={{ color: 'var(--text-muted)' }}>{error}</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={retry}
                className="text-[11px] font-semibold px-4 py-1.5 rounded-lg transition-all active:scale-[0.97]"
                style={{
                  background: isDark ? 'rgba(139,92,246,0.15)' : 'rgba(124,58,237,0.08)',
                  color: isDark ? '#c4b5fd' : '#6d28d9',
                  border: `1px solid ${isDark ? 'rgba(139,92,246,0.25)' : 'rgba(124,58,237,0.2)'}`,
                }}
              >
                Try Again
              </button>
              {/* [OFFLINE_MODE] — Allow continuing even when backend is unreachable */}
              <button
                onClick={onContinue}
                className="text-[11px] font-semibold px-4 py-1.5 rounded-lg transition-all active:scale-[0.97]"
                style={{
                  background: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(254,243,199,0.8)',
                  color: '#f59e0b',
                  border: `1px solid ${isDark ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.2)'}`,
                }}
              >
                Continue Offline
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <div className="rounded-xl p-3.5" style={{
                background: 'var(--glass-bg-subtle)',
                border: '1px solid var(--glass-border)',
              }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex-shrink-0">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Credits
                  </span>
                </div>
                <p className={`text-2xl font-extrabold tabular-nums ${
                  isZeroCredits ? 'text-red-400' : isLowCredits ? 'text-amber-400' : ''
                }`} style={!isZeroCredits && !isLowCredits ? { color: 'var(--text-primary)' } : undefined}>
                  {isAdminUser ? '∞' : credits}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
                  {isAdminUser ? (isOfflineUser ? 'Offline — no restrictions' : 'Unlimited — admin mode') : '1 credit per AI response'}
                </p>
              </div>

              <div className="rounded-xl p-3.5" style={{
                background: 'var(--glass-bg-subtle)',
                border: '1px solid var(--glass-border)',
              }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex-shrink-0">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Plan
                  </span>
                </div>
                <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {planName}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
                  {planName === 'Free' ? 'Starter plan' : 'Active subscription'}
                </p>
              </div>
            </div>

            {/* Warning banner */}
            {(isLowCredits || isZeroCredits) && (
              <div className="rounded-xl p-3 mb-4 flex items-center gap-3" style={{
                background: isZeroCredits
                  ? (isDark ? 'rgba(239,68,68,0.08)' : 'rgba(254,226,226,0.6)')
                  : (isDark ? 'rgba(245,158,11,0.08)' : 'rgba(254,243,199,0.6)'),
                border: `1px solid ${isZeroCredits
                  ? (isDark ? 'rgba(239,68,68,0.20)' : 'rgba(239,68,68,0.15)')
                  : (isDark ? 'rgba(245,158,11,0.20)' : 'rgba(245,158,11,0.15)')}`,
              }}>
                <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{
                  background: isZeroCredits
                    ? (isDark ? 'rgba(239,68,68,0.15)' : 'rgba(254,226,226,1)')
                    : (isDark ? 'rgba(245,158,11,0.15)' : 'rgba(254,243,199,1)'),
                }}>
                  {isZeroCredits ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-semibold" style={{ color: isZeroCredits ? '#ef4444' : '#f59e0b' }}>
                    {isZeroCredits ? 'No credits remaining' : `Only ${credits} credits left`}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {isZeroCredits ? 'Purchase a plan to continue.' : 'Consider upgrading your plan.'}
                  </p>
                </div>
                <button
                  onClick={onBuyCredits}
                  className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white flex-shrink-0 transition-all active:scale-[0.97]"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
                >
                  Upgrade
                </button>
              </div>
            )}

            {/* Primary action */}
            {isZeroCredits ? (
              <button
                onClick={onBuyCredits}
                className="w-full rounded-xl py-3 text-sm font-bold text-white transition-all active:scale-[0.98] mb-2.5"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  boxShadow: '0 4px 20px rgba(124,58,237,0.25)',
                }}
              >
                <span className="flex items-center justify-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  Get Credits to Continue
                </span>
              </button>
            ) : (
              <button
                onClick={onContinue}
                className="w-full rounded-xl py-3 text-sm font-bold text-white transition-all active:scale-[0.98] mb-2.5 group"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  boxShadow: '0 4px 20px rgba(124,58,237,0.25)',
                }}
              >
                <span className="flex items-center justify-center gap-2">
                  Start Using Meetvora
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-0.5">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                </span>
              </button>
            )}

            {/* Secondary action */}
            <button
              onClick={onBuyCredits}
              className="w-full rounded-xl py-2.5 text-xs font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              style={{
                background: 'var(--glass-bg-subtle)',
                border: '1px solid var(--glass-border)',
                color: isDark ? '#c4b5fd' : '#6d28d9',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--glass-bg-strong)'; e.currentTarget.style.borderColor = 'var(--glass-border-strong)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--glass-bg-subtle)'; e.currentTarget.style.borderColor = 'var(--glass-border)'; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              View Plans & Pricing
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default DashboardScreen;
