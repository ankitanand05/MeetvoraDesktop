/**
 * Theme Context — Dark / Light mode with persistence
 *
 * Provides a React context so every component can access `isDark` and `toggle()`.
 * Persists choice in localStorage. Applies a `data-theme` attribute on <html>
 * so CSS variables switch automatically.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

interface ThemeCtx {
  isDark: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeCtx>({ isDark: false, toggle: () => {} });

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ankit-theme');
      return saved === 'dark';
    } catch {
      return false; // default light
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('ankit-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggle = useCallback(() => setIsDark(prev => !prev), []);

  return (
    <ThemeContext.Provider value={{ isDark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};
