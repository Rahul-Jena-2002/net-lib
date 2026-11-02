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
import BookGridSkeleton from '@/components/common/BookGridSkeleton';
import Footer from '@/components/layout/Footer';
import UploadModal from '@/components/upload/UploadModal';
import { useTheme } from '@/context/ThemeContext';

export default function HomePage() {
  const { theme, toggleTheme } = useTheme();

  const [books, setBooks] = useState<Book[]>([]);
  const [query, setQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState<'all' | 'web' | 'pdf'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [cols, setCols] = useState(6);

  const webCount = useMemo(
    () => books.filter(b => b.format === 'html' || b.hasFullHtml).length,
    [books]
  );
  const pdfCount = useMemo(
    () => books.filter(b => b.format === 'pdf' || (!b.format && !b.hasFullHtml)).length,
    [books]
  );

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
      else setLoading(true);

      let loadedBooks: Book[] = [];
      const bp = process.env.NEXT_PUBLIC_BASE_PATH || '';

      if (bp) {
        // Direct static fetch for GitHub Pages
        try {
          const res = await fetch(`${bp}/data/books.json`);
          if (res.ok) {
            loadedBooks = await res.json();
          }
        } catch (err) {
          console.error('Failed to load books catalog:', err);
        }
      } else {
        try {
          const res = await fetch(`/api/books${force ? '?refresh=true' : ''}`);
          if (res.ok) {
            loadedBooks = await res.json();
          }
        } catch {
          // ignore
        }

        if (!loadedBooks.length) {
          try {
            const fallbackUrl = '/data/books.json';
            const res = await fetch(fallbackUrl);
            if (res.ok) {
              loadedBooks = await res.json();
            }
          } catch (err) {
            console.error('Failed to load books catalog:', err);
          }
        }
      }

      setBooks(loadedBooks);
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

    if (formatFilter === 'web') {
      result = result.filter(b => b.format === 'html' || b.hasFullHtml);
    } else if (formatFilter === 'pdf') {
      result = result.filter(b => b.format === 'pdf' || (!b.format && !b.hasFullHtml));
    }

    return result;
  }, [books, query, formatFilter]);

  // Reset page when query or format filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [query, formatFilter]);

  // Pagination for exactly 2 rows of books
  const totalPagesCount = Math.max(1, Math.ceil(filteredBooks.length / booksPerPage));
  const currentBooks = useMemo(() => {
    const start = (currentPage - 1) * booksPerPage;
    return filteredBooks.slice(start, start + booksPerPage);
  }, [filteredBooks, currentPage, booksPerPage]);

  return (
    <div className="min-h-screen flex flex-col font-sans relative selection:bg-white/20 selection:text-white bg-[#0c1017]">
      {/* ── TOP NAVBAR ── */}
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#0c1017]/95 backdrop-blur-md px-4 sm:px-6 md:px-8 py-3">
        <div className="w-full flex items-center justify-between gap-3">
          {/* Left: NetLib Brand Identity */}
          <Link
            href="/"
            className="flex items-center gap-2.5 hover:opacity-90 transition shrink-0 select-none"
          >
            <div className="w-8 h-8 rounded bg-neutral-800 border border-neutral-700/60 flex items-center justify-center text-sky-400">
              <BookOpen className="w-4.5 h-4.5" />
            </div>
            <div className="flex flex-col">
              <span className="tracking-tight text-sm sm:text-base font-bold leading-tight text-white">NetLib</span>
              <span className="text-[10px] font-medium text-neutral-400 tracking-wider hidden sm:block">DIGITAL LIBRARY</span>
            </div>
          </Link>

          {/* Center: Search Bar */}
          <div className="flex-1 max-w-xs sm:max-w-md lg:max-w-lg mx-1 sm:mx-4 relative flex items-center">
            <Search className="w-4 h-4 absolute left-3 text-neutral-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search books, authors, topics..."
              className="w-full pl-9 pr-12 py-1.5 sm:py-2 bg-neutral-900/90 border border-neutral-700/70 focus:border-neutral-500 rounded-lg outline-none text-xs sm:text-sm text-neutral-200 placeholder:text-neutral-500 transition-colors"
            />
            {query ? (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2 p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="absolute right-2.5 hidden sm:flex items-center gap-1 pointer-events-none select-none">
                <kbd className="text-[10px] font-mono px-1 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700/50">
                  ⌘K
                </kbd>
              </div>
            )}
          </div>

          {/* Right: Rescan & Add Book Action Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Rescan / Sync Button */}
            <button
              onClick={() => fetchCatalog(true)}
              disabled={refreshing}
              className="w-8 h-8 rounded-lg border border-neutral-700/60 bg-neutral-900/80 flex items-center justify-center text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-40 transition-colors"
              title="Rescan library"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            {/* Add Book Button */}
            <button
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors cursor-pointer"
              title="Upload new publication"
            >
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden md:inline">Add Book</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN BOOK SHOWCASE GRID ── */}
      <main className="w-full max-w-none px-4 sm:px-6 md:px-8 pt-6 pb-8 flex-1 relative z-10 flex flex-col justify-between">
        {/* ── FORMAT FILTER BAR ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 select-none">
          {/* Unified Filter Pills */}
          <div className="inline-flex items-center p-0.5 rounded-lg bg-neutral-900/90 border border-neutral-800">
            <button
              onClick={() => setFormatFilter('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                formatFilter === 'all'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>All Editions</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                  formatFilter === 'all'
                    ? 'bg-neutral-700 text-neutral-100'
                    : 'bg-neutral-800 text-neutral-400'
                }`}
              >
                {books.length}
              </span>
            </button>

            <button
              onClick={() => setFormatFilter('web')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                formatFilter === 'web'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
              }`}
              title="Show Web edition books only"
            >
              <span>Web Version</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                  formatFilter === 'web'
                    ? 'bg-neutral-700 text-neutral-100'
                    : 'bg-neutral-800 text-neutral-400'
                }`}
              >
                {webCount}
              </span>
            </button>

            <button
              onClick={() => setFormatFilter('pdf')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                formatFilter === 'pdf'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
              }`}
              title="Show PDF edition books only"
            >
              <span>PDF Version</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                  formatFilter === 'pdf'
                    ? 'bg-neutral-700 text-neutral-100'
                    : 'bg-neutral-800 text-neutral-400'
                }`}
              >
                {pdfCount}
              </span>
            </button>
          </div>

          {/* Filter Status & Reset Action */}
          <div className="flex items-center gap-3 text-xs">
            {formatFilter !== 'all' && (
              <button
                onClick={() => setFormatFilter('all')}
                className="text-[11px] font-medium text-sky-400 hover:text-sky-300 flex items-center gap-1 hover:underline transition cursor-pointer"
              >
                <span>Reset filter</span>
                <X className="w-3 h-3" />
              </button>
            )}
            <span className="text-[11px] text-neutral-400">
              Showing {filteredBooks.length} of {books.length} books
            </span>
          </div>
        </div>

        {/* Catalog Body with Proper Skeleton Loader (Tell #28) */}
        {loading ? (
          <BookGridSkeleton count={booksPerPage} />
        ) : filteredBooks.length === 0 ? (
          <div className="py-16 text-center max-w-md mx-auto bg-[#131822] border border-white/10 rounded-xl p-8 my-auto">
            <h3 className="text-base font-bold mb-1 text-white">No books found</h3>
            <p className="text-neutral-400 text-xs mb-4">
              {formatFilter !== 'all'
                ? `No ${formatFilter === 'web' ? 'Web' : 'PDF'} editions found${
                    query ? ` matching "${query}"` : ''
                  }.`
                : `We could not find matches for "${query}". Try searching with terms like "Java" or "Architecture".`}
            </p>
            <div className="flex items-center justify-center gap-2">
              {formatFilter !== 'all' && (
                <button
                  onClick={() => setFormatFilter('all')}
                  className="px-4 py-2 rounded-lg bg-white text-slate-950 font-bold text-xs transition hover:bg-neutral-200 cursor-pointer"
                >
                  Show All Formats ({books.length})
                </button>
              )}
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-medium cursor-pointer transition-colors"
                >
                  Clear Search
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6 gap-4 sm:gap-5 lg:gap-6">
            {currentBooks.map(book => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}

        {/* ── PAGINATION BAR ── */}
        {!loading && totalPagesCount > 1 && (
          <div className="mt-8 mb-2 flex items-center justify-between border-t border-white/[0.08] pt-4 select-none">
            <span className="text-[11px] text-neutral-400">
              Showing {(currentPage - 1) * booksPerPage + 1} to {Math.min(currentPage * booksPerPage, filteredBooks.length)} of {filteredBooks.length} books
            </span>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-3 py-1 rounded-md text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900 border border-neutral-700/60 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPagesCount }, (_, i) => i + 1).map(pageNumber => (
                  <button
                    key={pageNumber}
                    onClick={() => setCurrentPage(pageNumber)}
                    className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${
                      currentPage === pageNumber
                        ? 'bg-neutral-700 text-white font-bold'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                    }`}
                  >
                    {pageNumber}
                  </button>
                ))}
              </div>

              <button
                disabled={currentPage === totalPagesCount}
                onClick={() => setCurrentPage(p => Math.min(totalPagesCount, p + 1))}
                className="px-3 py-1 rounded-md text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900 border border-neutral-700/60 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 transition-colors"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={() => fetchCatalog(true)}
      />

      {/* Footer (Terms of Service, Privacy Policy) */}
      <Footer />
    </div>
  );
}
