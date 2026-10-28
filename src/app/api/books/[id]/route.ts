import { NextRequest, NextResponse } from 'next/server';
import { getBookById } from '@/lib/scanner';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Book ID is required' }, { status: 400 });
    }

    const book = getBookById(id);
    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    return NextResponse.json(book);
  } catch (e: any) {
    console.error('Error fetching book:', e);
    return NextResponse.json(
      { error: 'Internal Server Error', details: e?.message },
      { status: 500 }
    );
  }
}
