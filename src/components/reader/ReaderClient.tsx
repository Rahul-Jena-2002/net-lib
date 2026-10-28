'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { Book, Chapter } from '@/lib/types';
import { loadBookProgress, saveBookProgress } from '@/lib/storage';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Moon,
} from 'lucide-react';

const LiquidReader = dynamic(() => import('@/components/reader/LiquidReader'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 w-full h-full flex items-center justify-center text-xs opacity-60 flex-col gap-3">
      <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
      <span>Loading Liquid Glass Publication Engine...</span>
    </div>
  ),
});

// In-memory catalog cache to avoid redundant fetches
const booksCatalogCache = new Map<string, Book>();

export default function ReaderClient() {
  const params = useParams();
  const searchParams = useSearchParams();

  const bookId = (params?.id as string) || '';
  const initialChapterParam = searchParams.get('chapter');

  const [book, setBook] = useState<Book | null>(null);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [completedChapters, setCompletedChapters] = useState<string[]>([]);
  const [chapterMenuOpen, setChapterMenuOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Reader state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [fitWidth, setFitWidth] = useState<boolean>(true);
  const [darkInvert, setDarkInvert] = useState<boolean>(false);

  const chapterMenuRef = useRef<HTMLDivElement>(null);
  const activeChapterItemRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll to active chapter when dropdown opens
  useEffect(() => {
    if (chapterMenuOpen && activeChapterItemRef.current) {
      const timer = setTimeout(() => {
        activeChapterItemRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [chapterMenuOpen]);

  // Close chapter dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (chapterMenuRef.current && !chapterMenuRef.current.contains(e.target as Node)) {
        setChapterMenuOpen(false);
      }
    };
    if (chapterMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [chapterMenuOpen]);

  // Load Book metadata
  useEffect(() => {
    if (!bookId) return;

    if (booksCatalogCache.has(bookId)) {
      const found = booksCatalogCache.get(bookId)!;
      setBook(found);
      initChapter(found);
      return;
    }

    const loadBook = async () => {
      let books: Book[] = [];
      try {
        const res = await fetch('/api/books');
        if (res.ok) books = await res.json();
      } catch {
        // ignore
      }
      if (!books.length) {
        try {
          const fallbackUrl = (process.env.NEXT_PUBLIC_BASE_PATH || '') + '/data/books.json';
          const res = await fetch(fallbackUrl);
          if (res.ok) books = await res.json();
        } catch {
          // ignore
        }
      }
      for (const b of books) {
        booksCatalogCache.set(b.id, b);
      }
      const found = books.find(b => b.id === bookId);
      if (!found) return;
      setBook(found);
      initChapter(found);
    };
    loadBook();
  }, [bookId]);

  const initChapter = (b: Book) => {
    const savedProgress = loadBookProgress(b.id);
    if (savedProgress) {
      setCompletedChapters(savedProgress.completedChapters || []);
    }

    if (b.chapters && b.chapters.length > 0) {
      const targetChapterId = initialChapterParam || savedProgress?.chapterId;
      const initial =
        b.chapters.find(c => c.id === targetChapterId) || b.chapters[0];
      setActiveChapter(initial);
    }
  };

  // Fullscreen event listener
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(
        Boolean(
          document.fullscreenElement ||
            (document as any).webkitFullscreenElement ||
            (document as any).mozFullScreenElement
        )
      );
    };

    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    document.addEventListener('mozfullscreenchange', onFsChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      document.removeEventListener('mozfullscreenchange', onFsChange);
    };
  }, []);

  // Keyboard shortcut listener ('f' for fullscreen)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullScreen();
      } else if (e.key === 'Escape') {
        setChapterMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Chapter indices for navigation
  const currentChapterIndex = book?.chapters
    ? book.chapters.findIndex(c => c.id === activeChapter?.id)
    : -1;
  const prevChapter =
    book?.chapters && currentChapterIndex > 0 ? book.chapters[currentChapterIndex - 1] : undefined;
  const nextChapter =
    book?.chapters && currentChapterIndex !== -1 && currentChapterIndex < book.chapters.length - 1
      ? book.chapters[currentChapterIndex + 1]
      : undefined;

  // Navigate between chapters
  const goToChapter = useCallback(
    (chapter: Chapter) => {
      setActiveChapter(chapter);
      setCurrentPage(1);

      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `/books/${bookId}/read?chapter=${chapter.id}`);
      }

      setChapterMenuOpen(false);
    },
    [bookId]
  );

  const toggleChapterComplete = useCallback(
    (chapterId: string) => {
      setCompletedChapters(prev => {
        const next = prev.includes(chapterId)
          ? prev.filter(id => id !== chapterId)
          : [...prev, chapterId];
        if (book) {
          saveBookProgress({
            bookId: book.id,
            chapterId: activeChapter?.id,
            page: currentPage,
            completedChapters: next,
            percentage: book.chapters?.length ? Math.round((next.length / book.chapters.length) * 100) : 100,
            lastReadAt: new Date().toISOString(),
          });
        }
        return next;
      });
    },
    [book, activeChapter, currentPage]
  );

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      const docEl = document.documentElement;
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(err => console.warn('Fullscreen request failed:', err));
      } else if ((docEl as any).webkitRequestFullscreen) {
        (docEl as any).webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
  };

  const scrollToPage = (targetPage: number) => {
    const el = document.getElementById(`pdf-page-${targetPage}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePageChange = useCallback((curr: number, total: number) => {
    setCurrentPage(curr);
    setTotalPages(total);
  }, []);

  if (!book) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm opacity-60">
        Loading publication reader...
      </div>
    );
  }

  // Direct streaming PDF URL
  const pdfStreamUrl = activeChapter
    ? `/api/pdf?book=${encodeURIComponent(book.id)}&chapter=${encodeURIComponent(activeChapter.id)}`
    : `/api/pdf?book=${encodeURIComponent(book.id)}`;

  return (
    <div className="h-screen w-screen flex flex-col font-sans overflow-hidden bg-[#07090e] text-slate-100 select-none relative">
      {/* Ambient Optical Background Lighting */}
      <div className="ambient-optical-canvas">
        <div className="ambient-light-orb-1" />
        <div className="ambient-light-orb-2" />
      </div>

      {/* ── PINNED FLOATING APPLE LIQUID GLASS TOP NAVBAR (Fixed Over Scrolling Content) ── */}
      <header className="fixed top-0 left-0 right-0 z-50 pt-3 sm:pt-3.5 pb-2 px-3 sm:px-6 md:px-8 w-full max-w-none pointer-events-none">
        <div className="liquid-glass-nav rounded-full h-14 sm:h-15 px-3.5 sm:px-5 flex items-center justify-between gap-2 sm:gap-3 pointer-events-auto shadow-none">
          {/* Left: Library Back, Book Title & Custom Liquid Glass Chapter Dropdown */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <Link
              href={`/books/${book.id}`}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold text-slate-200 hover:text-white hover:bg-white/10 transition shrink-0"
              title="Back to Book Overview"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Overview</span>
            </Link>

            <span className="text-white/30 hidden sm:inline">|</span>

            {/* Book Title */}
            <span className="text-xs sm:text-sm font-bold truncate max-w-[100px] sm:max-w-xs text-white">
              {book.title}
            </span>

            {/* Custom Apple Liquid Glass Chapter Dropdown Menu */}
            {book.chapters && book.chapters.length > 0 && (
              <div className="relative min-w-0" ref={chapterMenuRef}>
                <button
                  onClick={() => setChapterMenuOpen(prev => !prev)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold ${
                    chapterMenuOpen
                      ? 'liquid-glass-trigger active'
                      : 'liquid-glass-trigger'
                  }`}
                  title="Select chapter"
                >
                  <span className="max-w-[130px] sm:max-w-[200px] md:max-w-[280px] truncate text-white">
                    {activeChapter?.title || 'Select Chapter'}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      chapterMenuOpen ? 'rotate-180 text-sky-400' : 'text-slate-300'
                    }`}
                  />
                </button>

                {/* Floating Apple VisionOS Liquid Glass Dropdown Menu (Short & Scrollable max ~5 items) */}
                {chapterMenuOpen && (
                  <div className="absolute top-full left-0 mt-2.5 w-80 sm:w-96 rounded-2xl liquid-glass-dropdown z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    {/* Liquid Glass Header */}
                    <div className="px-3.5 py-2.5 border-b border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,1)]" />
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-200">Chapters</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-300">
                        {book.chapters.length} chapters · {completedChapters.length} done
                      </span>
                    </div>

                    {/* Scrollable List: Compact max-height showing ~5 chapters */}
                    <div className="max-h-[220px] overflow-y-auto glass-scroll p-1.5 space-y-1">
                      {book.chapters.map((ch, idx) => {
                        const isActive = ch.id === activeChapter?.id;
                        const isDone = completedChapters.includes(ch.id);

                        return (
                          <button
                            key={ch.id}
                            ref={isActive ? activeChapterItemRef : undefined}
                            onClick={() => {
                              goToChapter(ch);
                              setChapterMenuOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between text-xs relative group ${
                              isActive
                                ? 'liquid-glass-active-item font-bold'
                                : 'liquid-glass-item'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              {isActive ? (
                                <span className="w-2 h-2 rounded-full bg-cyan-300 shrink-0 shadow-[0_0_8px_#38bdf8] animate-pulse" />
                              ) : (
                                <span className="font-mono text-[11px] shrink-0 w-5 text-slate-400 group-hover:text-sky-300 font-semibold">
                                  {String(idx + 1).padStart(2, '0')}
                                </span>
                              )}
                              <span className={`truncate ${isActive ? 'text-white font-bold' : 'text-slate-100 font-medium group-hover:text-white'}`}>
                                {ch.title}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                              {ch.pageCount && (
                                <span
                                  className={`text-[10px] font-mono ${
                                    isActive ? 'text-sky-200 font-semibold' : 'text-slate-400 group-hover:text-slate-300'
                                  }`}
                                >
                                  {ch.pageCount}p
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Center: Dynamic Continuous Page Navigation */}
          {totalPages > 0 && (
            <div className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <button
                disabled={currentPage <= 1}
                onClick={() => scrollToPage(currentPage - 1)}
                className="p-1 rounded-full hover:bg-white/10 disabled:opacity-20 text-slate-200 hover:text-white transition"
                title="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/[0.08] text-slate-100 border border-white/10">
                Page {currentPage} of {totalPages}
              </span>

              <button
                disabled={currentPage >= totalPages}
                onClick={() => scrollToPage(currentPage + 1)}
                className="p-1 rounded-full hover:bg-white/10 disabled:opacity-20 text-slate-200 hover:text-white transition"
                title="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Right: Zoom, Fit Width, Night Mode, Chapters, Completed, Fullscreen */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Zoom Out */}
            <button
              onClick={() => setScale(s => Math.max(0.6, s - 0.15))}
              className="p-1.5 rounded-full hover:bg-white/10 text-slate-200 hover:text-white transition hidden lg:inline-flex"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            {/* Fit Width Toggle */}
            <button
              onClick={() => setFitWidth(w => !w)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                fitWidth
                  ? 'text-sky-300 bg-sky-500/20 border border-sky-400/30'
                  : 'text-slate-200 hover:text-white hover:bg-white/10'
              }`}
              title="Toggle Fit to Screen Width"
            >
              <Maximize className="w-3 h-3" />
              <span className="hidden xl:inline">Fit Width</span>
            </button>

            {/* Zoom In */}
            <button
              onClick={() => setScale(s => Math.min(2.0, s + 0.15))}
              className="p-1.5 rounded-full hover:bg-white/10 text-slate-200 hover:text-white transition hidden lg:inline-flex"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            {/* Night Paper / Dark Mode Invert */}
            <button
              onClick={() => setDarkInvert(d => !d)}
              className={`p-1.5 rounded-full transition text-xs ${
                darkInvert
                  ? 'text-amber-300 bg-amber-500/20'
                  : 'text-slate-200 hover:text-white hover:bg-white/10'
              }`}
              title="Toggle Night Paper Inversion"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>

            {/* Chapter Prev / Next Navigation */}
            {book.chapters && book.chapters.length > 1 && (
              <div className="flex items-center gap-0.5">
                <button
                  disabled={!prevChapter}
                  onClick={() => prevChapter && goToChapter(prevChapter)}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-0.5 text-slate-200 hover:text-white disabled:opacity-30 hover:bg-white/10 transition"
                  title={prevChapter ? `Previous: ${prevChapter.title}` : 'First chapter'}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">Prev</span>
                </button>
                <button
                  disabled={!nextChapter}
                  onClick={() => nextChapter && goToChapter(nextChapter)}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-0.5 text-slate-200 hover:text-white disabled:opacity-30 hover:bg-white/10 transition"
                  title={nextChapter ? `Next: ${nextChapter.title}` : 'Last chapter'}
                >
                  <span className="hidden xl:inline">Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Mark Chapter Completed */}
            {activeChapter && (
              <button
                onClick={() => toggleChapterComplete(activeChapter.id)}
                className={`px-2.5 py-1 rounded-full transition flex items-center gap-1 text-xs font-semibold hover:bg-white/10 ${
                  completedChapters.includes(activeChapter.id)
                    ? 'text-emerald-300 bg-emerald-500/20'
                    : 'text-slate-200 hover:text-white'
                }`}
                title={
                  completedChapters.includes(activeChapter.id)
                    ? 'Chapter completed ✓'
                    : 'Mark chapter as completed'
                }
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">
                  {completedChapters.includes(activeChapter.id) ? 'Completed' : 'Done'}
                </span>
              </button>
            )}

            {/* Full Screen Mode Toggle */}
            <button
              onClick={toggleFullScreen}
              className={`p-1.5 rounded-full transition text-xs hover:bg-white/10 ${
                isFullscreen ? 'text-sky-400' : 'text-slate-200 hover:text-white'
              }`}
              title={isFullscreen ? 'Exit Full Screen (F)' : 'Enter Full Screen (F)'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </header>

      {/* ── CONTINUOUS SCROLLING PDF CANVAS (Full-Page Edge-to-Edge) ── */}
      <main className="flex-1 w-full h-full relative overflow-hidden flex flex-col">
        <LiquidReader
          key={pdfStreamUrl}
          pdfUrl={pdfStreamUrl}
          bookTitle={book.title}
          activeChapterTitle={activeChapter?.title}
          currentPage={currentPage}
          onPageChange={handlePageChange}
          scale={scale}
          fitWidth={fitWidth}
          darkInvert={darkInvert}
        />
      </main>
    </div>
  );
}
