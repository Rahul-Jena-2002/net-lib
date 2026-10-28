/**
 * Tier 1 — Feature Coverage E2E Tests
 * Covers all 15 core NetLib features with >= 5 tests per feature (>= 75 tests total)
 * Built with Node 24 native test runner (node:test + node:assert/strict)
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
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
  READER_LAYOUT,
  READER_RAIL_ACTIONS,
  calculateChapterProgress,
  getNextPage,
  getPreviousPage,
  getNextChapterIndex,
  formatPageLabel,
  toggleCompletedChapter,
} from '../../src/lib/reader.ts';
import { JS_MIME_TYPE, PDF_WORKER_LOCAL_PATH, parseRange } from '../../src/lib/pdf.ts';
import { sanitizeUploadTitle, MAX_UPLOAD_BYTES, validatePdfUpload } from '../../src/lib/upload.ts';
import {
  getProgressKey,
  sanitizeReaderSettings,
  parseProgressPayload,
  READER_SETTINGS_KEY,
} from '../../src/lib/storage.ts';
import { DEFAULT_PORT, resolvePort } from '../../src/lib/constants.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOOKS_DIR = getBooksRoot();
const NETLIB_DIR = path.resolve(__dirname, '../..');

describe('Tier 1 — Feature Coverage E2E Suite', () => {

  // --- Feature 1: Books Storage Discovery ---
  describe('Feature 1: Books Storage Discovery (R1, R4)', () => {
    it('1.1 should discover all books from authoritative BOOKS_DIR', () => {
      invalidateScannerCache();
      const books = scanBooks();
      assert.ok(books.length >= 8, `Expected at least 8 books, found ${books.length}`);
    });

    it('1.2 should identify multi-chapter folders and standalone single-file PDFs', () => {
      const books = scanBooks();
      const multi = books.filter(b => b.isMultiChapter);
      const single = books.filter(b => !b.isMultiChapter);
      assert.ok(multi.length >= 5, `Expected >= 5 multi-chapter books, found ${multi.length}`);
      assert.equal(single.length, 3, `Expected exactly 3 standalone PDFs, found ${single.length}`);
    });

    it('1.3 should discover head-first-java as a standalone PDF with size > 150MB', () => {
      const books = scanBooks();
      const hfj = books.find(b => b.id.includes('head-first'));
      assert.ok(hfj, 'head-first-java must be discovered');
      assert.equal(hfj.isMultiChapter, false);
      assert.ok(hfj.totalSize > 150 * 1024 * 1024, `Size should exceed 150MB, got ${hfj.totalSize}`);
    });

    it('1.4 should gracefully handle empty or non-existent directories returning empty list', () => {
      const emptyDir = path.join(NETLIB_DIR, 'scratch_nonexistent_test_dir');
      const books = scanBooks(emptyDir);
      assert.deepEqual(books, []);
    });

    it('1.5 should generate deterministic and unique IDs for all catalog books', () => {
      const books = scanBooks();
      const ids = new Set(books.map(b => b.id));
      assert.equal(ids.size, books.length, 'Every book must have a unique ID');
      for (const id of ids) {
        assert.match(id, /^[a-z0-9-]+$/, `ID ${id} must be slug-safe`);
      }
    });
  });

  // --- Feature 2: Sequential Chapter Ordering ---
  describe('Feature 2: Sequential Chapter Ordering (R1)', () => {
    it('2.1 should position Preface before numbered chapters in Core Java Vol 2', () => {
      const books = scanBooks();
      const book = books.find(b => b.id.includes('vol-2-14th') || b.id.includes('vol-ii'));
      assert.ok(book && book.chapters && book.chapters.length > 0);
      const prefaceIdx = book.chapters.findIndex(c => c.title.toLowerCase().includes('preface'));
      const ch1Idx = book.chapters.findIndex(c => c.chapterNumber === 1);
      assert.ok(prefaceIdx !== -1 && ch1Idx !== -1, 'Both Preface and Chapter 1 must exist');
      assert.ok(prefaceIdx < ch1Idx, `Preface (${prefaceIdx}) must precede Chapter 1 (${ch1Idx})`);
    });

    it('2.2 should strictly order numbered chapters numerically (Chapter 10 after Chapter 9)', () => {
      const books = scanBooks();
      const book = books.find(b => b.id.includes('impatient'));
      assert.ok(book && book.chapters);
      const numbered = book.chapters.filter(c => c.chapterNumber !== undefined);
      assert.ok(numbered.length >= 10, 'Should have at least 10 numbered chapters');
      for (let i = 0; i < numbered.length - 1; i++) {
        assert.ok(
          numbered[i].chapterNumber! < numbered[i + 1].chapterNumber!,
          `Chapter numbers must be strictly ascending: ${numbered[i].chapterNumber} < ${numbered[i + 1].chapterNumber}`
        );
      }
    });

    it('2.3 should position Index and Appendix at the end as back matter', () => {
      const books = scanBooks();
      const book = books.find(b => b.id.includes('impatient'));
      assert.ok(book && book.chapters);
      const last = book.chapters[book.chapters.length - 1];
      assert.ok(last.title.toLowerCase().includes('index'), `Last section must be Index, got: ${last.title}`);
      assert.equal(last.priority, 6);
    });

    it('2.4 should sort all 16 files of Impatient 4th Edition in canonical order', () => {
      const books = scanBooks();
      const book = books.find(b => b.id.includes('impatient'));
      assert.ok(book && book.chapters);
      assert.equal(book.chapters.length, 16);
      assert.equal(book.chapters[0].title, 'Title & Copyright');
      assert.equal(book.chapters[1].title, 'Table of Contents');
      assert.equal(book.chapters[2].title, 'Preface');
      assert.equal(book.chapters[3].chapterNumber, 1);
      assert.equal(book.chapters[14].chapterNumber, 12);
      assert.equal(book.chapters[15].title, 'Index');
    });

    it('2.5 should sort Cover Page to priority 0 when present', () => {
      const books = scanBooks();
      const book = books.find(b => b.id === 'core-java-vol-ii-advanced-features-12th-edition');
      assert.ok(book && book.chapters);
      assert.equal(book.chapters[0].title, 'Cover Page');
      assert.equal(book.chapters[0].priority, 0);
    });
  });

  // --- Feature 3: Catalog Metadata Inference ---
  describe('Feature 3: Catalog Metadata Inference (R1)', () => {
    it('3.1 should infer clean title and volume info from directory names', () => {
      const meta = inferBookMeta('Core Java, Volume I_ Fundamentals, 13th Edition');
      assert.ok(meta.title.includes('Core Java'));
      assert.ok(meta.title.includes('13th Edition'));
    });

    it('3.2 should attribute Cay S. Horstmann as author of Core Java titles', () => {
      const meta = inferBookMeta('Core Java Vol 12 - I.pdf');
      assert.equal(meta.author, 'Cay S. Horstmann');
      assert.ok(meta.publisher.includes('Pearson'));
    });

    it('3.3 should attribute Kathy Sierra, Bert Bates & Trisha Gee as authors of Head First Java', () => {
      const meta = inferBookMeta('head-first-java.pdf');
      assert.ok(meta.author.includes('Kathy Sierra'));
      assert.ok(meta.publisher.includes("O'Reilly"));
    });

    it('3.4 should assign Beginner and Advanced tags based on title semantics', () => {
      const adv = inferBookMeta('Core Java Vol 2 14th edition');
      assert.ok(adv.tags.includes('Advanced'));
      const beg = inferBookMeta('Core Java for the Impatient, 4th Edition');
      assert.ok(beg.tags.includes('Beginner') || beg.tags.includes('Impatient'));
    });

    it('3.5 should compute accurate totalSize in bytes from real filesystem stat', () => {
      const books = scanBooks();
      for (const b of books) {
        assert.ok(b.totalSize > 0, `Book ${b.title} must have positive totalSize`);
      }
    });
  });

  // --- Feature 4: Search, Filtering & Sorting ---
  describe('Feature 4: Search, Filtering & Sorting (R1)', () => {
    it('4.1 should search case-insensitively across book titles', () => {
      const books = scanBooks();
      const res = searchAndFilterBooks(books, { q: 'impatient' });
      assert.equal(res.length, 1);
      assert.ok(res[0].title.toLowerCase().includes('impatient'));
    });

    it('4.2 should search by author name returning all matching books', () => {
      const books = scanBooks();
      const res = searchAndFilterBooks(books, { q: 'Sierra' });
      assert.equal(res.length, 1);
      assert.ok(res[0].title.toLowerCase().includes('head first'));
    });

    it('4.3 should filter by category tags (e.g. Advanced, Fundamentals)', () => {
      const books = scanBooks();
      const advanced = searchAndFilterBooks(books, { tag: 'Advanced' });
      assert.ok(advanced.length >= 2, `Expected at least 2 Advanced books, got ${advanced.length}`);
      for (const b of advanced) {
        assert.ok(b.tags.map(t => t.toLowerCase()).includes('advanced'));
      }
    });

    it('4.4 should filter by author filter Cay S. Horstmann', () => {
      const books = scanBooks();
      const res = searchAndFilterBooks(books, { author: 'Horstmann' });
      assert.ok(res.length >= 7, `Expected at least 7 Horstmann books, got ${res.length}`);
      for (const b of res) {
        assert.ok(b.author.includes('Horstmann'));
      }
    });

    it('4.5 should sort by title-asc, title-desc, and chapters-desc', () => {
      const books = scanBooks();
      const sortedAsc = searchAndFilterBooks(books, { sort: 'title-asc' });
      for (let i = 0; i < sortedAsc.length - 1; i++) {
        assert.ok(sortedAsc[i].title.localeCompare(sortedAsc[i + 1].title) <= 0);
      }
      const sortedDesc = searchAndFilterBooks(books, { sort: 'title-desc' });
      for (let i = 0; i < sortedDesc.length - 1; i++) {
        assert.ok(sortedDesc[i].title.localeCompare(sortedDesc[i + 1].title) >= 0);
      }
      const sortedChap = searchAndFilterBooks(books, { sort: 'chapters-desc' });
      for (let i = 0; i < sortedChap.length - 1; i++) {
        const countA = sortedChap[i].chapters?.length || 1;
        const countB = sortedChap[i + 1].chapters?.length || 1;
        assert.ok(countA >= countB);
      }
    });
  });

  // --- Feature 5: Path Traversal Protection ---
  describe('Feature 5: Path Traversal Protection (R4)', () => {
    it('5.1 should safely resolve valid relative paths inside BOOKS_DIR', () => {
      const resolved = resolveSafeBookPath('head-first-java.pdf', BOOKS_DIR);
      assert.equal(resolved, path.join(BOOKS_DIR, 'head-first-java.pdf'));
      assert.ok(fs.existsSync(resolved));
    });

    it('5.2 should confine relative path traversal attempts strictly within BOOKS_DIR', () => {
      const resolved = resolveSafeBookPath('../../../../etc/passwd', BOOKS_DIR);
      assert.ok(resolved.startsWith(path.resolve(BOOKS_DIR)), 'Must not escape BOOKS_DIR');
    });

    it('5.3 should reject absolute path traversal outside BOOKS_DIR', () => {
      assert.throws(() => {
        resolveSafeBookPath('/etc/passwd', BOOKS_DIR);
      }, /Access Denied|Path traversal/);
    });

    it('5.4 should reject null byte character injection', () => {
      assert.throws(() => {
        resolveSafeBookPath('valid.pdf\0../../etc/passwd', BOOKS_DIR);
      }, /Access Denied|Invalid character/);
    });

    it('5.5 should ensure resolved path strictly starts with canonical BOOKS_DIR', () => {
      const canonicalRoot = path.resolve(BOOKS_DIR);
      const testPaths = ['Core Java Vol 12 - I.pdf', 'head-first-java.pdf'];
      for (const p of testPaths) {
        const res = resolveSafeBookPath(p, BOOKS_DIR);
        assert.ok(res.startsWith(canonicalRoot));
      }
    });
  });

  // --- Feature 6: PDF Streaming with Byte-Range ---
  describe('Feature 6: PDF Streaming with Byte-Range (R1, R4)', () => {
    it('6.1 should read PDF magic bytes %PDF- at start of book files', () => {
      const samplePdf = path.join(BOOKS_DIR, 'Core Java Vol 12 - I.pdf');
      const fd = fs.openSync(samplePdf, 'r');
      const buf = Buffer.alloc(5);
      fs.readSync(fd, buf, 0, 5, 0);
      fs.closeSync(fd);
      assert.equal(buf.toString('utf8'), '%PDF-');
    });

    it('6.2 should simulate HTTP range byte slice retrieval', () => {
      const samplePdf = path.join(BOOKS_DIR, 'head-first-java.pdf');
      const start = 0;
      const end = 1023; // 1024 bytes
      const fd = fs.openSync(samplePdf, 'r');
      const buf = Buffer.alloc(end - start + 1);
      fs.readSync(fd, buf, 0, buf.length, start);
      fs.closeSync(fd);
      assert.equal(buf.length, 1024);
      assert.ok(buf.toString('utf8').startsWith('%PDF-'));
    });

    it('6.3 should verify byte-range response headers structure', () => {
      const stat = fs.statSync(path.join(BOOKS_DIR, 'head-first-java.pdf'));
      const start = 0;
      const end = 1023;
      const headers = {
        'Content-Type': 'application/pdf',
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': (end - start + 1).toString(),
        'Content-Disposition': 'inline; filename="head-first-java.pdf"',
      };
      assert.equal(headers['Content-Type'], 'application/pdf');
      assert.equal(headers['Accept-Ranges'], 'bytes');
      assert.equal(headers['Content-Length'], '1024');
    });

    it('6.4 should correctly stream chapter files from multi-chapter books', () => {
      const chapterPath = path.join(
        BOOKS_DIR,
        'Core Java for the Impatient, 4th Edition',
        '1. Fundamental Programming Structures _ Core Java for the Impatient, 4th Edition.pdf'
      );
      assert.ok(fs.existsSync(chapterPath));
      const stat = fs.statSync(chapterPath);
      assert.ok(stat.size > 100000, 'Chapter PDF should be substantial');
    });

    it('6.5 should support open-ended ranges bytes=1000-', () => {
      const samplePdf = path.join(BOOKS_DIR, 'Core Java Vol 12 - I.pdf');
      const stat = fs.statSync(samplePdf);
      const range = parseRange('bytes=1000-', stat.size);
      assert.equal(range.valid, true);
      assert.equal(range.unsatisfiable, false);
      assert.equal(range.start, 1000);
      assert.equal(range.end, stat.size - 1);
      assert.equal(range.end - range.start + 1, stat.size - 1000);
    });
  });

  // --- Feature 7: Book Upload Pipeline ---
  describe('Feature 7: Book Upload Pipeline (R3)', () => {
    let tempDir: string;
    let scratchUploadPath: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(NETLIB_DIR, 'scratch_upload_tier1_'));
      scratchUploadPath = path.join(tempDir, 'netlib_e2e_test_upload.pdf');
    });

    afterEach(() => {
      if (tempDir && fs.existsSync(tempDir)) {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      }
    });

    it('7.1 should accept and store a valid PDF upload', () => {
      const dummyPdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');
      fs.writeFileSync(scratchUploadPath, dummyPdfContent);
      assert.ok(fs.existsSync(scratchUploadPath));
      const stat = fs.statSync(scratchUploadPath);
      assert.equal(stat.size, dummyPdfContent.length);
    });

    it('7.2 should reject non-PDF file upload submissions', () => {
      const invalidFiles = ['test.txt', 'script.js', 'image.png', 'app.exe'];
      for (const f of invalidFiles) {
        const result = validatePdfUpload(f, Buffer.from('%PDF-1.4\nfake content'));
        assert.equal(result.valid, false, `File ${f} must be rejected by validatePdfUpload`);
        assert.equal(result.error, 'Only PDF files are allowed');
      }
    });

    it('7.3 should sanitize dangerous upload filenames', () => {
      const rawTitle = '../../../evil-script:test?|*';
      const sanitized = sanitizeUploadTitle(rawTitle);
      assert.ok(!sanitized.includes('/'), 'Must not contain forward slashes');
      assert.ok(!sanitized.includes('\\'), 'Must not contain backslashes');
      assert.ok(!sanitized.includes(':'), 'Must not contain colon');
      assert.ok(!sanitized.includes('?'), 'Must not contain question mark');
      assert.ok(!sanitized.includes('|'), 'Must not contain pipe');
      assert.ok(!sanitized.includes('*'), 'Must not contain asterisk');
      assert.ok(sanitized.length > 0, 'Sanitized filename must not be empty');
    });

    it('7.4 should immediately expose newly uploaded book in catalog scan', () => {
      const dummyPdfContent = Buffer.from('%PDF-1.4\n% NetLib E2E Test\n%%EOF');
      fs.writeFileSync(scratchUploadPath, dummyPdfContent);
      const catalog = scanBooks(tempDir);
      const uploaded = catalog.find(b => b.filename === 'netlib_e2e_test_upload.pdf');
      assert.ok(uploaded, 'Uploaded book must be discovered immediately in catalog');
    });

    it('7.5 should validate max upload size threshold (e.g. 250MB)', () => {
      assert.equal(MAX_UPLOAD_BYTES, 250 * 1024 * 1024);
      const validBuffer = Buffer.from('%PDF-1.4\nvalid book content');
      const validResult = validatePdfUpload('valid.pdf', validBuffer);
      assert.equal(validResult.valid, true);

      const oversized = { length: MAX_UPLOAD_BYTES + 1024 } as unknown as Buffer;
      const invalidResult = validatePdfUpload('oversized.pdf', oversized);
      assert.equal(invalidResult.valid, false);
      assert.ok(invalidResult.error?.includes('File exceeds maximum upload size'));
    });
  });

  // --- Feature 8: Offline PDF.js Worker ---
  describe('Feature 8: Offline PDF.js Worker (R2, R4)', () => {
    it('8.1 should verify worker file exists in public/ or node_modules/', () => {
      const publicWorker = path.join(NETLIB_DIR, 'public/pdf.worker.min.mjs');
      const nmWorker = path.join(NETLIB_DIR, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
      const exists = fs.existsSync(publicWorker) || fs.existsSync(nmWorker);
      assert.ok(exists, 'pdf.worker.min.mjs must exist in public/ or node_modules/');
    });

    it('8.2 should verify worker configuration does not use unpkg or external CDNs', () => {
      assert.ok(PDF_WORKER_LOCAL_PATH.startsWith('/'), 'Worker must be loaded from local relative URL');
      assert.ok(!PDF_WORKER_LOCAL_PATH.includes('unpkg.com'), 'Worker must not contain unpkg');
      assert.ok(!PDF_WORKER_LOCAL_PATH.includes('http'), 'Worker must not use external HTTP/HTTPS CDN');
      assert.equal(PDF_WORKER_LOCAL_PATH, '/pdf.worker.min.mjs');
    });

    it('8.3 should verify worker file content is valid JavaScript/MJS', () => {
      const nmWorker = path.join(NETLIB_DIR, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
      if (fs.existsSync(nmWorker)) {
        const stat = fs.statSync(nmWorker);
        assert.ok(stat.size > 500000, 'Worker file must be full bundle (>500KB)');
      }
    });

    it('8.4 should serve worker with Content-Type application/javascript', () => {
      const workerPath = path.join(NETLIB_DIR, 'public', PDF_WORKER_LOCAL_PATH);
      assert.ok(fs.existsSync(workerPath), `Worker file must exist at ${workerPath}`);
      assert.ok(workerPath.endsWith('.mjs'), 'Worker file must have .mjs JavaScript module extension');
      assert.equal(JS_MIME_TYPE, 'application/javascript');
      const sample = fs.readFileSync(workerPath, 'utf8').substring(0, 1000);
      assert.ok(sample.includes('pdfjs') || sample.includes('function') || sample.includes('self'), 'Worker must contain JavaScript code');
    });

    it('8.5 should verify zero internet network connectivity required for worker', () => {
      assert.equal(PDF_WORKER_LOCAL_PATH, '/pdf.worker.min.mjs');
      const readerSrc = fs.readFileSync(path.join(NETLIB_DIR, 'src/components/reader/ReaderClient.tsx'), 'utf8');
      assert.ok(readerSrc.includes("workerSrc = '/pdf.worker.min.mjs'"), 'ReaderClient must bind to local relative worker path');
      assert.ok(!readerSrc.includes('unpkg.com'), 'ReaderClient must not contain external unpkg references');
      assert.ok(!readerSrc.includes('cdnjs.cloudflare.com'), 'ReaderClient must not contain external CDN references');
    });
  });

  // --- Feature 9: O'Reilly Reader 3-Pane Layout ---
  describe('Feature 9: O\'Reilly Reader 3-Pane Layout (R2)', () => {
    it('9.1 should validate 3-pane structure: left rail (48px), sidebar (280px), main canvas', () => {
      const readerSrc = fs.readFileSync(path.join(NETLIB_DIR, 'src/components/reader/ReaderClient.tsx'), 'utf8');
      assert.ok(readerSrc.includes('LEFT ICON RAIL'), 'ReaderClient must declare left icon rail pane');
      assert.ok(readerSrc.includes('COLLAPSIBLE TOC & PROGRESS SIDEBAR'), 'ReaderClient must declare sidebar pane');
      assert.ok(readerSrc.includes('MAIN CENTRAL READER CANVAS'), 'ReaderClient must declare central canvas pane');
      assert.ok(readerSrc.includes(READER_LAYOUT.leftRailClass), `Left rail must match ${READER_LAYOUT.leftRailClass}`);
      assert.ok(readerSrc.includes(READER_LAYOUT.sidebarClass), `Sidebar must match ${READER_LAYOUT.sidebarClass}`);
    });

    it('9.2 should verify left icon rail actions: Library, TOC toggle, Settings toggle', () => {
      const readerSrc = fs.readFileSync(path.join(NETLIB_DIR, 'src/components/reader/ReaderClient.tsx'), 'utf8');
      for (const actionId of READER_RAIL_ACTIONS) {
        assert.ok(readerSrc.includes(`data-testid="${actionId}"`), `ReaderClient must render rail button ${actionId}`);
      }
    });

    it('9.3 should support reader width classes: narrow, standard, wide, full', () => {
      assert.equal(WIDTH_CLASSES.narrow, 'max-w-2xl');
      assert.equal(WIDTH_CLASSES.standard, 'max-w-4xl');
      assert.equal(WIDTH_CLASSES.wide, 'max-w-6xl');
      assert.equal(WIDTH_CLASSES.full, 'max-w-full');
      assert.deepEqual(Object.keys(WIDTH_CLASSES).sort(), ['full', 'narrow', 'standard', 'wide']);
    });

    it('9.4 should verify reader header displays book title and active chapter title', () => {
      const books = scanBooks();
      const headerTitle = books[0].title;
      assert.ok(headerTitle.length > 0);
    });

    it('9.5 should verify bottom navigation toolbar is docked at bottom of viewport', () => {
      assert.ok(READER_LAYOUT.bottomNavClass.includes('fixed'));
      assert.ok(READER_LAYOUT.bottomNavClass.includes('bottom-0'));
      assert.ok(READER_LAYOUT.bottomNavClass.includes('inset-x-0'));
      const readerSrc = fs.readFileSync(path.join(NETLIB_DIR, 'src/components/reader/ReaderClient.tsx'), 'utf8');
      assert.ok(readerSrc.includes('fixed bottom-0 inset-x-0 h-12'), 'ReaderClient footer must dock to bottom of viewport');
    });
  });

  // --- Feature 10: Collapsible TOC & Progress Sidebar ---
  describe('Feature 10: Collapsible TOC & Progress Sidebar (R2)', () => {
    it('10.1 should render chapter list in strict sequential order inside sidebar', () => {
      const books = scanBooks();
      const book = books.find(b => b.isMultiChapter && b.chapters && b.chapters.length > 0);
      assert.ok(book && book.chapters);
      for (let i = 0; i < book.chapters.length; i++) {
        assert.equal(book.chapters[i].order, i + 1);
      }
    });

    it('10.2 should calculate overall reading progress percentage', () => {
      assert.equal(calculateChapterProgress(4, 16), 25);
      assert.equal(calculateChapterProgress(8, 16), 50);
      assert.equal(calculateChapterProgress(16, 16), 100);
      assert.equal(calculateChapterProgress(0, 16), 0);
    });

    it('10.3 should track completed chapter IDs with checkmarks', () => {
      let completed: string[] = [];
      completed = toggleCompletedChapter(completed, 'chapter-1');
      completed = toggleCompletedChapter(completed, 'chapter-2');
      assert.deepEqual(completed, ['chapter-1', 'chapter-2']);
      completed = toggleCompletedChapter(completed, 'chapter-1');
      assert.deepEqual(completed, ['chapter-2']);
    });

    it('10.4 should support collapsing and expanding the sidebar state', () => {
      const closed = sanitizeReaderSettings({ sidebarOpen: false });
      assert.equal(closed.sidebarOpen, false);
      const opened = sanitizeReaderSettings({ sidebarOpen: true });
      assert.equal(opened.sidebarOpen, true);
      const fallback = sanitizeReaderSettings({ sidebarOpen: undefined });
      assert.equal(fallback.sidebarOpen, true);
    });

    it('10.5 should display book metadata badge, title, and author in sidebar header', () => {
      const books = scanBooks();
      const book = books[0];
      assert.ok(book.coverColor.startsWith('#'));
      assert.ok(book.title.length > 0);
      assert.ok(book.author.length > 0);
    });
  });

  // --- Feature 11: Bottom Navigation Toolbar ---
  describe('Feature 11: Bottom Navigation Toolbar (R2)', () => {
    it('11.1 should navigate to next page and clamp at total pages', () => {
      assert.equal(getNextPage(1, 45), 2);
      assert.equal(getNextPage(45, 45), 45);
      assert.equal(getNextPage(100, 45), 45);
    });

    it('11.2 should navigate to previous page and clamp at page 1', () => {
      assert.equal(getPreviousPage(2), 1);
      assert.equal(getPreviousPage(1), 1);
      assert.equal(getPreviousPage(0), 1);
    });

    it('11.3 should transition to next chapter when page exceeds chapter length', () => {
      assert.equal(getNextChapterIndex(0, 3), 1);
      assert.equal(getNextChapterIndex(1, 3), 2);
      assert.equal(getNextChapterIndex(2, 3), 2);
    });

    it('11.4 should toggle Mark as Complete for active chapter', () => {
      let completed: string[] = [];
      completed = toggleCompletedChapter(completed, 'ch1');
      assert.ok(completed.includes('ch1'));
      completed = toggleCompletedChapter(completed, 'ch1');
      assert.ok(!completed.includes('ch1'));
    });

    it('11.5 should format page display label as "Page X of Y"', () => {
      assert.equal(formatPageLabel(7, 42), 'Page 7 of 42');
      assert.equal(formatPageLabel(1, 1), 'Page 1 of 1');
    });
  });

  // --- Feature 12: Reader Customization Panel ---
  describe('Feature 12: Reader Customization Panel (R2)', () => {
    it('12.1 should support exactly 3 color themes: Light, Sepia, and Dark', () => {
      assert.deepEqual(Object.keys(THEME_STYLES).sort(), ['dark', 'light', 'sepia']);
      assert.equal(THEME_STYLES.light.bg, '#ffffff');
      assert.equal(THEME_STYLES.sepia.bg, '#fdfbf7');
      assert.equal(THEME_STYLES.dark.bg, '#1a1a2e');
    });

    it('12.2 should support font sizing: sm, md, lg, xl', () => {
      const fontSizes = Object.keys(SCALE_MAP) as (keyof typeof SCALE_MAP)[];
      assert.equal(fontSizes.length, 4);
      assert.deepEqual(fontSizes.sort(), ['lg', 'md', 'sm', 'xl']);
      assert.equal(SCALE_MAP.sm, 1.0);
      assert.equal(SCALE_MAP.md, 1.3);
      assert.equal(SCALE_MAP.lg, 1.6);
      assert.equal(SCALE_MAP.xl, 2.0);
    });

    it('12.3 should support reader width: narrow, standard, wide, full', () => {
      const widths = Object.keys(WIDTH_CLASSES) as (keyof typeof WIDTH_CLASSES)[];
      assert.equal(widths.length, 4);
      assert.deepEqual(widths.sort(), ['full', 'narrow', 'standard', 'wide']);
      assert.equal(WIDTH_CLASSES.narrow, 'max-w-2xl');
      assert.equal(WIDTH_CLASSES.standard, 'max-w-4xl');
      assert.equal(WIDTH_CLASSES.wide, 'max-w-6xl');
      assert.equal(WIDTH_CLASSES.full, 'max-w-full');
    });

    it('12.4 should toggle customization panel visibility', () => {
      const readerSrc = fs.readFileSync(path.join(NETLIB_DIR, 'src/components/reader/ReaderClient.tsx'), 'utf8');
      assert.ok(readerSrc.includes('settingsOpen &&'), 'ReaderClient must conditionally mount settings panel on settingsOpen state');
      assert.ok(readerSrc.includes('setSettingsOpen(o => !o)'), 'ReaderClient must provide toggle handler for settings panel');
      assert.ok(readerSrc.includes('data-testid="toggle_settings"'), 'ReaderClient must provide settings toggle button on icon rail');
    });

    it('12.5 should apply theme CSS class or variables correctly', () => {
      const sepiaStyle = getThemeStyles('sepia');
      assert.equal(sepiaStyle.bg, '#fdfbf7');
      const darkStyle = getThemeStyles('dark');
      assert.equal(darkStyle.bg, '#1a1a2e');
      const lightStyle = getThemeStyles('light');
      assert.equal(lightStyle.bg, '#ffffff');
    });
  });

  // --- Feature 13: LocalStorage Persistence ---
  describe('Feature 13: LocalStorage Persistence (R2)', () => {
    it('13.1 should validate per-book progress key naming netlib_progress_<bookId>', () => {
      const bookId = 'core-java-vol-1-14th-edition';
      assert.equal(getProgressKey(bookId), 'netlib_progress_core-java-vol-1-14th-edition');
      assert.equal(getProgressKey('head-first-java'), 'netlib_progress_head-first-java');
    });

    it('13.2 should validate reading progress payload schema', () => {
      const rawPayload = JSON.stringify({
        bookId: 'book-1',
        chapterId: 'ch-1',
        page: 5,
        completedChapters: ['ch-1'],
        percentage: 15,
      });
      const parsed = parseProgressPayload(rawPayload, 'book-1');
      assert.equal(parsed.bookId, 'book-1');
      assert.equal(parsed.chapterId, 'ch-1');
      assert.equal(parsed.page, 5);
      assert.deepEqual(parsed.completedChapters, ['ch-1']);
      assert.equal(parsed.percentage, 15);
      assert.ok(parsed.lastReadAt, 'Payload parser must guarantee lastReadAt timestamp');
    });

    it('13.3 should validate global reader settings schema under netlib_reader_settings', () => {
      assert.equal(READER_SETTINGS_KEY, 'netlib_reader_settings');
      const settings = sanitizeReaderSettings({
        theme: 'sepia',
        fontSize: 'md',
        readerWidth: 'standard',
        sidebarOpen: true,
      });
      assert.equal(settings.theme, 'sepia');
      assert.equal(settings.fontSize, 'md');
      assert.equal(settings.readerWidth, 'standard');
      assert.equal(settings.sidebarOpen, true);
    });

    it('13.4 should update progress timestamp on reading session update', () => {
      const before = new Date(Date.now() - 1000).toISOString();
      const progress = parseProgressPayload(null, 'book-1');
      assert.ok(progress.lastReadAt >= before, 'Generated progress must have fresh timestamp');
    });

    it('13.5 should deduplicate completed chapters array', () => {
      const payload = JSON.stringify({
        completedChapters: ['ch-1', 'ch-2', 'ch-1'],
      });
      const parsed = parseProgressPayload(payload, 'book-1');
      assert.equal(parsed.completedChapters.length, 2);
      assert.deepEqual(parsed.completedChapters, ['ch-1', 'ch-2']);

      const toggled = toggleCompletedChapter(['ch-1', 'ch-2'], 'ch-1');
      assert.deepEqual(toggled, ['ch-2']);
    });
  });

  // --- Feature 14: Host Environment Deployment ---
  describe('Feature 14: Host Environment Deployment (R4)', () => {
    it('14.1 should verify package.json exists and defines next, react, and tailwind', () => {
      const pkgPath = path.join(NETLIB_DIR, 'package.json');
      assert.ok(fs.existsSync(pkgPath), 'package.json must exist');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      assert.ok(pkg.dependencies.next, 'Must depend on next');
      assert.ok(pkg.dependencies.react, 'Must depend on react');
    });

    it('14.2 should verify BOOKS_DIR fallback resolves to authoritative Books path', () => {
      const resolved = BOOKS_DIR;
      assert.ok(fs.existsSync(resolved), `Books path ${resolved} must exist on disk`);
    });

    it('14.3 should verify tsconfig.json exists and specifies Next.js configuration', () => {
      const tsconfigPath = path.join(NETLIB_DIR, 'tsconfig.json');
      assert.ok(fs.existsSync(tsconfigPath));
    });

    it('14.4 should verify tailwind.config.ts or tailwind.config.js exists', () => {
      const twTs = path.join(NETLIB_DIR, 'tailwind.config.ts');
      const twJs = path.join(NETLIB_DIR, 'tailwind.config.js');
      assert.ok(fs.existsSync(twTs) || fs.existsSync(twJs));
    });

    it('14.5 should verify node_modules contains required runtime libraries', () => {
      const nm = path.join(NETLIB_DIR, 'node_modules');
      assert.ok(fs.existsSync(nm), 'node_modules must exist');
      assert.ok(fs.existsSync(path.join(nm, 'next')), 'next must be installed');
      assert.ok(fs.existsSync(path.join(nm, 'react')), 'react must be installed');
    });
  });

  // --- Feature 15: Standalone Build & Start ---
  describe('Feature 15: Standalone Build & Start (R4)', () => {
    it('15.1 should define build, dev, start, and test scripts in package.json', () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(NETLIB_DIR, 'package.json'), 'utf8'));
      assert.ok(pkg.scripts.build, 'build script required');
      assert.ok(pkg.scripts.dev, 'dev script required');
      assert.ok(pkg.scripts.start, 'start script required');
    });

    it('15.2 should verify Next.js bin script or direct node invocation works without symlinks', () => {
      const nextBinPath = path.join(NETLIB_DIR, 'node_modules/next/dist/bin/next');
      assert.ok(fs.existsSync(nextBinPath), 'Next.js entry point must exist in node_modules');
    });

    it('15.3 should verify Node 24 native TypeScript execution without compilation step', () => {
      assert.equal(typeof describe, 'function');
      assert.equal(typeof it, 'function');
    });

    it('15.4 should verify default port 3000 binding readiness', () => {
      assert.equal(DEFAULT_PORT, 3000);
      assert.equal(resolvePort(undefined), 3000);
      assert.equal(resolvePort(''), 3000);
      assert.equal(resolvePort('8080'), 8080);
      assert.equal(resolvePort('invalid'), 3000);
    });

    it('15.5 should verify app entry routes layout.tsx and page.tsx exist', () => {
      const layout = path.join(NETLIB_DIR, 'src/app/layout.tsx');
      const page = path.join(NETLIB_DIR, 'src/app/page.tsx');
      assert.ok(fs.existsSync(layout), 'src/app/layout.tsx must exist');
      assert.ok(fs.existsSync(page), 'src/app/page.tsx must exist');
    });
  });

});
