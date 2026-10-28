/**
 * Tier 2 — Boundary & Corner Cases E2E Tests
 * Covers all boundary-sensitive features with >= 5 tests per group (>= 75 tests total)
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
import { computeReadingProgress } from '../../src/lib/reader.ts';
import { parseRange } from '../../src/lib/pdf.ts';
import {
  getCollisionSafePath,
  sanitizeUploadTitle,
  normalizePdfFilename,
  validatePdfUpload,
} from '../../src/lib/upload.ts';
import {
  parseProgressPayload,
  sanitizeReaderSettings,
  DEFAULT_READER_SETTINGS,
} from '../../src/lib/storage.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOOKS_DIR = getBooksRoot();
const NETLIB_DIR = path.resolve(__dirname, '../..');

describe('Tier 2 — Boundary & Corner Cases E2E Suite', () => {

  // --- Boundary 1: Non-breaking spaces in filenames ---
  describe('Boundary 1: Non-Breaking Spaces in Filenames', () => {
    it('B1.1 should detect non-breaking space (\\u00a0) in chapter filenames of Impatient 4th Ed', () => {
      const folder = 'Core Java for the Impatient, 4th Edition';
      const files = fs.readdirSync(path.join(BOOKS_DIR, folder));
      const nbspFiles = files.filter(f => f.includes('\u00a0'));
      assert.ok(nbspFiles.length >= 3, `Expected at least 3 files with nbsp, found ${nbspFiles.length}`);
    });

    it('B1.2 should normalize \\u00a0 to standard ASCII space in display titles', () => {
      const raw = '12. The Java Platform Module\u00a0System _ Core Java.pdf';
      const normalized = normalizeString(raw);
      assert.ok(!normalized.includes('\u00a0'), 'Must not contain non-breaking space');
      assert.ok(normalized.includes('Module System'));
    });

    it('B1.3 should preserve filesystem disk access when resolving chapter filename with \\u00a0', () => {
      const folder = 'Core Java for the Impatient, 4th Edition';
      const files = fs.readdirSync(path.join(BOOKS_DIR, folder));
      const target = files.find(f => f.includes('Module') && f.includes('\u00a0'));
      assert.ok(target, 'Target file with nbsp must exist');
      const resolved = path.join(BOOKS_DIR, folder, target);
      assert.ok(fs.existsSync(resolved), 'Disk file must exist and be accessible');
    });

    it('B1.4 should correctly order chapters containing \\u00a0 without sort degradation', () => {
      const folder = 'Core Java for the Impatient, 4th Edition';
      const key3 = getChapterSortKey('3. Interfaces and Lambda\u00a0Expressions _ Book.pdf', folder);
      const key12 = getChapterSortKey('12. The Java Platform Module\u00a0System _ Book.pdf', folder);
      assert.equal(key3.number, 3);
      assert.equal(key12.number, 12);
      assert.ok(key3.number < key12.number);
    });

    it('B1.5 should match search queries with normal space against chapters containing \\u00a0', () => {
      const books = scanBooks();
      const impatient = books.find(b => b.id.includes('impatient'));
      assert.ok(impatient && impatient.chapters);
      const ch12 = impatient.chapters.find(c => c.title.toLowerCase().includes('module system'));
      assert.ok(ch12, 'Chapter 12 Module System must be indexed and searchable');
    });
  });

  // --- Boundary 2: Folder Typo 'Code Java' Normalization ---
  describe('Boundary 2: Folder Typo Normalization (Code Java vs Core Java)', () => {
    it('B2.1 should detect folder typo "Code Java Vol. I_Fundamentals, 14th Edition"', () => {
      const folder = 'Code Java Vol. I_Fundamentals, 14th Edition';
      assert.ok(fs.existsSync(path.join(BOOKS_DIR, folder)));
    });

    it('B2.2 should normalize title display to "Core Java" instead of "Code Java"', () => {
      const meta = inferBookMeta('Code Java Vol. I_Fundamentals, 14th Edition');
      assert.ok(meta.title.startsWith('Core Java'), `Title should start with "Core Java", got: ${meta.title}`);
    });

    it('B2.3 should infer author Cay S. Horstmann despite folder typo', () => {
      const meta = inferBookMeta('Code Java Vol. I_Fundamentals, 14th Edition');
      assert.equal(meta.author, 'Cay S. Horstmann');
    });

    it('B2.4 should match "Core Java" search query against book in "Code Java" directory', () => {
      const books = scanBooks();
      const res = searchAndFilterBooks(books, { q: 'Core Java' });
      const found = res.find(b => b.folder === 'Code Java Vol. I_Fundamentals, 14th Edition');
      assert.ok(found, 'Should find book even when stored in typo folder');
    });

    it('B2.5 should correctly resolve disk path using actual folder name with typo', () => {
      const books = scanBooks();
      const book = books.find(b => b.folder === 'Code Java Vol. I_Fundamentals, 14th Edition');
      assert.ok(book);
      const diskPath = path.join(BOOKS_DIR, book.folder!);
      assert.ok(fs.existsSync(diskPath));
    });
  });

  // --- Boundary 3: Double Spaces in Filenames ---
  describe('Boundary 3: Double Spaces in Filenames', () => {
    it('B3.1 should detect double space in "Core Java Vol  13 - II.pdf"', () => {
      const filename = 'Core Java Vol  13 - II.pdf';
      assert.ok(fs.existsSync(path.join(BOOKS_DIR, filename)));
      assert.ok(filename.includes('  '));
    });

    it('B3.2 should generate clean slug ID collapsing multiple consecutive spaces', () => {
      const id = makeId('Core Java Vol  13 - II.pdf');
      assert.ok(!id.includes('--'), `Slug ${id} must collapse duplicate delimiters`);
      assert.ok(id.includes('core-java-vol-13-ii') || id.includes('vol-13'));
    });

    it('B3.3 should match search query "13th" against "Core Java Vol  13 - II.pdf"', () => {
      const books = scanBooks();
      const res = searchAndFilterBooks(books, { q: '13th' });
      assert.ok(res.length >= 1);
      const vol13 = res.find(b => b.filename === 'Core Java Vol  13 - II.pdf');
      assert.ok(vol13, 'Must match book with double spaces in filename');
    });

    it('B3.4 should preserve exact double space when resolving filesystem streaming path', () => {
      const resolved = resolveSafeBookPath('Core Java Vol  13 - II.pdf', BOOKS_DIR);
      assert.ok(fs.existsSync(resolved));
      const stat = fs.statSync(resolved);
      assert.equal(stat.size, 28959763);
    });

    it('B3.5 should infer Volume II and 13th Edition correctly despite double space', () => {
      const meta = inferBookMeta('Core Java Vol  13 - II.pdf');
      assert.ok(meta.volume?.includes('II') || meta.title.includes('II'));
      assert.ok(meta.tags.includes('Advanced'));
    });
  });

  // --- Boundary 4: Very Large PDF Handling (>150MB) ---
  describe('Boundary 4: Very Large PDF Handling (>150MB)', () => {
    const largePdf = path.join(BOOKS_DIR, 'head-first-java.pdf');

    it('B4.1 should confirm file size exceeds 150MB (163,529,269 bytes)', () => {
      const stat = fs.statSync(largePdf);
      assert.equal(stat.size, 163529269);
      assert.ok(stat.size > 150 * 1024 * 1024);
    });

    it('B4.2 should read 64KB chunks cleanly without memory spike', () => {
      const fd = fs.openSync(largePdf, 'r');
      const chunkSize = 64 * 1024;
      const buf = Buffer.alloc(chunkSize);
      const bytesRead = fs.readSync(fd, buf, 0, chunkSize, 0);
      fs.closeSync(fd);
      assert.equal(bytesRead, chunkSize);
      assert.ok(buf.toString('utf8').startsWith('%PDF-'));
    });

    it('B4.3 should retrieve range bytes from middle of 163MB file', () => {
      const fd = fs.openSync(largePdf, 'r');
      const midOffset = 80 * 1024 * 1024; // 80MB offset
      const buf = Buffer.alloc(1024);
      const bytesRead = fs.readSync(fd, buf, 0, 1024, midOffset);
      fs.closeSync(fd);
      assert.equal(bytesRead, 1024);
    });

    it('B4.4 should retrieve range bytes from EOF (last 1024 bytes)', () => {
      const stat = fs.statSync(largePdf);
      const fd = fs.openSync(largePdf, 'r');
      const endOffset = stat.size - 1024;
      const buf = Buffer.alloc(1024);
      const bytesRead = fs.readSync(fd, buf, 0, 1024, endOffset);
      fs.closeSync(fd);
      assert.equal(bytesRead, 1024);
      assert.ok(buf.toString('utf8').includes('%%EOF'));
    });

    it('B4.5 should format file size accurately as MB string (e.g. 155.95 MB)', () => {
      const stat = fs.statSync(largePdf);
      const mb = (stat.size / (1024 * 1024)).toFixed(2);
      assert.equal(mb, '155.95');
    });
  });

  // --- Boundary 5: Path Traversal Attack Variations ---
  describe('Boundary 5: Path Traversal Attack Variations', () => {
    it('B5.1 should reject deep directory traversal ../../../../../../../../etc/shadow', () => {
      const safe = resolveSafeBookPath('../../../../../../../../etc/shadow', BOOKS_DIR);
      assert.ok(safe.startsWith(path.resolve(BOOKS_DIR)));
    });

    it('B5.2 should reject URL-encoded dot-dot-slash (%2e%2e%2f)', () => {
      const decoded = decodeURIComponent('%2e%2e%2f%2e%2e%2fetc/passwd');
      const safe = resolveSafeBookPath(decoded, BOOKS_DIR);
      assert.ok(safe.startsWith(path.resolve(BOOKS_DIR)));
    });

    it('B5.3 should reject null-byte injection attempt (test.pdf\\0/etc/passwd)', () => {
      assert.throws(() => {
        resolveSafeBookPath('test.pdf\0/etc/passwd', BOOKS_DIR);
      }, /Invalid character/);
    });

    it('B5.4 should reject direct root paths (/etc/hosts)', () => {
      assert.throws(() => {
        resolveSafeBookPath('/etc/hosts', BOOKS_DIR);
      }, /Path traversal/);
    });

    it('B5.5 should normalize mixed forward/backward slashes on Linux', () => {
      const mixed = 'subfolder\\..\\head-first-java.pdf';
      const safe = resolveSafeBookPath(mixed, BOOKS_DIR);
      assert.ok(safe.startsWith(path.resolve(BOOKS_DIR)));
    });
  });

  // --- Boundary 6: Empty Search Query, Non-Matching, & Regex Meta-Characters ---
  describe('Boundary 6: Search Edge Cases & Meta-Characters', () => {
    const books = scanBooks();

    it('B6.1 should return all catalog books when search query is empty string', () => {
      const res = searchAndFilterBooks(books, { q: '' });
      assert.equal(res.length, books.length);
    });

    it('B6.2 should return all catalog books when search query is whitespace only', () => {
      const res = searchAndFilterBooks(books, { q: '   \t  \n  ' });
      assert.equal(res.length, books.length);
    });

    it('B6.3 should return empty array for non-matching search term', () => {
      const res = searchAndFilterBooks(books, { q: 'xyz_quantum_entanglement_nonexistent' });
      assert.equal(res.length, 0);
    });

    it('B6.4 should handle regex meta-characters without syntax crash ([.*+?^${}()|\\])', () => {
      const scaryQuery = '[.*+?^${}()|\\]\\\\';
      assert.doesNotThrow(() => {
        const res = searchAndFilterBooks(books, { q: scaryQuery });
        assert.ok(Array.isArray(res));
      });
    });

    it('B6.5 should handle mixed case search queries (jAvA, HoRsTmAnN)', () => {
      const res1 = searchAndFilterBooks(books, { q: 'jAvA' });
      const res2 = searchAndFilterBooks(books, { q: 'JAVA' });
      assert.equal(res1.length, res2.length);
      assert.ok(res1.length > 0);
    });
  });

  // --- Boundary 7: Corrupt or Non-PDF File Upload Rejection ---
  describe('Boundary 7: Corrupt or Non-PDF Upload Rejection', () => {
    it('B7.1 should reject zero-byte PDF upload', () => {
      const res = validatePdfUpload('empty.pdf', Buffer.alloc(0));
      assert.equal(res.valid, false);
      assert.equal(res.error, 'Uploaded file is empty');
    });

    it('B7.2 should reject plain text file with .pdf extension', () => {
      const res = validatePdfUpload('fake.pdf', Buffer.from('Hello world this is plain text'));
      assert.equal(res.valid, false);
      assert.equal(res.error, 'Invalid PDF file format');
    });

    it('B7.3 should reject executable script file', () => {
      const res = validatePdfUpload('payload.sh', Buffer.from('#!/bin/bash\nrm -rf /'));
      assert.equal(res.valid, false);
      assert.equal(res.error, 'Only PDF files are allowed');
    });

    it('B7.4 should accept genuine PDF file with %PDF- header', () => {
      const validPdf = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
      const res = validatePdfUpload('genuine.pdf', validPdf);
      assert.equal(res.valid, true);
    });

    it('B7.5 should reject PNG/JPEG image spoofed with .pdf extension', () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const res = validatePdfUpload('spoofed.pdf', pngHeader);
      assert.equal(res.valid, false);
      assert.equal(res.error, 'Invalid PDF file format');
    });
  });

  // --- Boundary 8: Multi-chapter Folders with Missing Front/Back Matter ---
  describe('Boundary 8: Folders with Missing Sections', () => {
    it('B8.1 should handle folder without separate Preface (14th Ed Vol 1)', () => {
      const books = scanBooks();
      const book = books.find(b => b.folder === 'Code Java Vol. I_Fundamentals, 14th Edition');
      assert.ok(book && book.chapters);
      const hasPreface = book.chapters.some(c => c.title.toLowerCase().includes('preface'));
      assert.equal(hasPreface, false, '14th Ed Vol 1 does not have a separate preface');
      assert.equal(book.chapters[0].chapterNumber, 1, 'First item must be Chapter 1');
    });

    it('B8.2 should handle folder without Index (14th Ed Vol 1)', () => {
      const books = scanBooks();
      const book = books.find(b => b.folder === 'Code Java Vol. I_Fundamentals, 14th Edition');
      assert.ok(book && book.chapters);
      const hasIndex = book.chapters.some(c => c.title.toLowerCase().includes('index'));
      assert.equal(hasIndex, false);
      const last = book.chapters[book.chapters.length - 1];
      assert.equal(last.title, 'Appendix');
    });

    it('B8.3 should handle folder without Appendix (Core Java Vol 2 14th edition)', () => {
      const books = scanBooks();
      const book = books.find(b => b.folder === 'Core Java Vol 2 14th edition');
      assert.ok(book && book.chapters);
      const hasAppendix = book.chapters.some(c => c.title.toLowerCase().includes('appendix'));
      assert.equal(hasAppendix, false);
    });

    it('B8.4 should maintain strict chapter monotonicity despite missing front matter', () => {
      const books = scanBooks();
      const book = books.find(b => b.folder === 'Code Java Vol. I_Fundamentals, 14th Edition');
      assert.ok(book && book.chapters);
      for (let i = 0; i < book.chapters.length - 2; i++) {
        const cur = book.chapters[i].chapterNumber;
        const next = book.chapters[i + 1].chapterNumber;
        if (cur !== undefined && next !== undefined) {
          assert.equal(next, cur + 1);
        }
      }
    });

    it('B8.5 should successfully calculate total chapters count for variable-length books', () => {
      const books = scanBooks();
      for (const b of books.filter(x => x.isMultiChapter)) {
        assert.ok(b.chapters && b.chapters.length > 0, `Book ${b.id} must contain chapters`);
        assert.equal(
          b.chapters.length,
          b.totalChapters || b.chapters.length,
          `Book ${b.id} totalChapters must equal chapters array length`
        );
        assert.ok(
          b.chapters.length <= 100,
          `Book ${b.id} has excessive chapter count (${b.chapters.length})`
        );
      }
    });
  });

  // --- Boundary 9: Single-File Book Progress Calculations ---
  describe('Boundary 9: Single-File Book Progress Calculations', () => {
    it('B9.1 should calculate page 1 progress correctly (clamped to at least 0% or proportional)', () => {
      const p = computeReadingProgress(1, 100);
      assert.equal(p.page, 1);
      assert.equal(p.percentage, 1);
    });

    it('B9.2 should calculate 50% midpoint accurately', () => {
      const p = computeReadingProgress(50, 100);
      assert.equal(p.page, 50);
      assert.equal(p.percentage, 50);
    });

    it('B9.3 should calculate last page as 100% completed', () => {
      const p = computeReadingProgress(100, 100);
      assert.equal(p.page, 100);
      assert.equal(p.percentage, 100);
    });

    it('B9.4 should clamp negative or 0 page input to page 1', () => {
      const pZero = computeReadingProgress(0, 100);
      assert.equal(pZero.page, 1);
      const pNeg = computeReadingProgress(-15, 100);
      assert.equal(pNeg.page, 1);
    });

    it('B9.5 should clamp excessive page numbers to totalPages (max page)', () => {
      const p = computeReadingProgress(9999, 100);
      assert.equal(p.page, 100);
      assert.equal(p.percentage, 100);
    });
  });

  // --- Boundary 10: LocalStorage Edge Cases & Fallbacks ---
  describe('Boundary 10: LocalStorage Edge Cases & Fallbacks', () => {
    it('B10.1 should recover gracefully from corrupt non-JSON strings', () => {
      const res = parseProgressPayload('CORRUPTED_JSON_{[[', 'book-1');
      assert.equal(res.bookId, 'book-1');
      assert.equal(res.page, 1);
      assert.deepEqual(res.completedChapters, []);
    });

    it('B10.2 should backfill missing fields from partial objects', () => {
      const partial = JSON.stringify({ page: 12 });
      const res = parseProgressPayload(partial, 'book-1');
      assert.equal(res.page, 12);
      assert.deepEqual(res.completedChapters, []);
      assert.equal(res.percentage, 0);
    });

    it('B10.3 should clamp invalid percentage values (e.g. -50 or 500) to 0-100', () => {
      const neg = JSON.stringify({ percentage: -50 });
      assert.equal(parseProgressPayload(neg, 'b1').percentage, 0);
      const high = JSON.stringify({ percentage: 500 });
      assert.equal(parseProgressPayload(high, 'b1').percentage, 100);
    });

    it('B10.4 should fall back to default theme when unknown theme string is provided', () => {
      const settings = sanitizeReaderSettings({ theme: 'neon-pink' as any });
      assert.equal(settings.theme, DEFAULT_READER_SETTINGS.theme);
    });

    it('B10.5 should fall back to standard reader width when unknown width is provided', () => {
      const settings = sanitizeReaderSettings({ readerWidth: 'ultra-wide' as any });
      assert.equal(settings.readerWidth, DEFAULT_READER_SETTINGS.readerWidth);
    });
  });

  // --- Boundary 11: HTTP Range Request Boundary Conditions ---
  describe('Boundary 11: HTTP Range Request Boundary Conditions', () => {
    const samplePdf = path.join(BOOKS_DIR, 'Core Java Vol 12 - I.pdf');
    const fileSize = fs.statSync(samplePdf).size;

    it('B11.1 should satisfy single-byte range request bytes=0-0', () => {
      const res = parseRange('bytes=0-0', fileSize);
      assert.equal(res.valid, true);
      assert.equal(res.start, 0);
      assert.equal(res.end, 0);
    });

    it('B11.2 should satisfy suffix range bytes=-500 (last 500 bytes)', () => {
      const res = parseRange('bytes=-500', fileSize);
      assert.equal(res.valid, true);
      assert.equal(res.start, fileSize - 500);
      assert.equal(res.end, fileSize - 1);
    });

    it('B11.3 should satisfy open-ended range bytes=1000-', () => {
      const res = parseRange('bytes=1000-', fileSize);
      assert.equal(res.valid, true);
      assert.equal(res.start, 1000);
      assert.equal(res.end, fileSize - 1);
    });

    it('B11.4 should identify unsatisfiable range bytes=999999999- beyond file size', () => {
      const res = parseRange('bytes=999999999-', fileSize);
      assert.equal(res.valid, false);
      assert.equal(res.unsatisfiable, true);
    });

    it('B11.5 should treat malformed range header as full file request', () => {
      const res = parseRange('bytes=invalid-range', fileSize);
      assert.equal(res.valid, false);
      assert.equal(res.unsatisfiable, false);
      assert.equal(res.start, 0);
      assert.equal(res.end, fileSize - 1);
    });
  });

  // --- Boundary 12: Filename Collision & Title Sanitization ---
  describe('Boundary 12: Filename Collision & Title Sanitization', () => {
    it('B12.1 should generate unique destination path when file already exists', () => {
      const existing = 'Core Java Vol 12 - I.pdf';
      const safe = getCollisionSafePath(BOOKS_DIR, existing);
      assert.ok(safe.finalName.includes(' (1).pdf') || safe.finalName.includes(' (2).pdf'));
      assert.ok(!fs.existsSync(safe.destPath));
    });

    it('B12.2 should sanitize unicode emojis and control characters from book titles', () => {
      const clean = sanitizeUploadTitle('🚀 Mastering Java 21 🔥');
      assert.equal(clean, 'Mastering Java 21');
    });

    it('B12.3 should safely truncate extremely long titles to 100 characters', () => {
      const longTitle = 'A'.repeat(250);
      const truncated = sanitizeUploadTitle(longTitle);
      assert.equal(truncated.length, 100);
    });

    it('B12.4 should handle title containing reserved filesystem characters (/\\:*?"<>|)', () => {
      const sanitized = sanitizeUploadTitle('Java 21: The Good, The Bad & The <Ugly>?');
      assert.ok(!sanitized.includes(':'));
      assert.ok(!sanitized.includes('?'));
      assert.ok(!sanitized.includes('<'));
    });

    it('B12.5 should preserve file extension .pdf strictly in lowercase', () => {
      const normalized = normalizePdfFilename('NEW_BOOK.PDF');
      assert.ok(normalized.endsWith('.pdf'));
      assert.ok(!normalized.endsWith('.PDF'));
    });
  });

  // --- Boundary 13: Extremely Long Queries & Control Characters ---
  describe('Boundary 13: Extremely Long Queries & Special Input', () => {
    const books = scanBooks();

    it('B13.1 should process 1000-character long search query without crashing', () => {
      const longQuery = 'java '.repeat(200);
      assert.doesNotThrow(() => {
        const res = searchAndFilterBooks(books, { q: longQuery });
        assert.ok(Array.isArray(res));
      });
    });

    it('B13.2 should handle null character \\0 in search query without crashing', () => {
      const nullQuery = 'java\0script';
      assert.doesNotThrow(() => {
        const res = searchAndFilterBooks(books, { q: nullQuery });
        assert.ok(Array.isArray(res));
      });
      assert.equal(sanitizeUploadTitle(nullQuery), 'javascript');
    });

    it('B13.3 should strip newline and tab characters from search query and normalize whitespace', () => {
      const dirty = '\t\n  Core Java  \r\n';
      const clean = normalizeString(dirty);
      assert.equal(clean, 'Core Java');
      const res = searchAndFilterBooks(books, { q: dirty });
      assert.ok(res.length >= 7, 'Normalized search should match Core Java books');
    });

    it('B13.4 should treat HTML script tags as literal search text', () => {
      const xssQuery = '<script>alert("hack")</script>';
      const res = searchAndFilterBooks(books, { q: xssQuery });
      assert.equal(res.length, 0);
    });

    it('B13.5 should safely search queries with quotes and apostrophes ("O\'Reilly")', () => {
      const res = searchAndFilterBooks(books, { q: "O'Reilly" });
      assert.ok(res.length >= 1, "Should find books published by O'Reilly");
    });
  });

  // --- Boundary 14: Color Mode CSS Boundaries & Hex Values ---
  describe('Boundary 14: Color Mode CSS Boundaries & Hex Values', () => {
    it('B14.1 should assert Sepia background is strictly #fdfbf7', () => {
      assert.equal(THEME_STYLES.sepia.bg, '#fdfbf7');
    });

    it('B14.2 should assert Dark background is strictly #1a1a2e', () => {
      assert.equal(THEME_STYLES.dark.bg, '#1a1a2e');
    });

    it('B14.3 should assert Light background is strictly #ffffff', () => {
      assert.equal(THEME_STYLES.light.bg, '#ffffff');
    });

    it('B14.4 should verify Dark mode text color (#e2e8f0) has high contrast with dark background', () => {
      assert.equal(THEME_STYLES.dark.text, '#e2e8f0');
      const bgHex = parseInt(THEME_STYLES.dark.bg.replace('#', '').substring(0, 2), 16);
      const textHex = parseInt(THEME_STYLES.dark.text.replace('#', '').substring(0, 2), 16);
      assert.ok(textHex - bgHex > 150, 'Text must have strong luminance difference');
    });

    it('B14.5 should verify Sepia mode text color (#433422) provides warm readable contrast', () => {
      assert.equal(THEME_STYLES.sepia.text, '#433422');
      assert.match(THEME_STYLES.sepia.text, /^#[0-9a-fA-F]{6}$/);
    });
  });

  // --- Boundary 15: Trailing Sections & Unrecognized Front Matter ---
  describe('Boundary 15: Trailing Sections & Fallback Sort Tiers', () => {
    it('B15.1 should assign Priority 7 to unrecognized back matter sections', () => {
      const key = getChapterSortKey('Glossary and Resources _ Book.pdf', 'Book');
      assert.equal(key.priority, 7);
      assert.equal(key.title, 'Glossary and Resources');
    });

    it('B15.2 should assign Priority 1 to files matching book title exactly', () => {
      const key = getChapterSortKey('Core Java for the Impatient, 4th Edition.pdf', 'Core Java for the Impatient, 4th Edition');
      assert.equal(key.priority, 1);
      assert.equal(key.title, 'Title & Copyright');
    });

    it('B15.3 should assign Priority 2 to "Tables of Content" variation', () => {
      const key = getChapterSortKey('Tables of Content Core Java for the Impatient, 4th Edition.pdf', 'Folder');
      assert.equal(key.priority, 2);
      assert.equal(key.title, 'Table of Contents');
    });

    it('B15.4 should parse both "1. Title" and "Chapter 1. Title" as chapterNumber 1', () => {
      const keyA = getChapterSortKey('1. Intro _ Book.pdf', 'Book');
      const keyB = getChapterSortKey('Chapter 1. Streams _ Book.pdf', 'Book');
      assert.equal(keyA.priority, 4);
      assert.equal(keyB.priority, 4);
      assert.equal(keyA.number, 1);
      assert.equal(keyB.number, 1);
    });

    it('B15.5 should strip " _ Book Title" suffix cleanly from chapter title', () => {
      const key = getChapterSortKey('4. Networking _ Core Java, Volume II_ Advanced Features, 14th Edition.pdf', 'Folder');
      assert.equal(key.title, '4. Networking');
    });
  });

});
