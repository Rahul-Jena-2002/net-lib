'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Upload,
  RefreshCw,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from 'lucide-react';
import type { Book } from '@/lib/types';
import BookCard from '@/components/catalog/BookCard';
import UploadModal from '@/components/upload/UploadModal';
import { useTheme } from '@/context/ThemeContext';

export default function HomePage() {
  const { theme, toggleTheme } = useTheme();

  const [books, setBooks] = useState<Book[]>([]);
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [cols, setCols] = useState(6);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Track responsive column count to strictly enforce MAX 2 ROWS on any screen size
  useEffect(() => {
    const updateCols = () => {
      const w = window.innerWidth;
      if (w >= 1024) setCols(6);
      else if (w >= 768) setCols(4);
      else if (w >= 640) setCols(3);
      else setCols(2);
    };
    updateCols();
    window.addEventListener('resize', updateCols);
    return () => window.removeEventListener('resize', updateCols);
  }, []);

  const booksPerPage = cols * 2; // Guaranteed max 2 rows on any screen!

  // Keyboard shortcut: Cmd+K / Ctrl+K / '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch catalog books
  const fetchCatalog = async (force = false) => {
    try {
      if (force) setRefreshing(true);
      const res = await fetch(`/api/books${force ? '?refresh=true' : ''}`);
      if (res.ok) {
        const data: Book[] = await res.json();
        setBooks(data);
        return;
      }
    } catch {
      // ignore
    }
    // Fallback to static bundled catalog on GitHub Pages
    try {
      const fallbackUrl = (process.env.NEXT_PUBLIC_BASE_PATH || '') + '/data/books.json';
      const res = await fetch(fallbackUrl);
      if (res.ok) {
        const data: Book[] = await res.json();
        setBooks(data);
      }
    } catch (err) {
      console.error('Failed to load books catalog:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  // Forgiving nearest-match search (ignoring commas, punctuation, word order)
  const filteredBooks = useMemo(() => {
    let result = [...books];

    if (query.trim()) {
      const cleanStr = (s: string) =>
        s
          .toLowerCase()
          .replace(/[,.:;'"()\[\]{}_-]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

      const expandToken = (t: string) => {
        if (t === 'vol' || t === 'v') return 'volume';
        if (t === 'ch') return 'chapter';
        if (t === 'ed') return 'edition';
        return t;
      };

      const qClean = cleanStr(query);
      const tokens = qClean.split(' ').filter(Boolean);
      const expandedTokens = tokens.map(expandToken);

      const scored: { book: Book; score: number }[] = [];

      for (const b of result) {
        const pool = cleanStr([
          b.title,
          b.author,
          b.edition || '',
          b.tags.join(' '),
          b.id,
          b.publisher || '',
          ...(b.chapters?.map(c => c.title) || []),
        ].join(' '));

        let score = 0;
        if (pool.includes(qClean)) score += 100;

        let tokensMatched = 0;
        for (let i = 0; i < tokens.length; i++) {
          const raw = tokens[i];
          const exp = expandedTokens[i];

          if (pool.includes(raw) || pool.includes(exp)) {
            tokensMatched++;
            score += 15;
          } else {
            const hasPrefix = pool.split(' ').some(w => w.startsWith(raw) || raw.startsWith(w));
            if (hasPrefix) {
              tokensMatched++;
              score += 8;
            }
          }
        }

        const minRequired = tokens.length <= 2 ? tokens.length : Math.ceil(tokens.length * 0.6);
        if (tokensMatched >= minRequired || score >= 20) {
          scored.push({ book: b, score: score + tokensMatched });
        }
      }

      scored.sort((a, b) => b.score - a.score);
      result = scored.map(s => s.book);
    }

    return result;
  }, [books, query]);

  // Reset page when query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [query]);

  // Pagination for exactly 2 rows of books
  const totalPagesCount = Math.max(1, Math.ceil(filteredBooks.length / booksPerPage));
  const currentBooks = useMemo(() => {
    const start = (currentPage - 1) * booksPerPage;
    return filteredBooks.slice(start, start + booksPerPage);
  }, [filteredBooks, currentPage, booksPerPage]);

  return (
    <div className="min-h-screen flex flex-col font-sans relative selection:bg-white/20 selection:text-white">
      {/* Ambient Optical Background Lighting */}
      <div className="ambient-optical-canvas">
        <div className="ambient-light-orb-1" />
        <div className="ambient-light-orb-2" />
      </div>

      {/* Subtle top edge fade for smooth scroll occlusion */}
      <div className="fixed top-0 left-0 right-0 h-4 bg-gradient-to-b from-[var(--canvas-bg)] to-transparent pointer-events-none z-40" />

      {/* ── PINNED FLOATING APPLE LIQUID GLASS TOP NAVBAR (Fixed on Scroll) ── */}
      <header className="fixed top-0 left-0 right-0 z-50 pt-3 sm:pt-3.5 pb-2 px-3 sm:px-6 md:px-8 w-full max-w-none pointer-events-none">
        <div className="liquid-glass-nav rounded-full h-14 sm:h-15 px-3.5 sm:px-5 flex items-center justify-between gap-3 pointer-events-auto">
          {/* Left: NetLib Brand Identity */}
          <Link
            href="/"
            className="flex items-center gap-2 font-bold hover:opacity-90 transition shrink-0 group select-none"
          >
            <div className="w-7 h-7 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
              <BookOpen className="w-4.5 h-4.5 text-sky-400 group-hover:text-sky-300 transition-colors" />
            </div>
            <div className="flex flex-col">
              <span className="tracking-tight text-sm sm:text-base font-extrabold leading-tight">NetLib</span>
              <span className="text-[9px] font-semibold opacity-40 tracking-wider hidden sm:block">LIBRARY</span>
            </div>
          </Link>

          {/* Center: Apple Spotlight-Grade Search Bar (Chromeless & Transparent) */}
          <div className="flex-1 max-w-xs sm:max-w-md lg:max-w-lg mx-1 sm:mx-4 relative flex items-center group">
            <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 absolute left-3 opacity-40 group-focus-within:opacity-100 group-focus-within:text-sky-400 transition-all pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search books, authors, topics..."
              className="w-full pl-8 sm:pl-9 pr-12 sm:pr-14 py-2 bg-transparent border-0 outline-none text-xs sm:text-sm font-normal text-inherit placeholder:text-inherit placeholder:opacity-40 focus:placeholder:opacity-20 transition-all shadow-none"
            />
            {query ? (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2 p-1 rounded-full hover:bg-white/10 opacity-60 hover:opacity-100 transition"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="absolute right-2.5 hidden sm:flex items-center gap-1 pointer-events-none select-none">
                <kbd className="text-[10px] font-mono font-medium opacity-40">
                  ⌘K
                </kbd>
              </div>
            )}
          </div>

          {/* Right: Refined Action Controls (Transparent & Sleek) */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">

            {/* Rescan / Sync Button */}
            <button
              onClick={() => fetchCatalog(true)}
              disabled={refreshing}
              className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-full flex items-center justify-center text-xs opacity-75 hover:opacity-100 hover:bg-white/[0.08] disabled:opacity-30 active:scale-95 transition"
              title="Rescan library"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            {/* Add Book Button (Opens Floating Apple Liquid Glass Menu) */}
            <button
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold opacity-85 hover:opacity-100 hover:bg-white/[0.08] active:scale-95 transition cursor-pointer"
              title="Upload new publication"
            >
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden md:inline">Add Book</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── COMPACT 2-ROW BOOK SHOWCASE GRID (Fits on Screen) ── */}
      <main className="w-full max-w-none px-4 sm:px-6 md:px-8 pt-20 sm:pt-24 pb-4 flex-1 relative z-10 flex flex-col justify-between">
        {loading ? (
          <div className="py-24 text-center opacity-60 text-sm">
            Loading library books...
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="py-20 text-center max-w-md mx-auto liquid-glass rounded-2xl p-8 my-auto">
            <h3 className="text-base font-bold mb-1">No books found</h3>
            <p className="opacity-70 text-xs mb-4">
              We couldn't find matches for "{query}". Try searching with terms like "Java" or "Microservices".
            </p>
            <button
              onClick={() => setQuery('')}
              className="px-4 py-2 rounded-full liquid-glass-pill text-xs font-semibold"
            >
              Reset Search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6 gap-4 sm:gap-5 lg:gap-6">
            {currentBooks.map(book => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}

        {/* ── APPLE LIQUID GLASS 2-ROW PAGINATION BAR ── */}
        {!loading && totalPagesCount > 1 && (
          <div className="mt-5 mb-1 flex items-center justify-between border-t border-white/[0.08] pt-3 select-none">
            <span className="text-[11px] opacity-60">
              Showing {(currentPage - 1) * booksPerPage + 1}–
              {Math.min(currentPage * booksPerPage, filteredBooks.length)} of {filteredBooks.length} books
            </span>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="liquid-glass-pill px-3 py-1 rounded-full text-xs font-medium disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPagesCount }, (_, i) => i + 1).map(pageNumber => (
                  <button
                    key={pageNumber}
                    onClick={() => setCurrentPage(pageNumber)}
                    className={`w-7 h-7 rounded-full text-xs font-bold transition ${
                      currentPage === pageNumber
                        ? 'liquid-glass shadow-md scale-105'
                        : 'opacity-60 hover:opacity-100 hover:bg-white/[0.08]'
                    }`}
                  >
                    {pageNumber}
                  </button>
                ))}
              </div>

              <button
                disabled={currentPage === totalPagesCount}
                onClick={() => setCurrentPage(p => Math.min(totalPagesCount, p + 1))}
                className="liquid-glass-pill px-3 py-1 rounded-full text-xs font-medium disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Floating Apple Liquid Glass Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={() => fetchCatalog(true)}
      />
    </div>
  );
}
