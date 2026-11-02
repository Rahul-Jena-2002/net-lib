import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { scanBooks, resolveSafeBookPath, BOOKS_ROOT } from '@/lib/scanner';
import { BOOK_COVERS } from '@/lib/covers';
import { getCustomCovers } from '@/lib/coversServer';

export const dynamic = 'force-dynamic';

function extractAndCleanChapterHtml(rawHtml: string, bookId: string): string {
  let content = '';

  // 1. Extract purely the core chapter content container (#sbo-rt-content or chapter div)
  const sboIdx = rawHtml.indexOf('<div id="sbo-rt-content">');
  if (sboIdx !== -1) {
    let depth = 1;
    let idx = sboIdx + '<div id="sbo-rt-content">'.length;
    while (depth > 0 && idx < rawHtml.length) {
      const nextOpen = rawHtml.indexOf('<div', idx);
      const nextClose = rawHtml.indexOf('</div>', idx);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        idx = nextOpen + 4;
      } else {
        depth--;
        idx = nextClose + 6;
      }
    }
    content = rawHtml.substring(sboIdx, idx);
  } else {
    // Fallback: look for chapter div or article
    const chMatch = rawHtml.match(/<div class="chapter"[^>]*>[\s\S]*?<\/div>\s*<\/div>/i);
    if (chMatch) {
      content = chMatch[0];
    } else {
      // Fallback: extract body content
      const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      content = bodyMatch ? bodyMatch[1] : rawHtml;
    }
  }

  // 2. Strip ALL scripts completely to eliminate tracking, Datadog, Amplitude, and telemetry
  content = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // 3. Strip any O'Reilly navigation headers, top bars, subscription banners, or footer widgets
  content = content.replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '');
  content = content.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '');
  content = content.replace(/<div[^>]+id=["']top-nav["'][^>]*>[\s\S]*?<\/div>/gi, '');
  content = content.replace(/<div[^>]+id=["']site-header["'][^>]*>[\s\S]*?<\/div>/gi, '');
  content = content.replace(/<app-ls-content\b[^<]*(?:(?!<\/app-ls-content>)<[^<]*)*<\/app-ls-content>/gi, '');

  // 4. Rewrite relative image URLs to load safely from local /api/asset
  content = content.replace(/<img([^>]+)src=["'](\.[^"']+)["']/gi, (match, before, src) => {
    const cleanSrc = src.replace(/^\.\//, '');
    return `<img${before}src="/api/asset?book=${encodeURIComponent(bookId)}&file=${encodeURIComponent(cleanSrc)}"`;
  });

  // Also rewrite any absolute https://learning.oreilly.com images to keep things clean
  content = content.replace(/<img([^>]+)src=["']https:\/\/learning\.oreilly\.com\/api\/v2\/epubs\/[^"']+\/files\/([^"']+)["']/gi, (match, before, filePath) => {
    return `<img${before}src="/api/asset?book=${encodeURIComponent(bookId)}&file=${encodeURIComponent(filePath)}"`;
  });

  // 5. Clean external O'Reilly book links: convert to harmless chapter links or internal anchors
  content = content.replace(/href=["']https:\/\/learning\.oreilly\.com\/library\/view\/[^"']*\/ch(\d+)[^"']*["']/gi, (match, chNum) => {
    return `href="#chapter-${chNum}" data-chapter="${chNum}"`;
  });

  // 6. Strip O'Reilly font-family overrides like font-family:"Title" so our Liquid Glass fonts take effect
  content = content.replace(/font-family\s*:\s*["']?(Title|Mono|Number|Fallback|Open Sans)["']?;?/gi, '');

  return content;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bookId = searchParams.get('book');
    const chapterId = searchParams.get('chapter');

    if (!bookId) {
      return NextResponse.json({ error: 'Missing book parameter' }, { status: 400 });
    }

    const books = scanBooks();
    const book = books.find(b => b.id === bookId);
    if (!book || !book.storagePath) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    const chapters = book.chapters || [];
    let targetChapter = chapterId ? chapters.find(c => c.id === chapterId) : chapters[0];

    // If still not found, fallback to first chapter
    if (!targetChapter && chapters.length > 0) {
      targetChapter = chapters[0];
    }

    if (!targetChapter) {
      return NextResponse.json({ error: 'No chapters found for book' }, { status: 404 });
    }

    const htmlFilename = targetChapter.htmlFilename || (targetChapter.filename.toLowerCase().endsWith('.html') ? targetChapter.filename : null);
    if (!htmlFilename) {
      return NextResponse.json({ error: 'Chapter does not have an HTML version', hasHtml: false }, { status: 404 });
    }

    // If this is a synthetic or generated Cover chapter, serve the cover image cleanly
    if (targetChapter.id === 'cover' || targetChapter.htmlFilename === 'cover.html') {
      const customCovers = getCustomCovers();
      const coverUrl = book.coverUrl || customCovers[book.id] || BOOK_COVERS[book.id];
      if (coverUrl) {
        const coverHtml = `
<div id="sbo-rt-content">
  <section epub:type="chapter" class="cover-chapter flex flex-col items-center justify-center min-h-[75vh] py-8 text-center">
    <figure class="cover my-0 mx-auto max-w-lg w-full">
      <img alt="${book.title} Cover" src="${coverUrl}" class="rounded-xl shadow-2xl mx-auto max-h-[85vh] w-auto object-contain border border-white/10" />
    </figure>
  </section>
</div>`;

        const currentIndex = chapters.findIndex(c => c.id === targetChapter.id);
        const prevChapter = currentIndex > 0 ? { id: chapters[currentIndex - 1].id, title: chapters[currentIndex - 1].title } : null;
        const nextChapter = currentIndex < chapters.length - 1 ? { id: chapters[currentIndex + 1].id, title: chapters[currentIndex + 1].title } : null;

        return NextResponse.json({
          success: true,
          bookId: book.id,
          bookTitle: book.title,
          author: book.author,
          chapter: {
            id: targetChapter.id,
            title: targetChapter.title,
            order: targetChapter.order,
            chapterNumber: targetChapter.chapterNumber,
          },
          prevChapter,
          nextChapter,
          contentHtml: coverHtml,
        });
      }
    }

    let cleanedHtml = '';
    const bookDir = (book.storagePath && fs.existsSync(book.storagePath))
      ? book.storagePath
      : path.join(BOOKS_ROOT, book.folder || (book.storagePath ? path.basename(book.storagePath) : ''));
    const filePath = resolveSafeBookPath(htmlFilename, bookDir);
    if (fs.existsSync(filePath)) {
      const rawHtml = fs.readFileSync(filePath, 'utf8');
      cleanedHtml = extractAndCleanChapterHtml(rawHtml, book.id);
    } else {
      const customCovers = getCustomCovers();
      const coverUrl = book.coverUrl || customCovers[book.id] || BOOK_COVERS[book.id];
      cleanedHtml = `
<div id="sbo-rt-content">
  <section class="chapter-content py-8 px-4 max-w-3xl mx-auto">
    <header class="mb-6 border-b border-white/10 pb-4">
      <span class="text-xs uppercase tracking-wider text-sky-400 font-semibold">Chapter ${targetChapter.chapterNumber || targetChapter.order}</span>
      <h1 class="text-2xl sm:text-3xl font-bold text-white mt-1">${targetChapter.title}</h1>
      <p class="text-xs sm:text-sm text-neutral-400 mt-1">${book.title} · ${book.author}</p>
    </header>
    ${coverUrl ? `<div class="my-6 text-center"><img src="${coverUrl}" alt="${book.title}" class="max-h-72 mx-auto rounded-lg shadow-lg border border-white/10" /></div>` : ''}
    <div class="prose prose-invert max-w-none text-neutral-300 leading-relaxed space-y-4 text-sm sm:text-base">
      <p>Reading <strong>${targetChapter.title}</strong> from <em>${book.title}</em> (${book.author}).</p>
      <div class="p-4 rounded-lg bg-sky-950/40 border border-sky-800/60 text-sky-200 text-xs sm:text-sm">
        📖 Web Edition active. Use the chapter menu or Prev/Next controls to browse all chapters.
      </div>
    </div>
  </section>
</div>`;
    }

    const currentIndex = chapters.findIndex(c => c.id === targetChapter.id);
    const prevChapter = currentIndex > 0 ? { id: chapters[currentIndex - 1].id, title: chapters[currentIndex - 1].title } : null;
    const nextChapter = currentIndex < chapters.length - 1 ? { id: chapters[currentIndex + 1].id, title: chapters[currentIndex + 1].title } : null;

    return NextResponse.json({
      success: true,
      bookId: book.id,
      bookTitle: book.title,
      author: book.author,
      chapter: {
        id: targetChapter.id,
        title: targetChapter.title,
        order: targetChapter.order,
        chapterNumber: targetChapter.chapterNumber,
      },
      prevChapter,
      nextChapter,
      contentHtml: cleanedHtml,
    });
  } catch (err: any) {
    console.error('Error serving chapter HTML:', err);
    return NextResponse.json({ error: 'Failed to process chapter HTML', details: err?.message }, { status: 500 });
  }
}
