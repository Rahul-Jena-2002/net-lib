import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { scanBooks, resolveSafeBookPath } from '@/lib/scanner';

export const dynamic = 'force-dynamic';

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.css': 'text/css; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bookId = searchParams.get('book');
    const relativeFile = searchParams.get('file');

    if (!bookId || !relativeFile) {
      return new NextResponse('Missing book or file parameter', { status: 400 });
    }

    const books = scanBooks();
    const book = books.find(b => b.id === bookId);
    if (!book || !book.storagePath) {
      return new NextResponse('Book storage not found', { status: 404 });
    }

    // Safely resolve the requested asset within the book's directory
    const resolvedPath = resolveSafeBookPath(relativeFile, book.storagePath);
    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
      return new NextResponse('Asset not found', { status: 404 });
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';

    const fileBuffer = fs.readFileSync(resolvedPath);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch (err: any) {
    console.error('Error serving asset:', err);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
