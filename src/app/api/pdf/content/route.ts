import { NextRequest, NextResponse } from 'next/server';
import { scanBooks, BOOKS_ROOT, resolveSafeBookPath } from '@/lib/scanner';
import { extractPdfContent } from '@/lib/pdfText';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

// GET /api/pdf/content?book=<bookId>&chapter=<chapterId>&page=<pageNum>&limit=<limit>
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get('book');
  const chapterId = searchParams.get('chapter');
  const startPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

  if (!bookId) {
    return NextResponse.json({ error: 'Missing book parameter' }, { status: 400 });
  }

  const books = scanBooks();
  const book = books.find(b => b.id === bookId);
  if (!book) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 });
  }

  let subPath: string;
  let activeChapterId = chapterId || undefined;

  if (book.chapters && chapterId) {
    const chapter = book.chapters.find(c => c.id === chapterId);
    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }
    subPath = path.join(book.folder!, chapter.filename);
    activeChapterId = chapter.id;
  } else if (book.filename) {
    subPath = book.filename;
  } else if (book.chapters && book.chapters.length > 0) {
    const first = book.chapters[0];
    subPath = path.join(book.folder!, first.filename);
    activeChapterId = first.id;
  } else {
    return NextResponse.json({ error: 'No PDF file found for this book' }, { status: 404 });
  }

  let filePath: string;
  try {
    filePath = resolveSafeBookPath(subPath, BOOKS_ROOT);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Access Denied: Path traversal attempt detected' },
      { status: 403 }
    );
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { error: `File not found on disk: ${filePath}` },
      { status: 404 }
    );
  }

  try {
    const content = await extractPdfContent(filePath, book.id, activeChapterId, startPage, limit);
    return NextResponse.json(content, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err: any) {
    console.error('Failed to extract PDF text content:', err);
    return NextResponse.json(
      { error: `Failed to extract text from PDF: ${err.message}` },
      { status: 500 }
    );
  }
}
