'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Layers,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import type { Book } from '@/lib/types';
import { getBookCoverUrl } from '@/lib/covers';
import { loadBookProgress } from '@/lib/storage';
import Footer from '@/components/layout/Footer';

export default function BookDetailClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [book, setBook] = useState<Book | null>(null);
  const [imageError, setImageError] = useState(false);
  const [completedChapters, setCompletedChapters] = useState<string[]>([]);
  const [lastChapterId, setLastChapterId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      let books: Book[] = [];
      try {
        const r = await fetch('/api/books');
        if (r.ok) {
          books = await r.json();
        }
      } catch {
        // ignore
      }
      if (!books.length) {
        try {
          const fallbackUrl = (process.env.NEXT_PUBLIC_BASE_PATH || '') + '/data/books.json';
          const r = await fetch(fallbackUrl);
          if (r.ok) books = await r.json();
        } catch {
          // ignore
        }
      }
      const found = books.find(b => b.id === id) || null;
      setBook(found);
      if (found) {
        const prog = loadBookProgress(found.id);
        if (prog) {
          setCompletedChapters(prog.completedChapters || []);
          setLastChapterId(prog.chapterId || null);
        }
      }
    };
    loadData();
  }, [id]);

  if (!book) {
    return (
      <div className="min-h-screen flex flex-col bg-[#0c1017] text-white">
        <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#0c1017]/95 px-4 sm:px-8 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5 text-xs font-medium text-neutral-300 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Library</span>
          </Link>
        </header>

        {/* Book Detail Skeleton Loader (Tell #28) */}
        <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-10 flex-1 animate-pulse">
          <div className="bg-[#131822] border border-white/[0.08] rounded-xl p-6 sm:p-10 mb-8 flex flex-col lg:flex-row gap-8 lg:gap-12">
            <div className="w-48 sm:w-56 aspect-[2/3] rounded-lg bg-neutral-800/80 shrink-0" />
            <div className="flex-1 space-y-4">
              <div className="h-4 bg-neutral-800/60 rounded w-1/4" />
              <div className="h-8 bg-neutral-800/90 rounded w-3/4" />
              <div className="h-4 bg-neutral-800/50 rounded w-1/3" />
              <div className="flex gap-2 pt-2">
                <div className="h-6 w-16 bg-neutral-800/60 rounded" />
                <div className="h-6 w-16 bg-neutral-800/60 rounded" />
              </div>
              <div className="grid grid-cols-4 gap-4 py-4 max-w-md">
                <div className="h-10 bg-neutral-800/50 rounded" />
                <div className="h-10 bg-neutral-800/50 rounded" />
                <div className="h-10 bg-neutral-800/50 rounded" />
                <div className="h-10 bg-neutral-800/50 rounded" />
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const coverUrl = getBookCoverUrl(book.id, book.coverUrl);

  // Resume reading from last chapter or first chapter
  const targetChapterId =
    lastChapterId || (book.chapters && book.chapters.length > 0 ? book.chapters[0].id : null);

  const hasWeb = Boolean(book.hasFullHtml || (book.htmlChaptersCount && book.htmlChaptersCount > 0));
  const hasPdf = Boolean(!book.isMultiChapter || book.filename || book.chapters?.some(c => c.hasPdf));

  const webChapterId =
    (lastChapterId && book.chapters?.find(c => c.id === lastChapterId)?.hasHtml ? lastChapterId : null) ||
    book.chapters?.find(c => c.hasHtml)?.id ||
    targetChapterId;

  const pdfChapterId =
    (lastChapterId && book.chapters?.find(c => c.id === lastChapterId)?.hasPdf ? lastChapterId : null) ||
    book.chapters?.find(c => c.hasPdf)?.id ||
    targetChapterId;

  const webReadHref = webChapterId
    ? `/books/${book.id}/read?chapter=${encodeURIComponent(webChapterId)}&format=html`
    : `/books/${book.id}/read?format=html`;

  const pdfReadHref = pdfChapterId
    ? `/books/${book.id}/read?chapter=${encodeURIComponent(pdfChapterId)}&format=pdf`
    : `/books/${book.id}/read?format=pdf`;

  return (
    <div className="min-h-screen flex flex-col font-sans relative selection:bg-white/20 selection:text-white bg-[#0c1017]">
      {/* ── TOP NAVBAR ── */}
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#0c1017]/95 backdrop-blur-md px-4 sm:px-6 md:px-8 py-3">
        <div className="w-full flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-neutral-300 hover:text-white transition-colors text-xs font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Library</span>
          </Link>

          <span className="text-xs font-medium truncate max-w-xs sm:max-w-md text-neutral-300 hidden sm:block">
            {book.title}
          </span>

          <div className="flex items-center gap-2">
            {hasPdf && (
              <Link
                href={pdfReadHref}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white transition-colors"
              >
                <span>Read PDF</span>
              </Link>
            )}
            {hasWeb && (
              <Link
                href={webReadHref}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors"
              >
                <span>HTML</span>
              </Link>
            )}
            {!hasPdf && !hasWeb && (
              <Link
                href={`/books/${book.id}/read`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Read</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO BOOK SHOWCASE ── */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-8 flex-1 relative z-10">
        <div className="bg-[#131822] border border-white/[0.08] rounded-xl p-6 sm:p-8 mb-8 w-full shadow-sm">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-center lg:items-start">
            {/* Book Cover Frame */}
            <div className="relative shrink-0 w-44 sm:w-52 aspect-[2/3] rounded-lg overflow-hidden bg-[#0a0d14] border border-white/10 flex items-center justify-center p-1.5">
              {coverUrl && !imageError ? (
                <img
                  src={coverUrl}
                  alt={book.title}
                  onError={() => setImageError(true)}
                  className="w-full h-full object-contain rounded"
                />
              ) : (
                <div className="w-full h-full p-5 flex flex-col justify-between bg-[#181f2a] border border-neutral-700/60 rounded select-none">
                  <span className="text-xs uppercase tracking-wider text-neutral-400 font-semibold">
                    {book.edition || 'Volume'}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold leading-snug line-clamp-3 mb-1 text-white">{book.title}</h3>
                    <p className="text-xs text-neutral-400 truncate">{book.author}</p>
                  </div>
                  <div className="text-xs text-neutral-400 pt-2 border-t border-neutral-700">
                    {book.totalPages} pages
                  </div>
                </div>
              )}
            </div>

            {/* Book Details */}
            <div className="flex-1 min-w-0 text-center lg:text-left flex flex-col justify-between h-full">
              <div>
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mb-3">
                  <span className="text-xs uppercase tracking-wider font-semibold px-2.5 py-1 rounded bg-neutral-800 text-neutral-300 border border-neutral-700/70">
                    {book.edition || (book.isMultiChapter ? 'Multi-chapter Publication' : 'Single Document')}
                  </span>
                  {book.publisher && (
                    <span className="text-xs text-neutral-400 px-2 py-1">
                      {book.publisher}
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-4xl font-bold tracking-tight mb-2.5 leading-tight text-white">
                  {book.title}
                </h1>
                <p className="text-sm sm:text-base text-neutral-400 mb-5 font-normal">
                  {book.author}
                </p>

                {/* Category tags */}
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-1.5 mb-6">
                  {book.tags.map(t => (
                    <span
                      key={t}
                      className="text-xs px-2.5 py-0.5 rounded bg-neutral-800/80 text-neutral-300 border border-neutral-700/60"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Stats & Call to Action Bar */}
              <div>
                <div className="grid grid-cols-4 gap-2 sm:gap-4 py-3 px-4 sm:px-6 rounded-lg bg-neutral-900/90 border border-neutral-800 mb-6 max-w-xl mx-auto lg:mx-0">
                  <div className="text-center">
                    <span className="text-base sm:text-lg font-bold block text-white">
                      {book.chapters?.length || 1}
                    </span>
                    <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Chapters</span>
                  </div>
                  <div className="text-center border-l border-neutral-800">
                    <span className="text-base sm:text-lg font-bold block text-white">
                      {book.totalPages}
                    </span>
                    <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Pages</span>
                  </div>
                  <div className="text-center border-l border-neutral-800">
                    <span className="text-base sm:text-lg font-bold block text-white">
                      {book.totalSize ? `${(book.totalSize / (1024 * 1024)).toFixed(1)} MB` : 'PDF'}
                    </span>
                    <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Size</span>
                  </div>
                  <div className="text-center border-l border-neutral-800">
                    <span className="text-base sm:text-lg font-bold block text-neutral-200">
                      {book.htmlChaptersCount || 0}/{book.chapters?.length || 1}
                    </span>
                    <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Web</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
                  {hasPdf && (
                    <Link
                      href={pdfReadHref}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-xs bg-sky-600 hover:bg-sky-500 text-white transition-colors cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Read PDF Document</span>
                    </Link>
                  )}
                  {hasWeb && (
                    <Link
                      href={webReadHref}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 transition-colors cursor-pointer"
                    >
                      <span>Web HTML Edition</span>
                    </Link>
                  )}
                  {!hasPdf && !hasWeb && (
                    <Link
                      href={`/books/${book.id}/read`}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-xs bg-sky-600 hover:bg-sky-500 text-white transition-colors cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Start Reading</span>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── TABLE OF CONTENTS GRID ── */}
        {book.chapters && book.chapters.length > 0 && (
          <div className="bg-[#131822] border border-white/[0.08] rounded-xl p-6 sm:p-8 w-full mb-12 shadow-sm">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-neutral-400" />
                <h2 className="text-base font-bold text-white">
                  Table of Contents
                </h2>
                <span className="text-xs text-neutral-400 px-2 py-0.5 rounded bg-neutral-800">
                  {book.chapters.length} chapters
                </span>
                {book.hasFullHtml ? (
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                    Web Complete
                  </span>
                ) : (
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                    {book.htmlChaptersCount || 0} of {book.chapters.length} Web
                  </span>
                )}
              </div>

              {completedChapters.length > 0 && (
                <span className="text-xs text-neutral-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{completedChapters.length} of {book.chapters.length} completed</span>
                </span>
              )}
            </div>

            {/* Responsive grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {book.chapters.map((ch, i) => {
                const isCompleted = completedChapters.includes(ch.id);
                return (
                  <Link
                    key={ch.id}
                    href={`/books/${book.id}/read?chapter=${encodeURIComponent(ch.id)}&format=${ch.hasPdf ? 'pdf' : 'html'}`}
                    className="group bg-[#0f141d] hover:bg-[#161c28] border border-white/[0.06] hover:border-white/20 rounded-lg p-3.5 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs text-neutral-500 w-5 text-right shrink-0 group-hover:text-neutral-400 transition-colors">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="text-xs sm:text-sm font-medium text-neutral-200 truncate group-hover:text-white transition-colors">
                        {ch.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {ch.hasPdf ? (
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-semibold bg-sky-950/80 text-sky-200 border border-sky-800/60">
                          PDF
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-medium bg-neutral-900 text-neutral-400 border border-neutral-800">
                          HTML
                        </span>
                      )}
                      {isCompleted && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
