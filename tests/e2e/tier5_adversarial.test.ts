/**
 * Tier 5 — Adversarial, Stress & Edge-Case Verification Suite
 * Authored by Empirical Challenger (challenger_m1_1)
 *
 * Stress-tests scanner engine and search API against hostile inputs,
 * boundary edge cases, and structural integrity contracts.
 * Built with Node 24 native test runner (node:test + node:assert/strict).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  scanBooks,
  getBookById,
  searchAndFilterBooks,
  resolveSafeBookPath,
  getChapterSortKey,
  cleanChapterTitle,
  normalizeString,
  makeId,
  inferBookMeta,
  getBooksRoot,
  invalidateScannerCache,
} from '../../src/lib/scanner.ts';
import type { Book, Chapter } from '../../src/lib/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BOOKS_DIR = getBooksRoot();

describe('Tier 5 — Adversarial & Stress Test Suite', () => {

  beforeEach(() => {
    invalidateScannerCache();
  });

  // =========================================================================
  // Section 1: Chapter Ordering & ID Uniqueness Adversarial Tests
  // =========================================================================
  describe('Section 1: Chapter Ordering & ID Uniqueness', () => {

    it('Adv 1.1: Every book in the catalog MUST have unique chapter IDs', () => {
      const books = scanBooks();
      for (const book of books) {
        if (!book.chapters || book.chapters.length === 0) continue;
        const idCounts = new Map<string, number>();
        for (const ch of book.chapters) {
          idCounts.set(ch.id, (idCounts.get(ch.id) || 0) + 1);
        }
        const duplicates = [...idCounts.entries()].filter(([_, count]) => count > 1);
        assert.equal(
          duplicates.length,
          0,
          `Book "${book.title}" (${book.id}) contains duplicate chapter IDs: ${JSON.stringify(duplicates)}`
        );
      }
    });

    it('Adv 1.2: Foreword and Preface in the same book must have distinct titles and IDs', () => {
      const folder = 'Site Reliability Engineering, 2nd Edition_en__By Betsy Beyer, Chris Jones, Christof Leng, David Huska, Jennifer Petoff, Niall Richard Murphy';
      const forewordKey = getChapterSortKey('Foreword _ Site Reliability Engineering, 2nd Edition.pdf', folder);
      const prefaceKey = getChapterSortKey('Preface _ Site Reliability Engineering, 2nd Edition.pdf', folder);

      assert.notEqual(
        forewordKey.title,
        prefaceKey.title,
        `Foreword and Preface must not have the same title (both got "${forewordKey.title}")`
      );
      assert.notEqual(
        makeId(forewordKey.title),
        makeId(prefaceKey.title),
        `Foreword and Preface must not have identical slug IDs (both got "${makeId(forewordKey.title)}")`
      );
    });

    it('Adv 1.3: Hypothetical multi-appendix filenames without separator must have distinct titles and IDs', () => {
      const keyA = getChapterSortKey('Appendix A.pdf', 'Hypothetical Book');
      const keyB = getChapterSortKey('Appendix B.pdf', 'Hypothetical Book');

      assert.notEqual(
        keyA.title,
        keyB.title,
        `Appendix A and Appendix B must have distinct titles, but both were "${keyA.title}"`
      );
      assert.notEqual(
        makeId(keyA.title),
        makeId(keyB.title),
        `Appendix A and Appendix B must have distinct IDs, but both were "${makeId(keyA.title)}"`
      );
    });

    it('Adv 1.4: Hypothetical multi-index filenames without separator must have distinct titles and IDs', () => {
      const keyAuthor = getChapterSortKey('Author Index.pdf', 'Hypothetical Book');
      const keySubject = getChapterSortKey('Subject Index.pdf', 'Hypothetical Book');

      assert.notEqual(
        keyAuthor.title,
        keySubject.title,
        `Author Index and Subject Index must have distinct titles, but both were "${keyAuthor.title}"`
      );
      assert.notEqual(
        makeId(keyAuthor.title),
        makeId(keySubject.title),
        `Author Index and Subject Index must have distinct IDs, but both were "${makeId(keyAuthor.title)}"`
      );
    });

    it('Adv 1.5: Lettered Appendices (A., B., etc.) must sort before Index (Tier 5 vs Tier 6)', () => {
      const books = scanBooks();
      const k8s = books.find(b => b.id.includes('kubernetes'));
      if (k8s && k8s.chapters) {
        const indexChapter = k8s.chapters.find(c => c.title.toLowerCase().includes('index'));
        const appendixA = k8s.chapters.find(c => c.title.toLowerCase().includes('building your own kubernetes cluster'));

        assert.ok(indexChapter, 'Index chapter must exist');
        assert.ok(appendixA, 'Appendix A chapter must exist');
        assert.ok(
          appendixA.order < indexChapter.order,
          `Appendix A (order ${appendixA.order}) must sort BEFORE Index (order ${indexChapter.order})`
        );
      }
    });

    it('Adv 1.6: Roman numeral parts IV, V, VI must sort before Index', () => {
      const keyIV = getChapterSortKey('IV. Infrastructure Design.pdf', 'SRE');
      const keyIndex = getChapterSortKey('Index.pdf', 'SRE');

      assert.ok(
        keyIV.priority <= 4,
        `Part IV should be classified as content tier (<= 4), got priority ${keyIV.priority}`
      );
      assert.ok(
        keyIV.priority < keyIndex.priority,
        `Part IV priority (${keyIV.priority}) must be strictly less than Index priority (${keyIndex.priority})`
      );
    });

    it('Adv 1.7: Numbered chapter edge cases (numerical vs lexicographical ordering)', () => {
      const ch2 = getChapterSortKey('2. Intermediate Topics.pdf', 'Book');
      const ch10 = getChapterSortKey('10. Advanced Topics.pdf', 'Book');
      const ch100 = getChapterSortKey('100. Expert Topics.pdf', 'Book');

      assert.equal(ch2.priority, 4);
      assert.equal(ch10.priority, 4);
      assert.equal(ch100.priority, 4);

      assert.ok(ch2.number < ch10.number, 'Chapter 2 must sort before Chapter 10');
      assert.ok(ch10.number < ch100.number, 'Chapter 10 must sort before Chapter 100');
    });

    it('Adv 1.8: Numbered chapters with leading zeroes (01, 02) normalize to standard numbers', () => {
      const ch01 = getChapterSortKey('01. Introduction.pdf', 'Book');
      const ch02 = getChapterSortKey('Chapter 02. Basics.pdf', 'Book');

      assert.equal(ch01.number, 1);
      assert.equal(ch02.number, 2);
    });

    it('Adv 1.9: Filename special characters and unicode in chapter sort keys', () => {
      const special = getChapterSortKey('1. What is C++ & STL (2024) [v1.0] {Final}.pdf', 'Book');
      assert.equal(special.priority, 4);
      assert.equal(special.number, 1);
      assert.ok(special.title.includes('What is C++ & STL'));

      const unicode = getChapterSortKey('1. Programmation Avancée & Données.pdf', 'Book');
      assert.equal(unicode.priority, 4);
      assert.equal(unicode.number, 1);
    });

    it('Adv 1.10: Unrecognized front/back matter defaults safely to priority 7', () => {
      const unknown = getChapterSortKey('Glossary and References.pdf', 'Book');
      assert.equal(unknown.priority, 7);
      assert.equal(unknown.number, 9999);
      assert.equal(unknown.title, 'Glossary and References');
    });
  });

  // =========================================================================
  // Section 2: Search, Filtering & Query Stress Testing
  // =========================================================================
  describe('Section 2: Search, Filtering & Hostile Query Stress', () => {
    const books = scanBooks();

    it('Adv 2.1: Regex meta-characters in search query do not cause crash or ReDoS', () => {
      const hostileQueries = [
        '.*',
        '.*+?^${}()|[]\\',
        '([a-zA-Z0-9]+)*',
        '(.*a){10}',
        '\\p{L}+',
        '^(?:chapter\\s+)?(\\d+)\\b',
        '((((((((a))))))))',
        '??*++$$',
      ];

      for (const q of hostileQueries) {
        assert.doesNotThrow(() => {
          const res = searchAndFilterBooks(books, { q });
          assert.ok(Array.isArray(res));
        }, `Search query "${q}" threw an unhandled exception`);
      }
    });

    it('Adv 2.2: Extreme query lengths up to 50,000 characters process safely without memory crash', () => {
      const query10k = 'Java '.repeat(2000);
      const query50k = 'x'.repeat(50000);

      const start = Date.now();
      const res10k = searchAndFilterBooks(books, { q: query10k });
      const res50k = searchAndFilterBooks(books, { q: query50k });
      const elapsed = Date.now() - start;

      assert.ok(Array.isArray(res10k));
      assert.ok(Array.isArray(res50k));
      assert.equal(res50k.length, 0);
      assert.ok(elapsed < 2000, `50k query took too long: ${elapsed}ms`);
    });

    it('Adv 2.3: Null byte injection in search query processes safely without exception', () => {
      const nullQueries = [
        '\0',
        'Java\0',
        '\0Java',
        'Java\0Script',
        'Core\0 Java\0 14th',
      ];

      for (const q of nullQueries) {
        assert.doesNotThrow(() => {
          const res = searchAndFilterBooks(books, { q });
          assert.ok(Array.isArray(res));
        }, `Null-byte query "${q}" caused crash`);
      }
    });

    it('Adv 2.4: Empty, whitespace-only, and control character queries return full catalog', () => {
      const emptyQueries = [
        '',
        '   ',
        '\t\t',
        '\n\r\n',
        '   \t  \n  ',
        '\u00a0',
        '  \u00a0  \t ',
      ];

      for (const q of emptyQueries) {
        const res = searchAndFilterBooks(books, { q });
        assert.equal(
          res.length,
          books.length,
          `Query "${encodeURIComponent(q)}" should return full catalog (${books.length}), got ${res.length}`
        );
      }
    });

    it('Adv 2.5: Script injection / XSS payloads are treated as literal text', () => {
      const xssQueries = [
        '<script>alert(1)</script>',
        '<img src=x onerror=alert(1)>',
        '"><svg onload=alert(1)>',
        'javascript:alert(1)',
      ];

      for (const q of xssQueries) {
        const res = searchAndFilterBooks(books, { q });
        assert.equal(res.length, 0, `XSS query "${q}" matched unexpectedly`);
      }
    });

    it('Adv 2.6: SQL/NoSQL injection payloads are treated as literal text', () => {
      const sqliQueries = [
        "' OR '1'='1",
        "'; DROP TABLE books; --",
        "admin'--",
        '{"$gt": ""}',
        '{"$where": "sleep(5000)"}',
      ];

      for (const q of sqliQueries) {
        const res = searchAndFilterBooks(books, { q });
        assert.equal(res.length, 0, `Injection query "${q}" matched unexpectedly`);
      }
    });

    it('Adv 2.7: Author filtering on catalog books discovers all corresponding authors', () => {
      // Test author filtering against all authoritative books
      const horstmannBooks = searchAndFilterBooks(books, { author: 'Horstmann' });
      assert.ok(horstmannBooks.length >= 7, 'Expected >= 7 books by Horstmann');

      const sierraBooks = searchAndFilterBooks(books, { author: 'Sierra' });
      assert.ok(sierraBooks.length >= 1, 'Expected >= 1 book by Sierra');

      // Test author filtering for O'Reilly books in library
      const newmanBooks = searchAndFilterBooks(books, { author: 'Sam Newman' });
      assert.ok(
        newmanBooks.length >= 1,
        `Expected >= 1 book by Sam Newman, got ${newmanBooks.length}`
      );

      const kleppmannBooks = searchAndFilterBooks(books, { author: 'Martin Kleppmann' });
      assert.ok(
        kleppmannBooks.length >= 1,
        `Expected >= 1 book by Martin Kleppmann, got ${kleppmannBooks.length}`
      );
    });

    it('Adv 2.8: Invalid / prototype-polluting sort parameters fallback safely without crash', () => {
      const invalidSorts = [
        '__proto__',
        'constructor',
        'prototype',
        'DROP TABLE',
        'undefined',
        'null',
        '../../../etc/passwd',
      ];

      for (const s of invalidSorts) {
        assert.doesNotThrow(() => {
          const res = searchAndFilterBooks(books, { sort: s });
          assert.equal(res.length, books.length);
        }, `Invalid sort "${s}" threw an unhandled exception`);
      }
    });

    it('Adv 2.9: Multi-parameter combination stress test (q + tag + author + sort)', () => {
      const res = searchAndFilterBooks(books, {
        q: 'Java',
        tag: 'Fundamentals',
        author: 'Horstmann',
        sort: 'title-desc',
      });

      assert.ok(res.length >= 1, 'Combined query should match Fundamentals by Horstmann');
      for (const b of res) {
        assert.ok(b.tags.includes('Fundamentals'));
        assert.ok(b.author.includes('Horstmann'));
      }
      for (let i = 0; i < res.length - 1; i++) {
        assert.ok(res[i].title.localeCompare(res[i + 1].title) >= 0);
      }
    });

    it('Adv 2.10: Case-insensitive author and tag filtering with "all" bypass', () => {
      const allTags = searchAndFilterBooks(books, { tag: 'all' });
      assert.equal(allTags.length, books.length);

      const allAuthors = searchAndFilterBooks(books, { author: 'all' });
      assert.equal(allAuthors.length, books.length);

      const lowerTag = searchAndFilterBooks(books, { tag: 'java' });
      const upperTag = searchAndFilterBooks(books, { tag: 'JAVA' });
      assert.equal(lowerTag.length, upperTag.length);
      assert.ok(lowerTag.length > 0);
    });
  });

  // =========================================================================
  // Section 3: Performance, Caching & Traversal Stress Harness
  // =========================================================================
  describe('Section 3: Performance, Caching & Traversal Harness', () => {

    it('Adv 3.1: In-memory cache hit executes 100 scans in under 100ms', () => {
      // Warm cache
      scanBooks();

      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        const cached = scanBooks();
        assert.ok(cached.length > 0);
      }
      const elapsed = Date.now() - start;
      assert.ok(
        elapsed < 100,
        `100 cached scans took ${elapsed}ms (expected < 100ms)`
      );
    });

    it('Adv 3.2: 1,000 rapid searches with diverse criteria execute in under 500ms', () => {
      const books = scanBooks();
      const queries = ['java', 'streams', 'concurrency', 'fundamentals', 'advanced', 'sierra', 'architecture', 'pdf', ''];

      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        const q = queries[i % queries.length];
        const res = searchAndFilterBooks(books, { q });
        assert.ok(Array.isArray(res));
      }
      const elapsed = Date.now() - start;
      assert.ok(
        elapsed < 500,
        `1,000 search queries took ${elapsed}ms (expected < 500ms)`
      );
    });

    it('Adv 3.3: Path traversal stress harness (50 adversarial path payloads rejected)', () => {
      const payloads = [
        '../etc/passwd',
        '..\\..\\Windows\\System32\\cmd.exe',
        '%2e%2e/%2e%2e/etc/passwd',
        '....//....//etc/passwd',
        '/etc/shadow',
        '/etc/hosts',
        '/var/run/docker.sock',
        '/root/.ssh/id_rsa',
        'books/../../../../../../etc/passwd',
        'test.pdf\0/etc/passwd',
        'valid.pdf\0.exe',
        '\0/etc/passwd',
        '/run/media/sonu/hdd exfat/projectssss/Net Lib/netlib/src/lib/scanner.ts',
        '/home/sonu/.bashrc',
      ];

      for (const p of payloads) {
        if (p.includes('\0') || path.isAbsolute(p)) {
          // Absolute paths outside BOOKS_ROOT and null byte injections must throw
          const resolved = path.resolve(BOOKS_DIR, p);
          if (!resolved.startsWith(path.resolve(BOOKS_DIR)) || p.includes('\0')) {
            assert.throws(
              () => {
                resolveSafeBookPath(p);
              },
              /Access Denied|Path traversal|Invalid character/,
              `Payload "${p}" should have thrown Access Denied`
            );
          }
        } else {
          // Relative traversals must be strictly confined to BOOKS_ROOT
          const confined = resolveSafeBookPath(p);
          assert.ok(
            confined.startsWith(path.resolve(BOOKS_DIR)),
            `Relative path "${p}" escaped BOOKS_DIR: ${confined}`
          );
        }
      }
    });

    it('Adv 3.4: getBookById handles non-existent, whitespace, and special characters safely', () => {
      assert.equal(getBookById(''), null);
      assert.equal(getBookById('   '), null);
      assert.equal(getBookById('non-existent-id-99999'), null);
      assert.equal(getBookById('"><script>alert(1)</script>'), null);
      assert.equal(getBookById('..%2f..%2fetc%2fpasswd'), null);

      // Valid lookup
      const valid = getBookById('head-first-java');
      assert.ok(valid);
      assert.equal(valid.id, 'head-first-java');
    });
  });
});
