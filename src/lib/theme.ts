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
    bg: '#080b11',
    text: '#e2e8f0',
    sidebarBg: '#0f172a',
    border: 'rgba(255, 255, 255, 0.08)',
    canvasBg: '#080b11',
    activeBg: 'rgba(255, 255, 255, 0.1)',
  },
  light: {
    bg: '#f8fafc',
    text: '#1e293b',
    sidebarBg: '#ffffff',
    border: '#e2e8f0',
    canvasBg: '#f8fafc',
    activeBg: '#e2e8f0',
  },
};

export function getThemeStyles(theme: Theme): ThemeStyle {
  return THEME_STYLES[theme] || THEME_STYLES.dark;
}
