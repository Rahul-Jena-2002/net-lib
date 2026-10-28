import type { BookProgress, ReaderPreferences, Theme, FontSize, ReaderWidth } from './types';

export const READER_SETTINGS_KEY = 'netlib_reader_settings';

export const DEFAULT_READER_SETTINGS: ReaderPreferences = {
  theme: 'dark',
  fontSize: 'md',
  readerWidth: 'wide',
  sidebarOpen: false,
};

export function getProgressKey(bookId: string): string {
  return `netlib_progress_${bookId}`;
}

export function parseProgressPayload(rawJson: string | null, fallbackBookId: string): BookProgress {
  const defaults: BookProgress = {
    bookId: fallbackBookId,
    page: 1,
    completedChapters: [],
    percentage: 0,
    lastReadAt: new Date().toISOString(),
  };
  if (!rawJson) return defaults;
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object') return defaults;
    return {
      bookId: parsed.bookId || fallbackBookId,
      chapterId: parsed.chapterId,
      page: typeof parsed.page === 'number' && parsed.page > 0 ? parsed.page : 1,
      completedChapters: Array.isArray(parsed.completedChapters)
        ? Array.from(new Set(parsed.completedChapters))
        : Array.isArray(parsed.completed)
        ? Array.from(new Set(parsed.completed))
        : [],
      percentage: typeof parsed.percentage === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.percentage))) : 0,
      lastReadAt: parsed.lastReadAt || defaults.lastReadAt,
    };
  } catch {
    return defaults;
  }
}

export function sanitizeReaderSettings(raw: Partial<ReaderPreferences> | null | undefined): ReaderPreferences {
  const validThemes: Theme[] = ['dark', 'light'];
  const validSizes: FontSize[] = ['sm', 'md', 'lg', 'xl'];
  const validWidths: ReaderWidth[] = ['narrow', 'standard', 'wide', 'full'];

  if (!raw) return DEFAULT_READER_SETTINGS;
  return {
    theme: raw.theme && validThemes.includes(raw.theme) ? raw.theme : DEFAULT_READER_SETTINGS.theme,
    fontSize: raw.fontSize && validSizes.includes(raw.fontSize) ? raw.fontSize : DEFAULT_READER_SETTINGS.fontSize,
    readerWidth: raw.readerWidth && validWidths.includes(raw.readerWidth) ? raw.readerWidth : DEFAULT_READER_SETTINGS.readerWidth,
    sidebarOpen: typeof raw.sidebarOpen === 'boolean' ? raw.sidebarOpen : DEFAULT_READER_SETTINGS.sidebarOpen,
  };
}

export function loadBookProgress(bookId: string): BookProgress | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getProgressKey(bookId));
    if (!raw) return null;
    JSON.parse(raw);
    return parseProgressPayload(raw, bookId);
  } catch {
    return null;
  }
}

export function saveBookProgress(progress: BookProgress): void {
  if (typeof window === 'undefined') return;
  try {
    const deduplicated = Array.from(new Set(progress.completedChapters || []));
    const payload: BookProgress = {
      bookId: progress.bookId,
      chapterId: progress.chapterId,
      page: Math.max(1, progress.page || 1),
      completedChapters: deduplicated,
      percentage: Math.max(0, Math.min(100, Math.round(progress.percentage || 0))),
      lastReadAt: new Date().toISOString(),
    };
    localStorage.setItem(getProgressKey(progress.bookId), JSON.stringify(payload));
  } catch {
    // ignore local storage quota errors
  }
}

export function loadReaderSettings(): ReaderPreferences {
  if (typeof window === 'undefined') return DEFAULT_READER_SETTINGS;
  try {
    const raw = localStorage.getItem(READER_SETTINGS_KEY);
    if (!raw) return DEFAULT_READER_SETTINGS;
    const parsed = JSON.parse(raw);
    return sanitizeReaderSettings(parsed);
  } catch {
    return DEFAULT_READER_SETTINGS;
  }
}

export function saveReaderSettings(settings: ReaderPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(READER_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}
