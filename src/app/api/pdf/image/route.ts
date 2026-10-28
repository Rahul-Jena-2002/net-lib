import { NextRequest, NextResponse } from 'next/server';
import { scanBooks, BOOKS_ROOT, resolveSafeBookPath } from '@/lib/scanner';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

function encodeBmp(width: number, height: number, rgbData: Uint8Array): Buffer {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const imageSize = rowSize * height;
  const fileSize = 54 + imageSize;
  const buf = Buffer.alloc(fileSize);

  // BMP Header
  buf.write('BM', 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(54, 10);

  // DIB Header
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(-height, 22); // Top-down
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(0, 30);
  buf.writeUInt32LE(imageSize, 34);

  let srcOffset = 0;
  let dstOffset = 54;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const r = rgbData[srcOffset];
      const g = rgbData[srcOffset + 1];
      const b = rgbData[srcOffset + 2];
      buf[dstOffset] = b;
      buf[dstOffset + 1] = g;
      buf[dstOffset + 2] = r;
      srcOffset += 3;
      dstOffset += 3;
    }
    const pad = rowSize - width * 3;
    dstOffset += pad;
  }
  return buf;
}

const imageCache = new Map<string, Buffer>();

// GET /api/pdf/image?book=<id>&chapter=<id>&page=<pageNum>&index=<index>
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get('book');
  const chapterId = searchParams.get('chapter');
  const pageNum = parseInt(searchParams.get('page') || '1', 10);
  const imgIndex = parseInt(searchParams.get('index') || '0', 10);

  if (!bookId) {
    return NextResponse.json({ error: 'Missing book' }, { status: 400 });
  }

  const cacheKey = `${bookId}:${chapterId || 'root'}:${pageNum}:${imgIndex}`;
  if (imageCache.has(cacheKey)) {
    const cached = imageCache.get(cacheKey)!;
    return new NextResponse(cached as any, {
      status: 200,
      headers: {
        'Content-Type': 'image/bmp',
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  }

  const books = scanBooks();
  const book = books.find(b => b.id === bookId);
  if (!book) return NextResponse.json({ error: 'Book not found' }, { status: 404 });

  let subPath: string;
  if (book.chapters && chapterId) {
    const chapter = book.chapters.find(c => c.id === chapterId);
    if (!chapter) return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    subPath = path.join(book.folder!, chapter.filename);
  } else if (book.filename) {
    subPath = book.filename;
  } else if (book.chapters && book.chapters.length > 0) {
    subPath = path.join(book.folder!, book.chapters[0].filename);
  } else {
    return NextResponse.json({ error: 'No PDF file' }, { status: 404 });
  }

  const filePath = resolveSafeBookPath(subPath, BOOKS_ROOT);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  try {
    await import('pdfjs-dist/legacy/build/pdf.worker.mjs' as any);
    const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');

    const fileData = new Uint8Array(fs.readFileSync(filePath));
    const doc = await pdfjs.getDocument({ data: fileData }).promise;
    if (pageNum > doc.numPages) {
      return NextResponse.json({ error: 'Page out of range' }, { status: 404 });
    }

    const page = await doc.getPage(pageNum);
    const ops = await page.getOperatorList();

    const imageNames: string[] = [];
    for (let i = 0; i < ops.fnArray.length; i++) {
      if (ops.fnArray[i] === 85) {
        imageNames.push(ops.argsArray[i][0]);
      }
    }

    if (imageNames.length <= imgIndex) {
      return NextResponse.json({ error: 'Image index not found' }, { status: 404 });
    }

    const targetName = imageNames[imgIndex];
    const imgData: any = await new Promise((resolve, reject) => {
      page.objs.get(targetName, (img: any) => {
        if (img) resolve(img);
        else reject(new Error('Image failed to load'));
      });
    });

    if (!imgData || !imgData.data) {
      return NextResponse.json({ error: 'Image data missing' }, { status: 500 });
    }

    const bmpBuffer = encodeBmp(imgData.width, imgData.height, imgData.data);
    imageCache.set(cacheKey, bmpBuffer);

    return new NextResponse(bmpBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'image/bmp',
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch (err: any) {
    console.error('Failed to extract image:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
