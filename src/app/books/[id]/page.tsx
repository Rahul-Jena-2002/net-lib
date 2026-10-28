'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  Layers,
  ArrowUpRight,
  Sun,
  Moon,
  CheckCircle2,
  Clock,
  FileText,
} from 'lucide-react';
import type { Book } from '@/lib/types';
import { getBookCoverUrl } from '@/lib/covers';
import { useTheme } from '@/context/ThemeContext';
import { loadBookProgress } from '@/lib/storage';

export default function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { theme, toggleTheme } = useTheme();

  const [book, setBook] = useState<Book | null>(null);
  const [imageError, setImageError] = useState(false);
  const [completedChapters, setCompletedChapters] = useState<string[]>([]);
  const [lastChapterId, setLastChapterId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/books')
      .then(r => r.json())
      .then((books: Book[]) => {
        const found = books.find(b => b.id === id) || null;
        setBook(found);
        if (found) {
          const prog = loadBookProgress(found.id);
          if (prog) {
            setCompletedChapters(prog.completedChapters || []);
            setLastChapterId(prog.chapterId || null);
          }
        }
      });
  }, [id]);

  if (!book) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm opacity-60">
        Loading book details...
      </div>
    );
  }

  const coverUrl = getBookCoverUrl(book.id, book.coverUrl);

  // Resume reading from last chapter or first chapter
  const targetChapterId =
    lastChapterId || (book.chapters && book.chapters.length > 0 ? book.chapters[0].id : null);

  const readHref = targetChapterId
    ? `/books/${book.id}/read?chapter=${encodeURIComponent(targetChapterId)}`
    : `/books/${book.id}/read`;

  return (
    <div className="min-h-screen flex flex-col font-sans relative selection:bg-white/20 selection:text-white">
      {/* Ambient Optical Background Lighting */}
      <div className="ambient-optical-canvas">
        <div className="ambient-light-orb-1" />
        <div className="ambient-light-orb-2" />
      </div>

      {/* Subtle top edge fade for smooth scroll occlusion */}
      <div className="fixed top-0 left-0 right-0 h-4 bg-gradient-to-b from-[var(--canvas-bg)] to-transparent pointer-events-none z-40" />

      {/* ── PINNED FLOATING APPLE LIQUID GLASS TOP NAVBAR ── */}
      <header className="fixed top-0 left-0 right-0 z-50 pt-3 pb-2 px-4 sm:px-6 md:px-8 w-full max-w-none pointer-events-none">
        <div className="liquid-glass-nav rounded-full h-14 px-5 flex items-center justify-between gap-4 pointer-events-auto">
          <Link
            href="/"
            className="flex items-center gap-1.5 opacity-75 hover:opacity-100 transition-opacity text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Library</span>
          </Link>

          <span className="text-xs font-medium truncate max-w-xs sm:max-w-md opacity-85 hidden sm:block">
            {book.title}
          </span>

          <div className="flex items-center gap-2">

            <Link
              href={readHref}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full liquid-glass-pill text-xs font-semibold"
            >
              <span>{lastChapterId ? 'Resume' : 'Start'} Reading</span>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-80" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── 100% FULL-WIDTH HERO BOOK SHOWCASE ── */}
      <main className="w-full max-w-none px-4 sm:px-6 md:px-8 pt-20 sm:pt-24 pb-8 flex-1 relative z-10">
        <div className="liquid-glass rounded-3xl p-6 sm:p-10 mb-8 w-full">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-center lg:items-start">
            {/* Book Cover with Ambient Optical Glow */}
            <div className="relative shrink-0 w-48 sm:w-56 aspect-[2/3] rounded-2xl overflow-hidden bg-slate-950 border border-white/15 flex items-center justify-center p-1.5 shadow-none">
              {coverUrl && !imageError ? (
                <img
                  src={coverUrl}
                  alt={book.title}
                  onError={() => setImageError(true)}
                  className="w-full h-full object-contain rounded-xl"
                />
              ) : (
                <div className="w-full h-full p-6 flex flex-col justify-between bg-gradient-to-br from-slate-800 to-slate-950">
                  <span className="text-xs uppercase tracking-wider opacity-60 font-semibold">
                    {book.edition || 'Volume'}
                  </span>
                  <div>
                    <h3 className="text-base font-bold leading-snug line-clamp-4 mb-2">{book.title}</h3>
                    <p className="text-xs opacity-70 truncate">{book.author}</p>
                  </div>
                  <div className="text-xs opacity-60 pt-3 border-t border-white/10">
                    {book.totalPages} pages
                  </div>
                </div>
              )}
            </div>

            {/* Book Details and Action Bar */}
            <div className="flex-1 min-w-0 text-center lg:text-left flex flex-col justify-between h-full">
              <div>
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mb-3">
                  <span className="text-xs uppercase tracking-wider font-bold px-3 py-1 rounded-full bg-white/[0.1] border border-white/15">
                    {book.edition || (book.isMultiChapter ? 'Multi-chapter Publication' : 'Single Document')}
                  </span>
                  {book.publisher && (
                    <span className="text-xs opacity-60 px-2.5 py-1">
                      {book.publisher}
                    </span>
                  )}
                </div>

                <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-3 leading-tight">
                  {book.title}
                </h1>
                <p className="text-base sm:text-lg opacity-75 mb-6 font-medium">
                  {book.author}
                </p>

                {/* Category tags */}
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-1.5 mb-8">
                  {book.tags.map(t => (
                    <span
                      key={t}
                      className="text-xs px-3 py-1 rounded-full bg-white/[0.08] border border-white/10 opacity-80"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Stats & Call to Action Bar */}
              <div>
                <div className="grid grid-cols-3 gap-3 sm:gap-6 py-4 px-6 rounded-2xl bg-white/[0.05] border border-white/10 mb-6 max-w-lg mx-auto lg:mx-0">
                  <div className="text-center">
                    <span className="text-lg sm:text-xl font-bold block">
                      {book.chapters?.length || 1}
                    </span>
                    <span className="text-[11px] opacity-60 uppercase tracking-wider">Chapters</span>
                  </div>
                  <div className="text-center border-x border-white/10">
                    <span className="text-lg sm:text-xl font-bold block">
                      {book.totalPages}
                    </span>
                    <span className="text-[11px] opacity-60 uppercase tracking-wider">Pages</span>
                  </div>
                  <div className="text-center">
                    <span className="text-lg sm:text-xl font-bold block">
                      {book.totalSize ? `${(book.totalSize / (1024 * 1024)).toFixed(1)} MB` : 'PDF'}
                    </span>
                    <span className="text-[11px] opacity-60 uppercase tracking-wider">Size</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
                  <Link
                    href={readHref}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full liquid-glass-pill font-bold text-sm"
                  >
                    <span>{lastChapterId ? 'Resume Reading' : 'Start Reading Book'}</span>
                    <ArrowUpRight className="w-4 h-4 opacity-80" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 100% FULL-WIDTH RESPONSIVE TABLE OF CONTENTS GRID ── */}
        {book.chapters && book.chapters.length > 0 && (
          <div className="liquid-glass rounded-3xl p-6 sm:p-10 w-full mb-12">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <Layers className="w-5 h-5 opacity-70" />
                <h2 className="text-lg font-bold">
                  Table of Contents
                </h2>
                <span className="text-xs opacity-50 px-2 py-0.5 rounded-full bg-white/[0.08]">
                  {book.chapters.length} chapters
                </span>
              </div>

              {completedChapters.length > 0 && (
                <span className="text-xs opacity-70 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{completedChapters.length} of {book.chapters.length} completed</span>
                </span>
              )}
            </div>

            {/* 2 or 3-column responsive grid utilizing 100% of the display */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {book.chapters.map((ch, i) => {
                const isCompleted = completedChapters.includes(ch.id);
                return (
                  <Link
                    key={ch.id}
                    href={`/books/${book.id}/read?chapter=${encodeURIComponent(ch.id)}`}
                    className="group liquid-glass rounded-2xl p-4 flex items-center justify-between gap-3 transition-all duration-200 hover:scale-[1.01] hover:-translate-y-0.5"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="font-mono text-xs opacity-40 w-6 text-right shrink-0 group-hover:opacity-80 transition-opacity">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="text-xs sm:text-sm font-medium truncate group-hover:opacity-100 transition-opacity">
                        {ch.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isCompleted && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      )}
                      <ArrowUpRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
