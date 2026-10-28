import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  scanBooks,
  getBookById,
  searchAndFilterBooks,
  getChapterSortKey,
  cleanChapterTitle,
  makeId,
  normalizeString,
  resolveSafeBookPath,
  invalidateScannerCache,
  getBooksRoot,
} from '../../src/lib/scanner.ts';

test('BOOKS_ROOT resolution and environment fallback', () => {
  const root = getBooksRoot();
  assert.ok(root, 'BOOKS_ROOT must not be empty');
  assert.ok(
    root.includes('Books'),
    `Resolved root should point to Books directory, got: ${root}`
  );
});

test('normalizeString handles non-breaking spaces and extra whitespace', () => {
  const withNBSP = '3. Interfaces and Lambda\u00a0Expressions';
  const normalized = normalizeString(withNBSP);
  assert.equal(normalized, '3. Interfaces and Lambda Expressions');
  assert.ok(!normalized.includes('\u00a0'), 'Must not contain non-breaking space');

  const withDoubleSpaces = 'Core  Java   Vol    13  - II.pdf';
  assert.equal(normalizeString(withDoubleSpaces), 'Core Java Vol 13 - II.pdf');
});

test('makeId produces clean, deterministic URL-safe slugs', () => {
  assert.equal(
    makeId('Code Java Vol. I_Fundamentals, 14th Edition'),
    'code-java-vol-i-fundamentals-14th-edition'
  );
  assert.equal(
    makeId('Core Java Vol  13 - II.pdf'),
    'core-java-vol-13-ii'
  );
  assert.equal(
    makeId('3. Interfaces and Lambda\u00a0Expressions _ Core Java...pdf'),
    '3-interfaces-and-lambda-expressions-core-java'
  );
});

test('getChapterSortKey classifies chapters into deterministic 8-tier hierarchy', () => {
  const folder = 'Core Java, Vol. II-Advanced Features, 12th Edition';

  // Tier 0: Cover
  const cover = getChapterSortKey('Cover Page _ Core Java.pdf', folder);
  assert.equal(cover.priority, 0);

  // Tier 1: Title & Copyright
  const title = getChapterSortKey('Core Java for the Impatient, 4th Edition.pdf', 'Core Java for the Impatient, 4th Edition');
  assert.equal(title.priority, 1);

  // Tier 2: Table of Contents
  const toc1 = getChapterSortKey('Contents _ Core Java.pdf', folder);
  assert.equal(toc1.priority, 2);
  const toc2 = getChapterSortKey('Tables of Content Core Java.pdf', folder);
  assert.equal(toc2.priority, 2);

  // Tier 3: Preface
  const preface = getChapterSortKey('Preface _ Core Java.pdf', folder);
  assert.equal(preface.priority, 3);

  // Tier 4: Numbered Chapters
  const ch1 = getChapterSortKey('Chapter 1. Streams _ Core Java.pdf', folder);
  assert.equal(ch1.priority, 4);
  assert.equal(ch1.number, 1);

  const ch10 = getChapterSortKey('10. Concurrency _ Core Java.pdf', folder);
  assert.equal(ch10.priority, 4);
  assert.equal(ch10.number, 10);

  // Number comparison: Chapter 10 must have a higher number than Chapter 2
  const ch2 = getChapterSortKey('2. The Java Programming Environment.pdf', folder);
  assert.ok(ch2.number < ch10.number, 'Chapter 2 number must be less than Chapter 10');

  // Tier 5: Appendix
  const app = getChapterSortKey('Appendix _ Core Java.pdf', folder);
  assert.equal(app.priority, 5);

  // Tier 6: Index
  const idx = getChapterSortKey('Index _ Core Java.pdf', folder);
  assert.equal(idx.priority, 6);
});

test('scanBooks discovers all authoritative books', () => {
  invalidateScannerCache();
  const books = scanBooks();

  assert.ok(
    books.length >= 8,
    `Expected at least 8 books in the catalog, discovered: ${books.length}`
  );

  const multiChapterBooks = books.filter(b => b.isMultiChapter);
  assert.ok(
    multiChapterBooks.length >= 5,
    `Expected >= 5 multi-chapter books, found: ${multiChapterBooks.length}`
  );

  const singlePdfBooks = books.filter(b => !b.isMultiChapter);
  assert.equal(
    singlePdfBooks.length,
    3,
    `Expected 3 single-file PDF books, found: ${singlePdfBooks.length}`
  );
});

test('Sequential chapter monotonicity across ALL multi-chapter books in the catalog', () => {
  const books = scanBooks();
  const multiChapterBooks = books.filter(b => b.isMultiChapter);

  assert.ok(
    multiChapterBooks.length >= 10,
    `Must discover all multi-chapter books in storage (found ${multiChapterBooks.length}, expected >= 10)`
  );

  for (const book of multiChapterBooks) {
    assert.ok(book.chapters && book.chapters.length > 0, `Book ${book.id} has no chapters`);
    const chapters = book.chapters;

    // 1. Order indices must be strictly 1..N with no gaps or duplicates
    chapters.forEach((ch, idx) => {
      assert.equal(
        ch.order,
        idx + 1,
        `Chapter "${ch.title}" in ${book.id} has order ${ch.order}, expected ${idx + 1}`
      );
    });

    // 2. Chapter IDs within the same book must be unique (no collision)
    const idSet = new Set<string>();
    for (const ch of chapters) {
      assert.ok(
        !idSet.has(ch.id),
        `Duplicate chapter ID "${ch.id}" detected in book "${book.title}" (${book.id})`
      );
      idSet.add(ch.id);
    }

    // 3. Priority tiers must be monotonically non-decreasing
    for (let i = 0; i < chapters.length - 1; i++) {
      const current = chapters[i];
      const next = chapters[i + 1];

      assert.ok(
        current.priority <= next.priority,
        `Priority inverted in ${book.id}: "${current.title}" (tier ${current.priority}) appeared before "${next.title}" (tier ${next.priority})`
      );

      // 4. Numbered chapters within Tier 4 must be strictly increasing
      if (current.priority === 4 && next.priority === 4) {
        if (current.chapterNumber !== undefined && next.chapterNumber !== undefined) {
          assert.ok(
            current.chapterNumber < next.chapterNumber,
            `Chapter numbering inverted in ${book.id}: Chapter ${current.chapterNumber} ("${current.title}") appeared before Chapter ${next.chapterNumber} ("${next.title}")`
          );
        }
      }
    }

    // 5. Index (Tier 6) placement invariant:
    // If an Index exists, no content chapter (Tier 0..4), appendix (Tier 5), or other non-index section can appear after it
    const firstIndex = chapters.find(c => c.priority === 6 || c.title.toLowerCase() === 'index');
    if (firstIndex) {
      for (const ch of chapters) {
        if (ch.priority < 6) {
          assert.ok(
            ch.order < firstIndex.order,
            `Content/appendix chapter "${ch.title}" (tier ${ch.priority}) was ordered at ${ch.order} after Index (order ${firstIndex.order}) in book ${book.id}`
          );
        }
        // Strict invariant: no non-index chapter can follow Index
        if (ch.order > firstIndex.order) {
          assert.equal(
            ch.priority,
            6,
            `Non-index chapter "${ch.title}" (tier ${ch.priority}) appeared at order ${ch.order} after Index in book ${book.id}`
          );
        }
      }
    }
  }
});

test('Specific verification of each multi-chapter book structure', () => {
  const books = scanBooks();

  // Book 1: Code Java Vol. I_Fundamentals, 14th Edition
  const b1 = books.find(b => b.id.includes('code-java-vol-i-fundamentals-14th-edition'));
  assert.ok(b1, 'Book 1 must exist');
  assert.equal(b1.chapters?.length, 13);
  assert.equal(b1.chapters?.[0].title, '1. An Introduction to Java');
  assert.equal(b1.chapters?.[12].title, 'Appendix');

  // Book 2: Core Java Vol 2 14th edition
  const b2 = books.find(b => b.id.includes('core-java-vol-2-14th-edition'));
  assert.ok(b2, 'Book 2 must exist');
  assert.equal(b2.chapters?.length, 15);
  assert.equal(b2.chapters?.[0].title, 'Preface');
  assert.equal(b2.chapters?.[1].title, '1. Streams');
  assert.equal(b2.chapters?.[14].title, 'Index');

  // Book 3: Core Java for the Impatient, 4th Edition
  const b3 = books.find(b => b.id.includes('impatient'));
  assert.ok(b3, 'Book 3 must exist');
  assert.equal(b3.chapters?.length, 16);
  assert.equal(b3.chapters?.[0].title, 'Title & Copyright');
  assert.equal(b3.chapters?.[1].title, 'Table of Contents');
  assert.equal(b3.chapters?.[2].title, 'Preface');
  assert.equal(b3.chapters?.[3].title, '1. Fundamental Programming Structures');
  assert.equal(b3.chapters?.[15].title, 'Index');

  // Book 4: Core Java, Vol. II-Advanced Features, 12th Edition
  const b4 = books.find(b => b.id.includes('core-java-vol-ii-advanced-features-12th-edition'));
  assert.ok(b4, 'Book 4 must exist');
  assert.equal(b4.chapters?.length, 16);
  assert.equal(b4.chapters?.[0].title, 'Cover Page');
  assert.equal(b4.chapters?.[1].title, 'Table of Contents');
  assert.equal(b4.chapters?.[2].title, 'Preface');
  assert.equal(b4.chapters?.[3].title, 'Chapter 1. Streams');
  assert.equal(b4.chapters?.[15].title, 'Index');

  // Book 5: Core Java, Volume I_ Fundamentals, 13th Edition
  const b5 = books.find(b => b.id.includes('core-java-volume-i-fundamentals-13th-edition'));
  assert.ok(b5, 'Book 5 must exist');
  assert.equal(b5.chapters?.length, 16);
  assert.equal(b5.chapters?.[0].title, 'Title & Copyright');
  assert.equal(b5.chapters?.[1].title, 'Preface');
  assert.equal(b5.chapters?.[2].title, '1. An Introduction to Java');
  assert.equal(b5.chapters?.[14].title, 'Appendix');
  assert.equal(b5.chapters?.[15].title, 'Index');

  // Book 6: Building Intelligent Applications with Spring AI
  const bSpring = books.find(b => b.id.includes('spring-ai'));
  assert.ok(bSpring, 'Spring AI book must exist');
  assert.equal(bSpring.chapters?.length, 18);
  const springTitles = bSpring.chapters?.map(c => c.title) || [];
  // Must start with front matter / TOC / Preface
  assert.equal(springTitles[0], 'Title & Copyright');
  assert.equal(springTitles[1], 'Table of Contents');
  assert.equal(springTitles[2], 'Preface');
  // Part 1 before Chapter 1
  assert.ok(springTitles[3].startsWith('Part 1'));
  assert.ok(springTitles[4].includes('Chapter 1_'));
  assert.ok(springTitles[5].includes('Chapter 2_'));
  assert.ok(springTitles[6].includes('Chapter 3_'));
  // Part 2 between Chapter 3 and Chapter 4
  assert.ok(springTitles[7].startsWith('Part 2'));
  assert.ok(springTitles[8].includes('Chapter 4_'));
  assert.ok(springTitles[9].includes('Chapter 5_'));
  assert.ok(springTitles[10].includes('Chapter 6_'));
  // Part 3 between Chapter 6 and Chapter 7
  assert.ok(springTitles[11].startsWith('Part 3'));
  assert.ok(springTitles[12].includes('Chapter 7_'));
  assert.ok(springTitles[13].includes('Chapter 8_'));
  assert.ok(springTitles[14].includes('Chapter 9_'));
  assert.ok(springTitles[15].includes('Chapter 10_'));
  // All numbered chapters must precede Index
  const springIndexOrder = bSpring.chapters?.find(c => c.priority === 6)?.order || 0;
  for (let i = 1; i <= 10; i++) {
    const ch = bSpring.chapters?.find(c => c.title.includes(`Chapter ${i}_`));
    assert.ok(ch, `Chapter ${i} must exist in Spring AI`);
    assert.ok(ch.order < springIndexOrder, `Chapter ${i} must sort before Index in Spring AI`);
  }

  // Book 7: Learning Git
  const bGit = books.find(b => b.id.includes('learning-git'));
  assert.ok(bGit, 'Learning Git must exist');
  const gitEpilogue = bGit.chapters?.find(c => c.title.toLowerCase().includes('epilogue'));
  const gitIndex = bGit.chapters?.find(c => c.priority === 6);
  assert.ok(gitEpilogue, 'Epilogue must exist in Learning Git');
  assert.ok(gitIndex, 'Index must exist in Learning Git');
  assert.equal(gitEpilogue.priority, 5, 'Epilogue must be Tier 5 back matter');
  assert.ok(gitEpilogue.order < gitIndex.order, 'Epilogue must sort before Index in Learning Git');

  // Book 8: The Well-Grounded Java Developer
  const bWj = books.find(b => b.id.includes('well-grounded'));
  assert.ok(bWj, 'The Well-Grounded Java Developer must exist');
  const wjIndex = bWj.chapters?.find(c => c.priority === 6);
  const wjCopyright = bWj.chapters?.find(c => c.title.toLowerCase().includes('copyright'));
  assert.ok(wjIndex, 'Index must exist in Well-Grounded');
  assert.ok(wjCopyright, 'Copyright must exist in Well-Grounded');
  assert.ok(wjCopyright.order < wjIndex.order, 'Copyright must sort before Index in Well-Grounded');
});

test('Verification of all 3 standalone PDF books', () => {
  const books = scanBooks();

  // Head First Java
  const hfj = books.find(b => b.id === 'head-first-java');
  assert.ok(hfj, 'Head First Java must exist');
  assert.equal(hfj.isMultiChapter, false);
  assert.equal(hfj.totalPages, 755);
  assert.ok(hfj.author.includes('Sierra'));
  assert.ok(hfj.tags.includes('Beginner'));

  // Core Java Vol 12 - I
  const v12_1 = books.find(b => b.id === 'core-java-vol-12-i');
  assert.ok(v12_1, 'Core Java Vol 12 - I must exist');
  assert.equal(v12_1.isMultiChapter, false);
  assert.equal(v12_1.totalPages, 1198);
  assert.equal(v12_1.volume, 'Volume I');

  // Core Java Vol  13 - II (double space in filename)
  const v13_2 = books.find(b => b.id === 'core-java-vol-13-ii');
  assert.ok(v13_2, 'Core Java Vol 13 - II must exist');
  assert.equal(v13_2.isMultiChapter, false);
  assert.equal(v13_2.totalPages, 1283);
  assert.equal(v13_2.volume, 'Volume II');
});

test('getBookById lookup functionality', () => {
  const book = getBookById('head-first-java');
  assert.ok(book, 'Should find book by id');
  assert.equal(book?.title, 'Head First Java (3rd Edition)');

  const nonExistent = getBookById('non-existent-book-12345');
  assert.equal(nonExistent, null, 'Non-existent book must return null');
});

test('searchAndFilterBooks text search, category tag, and author filtering', () => {
  const all = scanBooks();

  // Search by query
  const queryResult = searchAndFilterBooks(all, { q: 'streams' });
  assert.ok(queryResult.length > 0, 'Should find books matching "streams"');

  // Tag filter
  const advResult = searchAndFilterBooks(all, { tag: 'Advanced' });
  assert.equal(advResult.length, 3, 'Expected 3 Advanced books (Vol II 12th, 13th, 14th)');
  advResult.forEach(b => assert.ok(b.tags.includes('Advanced')));

  // Author filter
  const sierraResult = searchAndFilterBooks(all, { author: 'Sierra' });
  assert.equal(sierraResult.length, 1, 'Expected 1 book for author Sierra');
  assert.equal(sierraResult[0].id, 'head-first-java');

  // Sorting: title-desc
  const sortedDesc = searchAndFilterBooks(all, { sort: 'title-desc' });
  for (let i = 0; i < sortedDesc.length - 1; i++) {
    assert.ok(
      sortedDesc[i].title.localeCompare(sortedDesc[i + 1].title) >= 0,
      'Titles must be in non-ascending alphabetical order'
    );
  }

  // Sorting: chapters-desc
  const sortedChapters = searchAndFilterBooks(all, { sort: 'chapters-desc' });
  const firstCount = sortedChapters[0].chapters?.length || 1;
  const lastCount = sortedChapters[sortedChapters.length - 1].chapters?.length || 1;
  assert.ok(firstCount >= lastCount, 'First book should have more or equal chapters than last');
});

test('resolveSafeBookPath prevents path traversal and sibling prefix escapes', () => {
  const root = path.resolve(getBooksRoot());

  // 1. Valid subpath inside BOOKS_ROOT
  const safePath = resolveSafeBookPath('head-first-java.pdf');
  assert.equal(safePath, path.join(root, 'head-first-java.pdf'));

  // 2. Relative traversal attempt is sanitized and confined strictly within BOOKS_ROOT
  const confinedPath = resolveSafeBookPath('../../../../../etc/passwd');
  assert.ok(
    confinedPath.startsWith(root),
    'Relative traversal must be confined strictly within BOOKS_ROOT'
  );
  assert.equal(confinedPath, path.join(root, 'etc/passwd'));

  // 3. Absolute path traversal outside BOOKS_ROOT throws Access Denied
  assert.throws(
    () => {
      resolveSafeBookPath('/etc/passwd');
    },
    /Access Denied|Path traversal/,
    'Should throw error on absolute path traversal outside BOOKS_ROOT'
  );

  // 4. Sibling directory prefix bypass MUST throw Access Denied
  // Tests cases like /path/to/Books_evil or /path/to/Books-backup
  const siblingEvil = root + '_evil/secret.txt';
  const siblingBackup = root + '-backup/secret.pdf';
  assert.throws(
    () => {
      resolveSafeBookPath(siblingEvil, root);
    },
    /Access Denied|Path traversal/,
    'Must strictly block sibling directory prefix collision (Books_evil)'
  );
  assert.throws(
    () => {
      resolveSafeBookPath(siblingBackup, root);
    },
    /Access Denied|Path traversal/,
    'Must strictly block sibling directory hyphen collision (Books-backup)'
  );

  // 5. Root directory itself resolves safely
  assert.equal(resolveSafeBookPath('', root), root);
  assert.equal(resolveSafeBookPath(root, root), root);

  // 6. Path traversal attempt with literal null byte
  assert.throws(
    () => {
      resolveSafeBookPath('test.pdf\0/../../etc/passwd');
    },
    /Access Denied|Invalid character/,
    'Should throw error on literal null byte injection'
  );

  // 7. Path traversal attempt with encoded null byte (%00)
  assert.throws(
    () => {
      resolveSafeBookPath('test.pdf%00/../../etc/passwd');
    },
    /Access Denied|Invalid character/,
    'Should throw error on percent-encoded null byte injection'
  );
});
