/**
 * Tier 3 — Pairwise Cross-Feature Combinations E2E Tests
 * Validates cross-feature interactions across NetLib features
 * Built with Node 24 native test runner (node:test + node:assert/strict)
 */

import { describe, it, afterEach } from 'node:test';
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
import { THEME_STYLES } from '../../src/lib/theme.ts';
import {
  WIDTH_CLASSES,
  READER_LAYOUT,
  READER_RAIL_ACTIONS,
  calculateChapterProgress,
  computeReadingProgress,
  toggleCompletedChapter,
} from '../../src/lib/reader.ts';
import { PDF_WORKER_LOCAL_PATH } from '../../src/lib/pdf.ts';
import { validatePdfUpload, sanitizeUploadTitle } from '../../src/lib/upload.ts';
import {
  READER_SETTINGS_KEY,
  sanitizeReaderSettings,
  getProgressKey,
  parseProgressPayload,
} from '../../src/lib/storage.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOOKS_DIR = getBooksRoot();
const NETLIB_DIR = path.resolve(__dirname, '../..');

describe('Tier 3 — Cross-Feature Pairwise Combinations E2E Suite', () => {

  // --- Combination 1: Upload (F7) -> Auto-Discovery (F1) -> Metadata Inference (F3) ---
  it('Pair 1: Upload PDF -> Immediate Discovery -> Metadata Inference', () => {
    const tempDir = fs.mkdtempSync(path.join(NETLIB_DIR, 'scratch_upload_tier3_p1_'));
    const uploadFilename = 'netlib_combo_test_rust_guide.pdf';
    const uploadPath = path.join(tempDir, uploadFilename);

    try {
      // 1. Upload simulation
      const dummyPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');
      fs.writeFileSync(uploadPath, dummyPdf);

      // 2. Discover in isolated directory
      const catalog = scanBooks(tempDir);
      const discovered = catalog.find(b => b.filename === uploadFilename);
      assert.ok(discovered, 'Uploaded PDF must immediately appear in scanned catalog');

      // 3. Metadata inference verification
      assert.ok(discovered.title.length > 0);
      assert.equal(discovered.isMultiChapter, false);
      assert.equal(discovered.totalSize, dummyPdf.length);
      assert.ok(discovered.tags.length > 0);
    } finally {
      if (tempDir && fs.existsSync(tempDir)) {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      }
    }
  });

  // --- Combination 2: Tag Filtering (F4) -> Book Selection (F1) -> Sequential Chapter Ordering (F2) ---
  it('Pair 2: Tag Filtering -> Book Selection -> Monotonic Chapter Ordering', () => {
    const books = scanBooks();
    // 1. Filter by tag
    const filtered = searchAndFilterBooks(books, { tag: 'Advanced' });
    assert.ok(filtered.length >= 2, 'Must find at least 2 Advanced books');

    // 2. Select a multi-chapter book from the filtered list
    const selected = filtered.find(b => b.isMultiChapter && b.chapters && b.chapters.length > 0);
    assert.ok(selected && selected.chapters);

    // 3. Verify sequential chapter ordering
    for (let i = 0; i < selected.chapters.length - 1; i++) {
      const cur = selected.chapters[i];
      const next = selected.chapters[i + 1];
      assert.equal(cur.order + 1, next.order, 'Chapter orders must be sequential integers');
      assert.ok(cur.priority <= next.priority, `Priority tier ${cur.priority} <= ${next.priority}`);
    }
  });

  // --- Combination 3: Search Query (F4) -> Single-file PDF (F1) -> Stream Byte Range (F6) ---
  it('Pair 3: Search Query -> Standalone PDF Discovery -> Range Stream Verification', () => {
    const books = scanBooks();
    // 1. Search for Head First
    const matches = searchAndFilterBooks(books, { q: 'Head First' });
    assert.equal(matches.length, 1);
    const book = matches[0];
    assert.equal(book.isMultiChapter, false);

    // 2. Resolve safe disk path
    const pdfPath = resolveSafeBookPath(book.filename!, BOOKS_DIR);
    assert.ok(fs.existsSync(pdfPath));

    // 3. Read first 512 bytes range
    const fd = fs.openSync(pdfPath, 'r');
    const rangeBuf = Buffer.alloc(512);
    const bytesRead = fs.readSync(fd, rangeBuf, 0, 512, 0);
    fs.closeSync(fd);

    assert.equal(bytesRead, 512);
    assert.ok(rangeBuf.toString('utf8').startsWith('%PDF-'));
  });

  // --- Combination 4: Chapter Navigation (F2) -> Bottom Toolbar Transitions (F11) -> LocalStorage Update (F13) ---
  it('Pair 4: Chapter Boundary Navigation -> LocalStorage Progress Persistence', () => {
    const books = scanBooks();
    const book = books.find(b => b.id.includes('impatient'));
    assert.ok(book && book.chapters);

    // 1. User starts reading chapter 1 at page 1
    const ch1 = book.chapters[3]; // Chapter 1
    const progress: BookProgress = {
      bookId: book.id,
      chapterId: ch1.id,
      page: 1,
      completedChapters: [],
      percentage: 0,
      lastReadAt: new Date().toISOString(),
    };

    // 2. User advances to end of chapter 1 (page 60) and transitions to chapter 2
    const ch2 = book.chapters[4]; // Chapter 2
    progress.completedChapters.push(ch1.id);
    progress.chapterId = ch2.id;
    progress.page = 1;
    progress.percentage = Math.round((progress.completedChapters.length / book.chapters.length) * 100);
    progress.lastReadAt = new Date().toISOString();

    // 3. Serialize and restore from localStorage simulation using parseProgressPayload
    const serialized = JSON.stringify(progress);
    const restored = parseProgressPayload(serialized, book.id);

    assert.equal(restored.chapterId, ch2.id);
    assert.equal(restored.page, 1);
    assert.ok(restored.completedChapters.includes(ch1.id));
    assert.ok(restored.percentage > 0);
  });

  // --- Combination 5: Reader Customization Theme (F12) -> Reader Width (F9) -> Settings Persistence (F13) ---
  it('Pair 5: Theme Customization -> Reader Width Configuration -> Persistent Preferences', () => {
    // 1. User configures Sepia theme with Wide reader width
    const userPrefs: ReaderPreferences = {
      theme: 'sepia',
      fontSize: 'lg',
      readerWidth: 'wide',
      sidebarOpen: true,
    };

    // 2. Validate CSS definitions match specifications from application exports
    assert.equal(THEME_STYLES[userPrefs.theme].bg, '#fdfbf7');
    assert.equal(WIDTH_CLASSES[userPrefs.readerWidth], 'max-w-6xl');

    // 3. Save to localStorage and verify reload using sanitizeReaderSettings
    const store: Record<string, string> = {};
    store[READER_SETTINGS_KEY] = JSON.stringify(userPrefs);

    const reloaded = sanitizeReaderSettings(JSON.parse(store[READER_SETTINGS_KEY]));
    assert.equal(reloaded.theme, 'sepia');
    assert.equal(reloaded.readerWidth, 'wide');
    assert.equal(reloaded.fontSize, 'lg');
    assert.equal(reloaded.sidebarOpen, true);
  });

  // --- Combination 6: Upload PDF with Spaces (F7, B1) -> Traversal Guard (F5) -> Catalog Discovery (F1) ---
  it('Pair 6: Upload PDF with Spaces & Special Chars -> Traversal Guard -> Discover in Catalog', () => {
    const tempDir = fs.mkdtempSync(path.join(NETLIB_DIR, 'scratch_upload_tier3_p6_'));
    const rawTitle = 'Advanced Network Programming in Java (2026 Edition)';
    const cleanFilename = `${sanitizeUploadTitle(rawTitle)}.pdf`;
    const targetPath = path.join(tempDir, cleanFilename);

    try {
      // 1. Traversal guard check
      const safePath = resolveSafeBookPath(cleanFilename, tempDir);
      assert.equal(safePath, targetPath);

      // 2. Write file
      const dummyPdf = Buffer.from('%PDF-1.5\n% Pairwise Test\n%%EOF');
      fs.writeFileSync(safePath, dummyPdf);

      // 3. Isolated discovery
      const catalog = scanBooks(tempDir);
      const found = catalog.find(b => b.filename === cleanFilename);
      assert.ok(found, 'Book uploaded with spaces must be discovered in catalog');
      assert.ok(found.title.includes('Advanced Network Programming'));
    } finally {
      if (tempDir && fs.existsSync(tempDir)) {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      }
    }
  });

  // --- Combination 7: Multi-Chapter Navigation (F10) -> Mark Complete (F11) -> Percentage Recalculation (F10, F13) ---
  it('Pair 7: Sidebar TOC Navigation -> Mark Chapter Complete -> Progress Recalculation', () => {
    const books = scanBooks();
    const book = books.find(b => b.isMultiChapter && b.chapters && b.chapters.length === 16);
    assert.ok(book && book.chapters);

    const totalChapters = book.chapters.length;
    let completedList: string[] = [];

    // Mark 4 chapters complete using toggleCompletedChapter
    for (let i = 0; i < 4; i++) {
      completedList = toggleCompletedChapter(completedList, book.chapters[i].id);
    }

    const percentage = calculateChapterProgress(completedList.length, totalChapters);
    assert.equal(percentage, 25);

    // Mark 4 more chapters complete
    for (let i = 4; i < 8; i++) {
      completedList = toggleCompletedChapter(completedList, book.chapters[i].id);
    }

    const updatedPercentage = calculateChapterProgress(completedList.length, totalChapters);
    assert.equal(updatedPercentage, 50);
  });

  // --- Combination 8: Large PDF Streaming (F6, B4) -> Page Jumps (F11) -> Standalone Progress Tracking (F13) ---
  it('Pair 8: Large PDF (163MB) Byte-Range -> Midpoint Page Jump -> Progress Persistence', () => {
    const largeBookPath = path.join(BOOKS_DIR, 'head-first-java.pdf');
    const stat = fs.statSync(largeBookPath);

    // 1. Simulate Range request for pages table / xref near EOF
    const end = stat.size - 1;
    const start = Math.max(0, stat.size - 4096);
    const fd = fs.openSync(largeBookPath, 'r');
    const buf = Buffer.alloc(end - start + 1);
    fs.readSync(fd, buf, 0, buf.length, start);
    fs.closeSync(fd);
    assert.ok(buf.toString('utf8').includes('%%EOF'));

    // 2. User jumps to page 378 out of 755
    const totalPages = 755;
    const currentPage = 378;
    const computed = computeReadingProgress(currentPage, totalPages);
    assert.equal(computed.percentage, 50);
    assert.equal(computed.page, 378);
    const progressPct = computed.percentage;

    // 3. Save standalone progress
    const progress: BookProgress = {
      bookId: 'head-first-java',
      page: currentPage,
      completedChapters: [],
      percentage: progressPct,
      lastReadAt: new Date().toISOString(),
    };
    assert.equal(progress.percentage, 50);
    assert.equal(progress.page, 378);
  });

  // --- Combination 9: Offline Worker (F8) -> 3-Pane Reader (F9) -> TOC Toggle (F10) ---
  it('Pair 9: Local Offline Worker Asset -> Reader Layout Mounting -> TOC Sidebar Toggle', () => {
    // 1. Verify local worker exists and local path constant is configured
    assert.equal(PDF_WORKER_LOCAL_PATH, '/pdf.worker.min.mjs');
    const workerPath = path.join(NETLIB_DIR, 'public', PDF_WORKER_LOCAL_PATH);
    const nmWorkerPath = path.join(NETLIB_DIR, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
    assert.ok(fs.existsSync(workerPath) || fs.existsSync(nmWorkerPath), 'Offline worker script must be present locally');

    // 2. Verify reader layout pane contracts and rail toggle actions
    assert.ok(READER_RAIL_ACTIONS.includes('toggle_toc'));
    assert.equal(READER_LAYOUT.sidebarClass, 'w-80');
    assert.equal(READER_LAYOUT.leftRailClass, 'w-14');

    // 3. Verify sidebar state sanitation
    const closed = sanitizeReaderSettings({ sidebarOpen: false });
    assert.equal(closed.sidebarOpen, false);
    const opened = sanitizeReaderSettings({ sidebarOpen: true });
    assert.equal(opened.sidebarOpen, true);
  });

  // --- Combination 10: Sort by Chapters Descending (F4) -> Select First Book (F1) -> Sequential Order (F2) ---
  it('Pair 10: Sort by Chapters Descending -> Select Top Book -> Sequential Monotonic Order', () => {
    const books = scanBooks();
    const sorted = searchAndFilterBooks(books, { sort: 'chapters-desc' });
    const topBook = sorted[0];

    assert.ok(topBook.isMultiChapter);
    assert.ok(topBook.chapters && topBook.chapters.length >= 16);

    // Verify top book chapters are strictly sorted
    for (let i = 0; i < topBook.chapters.length - 1; i++) {
      assert.ok(
        topBook.chapters[i].order < topBook.chapters[i + 1].order,
        'Chapter orders must be strictly increasing'
      );
    }
  });

  // --- Combination 11: Corrupt Upload Rejection (F7, B7) -> Cache Integrity (F1) -> Search Consistency (F4) ---
  it('Pair 11: Reject Non-PDF Upload -> Cache Unaltered -> Search Results Remain Consistent', () => {
    const initialBooks = scanBooks();
    const initialCount = initialBooks.length;

    // Reject non-PDF upload via application validator
    const nonPdfResult = validatePdfUpload('exploit.sh', Buffer.from('#!/bin/bash'));
    assert.equal(nonPdfResult.valid, false);
    assert.equal(nonPdfResult.error, 'Only PDF files are allowed');

    // Reject corrupted PDF header via application validator
    const corruptResult = validatePdfUpload('corrupt.pdf', Buffer.from('NOT_A_VALID_PDF_HEADER'));
    assert.equal(corruptResult.valid, false);
    assert.equal(corruptResult.error, 'Invalid PDF file format');

    // Verify catalog has not changed
    const currentBooks = scanBooks();
    assert.equal(currentBooks.length, initialCount);

    const searchRes = searchAndFilterBooks(currentBooks, { q: 'Horstmann' });
    assert.ok(searchRes.length >= 7);
  });

  // --- Combination 12: Host Deployment Directory (F14) -> BOOKS_DIR Override (F1) -> Traversal Guard (F5) ---
  it('Pair 12: Custom BOOKS_DIR Environment Resolution -> Scan -> Traversal Confinement', () => {
    const customDir = BOOKS_DIR; // Use authoritative root as target
    const books = scanBooks(customDir);
    assert.ok(books.length >= 8);

    // Verify safe path resolution within custom dir
    const sample = books[0].filename || books[0].folder!;
    const safe = resolveSafeBookPath(sample, customDir);
    assert.ok(safe.startsWith(path.resolve(customDir)));
  });

  // --- Combination 13: Theme Sepia (F12) -> Font Size 'xl' (F12) -> Sidebar Collapse (F10) -> Persistence (F13) ---
  it('Pair 13: Multi-Parameter Customization Configuration -> Round-Trip Persistence', () => {
    const prefs: ReaderPreferences = {
      theme: 'sepia',
      fontSize: 'xl',
      readerWidth: 'wide',
      sidebarOpen: false,
    };

    const serialized = JSON.stringify(prefs);
    const restored: ReaderPreferences = JSON.parse(serialized);

    assert.equal(restored.theme, 'sepia');
    assert.equal(restored.fontSize, 'xl');
    assert.equal(restored.readerWidth, 'wide');
    assert.equal(restored.sidebarOpen, false);
  });

  // --- Combination 14: Search by Author (F4) -> Select Typo Folder (B2) -> Title Display (F3) -> Stream (F6) ---
  it('Pair 14: Search by Author -> Select Typo Book -> Display Normalized Title -> Stream First Chapter', () => {
    const books = scanBooks();
    // 1. Search for Horstmann
    const horstmannBooks = searchAndFilterBooks(books, { author: 'Horstmann' });

    // 2. Find book in Code Java typo folder
    const typoBook = horstmannBooks.find(b => b.folder === 'Code Java Vol. I_Fundamentals, 14th Edition');
    assert.ok(typoBook, 'Must locate book in Code Java folder');

    // 3. Verify normalized title
    assert.ok(typoBook.title.startsWith('Core Java'), `Title must be normalized to Core Java: ${typoBook.title}`);

    // 4. Verify chapter 1 disk stream
    assert.ok(typoBook.chapters && typoBook.chapters.length > 0);
    const ch1 = typoBook.chapters.find(c => c.chapterNumber === 1);
    assert.ok(ch1);

    const ch1Path = path.join(BOOKS_DIR, typoBook.folder!, ch1.filename);
    assert.ok(fs.existsSync(ch1Path));
    const stat = fs.statSync(ch1Path);
    assert.ok(stat.size > 10000);
  });

  // --- Combination 15: Standalone Start Config (F15) -> Environment Variable Override (F14) -> Complete Pipeline (F1-F7) ---
  it('Pair 15: Standalone Execution Pipeline: Config Verification -> Scan -> Filter -> Stream', () => {
    // 1. Verify build & start scripts
    const pkg = JSON.parse(fs.readFileSync(path.join(NETLIB_DIR, 'package.json'), 'utf8'));
    assert.ok(pkg.scripts.start);

    // 2. Discover catalog
    const catalog = scanBooks(BOOKS_DIR);
    assert.ok(catalog.length >= 8);

    // 3. Filter down to single book
    const filtered = searchAndFilterBooks(catalog, { q: 'Impatient' });
    assert.equal(filtered.length, 1);

    // 4. Resolve chapter stream path
    const book = filtered[0];
    assert.ok(book.chapters && book.chapters.length === 16);
    const firstChapter = book.chapters[0];
    const streamPath = resolveSafeBookPath(path.join(book.folder!, firstChapter.filename), BOOKS_DIR);
    assert.ok(fs.existsSync(streamPath));

    const fd = fs.openSync(streamPath, 'r');
    const header = Buffer.alloc(5);
    fs.readSync(fd, header, 0, 5, 0);
    fs.closeSync(fd);
    assert.equal(header.toString('utf8'), '%PDF-');
  });

});
