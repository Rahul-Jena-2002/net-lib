/**
 * Tier 4 — Real-World Application Workloads E2E Tests
 * Validates realistic, multi-step end-to-end user workflows
 * Built with Node 24 native test runner (node:test + node:assert/strict)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  scanBooks,
  getBookById,
  searchAndFilterBooks,
  resolveSafeBookPath,
  getChapterSortKey,
  normalizeString,
  makeId,
  inferBookMeta,
  getBooksRoot,
  invalidateScannerCache,
} from '../../src/lib/scanner.ts';
import type { Book, Chapter, BookProgress, ReaderPreferences } from '../../src/lib/types.ts';
import { THEME_STYLES, getThemeStyles } from '../../src/lib/theme.ts';
import {
  WIDTH_CLASSES,
  SCALE_MAP,
  computeReadingProgress,
  calculateChapterProgress,
  toggleCompletedChapter,
} from '../../src/lib/reader.ts';
import { PDF_WORKER_LOCAL_PATH } from '../../src/lib/pdf.ts';
import { validatePdfUpload } from '../../src/lib/upload.ts';
import {
  getProgressKey,
  parseProgressPayload,
  sanitizeReaderSettings,
  READER_SETTINGS_KEY,
} from '../../src/lib/storage.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOOKS_DIR = getBooksRoot();
const NETLIB_DIR = path.resolve(__dirname, '../..');

describe('Tier 4 — Real-World Application Workloads E2E Suite', () => {

  // --- Scenario 1: Full Discovery, Multi-Chapter Reading & Progress Persistence ---
  it('Scenario 1: Full Discovery, Multi-Chapter Reading & Progress Persistence (F1, F2, F3, F9, F10, F11, F13)', () => {
    // Step 1: User visits home page -> Catalog auto-discovery scans Books storage
    invalidateScannerCache();
    const catalog = scanBooks();
    assert.ok(catalog.length >= 8, 'Catalog must contain all books');

    // Step 2: User locates "Core Java for the Impatient, 4th Edition"
    const book = catalog.find(b => b.id.includes('impatient'));
    assert.ok(book, 'Must locate Core Java for the Impatient');
    assert.equal(book.author, 'Cay S. Horstmann');
    assert.ok(book.publisher.includes('Pearson'));
    assert.ok(book.tags.includes('Beginner') || book.tags.includes('Impatient'));
    assert.equal(book.isMultiChapter, true);
    assert.equal(book.chapters?.length, 16);

    // Step 3: User opens Reader (/books/[id]/read)
    // Verify TOC sidebar chapter sequence
    const chapters = book.chapters!;
    assert.equal(chapters[0].title, 'Title & Copyright');
    assert.equal(chapters[1].title, 'Table of Contents');
    assert.equal(chapters[2].title, 'Preface');
    assert.equal(chapters[3].chapterNumber, 1);
    assert.equal(chapters[3].title, '1. Fundamental Programming Structures');
    assert.equal(chapters[15].title, 'Index');

    // Step 4: User begins reading Chapter 1 at page 1
    const progressStore: Record<string, string> = {};
    const bookProgressKey = getProgressKey(book.id);

    let progress: BookProgress = {
      bookId: book.id,
      chapterId: chapters[3].id,
      page: 1,
      completedChapters: [],
      percentage: 0,
      lastReadAt: new Date().toISOString(),
    };
    progressStore[bookProgressKey] = JSON.stringify(progress);

    // Step 5: User reads to page 60 of Chapter 1
    progress.page = 60;
    progressStore[bookProgressKey] = JSON.stringify(progress);

    // Step 6: User clicks "Next Chapter" on BottomNav toolbar -> transitions to Chapter 2 page 1
    const nextChapter = chapters[4]; // Chapter 2
    assert.equal(nextChapter.chapterNumber, 2);

    progress.chapterId = nextChapter.id;
    progress.page = 1;
    progress.completedChapters = toggleCompletedChapter(progress.completedChapters, chapters[3].id);
    progress.percentage = calculateChapterProgress(progress.completedChapters.length, chapters.length);
    progress.lastReadAt = new Date().toISOString();
    progressStore[bookProgressKey] = JSON.stringify(progress);

    // Step 7: Verify progress state in storage
    const restored = parseProgressPayload(progressStore[bookProgressKey], book.id);
    assert.equal(restored.chapterId, nextChapter.id);
    assert.equal(restored.page, 1);
    assert.deepEqual(restored.completedChapters, [chapters[3].id]);
    assert.equal(restored.percentage, 6); // 1/16 = 6.25% ~ 6%

    // Step 8: User reloads reader -> restored state matches active reading position
    assert.equal(restored.bookId, book.id);
    assert.ok(restored.lastReadAt.length > 0);
  });

  // --- Scenario 2: Search, Filtering, and Standalone PDF Reading Workflow ---
  it('Scenario 2: Search, Filtering, and Standalone PDF Reading Workflow (F1, F3, F4, F6, F9, F12, F13)', () => {
    const books = scanBooks();

    // Step 1: User types "Head First" in search box
    const searchResults = searchAndFilterBooks(books, { q: 'Head First' });
    assert.equal(searchResults.length, 1);
    const book = searchResults[0];

    // Step 2: Validate metadata display on catalog card
    assert.ok(book.title.includes('Head First Java'));
    assert.ok(book.author.includes('Kathy Sierra'));
    assert.ok(book.publisher.includes("O'Reilly"));
    assert.equal(book.isMultiChapter, false);
    assert.ok(book.totalSize > 150 * 1024 * 1024);

    // Step 3: User opens book reader -> PDF streamer serves initial page bytes
    const pdfPath = resolveSafeBookPath(book.filename!, BOOKS_DIR);
    assert.ok(fs.existsSync(pdfPath));

    const fd = fs.openSync(pdfPath, 'r');
    const headerChunk = Buffer.alloc(1024);
    fs.readSync(fd, headerChunk, 0, 1024, 0);
    fs.closeSync(fd);
    assert.ok(headerChunk.toString('utf8').startsWith('%PDF-'));

    // Step 4: User opens Customization panel and selects Sepia theme (#fdfbf7), font size 'lg', and 'narrow' width
    const userSettings: ReaderPreferences = {
      theme: 'sepia',
      fontSize: 'lg',
      readerWidth: 'narrow',
      sidebarOpen: false,
    };
    const settingsStore: Record<string, string> = {};
    settingsStore[READER_SETTINGS_KEY] = JSON.stringify(userSettings);

    const activeSettings = sanitizeReaderSettings(JSON.parse(settingsStore[READER_SETTINGS_KEY]));
    assert.equal(activeSettings.theme, 'sepia');
    assert.equal(activeSettings.readerWidth, 'narrow');

    // Step 5: User navigates from page 1 to page 150
    const totalPages = 755;
    const targetPage = 150;
    const computedProgress = computeReadingProgress(targetPage, totalPages);
    assert.equal(computedProgress.percentage, 20); // 150/755 = 19.86% ~ 20%
    assert.equal(computedProgress.page, 150);

    const bookProgress: BookProgress = {
      bookId: book.id,
      page: targetPage,
      completedChapters: [],
      percentage: computedProgress.percentage,
      lastReadAt: new Date().toISOString(),
    };
    assert.equal(bookProgress.percentage, 20);
  });

  // --- Scenario 3: PDF Book Upload, Immediate Catalog Refresh & Stream Verification ---
  it('Scenario 3: PDF Book Upload, Immediate Catalog Refresh & Stream Verification (F1, F5, F6, F7, F10)', () => {
    const tempDir = fs.mkdtempSync(path.join(NETLIB_DIR, 'scratch_upload_tier4_'));
    const uploadFilename = 'Site_Reliability_Engineering_Handbook.pdf';
    const uploadPath = path.join(tempDir, uploadFilename);

    try {
      // Step 1: User navigates to /upload and uploads a new PDF
      const uploadBytes = Buffer.from('%PDF-1.6\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');
      const valResult = validatePdfUpload(uploadFilename, uploadBytes);
      assert.equal(valResult.valid, true);

      // Step 2: Safe path resolution checks upload destination
      const safeUploadPath = resolveSafeBookPath(uploadFilename, tempDir);
      assert.equal(safeUploadPath, uploadPath);
      fs.writeFileSync(safeUploadPath, uploadBytes);

      // Step 3: Immediate catalog refresh in destination directory
      const refreshedCatalog = scanBooks(tempDir);
      const newBook = refreshedCatalog.find(b => b.filename === uploadFilename);
      assert.ok(newBook, 'New book must be present in refreshed catalog');
      assert.ok(newBook.title.includes('Site Reliability Engineering'));
      assert.equal(newBook.isMultiChapter, false);

      // Step 4: User opens newly uploaded book -> Stream verified
      const streamFd = fs.openSync(safeUploadPath, 'r');
      const verifyBuf = Buffer.alloc(5);
      fs.readSync(streamFd, verifyBuf, 0, 5, 0);
      fs.closeSync(streamFd);
      assert.equal(verifyBuf.toString('utf8'), '%PDF-');
    } finally {
      if (tempDir && fs.existsSync(tempDir)) {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      }
    }
  });

  // --- Scenario 4: Offline Reader Customization & Theme/Size/Width Persistence ---
  it('Scenario 4: Offline Reader Customization & Theme/Size/Width Persistence (F9, F11, F12, F13)', () => {
    // Step 1: Offline verification: verify local worker bundle
    const publicWorker = path.join(NETLIB_DIR, 'public', PDF_WORKER_LOCAL_PATH);
    const nmWorker = path.join(NETLIB_DIR, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
    assert.ok(fs.existsSync(publicWorker) || fs.existsSync(nmWorker), 'Offline PDF.js worker must be available locally');

    // Step 2: Initialize default reader state
    const storage: Record<string, string> = {};
    const defaultSettings: ReaderPreferences = {
      theme: 'light',
      fontSize: 'md',
      readerWidth: 'standard',
      sidebarOpen: true,
    };
    storage[READER_SETTINGS_KEY] = JSON.stringify(defaultSettings);

    // Step 3: User configures Dark theme (#1a1a2e), XL font, Full width, collapsed sidebar
    const customSettings: ReaderPreferences = {
      theme: 'dark',
      fontSize: 'xl',
      readerWidth: 'full',
      sidebarOpen: false,
    };
    storage[READER_SETTINGS_KEY] = JSON.stringify(customSettings);

    // Step 4: User navigates away and reloads reader session
    const restoredSettings = sanitizeReaderSettings(JSON.parse(storage[READER_SETTINGS_KEY]));
    assert.equal(restoredSettings.theme, 'dark');
    assert.equal(restoredSettings.fontSize, 'xl');
    assert.equal(restoredSettings.readerWidth, 'full');
    assert.equal(restoredSettings.sidebarOpen, false);

    // Step 5: Verify CSS theme variables for Dark theme from application theme module
    const darkTheme = getThemeStyles('dark');
    assert.equal(darkTheme.bg, '#1a1a2e');
    assert.equal(darkTheme.text, '#e2e8f0');
    assert.equal(THEME_STYLES.dark.bg, '#1a1a2e');
    assert.equal(THEME_STYLES.dark.text, '#e2e8f0');
  });

  // --- Scenario 5: Standalone Host Build & Execution from /home/sonu/netlib ---
  it('Scenario 5: Standalone Host Build & Execution from /home/sonu/netlib (F1, F5, F6, F14, F15)', () => {
    // Step 1: Verify package.json structure
    const pkgPath = path.join(NETLIB_DIR, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    assert.ok(pkg.scripts.dev);
    assert.ok(pkg.scripts.build);
    assert.ok(pkg.scripts.start);

    // Step 2: Verify BOOKS_DIR fallback logic
    const resolvedBooksRoot = getBooksRoot();
    assert.ok(fs.existsSync(resolvedBooksRoot), 'Books root must exist on filesystem');

    // Step 3: Verify core Next.js routes exist
    const apiBooksRoute = path.join(NETLIB_DIR, 'src/app/api/books/route.ts');
    const apiPdfRoute = path.join(NETLIB_DIR, 'src/app/api/pdf/route.ts');
    const apiUploadRoute = path.join(NETLIB_DIR, 'src/app/api/upload/route.ts');
    assert.ok(fs.existsSync(apiBooksRoute));
    assert.ok(fs.existsSync(apiPdfRoute));
    assert.ok(fs.existsSync(apiUploadRoute));

    // Step 4: Verify scanner and ordering engine executes cleanly
    const books = scanBooks(resolvedBooksRoot);
    assert.ok(books.length >= 8);

    // Step 5: Verify PDF streamable
    const firstPdf = books.find(b => !b.isMultiChapter && b.filename && fs.existsSync(path.join(resolvedBooksRoot, b.filename)));
    assert.ok(firstPdf && firstPdf.filename);
    const pdfPath = resolveSafeBookPath(firstPdf.filename, resolvedBooksRoot);
    assert.ok(fs.existsSync(pdfPath));
  });

  // --- Scenario 6: Edge-Case Catalog Discovery and Resilient Reading Session ---
  it('Scenario 6: Edge-Case Catalog Discovery and Resilient Reading Session (B1, B2, B3, F1, F2, F10, F13)', () => {
    const books = scanBooks();

    // 1. Identify all 3 edge case books:
    // a. Non-breaking space in chapter names
    const nbspBook = books.find(b => b.id.includes('impatient'));
    assert.ok(nbspBook && nbspBook.chapters);
    const chWithNbsp = nbspBook.chapters.find(c => c.filename.includes('\u00a0'));
    assert.ok(chWithNbsp, 'Must find chapter with non-breaking space');
    assert.ok(!chWithNbsp.title.includes('\u00a0'), 'Display title must normalize nbsp to space');

    // b. Typo in directory name "Code Java"
    const typoBook = books.find(b => b.folder === 'Code Java Vol. I_Fundamentals, 14th Edition');
    assert.ok(typoBook);
    assert.ok(typoBook.title.startsWith('Core Java'), 'Must normalize title display');

    // c. Double space in standalone filename "Core Java Vol  13 - II.pdf"
    const doubleSpaceBook = books.find(b => b.filename === 'Core Java Vol  13 - II.pdf');
    assert.ok(doubleSpaceBook);
    assert.ok(!doubleSpaceBook.id.includes('--'), 'ID must collapse double spaces');

    // 2. Reading session on typo book:
    assert.ok(typoBook.chapters && typoBook.chapters.length === 13);
    const ch1 = typoBook.chapters[0];
    const ch1Path = path.join(BOOKS_DIR, typoBook.folder!, ch1.filename);
    assert.ok(fs.existsSync(ch1Path), 'Chapter 1 disk file must resolve correctly');
  });

  // --- Scenario 7: High-Volume Multi-Book Reader Session with State Synchronizations ---
  it('Scenario 7: High-Volume Multi-Book Reader Session with State Synchronizations (F1, F4, F9, F10, F11, F12, F13)', () => {
    const books = scanBooks();
    const sessionStore: Record<string, string> = {};

    // Simulate reading across 3 different books in a single user session
    const testBooks = books.slice(0, 3);

    for (let i = 0; i < testBooks.length; i++) {
      const b = testBooks[i];
      const bookKey = getProgressKey(b.id);

      let currentChapterId: string | undefined;
      let completedList: string[] = [];
      let page = 1;
      let pct = 0;

      if (b.isMultiChapter && b.chapters && b.chapters.length > 0) {
        currentChapterId = b.chapters[1].id;
        completedList = [b.chapters[0].id];
        page = 10;
        pct = Math.round((1 / b.chapters.length) * 100);
      } else {
        page = 50;
        pct = 15;
      }

      const rec: BookProgress = {
        bookId: b.id,
        chapterId: currentChapterId,
        page,
        completedChapters: completedList,
        percentage: pct,
        lastReadAt: new Date().toISOString(),
      };
      sessionStore[bookKey] = JSON.stringify(rec);
    }

    // Verify all 3 books retained separate independent progress records
    for (let i = 0; i < testBooks.length; i++) {
      const b = testBooks[i];
      const key = getProgressKey(b.id);
      assert.ok(sessionStore[key], `Progress for ${b.id} must exist`);
      const parsed = parseProgressPayload(sessionStore[key], b.id);
      assert.equal(parsed.bookId, b.id);
      assert.ok(parsed.page > 0);
    }
  });

});
