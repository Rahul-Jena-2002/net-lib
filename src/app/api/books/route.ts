import { NextRequest, NextResponse } from 'next/server';
import { scanBooks, searchAndFilterBooks } from '@/lib/scanner';
import { BOOK_COVERS } from '@/lib/covers';
import { getCustomCovers } from '@/lib/coversServer';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || undefined;
    const tag = searchParams.get('tag') || undefined;
    const author = searchParams.get('author') || undefined;
    const sort = searchParams.get('sort') || undefined;
    const refresh = searchParams.get('refresh') === 'true';

    const allBooks = scanBooks(undefined, refresh);
    const customCovers = getCustomCovers();

    // Attach coverUrl to books
    const enriched = allBooks.map(b => ({
      ...b,
      coverUrl: customCovers[b.id] || BOOK_COVERS[b.id] || undefined,
    }));

    const result = searchAndFilterBooks(enriched, { q, tag, author, sort });

    return NextResponse.json(result);
  } catch (e: any) {
    console.error('Failed to retrieve books:', e);
    return NextResponse.json(
      { error: 'Failed to scan books', details: e?.message },
      { status: 500 }
    );
  }
}
