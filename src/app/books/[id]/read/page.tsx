import { Suspense } from 'react';
import ReaderClient from '@/components/reader/ReaderClient';
import booksData from '@/data/books.json';

export function generateStaticParams() {
  return booksData.map((b: any) => ({ id: b.id }));
}

export default function ReadPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07090e] flex items-center justify-center text-white/40">Loading reader…</div>}>
      <ReaderClient />
    </Suspense>
  );
}
