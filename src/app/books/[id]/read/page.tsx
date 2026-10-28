'use client';
import { Suspense } from 'react';
import ReaderClient from '@/components/reader/ReaderClient';

export default function ReadPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center text-white/40">Loading reader…</div>}>
      <ReaderClient />
    </Suspense>
  );
}
