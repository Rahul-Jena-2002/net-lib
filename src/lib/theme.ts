import type { Theme } from './types';

export interface ThemeStyle {
  bg: string;
  text: string;
  sidebarBg: string;
  border: string;
  canvasBg: string;
  activeBg: string;
}

export const THEME_STYLES: Record<Theme, ThemeStyle> = {
  dark: {
    bg: '#1a1a2e',
    text: '#e2e8f0',
    sidebarBg: '#0f172a',
    border: 'rgba(255, 255, 255, 0.08)',
    canvasBg: '#080b11',
    activeBg: 'rgba(255, 255, 255, 0.1)',
  },
  light: {
    bg: '#ffffff',
    text: '#1e293b',
    sidebarBg: '#ffffff',
    border: '#e2e8f0',
    canvasBg: '#f8fafc',
    activeBg: '#e2e8f0',
  },
  sepia: {
    bg: '#FBF9F6',
    text: '#222222',
    sidebarBg: '#F3EFEA',
    border: '#DDDDDD',
    canvasBg: '#FBF9F6',
    activeBg: '#EAE5DC',
  },
};

export function getThemeStyles(theme: Theme): ThemeStyle {
  return THEME_STYLES[theme] || THEME_STYLES.dark;
}
