'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Theme } from '@/lib/types';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');

  const applyTheme = (t: Theme) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.remove('theme-light', 'light', 'theme-dark', 'dark', 'theme-sepia', 'theme-grayscale');
    if (t === 'sepia') {
      root.classList.add('theme-sepia', 'theme-grayscale');
    } else if (t === 'light') {
      root.classList.add('theme-light', 'light');
    } else {
      root.classList.add('theme-dark', 'dark');
    }
  };

  useEffect(() => {
    try {
      const saved = (localStorage.getItem('netlib_reader_theme') || localStorage.getItem('netlib_theme')) as Theme;
      if (saved && (saved === 'dark' || saved === 'sepia' || saved === 'light')) {
        setThemeState(saved);
        applyTheme(saved);
      }
    } catch {}
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    try {
      localStorage.setItem('netlib_theme', newTheme);
      localStorage.setItem('netlib_reader_theme', newTheme);
    } catch {}
  };

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'sepia' : theme === 'sepia' ? 'light' : 'dark';
    setTheme(next);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
