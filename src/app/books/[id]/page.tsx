import BookDetailClient from '@/components/book/BookDetailClient';
import booksData from '@/data/books.json';

export function generateStaticParams() {
  return booksData.map((b: any) => ({ id: b.id }));
}

export default function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <BookDetailClient params={params} />;
}
