import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {
  scanBooks,
  getBookById,
  resolveSafeBookPath,
  invalidateScannerCache,
  getBooksRoot,
  searchAndFilterBooks,
  getChapterSortKey,
} from '../../src/lib/scanner.ts';

describe('Empirical Challenger Suite: Path Traversal Security', () => {
  const root = getBooksRoot();

  it('1.1 should confine standard relative traversal ../../etc/passwd inside root', () => {
    const resolved = resolveSafeBookPath('../../etc/passwd', root);
    assert.ok(
      resolved.startsWith(root),
      `Path must be confined inside root. Got: ${resolved}`
    );
    assert.equal(
      resolved,
      path.resolve(root, 'etc/passwd'),
      'Leading ../ should be stripped, resolving to root/etc/passwd'
    );
  });

  it('1.2 should confine deep directory traversal ../../../../../../../../etc/shadow', () => {
    const resolved = resolveSafeBookPath('../../../../../../../../etc/shadow', root);
    assert.ok(resolved.startsWith(root));
    assert.equal(resolved, path.resolve(root, 'etc/shadow'));
  });

  it('1.3 should handle ../Books/../ safely and remain confined to root', () => {
    const resolved = resolveSafeBookPath('../Books/../', root);
    assert.ok(resolved.startsWith(root));
    assert.equal(resolved, root);
  });

  it('1.4 should reject or confine URL-encoded traversals (%2e%2e%2f, %252e)', () => {
    // When decoded
    const decoded = decodeURIComponent('%2e%2e%2f%2e%2e%2fetc%2fpasswd');
    const resDecoded = resolveSafeBookPath(decoded, root);
    assert.ok(resDecoded.startsWith(root));

    // When raw encoded (treated literally as filename inside root)
    const rawEncoded = '%2e%2e%2f%2e%2e%2fetc%2fpasswd';
    const resRaw = resolveSafeBookPath(rawEncoded, root);
    assert.ok(resRaw.startsWith(root));
  });

  it('1.5 should strictly reject null byte injections in all positions', () => {
    const nullPayloads = [
      'test.pdf\0/../../etc/passwd',
      '\0/etc/passwd',
      'subfolder/\0/file.pdf',
      'book.pdf\0',
    ];
    for (const p of nullPayloads) {
      assert.throws(
        () => resolveSafeBookPath(p, root),
        /Access Denied|Invalid character/,
        `Should throw for null byte payload: ${p}`
      );
    }
  });

  it('1.6 should strictly reject absolute path traversals outside root', () => {
    const absolutePaths = [
      '/etc/passwd',
      '/etc/shadow',
      '/var/log/syslog',
      '/home',
      '/tmp/evil.sh',
      '/root/.ssh/id_rsa',
    ];
    for (const p of absolutePaths) {
      assert.throws(
        () => resolveSafeBookPath(p, root),
        /Access Denied|Path traversal/,
        `Should throw for absolute path: ${p}`
      );
    }
  });

  it('1.7 should evaluate sibling prefix directory behavior (boundary robustness)', () => {
    // Test if passing a path like /path/to/Books-backup/evil.pdf can escape
    const siblingDir = root + '-backup';
    const siblingFile = path.join(siblingDir, 'evil.pdf');

    // If resolveSafeBookPath uses resolved.startsWith(root) without path.sep,
    // this would be allowed unless checked with separator.
    let allowed = false;
    try {
      const res = resolveSafeBookPath(siblingFile, root);
      // Check if it really escaped root
      if (res !== root && !res.startsWith(root + path.sep)) {
        allowed = true; // Escaped boundary!
      }
    } catch {
      allowed = false; // Successfully blocked
    }

    // We record this empirical observation
    console.log(`[CHALLENGER METRIC] Sibling directory prefix bypass test: escaped=${allowed}`);
    // A strict implementation should prevent sibling directory escape
    // Note: If allowed is true, this is an empirical finding for handoff report.
  });

  it('1.8 should resolve valid book and chapter paths safely', () => {
    const valid1 = resolveSafeBookPath('head-first-java.pdf', root);
    assert.equal(valid1, path.join(root, 'head-first-java.pdf'));

    const valid2 = resolveSafeBookPath('Core Java Vol 2 14th edition/1. Streams.pdf', root);
    assert.equal(valid2, path.join(root, 'Core Java Vol 2 14th edition/1. Streams.pdf'));
  });
});

describe('Empirical Challenger Suite: Concurrency Safety & Scanner Performance', () => {
  it('2.1 should handle 100 rapid concurrent scanBooks calls consistently', async () => {
    invalidateScannerCache();
    const t0 = performance.now();

    // Launch 100 concurrent scanner reads
    const promises = Array.from({ length: 100 }, async (_, i) => {
      const books = scanBooks();
      return { index: i, count: books.length, firstId: books[0]?.id };
    });

    const results = await Promise.all(promises);
    const duration = performance.now() - t0;

    assert.equal(results.length, 100);
    const expectedCount = results[0].count;
    const expectedFirstId = results[0].firstId;

    for (const r of results) {
      assert.equal(r.count, expectedCount, `Result ${r.index} had inconsistent count`);
      assert.equal(r.firstId, expectedFirstId, `Result ${r.index} had inconsistent firstId`);
    }

    console.log(`[CHALLENGER METRIC] 100 concurrent scanBooks completed in ${duration.toFixed(2)}ms (avg ${(duration / 100).toFixed(3)}ms/call)`);
    assert.ok(duration < 15000, `Concurrent scan must complete within 15s, took ${duration}ms`);
  });

  it('2.2 should handle rapid concurrent lookups across getBookById', async () => {
    const books = scanBooks();
    const ids = books.map(b => b.id);
    assert.ok(ids.length > 0);

    const t0 = performance.now();
    const lookups = Array.from({ length: 200 }, async (_, i) => {
      const targetId = ids[i % ids.length];
      const found = getBookById(targetId);
      assert.ok(found !== null, `Lookup failed for id ${targetId}`);
      assert.equal(found?.id, targetId);
      return found?.id;
    });

    await Promise.all(lookups);
    const duration = performance.now() - t0;
    console.log(`[CHALLENGER METRIC] 200 concurrent getBookById lookups completed in ${duration.toFixed(2)}ms`);
    assert.ok(duration < 2000, `200 lookups should be near instantaneous under cache, took ${duration}ms`);
  });

  it('2.3 should preserve consistency under interleaved cache invalidation and queries', async () => {
    const t0 = performance.now();
    const tasks: Promise<any>[] = [];

    for (let i = 0; i < 20; i++) {
      if (i % 5 === 0) {
        tasks.push(
          (async () => {
            invalidateScannerCache();
            return { action: 'invalidate', index: i };
          })()
        );
      } else {
        tasks.push(
          (async () => {
            const b = scanBooks();
            return { action: 'scan', count: b.length, index: i };
          })()
        );
      }
    }

    const res = await Promise.all(tasks);
    const duration = performance.now() - t0;
    console.log(`[CHALLENGER METRIC] 20 interleaved invalidations and scans completed in ${duration.toFixed(2)}ms`);
    assert.equal(res.length, 20);
    // Final check
    const finalBooks = scanBooks();
    assert.ok(finalBooks.length >= 8);
  });
});

describe('Empirical Challenger Suite: Chapter Lists & Book Integrity', () => {
  it('3.1 should verify the authoritative 8 books exist and have valid structure', () => {
    const books = scanBooks();
    assert.ok(books.length >= 8, `Expected at least 8 books, got ${books.length}`);

    // Check the 8 core books
    const expectedCoreBooks = [
      { idMatch: 'code-java-vol-i-fundamentals-14th-edition', multi: true, minChapters: 10 },
      { idMatch: 'core-java-vol-2-14th-edition', multi: true, minChapters: 10 },
      { idMatch: 'impatient', multi: true, minChapters: 10 },
      { idMatch: 'core-java-vol-ii-advanced-features-12th-edition', multi: true, minChapters: 10 },
      { idMatch: 'core-java-volume-i-fundamentals-13th-edition', multi: true, minChapters: 10 },
      { idMatch: 'head-first-java', multi: false, minChapters: 0 },
      { idMatch: 'core-java-vol-12-i', multi: false, minChapters: 0 },
      { idMatch: 'core-java-vol-13-ii', multi: false, minChapters: 0 },
    ];

    for (const expected of expectedCoreBooks) {
      const book = books.find(b => b.id.includes(expected.idMatch));
      assert.ok(book, `Core book matching "${expected.idMatch}" must exist in catalog`);
      assert.equal(
        book.isMultiChapter,
        expected.multi,
        `Book ${book.id} multi-chapter status mismatch: expected ${expected.multi}, got ${book.isMultiChapter}`
      );

      if (expected.multi) {
        assert.ok(book.chapters && book.chapters.length >= expected.minChapters);
      } else {
        assert.ok(book.totalPages > 0, `Single PDF book ${book.id} must have totalPages > 0`);
        assert.ok(book.totalSize > 0, `Single PDF book ${book.id} must have positive file size`);
        assert.ok(fs.existsSync(book.storagePath), `File must exist at ${book.storagePath}`);
      }
    }
  });

  it('3.2 should verify chapter lists are non-empty, sequential, and valid for all multi-chapter books', () => {
    const books = scanBooks();
    const multiBooks = books.filter(b => b.isMultiChapter);
    console.log(`[CHALLENGER METRIC] Total multi-chapter books discovered: ${multiBooks.length}`);
    assert.ok(multiBooks.length >= 5, `Expected >= 5 multi-chapter books, got ${multiBooks.length}`);

    for (const book of multiBooks) {
      assert.ok(book.chapters, `Book ${book.id} missing chapters property`);
      assert.ok(book.chapters.length > 0, `Book ${book.id} has empty chapters array`);

      const chapters = book.chapters;

      // 1. Strict 1..N order with no duplicates or gaps
      for (let idx = 0; idx < chapters.length; idx++) {
        const ch = chapters[idx];
        assert.equal(
          ch.order,
          idx + 1,
          `Book ${book.id} chapter "${ch.title}" has order ${ch.order}, expected ${idx + 1}`
        );

        // 2. File must exist on disk and be non-empty
        const chPath = path.join(book.storagePath, ch.filename);
        assert.ok(
          fs.existsSync(chPath),
          `Book ${book.id} chapter file does not exist: ${chPath}`
        );
        const stat = fs.statSync(chPath);
        assert.ok(
          stat.size > 0,
          `Book ${book.id} chapter file ${ch.filename} is 0 bytes`
        );
      }

      // 3. Monotonic priority progression
      for (let idx = 0; idx < chapters.length - 1; idx++) {
        const curr = chapters[idx];
        const next = chapters[idx + 1];

        // Exception check: verify priority ordering
        assert.ok(
          curr.priority <= next.priority,
          `Priority inverted in ${book.id}: [${curr.order}] "${curr.title}" (tier ${curr.priority}) vs [${next.order}] "${next.title}" (tier ${next.priority})`
        );

        // 4. Numbered chapters within Tier 4 must be strictly increasing
        if (curr.priority === 4 && next.priority === 4) {
          if (curr.chapterNumber !== undefined && next.chapterNumber !== undefined) {
            assert.ok(
              curr.chapterNumber < next.chapterNumber,
              `Chapter number inverted in ${book.id}: Chapter ${curr.chapterNumber} ("${curr.title}") before Chapter ${next.chapterNumber} ("${next.title}")`
            );
          }
        }
      }

      // 5. Structure sanity: Preface should be before Chapter 1
      const preface = chapters.find(c => c.priority === 3);
      const ch1 = chapters.find(c => c.priority === 4 && c.chapterNumber === 1);
      if (preface && ch1) {
        assert.ok(
          preface.order < ch1.order,
          `Preface (order ${preface.order}) should precede Chapter 1 (order ${ch1.order}) in ${book.id}`
        );
      }

      // 6. Structure sanity: Index (Tier 6) should be after all numbered chapters (Tier 4)
      const index = chapters.find(c => c.priority === 6);
      const lastNumbered = [...chapters].reverse().find(c => c.priority === 4);
      if (index && lastNumbered) {
        assert.ok(
          index.order > lastNumbered.order,
          `Index (order ${index.order}) should follow last numbered chapter (order ${lastNumbered.order}) in ${book.id}`
        );
      }
    }
  });

  it('3.3 should verify all single-file PDF books exist, are non-empty, and have valid page counts', () => {
    const books = scanBooks();
    const singlePdfBooks = books.filter(b => !b.isMultiChapter);
    assert.ok(singlePdfBooks.length >= 3, `Expected at least 3 single PDF books, got ${singlePdfBooks.length}`);

    for (const book of singlePdfBooks) {
      assert.ok(fs.existsSync(book.storagePath), `Single PDF missing: ${book.storagePath}`);
      const stat = fs.statSync(book.storagePath);
      assert.ok(stat.size > 1000, `Single PDF ${book.id} file is suspiciously small (${stat.size} bytes)`);
      assert.ok(book.totalPages > 0, `Single PDF ${book.id} must have totalPages > 0`);
      console.log(`[CHALLENGER METRIC] Single book verified: "${book.title}", size=${(stat.size / 1024 / 1024).toFixed(1)}MB, pages=${book.totalPages}`);
    }
  });
});
