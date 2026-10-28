import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getProgressKey,
  READER_SETTINGS_KEY,
  DEFAULT_READER_SETTINGS,
  loadBookProgress,
  saveBookProgress,
  loadReaderSettings,
  saveReaderSettings,
} from '../../src/lib/storage.ts';
import type { BookProgress, ReaderPreferences } from '../../src/lib/types';

// Mock localStorage for node environment
class MockLocalStorage {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

// Attach mock localStorage to global
const mockStorage = new MockLocalStorage();
(global as any).localStorage = mockStorage;
(global as any).window = {};

test('Storage: getProgressKey format', () => {
  assert.equal(getProgressKey('head-first-java'), 'netlib_progress_head-first-java');
  assert.equal(getProgressKey('core-java-vol-1'), 'netlib_progress_core-java-vol-1');
  assert.equal(READER_SETTINGS_KEY, 'netlib_reader_settings');
});

test('Storage: DEFAULT_READER_SETTINGS schema', () => {
  assert.equal(DEFAULT_READER_SETTINGS.theme, 'sepia');
  assert.equal(DEFAULT_READER_SETTINGS.fontSize, 'md');
  assert.equal(DEFAULT_READER_SETTINGS.readerWidth, 'standard');
  assert.equal(DEFAULT_READER_SETTINGS.sidebarOpen, true);
});

test('Storage: saveBookProgress and loadBookProgress round-trip', () => {
  mockStorage.clear();
  const bookId = 'spring-ai-in-action';
  const progress: BookProgress = {
    bookId,
    chapterId: 'ch-3',
    page: 12,
    completedChapters: ['ch-1', 'ch-2'],
    percentage: 25,
    lastReadAt: new Date().toISOString(),
  };

  saveBookProgress(progress);
  const loaded = loadBookProgress(bookId);

  assert.ok(loaded);
  assert.equal(loaded?.bookId, bookId);
  assert.equal(loaded?.chapterId, 'ch-3');
  assert.equal(loaded?.page, 12);
  assert.deepEqual(loaded?.completedChapters, ['ch-1', 'ch-2']);
  assert.equal(loaded?.percentage, 25);
  assert.ok(loaded?.lastReadAt);
});

test('Storage: deduplicate completedChapters and clamp values', () => {
  mockStorage.clear();
  const bookId = 'test-book';
  const progress: BookProgress = {
    bookId,
    chapterId: 'ch-1',
    page: 0, // Should clamp to 1
    completedChapters: ['ch-1', 'ch-1', 'ch-2', 'ch-1'],
    percentage: 150, // Should clamp to 100
    lastReadAt: new Date().toISOString(),
  };

  saveBookProgress(progress);
  const loaded = loadBookProgress(bookId);

  assert.ok(loaded);
  assert.equal(loaded?.page, 1);
  assert.deepEqual(loaded?.completedChapters, ['ch-1', 'ch-2']);
  assert.equal(loaded?.percentage, 100);
});

test('Storage: loadBookProgress handles missing or corrupt JSON safely', () => {
  mockStorage.clear();
  assert.equal(loadBookProgress('non-existent'), null);

  mockStorage.setItem(getProgressKey('corrupt'), 'invalid-json{{');
  assert.equal(loadBookProgress('corrupt'), null);
});

test('Storage: saveReaderSettings and loadReaderSettings round-trip and fallbacks', () => {
  mockStorage.clear();
  const customSettings: ReaderPreferences = {
    theme: 'dark',
    fontSize: 'xl',
    readerWidth: 'wide',
    sidebarOpen: false,
  };

  saveReaderSettings(customSettings);
  const loaded = loadReaderSettings();

  assert.equal(loaded.theme, 'dark');
  assert.equal(loaded.fontSize, 'xl');
  assert.equal(loaded.readerWidth, 'wide');
  assert.equal(loaded.sidebarOpen, false);

  // Test invalid theme fallback
  mockStorage.setItem(READER_SETTINGS_KEY, JSON.stringify({ theme: 'neon', fontSize: 'invalid' }));
  const fallback = loadReaderSettings();
  assert.equal(fallback.theme, 'sepia');
  assert.equal(fallback.fontSize, 'md');
});
