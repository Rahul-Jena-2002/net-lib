import { NextRequest, NextResponse } from 'next/server';
import { BOOKS_ROOT, invalidateScannerCache, scanBooks, resolveSafeBookPath } from '@/lib/scanner';
import { getCollisionSafePath, normalizePdfFilename, validatePdfUpload } from '@/lib/upload';
import { saveCustomCover } from '@/lib/coversServer';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// File upload: saves PDF to BOOKS_ROOT, invalidates catalog cache, and returns uploaded book
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const bookTitle = (formData.get('title') as string | null)?.trim();
    const coverUrl = (formData.get('coverUrl') as string | null)?.trim();

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const validation = validatePdfUpload(file.name, buffer);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const targetFilename = normalizePdfFilename(file.name, bookTitle || undefined);
    const { destPath, finalName } = getCollisionSafePath(BOOKS_ROOT, targetFilename);
    const safeTitle = finalName.replace(/\.pdf$/i, '');

    // Verify destination is safely within BOOKS_ROOT
    resolveSafeBookPath(finalName, BOOKS_ROOT);

    fs.writeFileSync(destPath, buffer);

    // Invalidate scanner cache so new book is instantly discoverable
    invalidateScannerCache();
    const books = scanBooks(undefined, true);
    const uploadedBook = books.find(b => b.filename === finalName || b.title.toLowerCase() === safeTitle.toLowerCase()) || null;

    // If coverUrl provided, persist it for this book
    if (coverUrl && uploadedBook) {
      saveCustomCover(uploadedBook.id, coverUrl);
      uploadedBook.coverUrl = coverUrl;
    }

    return NextResponse.json({
      success: true,
      message: `Book "${safeTitle}" uploaded successfully!`,
      book: uploadedBook,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 });
  }
}
