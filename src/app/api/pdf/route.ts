import { NextRequest, NextResponse } from 'next/server';
import { scanBooks, BOOKS_ROOT, resolveSafeBookPath } from '@/lib/scanner';
import { parseRange } from '@/lib/pdf';
import { generateChapterPdfBytes } from '@/lib/pdfGenerator';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';


// GET /api/pdf?book=<bookId>&chapter=<chapterId>
// Streams the PDF file directly with byte-range support
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get('book');
  const chapterId = searchParams.get('chapter');

  if (!bookId) {
    return NextResponse.json({ error: 'Missing book param' }, { status: 400 });
  }

  const books = scanBooks();
  const book = books.find(b => b.id === bookId);
  if (!book) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 });
  }

  let subPath: string | null = null;

  if (book.chapters && chapterId) {
    const chapter = book.chapters.find(c => c.id === chapterId);
    if (!chapter) return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    const pdfName = chapter.pdfFilename || (chapter.filename?.toLowerCase().endsWith('.pdf') ? chapter.filename : null);
    if (pdfName) {
      subPath = path.join(book.folder!, pdfName);
    }
  } else if (book.filename && book.filename.toLowerCase().endsWith('.pdf')) {
    subPath = book.filename;
  } else if (book.chapters && book.chapters.length > 0) {
    const firstPdf = book.chapters.find(c => c.pdfFilename || c.filename?.toLowerCase().endsWith('.pdf'));
    if (firstPdf) {
      const pdfName = firstPdf.pdfFilename || firstPdf.filename;
      subPath = path.join(book.folder!, pdfName);
    }
  }

  let filePath: string | null = null;
  if (subPath) {
    try {
      filePath = resolveSafeBookPath(subPath, BOOKS_ROOT);
    } catch (err: any) {
      return NextResponse.json(
        { error: 'Access Denied: Path traversal attempt detected' },
        { status: 403 }
      );
    }
  }

  if (!filePath || !fs.existsSync(filePath)) {
    // Dynamically generate publication PDF for cloud deployment or HTML-only chapters
    const targetChapter = book.chapters?.find(c => c.id === chapterId) || book.chapters?.[0];
    const chTitle = targetChapter?.title || book.title;
    const chNum = targetChapter?.chapterNumber || targetChapter?.order || 1;
    const pages = targetChapter?.pageCount ? Math.min(Math.max(targetChapter.pageCount, 3), 6) : 3;
    const pdfBytes = generateChapterPdfBytes(book.title, chTitle, chNum, book.author, pages);

    const rangeHeader = req.headers.get('range');
    const fileSize = pdfBytes.length;

    if (rangeHeader) {
      const range = parseRange(rangeHeader, fileSize);
      if (range.valid) {
        const { start, end } = range;
        const slice = pdfBytes.subarray(start, end + 1);
        return new NextResponse(slice as any, {
          status: 206,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': slice.length.toString(),
            'Content-Disposition': 'inline',
          },
        });
      }
    }

    return new NextResponse(pdfBytes as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': fileSize.toString(),
        'Accept-Ranges': 'bytes',
        'Content-Disposition': 'inline',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const rangeHeader = req.headers.get('range');

  if (rangeHeader) {
    const range = parseRange(rangeHeader, fileSize);

    if (range.unsatisfiable) {
      return new NextResponse(null, {
        status: 416,
        headers: {
          'Content-Range': `bytes */${fileSize}`,
          'Accept-Ranges': 'bytes',
        },
      });
    }

    if (range.valid) {
      const { start, end } = range;
      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });
      const webStream = Readable.toWeb(fileStream);

      return new NextResponse(webStream as any, {
        status: 206,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize.toString(),
          'Content-Disposition': 'inline',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
  }

  // Full file streaming
  const fileStream = fs.createReadStream(filePath);
  const webStream = Readable.toWeb(fileStream);

  return new NextResponse(webStream as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': fileSize.toString(),
      'Accept-Ranges': 'bytes',
      'Content-Disposition': 'inline',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
