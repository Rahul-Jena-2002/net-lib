'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Book, Chapter, FontSize, ReaderWidth, Theme } from '@/lib/types';
import { loadBookProgress, saveBookProgress } from '@/lib/storage';
import { generateChapterPdfBlobUrl } from '@/lib/pdfGenerator';
import LiquidHtmlReader from '@/components/reader/LiquidHtmlReader';

const getBasePath = (): string => {
  if (process.env.NEXT_PUBLIC_BASE_PATH) return process.env.NEXT_PUBLIC_BASE_PATH;
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/net-lib')) {
    return '/net-lib';
  }
  return '';
};

import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  FileText,
  Maximize2,
  Minimize2,
  Moon,
  Sun,
  Type,
} from 'lucide-react';

// In-memory catalog cache to avoid redundant fetches
const booksCatalogCache = new Map<string, Book>();

export default function ReaderClient() {
  const params = useParams();
  const searchParams = useSearchParams();

  const bookId = (params?.id as string) || '';
  const initialChapterParam = searchParams.get('chapter');
  const initialFormatParam = searchParams.get('format'); // 'html' | 'pdf'

  const [book, setBook] = useState<Book | null>(null);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [completedChapters, setCompletedChapters] = useState<string[]>([]);
  const [chapterMenuOpen, setChapterMenuOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Format mode: strictly respect URL ?format param immediately
  const [formatMode, setFormatMode] = useState<'pdf' | 'html'>(
    initialFormatParam === 'html' ? 'html' : 'pdf'
  );

  // HTML reader typography, theme & width controls
  const [readerTheme, setReaderTheme] = useState<Theme>('dark');

  // Load saved theme from localStorage on client mount
  useEffect(() => {
    try {
      const saved = (localStorage.getItem('netlib_reader_theme') || localStorage.getItem('netlib_theme')) as Theme;
      if (saved && (saved === 'dark' || saved === 'sepia' || saved === 'light')) {
        setReaderTheme(saved);
      }
    } catch {}
  }, []);

  const handleThemeChange = (newTheme: Theme) => {
    setReaderTheme(newTheme);
    try {
      localStorage.setItem('netlib_reader_theme', newTheme);
      localStorage.setItem('netlib_theme', newTheme);
    } catch {}
  };

  const [fontSize, setFontSize] = useState<FontSize>('md');
  const [readerWidth, setReaderWidth] = useState<ReaderWidth>('full');

  // Dropdown open states
  const [themeMenuOpen, setThemeMenuOpen] = useState<boolean>(false);
  const [fontSizeMenuOpen, setFontSizeMenuOpen] = useState<boolean>(false);
  const [widthMenuOpen, setWidthMenuOpen] = useState<boolean>(false);

  // PDF reader state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [fitWidth, setFitWidth] = useState<boolean>(true);
  const [activePdfUrl, setActivePdfUrl] = useState<string>('');

  const chapterMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const fontSizeMenuRef = useRef<HTMLDivElement>(null);
  const widthMenuRef = useRef<HTMLDivElement>(null);
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

  // Unified close for all dropdown menus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (chapterMenuRef.current && !chapterMenuRef.current.contains(target)) {
        setChapterMenuOpen(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(target)) {
        setThemeMenuOpen(false);
      }
      if (fontSizeMenuRef.current && !fontSizeMenuRef.current.contains(target)) {
        setFontSizeMenuOpen(false);
      }
      if (widthMenuRef.current && !widthMenuRef.current.contains(target)) {
        setWidthMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

function ensureCoverChapter(b: Book): Book {
  if (!b.chapters || b.chapters.length === 0) return b;
  const hasCover = b.chapters.some(
    c => c.id === 'cover' || c.priority === 0 || /\bcover(\s*page)?\b/i.test(c.title)
  );
  if (!hasCover && b.coverUrl) {
    const coverChapter: Chapter = {
      id: 'cover',
      title: 'Cover Page',
      filename: 'cover.html',
      order: 1,
      priority: 0,
      pageCount: 1,
      fileSize: 1024,
      htmlFilename: 'cover.html',
      hasHtml: true,
      hasPdf: false,
      format: 'html',
    };
    return {
      ...b,
      chapters: [coverChapter, ...b.chapters.map((ch, idx) => ({ ...ch, order: idx + 2 }))],
    };
  }
  return b;
}

  // Load Book metadata
  useEffect(() => {
    if (!bookId) return;

    if (booksCatalogCache.has(bookId)) {
      const found = ensureCoverChapter(booksCatalogCache.get(bookId)!);
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
          const fallbackUrl = `${getBasePath()}/data/books.json`;
          const res = await fetch(fallbackUrl);
          if (res.ok) books = await res.json();
        } catch {
          // ignore
        }
      }
      for (const b of books) {
        booksCatalogCache.set(b.id, b);
      }
      const rawFound = books.find(b => b.id === bookId);
      if (!rawFound) return;
      const found = ensureCoverChapter(rawFound);
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
        (targetChapterId ? b.chapters.find(c => c.id === targetChapterId) : null) ||
        (initialFormatParam === 'html' ? b.chapters.find(c => c.hasHtml) : null) ||
        (initialFormatParam === 'pdf' ? b.chapters.find(c => c.hasPdf) : null) ||
        b.chapters[0];
      setActiveChapter(initial);
      
      const determinedFormat: 'pdf' | 'html' =
        initialFormatParam === 'html' ? 'html' :
        initialFormatParam === 'pdf' ? 'pdf' :
        (initial.hasPdf ? 'pdf' : 'html');
      setFormatMode(determinedFormat);

      if (typeof window !== 'undefined') {
        const bp = getBasePath();
        window.history.replaceState(
          null,
          '',
          `${bp}/books/${b.id}/read?chapter=${encodeURIComponent(initial.id)}&format=${determinedFormat}`
        );
      }
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
        setThemeMenuOpen(false);
        setFontSizeMenuOpen(false);
        setWidthMenuOpen(false);
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
    (chapter: Chapter, forcedFormat?: 'html' | 'pdf') => {
      setActiveChapter(chapter);
      setCurrentPage(1);

      const targetFormat = forcedFormat || formatMode;
      setFormatMode(targetFormat);

      if (typeof window !== 'undefined') {
        const bp = getBasePath();
        window.history.replaceState(
          null,
          '',
          `${bp}/books/${bookId}/read?chapter=${encodeURIComponent(chapter.id)}&format=${targetFormat}`
        );
      }

      setChapterMenuOpen(false);
    },
    [bookId, formatMode]
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

  // Cycle font size
  const cycleFontSize = () => {
    const sizes: FontSize[] = ['sm', 'md', 'lg', 'xl'];
    const nextIdx = (sizes.indexOf(fontSize) + 1) % sizes.length;
    setFontSize(sizes[nextIdx]);
  };

  // Cycle width
  const cycleWidth = () => {
    const widths: ReaderWidth[] = ['narrow', 'standard', 'wide', 'full'];
    const nextIdx = (widths.indexOf(readerWidth) + 1) % widths.length;
    setReaderWidth(widths[nextIdx]);
  };

  // Dynamic chapter PDF URL: generates specific PDF blob on static hosts, or streams from /api/pdf
  useEffect(() => {
    if (!book) return;
    const isStaticHost =
      typeof window !== 'undefined' &&
      (window.location.hostname.includes('github.io') || window.location.protocol === 'file:');

    if (isStaticHost) {
      const chapterTitle = activeChapter?.title || book.title;
      const chapterNum = activeChapter?.chapterNumber || activeChapter?.order || 1;
      const pages = activeChapter?.pageCount ? Math.min(Math.max(activeChapter.pageCount, 3), 6) : 3;
      const blobUrl = generateChapterPdfBlobUrl(book.title, chapterTitle, chapterNum, book.author, pages);
      setActivePdfUrl(blobUrl);
      return () => {
        URL.revokeObjectURL(blobUrl);
      };
    } else {
      const url = activeChapter
        ? `/api/pdf?book=${encodeURIComponent(book.id)}&chapter=${encodeURIComponent(activeChapter.id)}`
        : `/api/pdf?book=${encodeURIComponent(book.id)}`;
      setActivePdfUrl(url);
    }
  }, [book, activeChapter]);

  if (!book) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm opacity-60">
        Loading reader...
      </div>
    );
  }

  const pdfStreamUrl =
    activePdfUrl ||
    (activeChapter
      ? `/api/pdf?book=${encodeURIComponent(book.id)}&chapter=${encodeURIComponent(activeChapter.id)}`
      : `/api/pdf?book=${encodeURIComponent(book.id)}`);

  const hasBothFormats = Boolean(activeChapter?.hasHtml && activeChapter?.hasPdf);

  const isLight = readerTheme === 'light' || readerTheme === 'sepia';

  return (
    <div
      className={`h-screen w-screen flex flex-col font-sans overflow-hidden select-none relative transition-colors duration-200 ease-out ${
        readerTheme === 'sepia'
          ? 'reader-theme-sepia bg-[#fbf8f1] text-[#2d261e]'
          : readerTheme === 'light'
          ? 'reader-theme-light bg-[#f8f9fa] text-slate-900'
          : 'reader-theme-dark bg-[#0c1017] text-slate-100'
      }`}
      style={{
        backgroundColor: readerTheme === 'sepia' ? '#fbf8f1' : readerTheme === 'light' ? '#f8f9fa' : '#0c1017',
        color: readerTheme === 'sepia' ? '#2d261e' : readerTheme === 'light' ? '#1e293b' : '#f1f5f9',
      }}
    >
      {/* ── TOP VIEWPORT SOFT DIFFUSION VEIL ── */}
      <div
        className={`reader-top-veil ${
          readerTheme === 'dark'
            ? 'reader-top-veil-dark'
            : readerTheme === 'sepia'
            ? 'reader-top-veil-sepia'
            : 'reader-top-veil-light'
        }`}
      />

      {/* ── CLEAN READER HEADER BAR ── */}
      <header className="fixed top-0 left-0 right-0 z-50 pt-2.5 pb-2 px-3 sm:px-6 md:px-8 w-full max-w-none pointer-events-none">
        <div className="liquid-glass-nav rounded-lg h-12 px-3 sm:px-4 flex items-center justify-between gap-2 pointer-events-auto shadow-sm">
          {/* Left: Library Back, Book Title & Chapter Dropdown */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <Link
              href={`/books/${book.id}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition shrink-0 ${
                isLight ? 'text-black hover:bg-black/[0.06]' : 'text-slate-200 hover:text-white hover:bg-white/[0.08]'
              }`}
              title="Back to Book Overview"
            >
              <ArrowLeft className={`w-3.5 h-3.5 ${isLight ? 'text-black' : ''}`} />
              <span className="hidden sm:inline">Overview</span>
            </Link>

            <span className={`hidden lg:inline ${isLight ? 'text-black/30' : 'text-white/40'}`}>/</span>

            {/* Book Title */}
            <span
              className={`text-xs font-bold truncate max-w-[120px] lg:max-w-[200px] hidden lg:inline ${
                isLight ? 'text-black' : 'text-white/90'
              }`}
            >
              {book.title}
            </span>

            {/* Custom Apple Liquid Glass Chapter Dropdown Menu */}
            {book.chapters && book.chapters.length > 0 && (
              <div className="relative min-w-0" ref={chapterMenuRef}>
                <button
                  onClick={() => setChapterMenuOpen(prev => !prev)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                    isLight
                      ? chapterMenuOpen
                        ? 'text-black bg-black/[0.08]'
                        : 'text-black hover:bg-black/[0.06]'
                      : chapterMenuOpen
                      ? 'text-white bg-white/[0.08]'
                      : 'text-slate-200 hover:text-white hover:bg-white/[0.08]'
                  }`}
                  title="Select chapter"
                >
                  <span
                    className={`max-w-[120px] sm:max-w-[170px] md:max-w-[230px] truncate ${
                      isLight ? 'text-black font-semibold' : 'text-white'
                    }`}
                  >
                    {activeChapter?.title || 'Select Chapter'}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      chapterMenuOpen ? 'rotate-180' : ''
                    } ${isLight ? 'text-black' : 'text-slate-400'}`}
                  />
                </button>

                {/* Chapter Dropdown Menu */}
                {chapterMenuOpen && (
                  <div className="absolute top-full left-0 mt-2.5 w-80 sm:w-96 rounded-2xl liquid-glass-dropdown z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    {/* Header */}
                    <div className={`px-3.5 py-2.5 border-b flex items-center justify-between ${isLight ? 'border-black/10' : 'border-white/10'}`}>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${isLight ? 'bg-black' : 'bg-slate-400'}`} />
                        <span className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-black font-bold' : 'text-slate-300'}`}>Chapters</span>
                      </div>
                      <span className={`text-[11px] font-mono ${isLight ? 'text-neutral-500' : 'text-slate-400'}`}>
                        {book.chapters.length} chapters · {completedChapters.length} done
                      </span>
                    </div>

                    {/* Scrollable List: Compact max-height */}
                    <div className="max-h-[260px] overflow-y-auto glass-scroll p-1.5 space-y-1">
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
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isLight ? 'bg-black' : 'bg-white'}`} />
                              ) : (
                                <span className={`font-mono text-[11px] shrink-0 w-5 font-semibold ${isLight ? 'text-neutral-500 group-hover:text-black' : 'text-slate-400 group-hover:text-slate-200'}`}>
                                  {String(idx + 1).padStart(2, '0')}
                                </span>
                              )}
                              <span className={`truncate ${isActive ? (isLight ? 'text-black font-bold' : 'text-white font-bold') : (isLight ? 'text-neutral-800 font-medium group-hover:text-black' : 'text-slate-200 font-medium group-hover:text-white')}`}>
                                {ch.title}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Format indicator badge: Show PDF as default */}
                              {ch.hasPdf ? (
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${isLight ? 'bg-sky-100 text-sky-800 border border-sky-300' : 'bg-sky-950/80 text-sky-200 border border-sky-800/60'}`}>
                                  PDF
                                </span>
                              ) : (
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${isLight ? 'bg-black/[0.05] text-neutral-600 border border-black/10' : 'bg-neutral-800 text-neutral-400 border border-neutral-700'}`}>
                                  Web
                                </span>
                              )}

                              {isDone ? (
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold flex items-center gap-1 ${isLight ? 'bg-black/[0.08] text-black border border-black/15 font-bold' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                                  <Check className={`w-2.5 h-2.5 ${isLight ? 'text-black' : ''}`} /> Done
                                </span>
                              ) : isActive ? (
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold flex items-center gap-1 ${isLight ? 'bg-black/[0.08] text-black border border-black/15 font-bold' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${isLight ? 'bg-black' : 'bg-sky-400'} animate-pulse`} /> Reading
                                </span>
                              ) : null}
                              {ch.pageCount && (
                                <span
                                  className={`text-[10px] font-mono ${
                                    isActive
                                      ? isLight ? 'text-black font-semibold' : 'text-slate-300 font-semibold'
                                      : isLight ? 'text-neutral-500 group-hover:text-black' : 'text-slate-400 group-hover:text-slate-300'
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



          {/* Right: Mode controls, Themes, Fullscreen */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Format Mode Switcher (PDF default / HTML) */}
            {activeChapter?.hasHtml && activeChapter?.hasPdf && (
              <div className="flex items-center rounded-lg p-0.5 bg-black/20 border border-white/10 text-xs mr-1">
                <button
                  onClick={() => goToChapter(activeChapter, 'pdf')}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                    formatMode === 'pdf'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : isLight
                      ? 'text-neutral-700 hover:text-black'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Native PDF Viewer (Default, unparsed)"
                >
                  PDF
                </button>
                <button
                  onClick={() => goToChapter(activeChapter, 'html')}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                    formatMode === 'html'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : isLight
                      ? 'text-neutral-700 hover:text-black'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Web Reader"
                >
                  Web
                </button>
              </div>
            )}
            {/* HTML Mode: Font Size Dropdown */}
            {formatMode === 'html' && activeChapter?.hasHtml && (
              <div className="relative" ref={fontSizeMenuRef}>
                <button
                  onClick={() => {
                    setFontSizeMenuOpen(v => !v);
                    setThemeMenuOpen(false);
                    setWidthMenuOpen(false);
                  }}
                  className={`px-2.5 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                    fontSizeMenuOpen
                      ? isLight
                        ? 'text-black bg-black/[0.08]'
                        : 'text-white bg-white/[0.08]'
                      : isLight
                      ? 'text-black hover:bg-black/[0.06]'
                      : 'text-slate-200 hover:text-white hover:bg-white/[0.08]'
                  }`}
                  title="Text Size"
                >
                  <Type className={`w-3.5 h-3.5 ${isLight ? 'text-black' : 'text-slate-300'}`} />
                  <span className={`text-[11px] font-semibold ${isLight ? 'text-black' : ''}`}>
                    {fontSize === 'sm' ? 'Small' : fontSize === 'md' ? 'Medium' : fontSize === 'lg' ? 'Large' : 'XL'}
                  </span>
                  <ChevronDown className={`w-3 h-3 ${isLight ? 'text-black' : ''} transition-transform ${fontSizeMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {fontSizeMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 w-36 rounded-xl liquid-glass-dropdown z-50 overflow-hidden shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-150">
                    <div className={`px-3 py-1.5 border-b text-[10px] font-bold uppercase tracking-wider ${isLight ? 'border-black/10 text-neutral-500' : 'border-white/10 text-slate-400'}`}>
                      Text Size
                    </div>
                    {(
                      [
                        { id: 'sm', label: 'Small' },
                        { id: 'md', label: 'Medium' },
                        { id: 'lg', label: 'Large' },
                        { id: 'xl', label: 'Extra Large' },
                      ] as const
                    ).map(item => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setFontSize(item.id);
                          setFontSizeMenuOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors cursor-pointer ${
                          fontSize === item.id
                            ? isLight
                              ? 'bg-black/10 text-black font-semibold'
                              : 'bg-white/15 text-white font-semibold'
                            : isLight
                            ? 'text-neutral-800 hover:bg-black/5 hover:text-black'
                            : 'text-slate-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span>{item.label}</span>
                        {fontSize === item.id && (
                          <Check className={`w-3.5 h-3.5 ${isLight ? 'text-black' : 'text-sky-400'}`} />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* HTML Mode: Reader Width Dropdown */}
            {formatMode === 'html' && activeChapter?.hasHtml && (
              <div className="relative" ref={widthMenuRef}>
                <button
                  onClick={() => {
                    setWidthMenuOpen(v => !v);
                    setThemeMenuOpen(false);
                    setFontSizeMenuOpen(false);
                  }}
                  className={`px-2.5 py-1.5 rounded-full text-xs font-semibold transition hidden sm:flex items-center gap-1.5 cursor-pointer ${
                    widthMenuOpen
                      ? isLight
                        ? 'text-black bg-black/[0.08]'
                        : 'text-white bg-white/[0.08]'
                      : isLight
                      ? 'text-black hover:bg-black/[0.06]'
                      : 'text-slate-200 hover:text-white hover:bg-white/[0.08]'
                  }`}
                  title="Reading Width"
                >
                  <span className={`capitalize text-[11px] font-medium ${isLight ? 'text-black font-semibold' : ''}`}>
                    {readerWidth === 'full' ? 'Full Width' : readerWidth}
                  </span>
                  <ChevronDown className={`w-3 h-3 ${isLight ? 'text-black' : ''} transition-transform ${widthMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {widthMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 w-36 rounded-xl liquid-glass-dropdown z-50 overflow-hidden shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-150">
                    <div className={`px-3 py-1.5 border-b text-[10px] font-bold uppercase tracking-wider ${isLight ? 'border-black/10 text-neutral-500' : 'border-white/10 text-slate-400'}`}>
                      Reading Width
                    </div>
                    {(
                      [
                        { id: 'full', label: 'Full Width' },
                        { id: 'wide', label: 'Wide' },
                        { id: 'standard', label: 'Standard' },
                        { id: 'narrow', label: 'Narrow' },
                      ] as const
                    ).map(item => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setReaderWidth(item.id);
                          setWidthMenuOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors cursor-pointer ${
                          readerWidth === item.id
                            ? isLight
                              ? 'bg-black/10 text-black font-semibold'
                              : 'bg-white/15 text-white font-semibold'
                            : isLight
                            ? 'text-neutral-800 hover:bg-black/5 hover:text-black'
                            : 'text-slate-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span>{item.label}</span>
                        {readerWidth === item.id && (
                          <Check className={`w-3.5 h-3.5 ${isLight ? 'text-black' : 'text-sky-400'}`} />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Theme Dropdown (Dark, Pure Grayscale, Light) */}
            <div className="relative" ref={themeMenuRef}>
              <button
                onClick={() => {
                  setThemeMenuOpen(v => !v);
                  setFontSizeMenuOpen(false);
                  setWidthMenuOpen(false);
                }}
                className={`px-2.5 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                  themeMenuOpen
                    ? isLight
                      ? 'text-black bg-black/[0.08]'
                      : 'text-white bg-white/[0.08]'
                    : isLight
                    ? 'text-black hover:bg-black/[0.06]'
                    : 'text-slate-200 hover:text-white hover:bg-white/[0.08]'
                }`}
                title="Theme"
              >
                {readerTheme === 'dark' && <Moon className="w-3.5 h-3.5 text-slate-300" />}
                {readerTheme === 'sepia' && <FileText className={`w-3.5 h-3.5 ${isLight ? 'text-black' : 'text-slate-300'}`} />}
                {readerTheme === 'light' && (
                  <Sun className={`w-3.5 h-3.5 ${isLight ? 'text-black' : 'text-amber-400'}`} />
                )}
                <span className={`hidden sm:inline capitalize text-[11px] font-semibold ${isLight ? 'text-black' : ''}`}>
                  {readerTheme === 'sepia' ? 'Sepia' : readerTheme}
                </span>
                <ChevronDown className={`w-3 h-3 ${isLight ? 'text-black' : ''} transition-transform ${themeMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {themeMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-40 rounded-lg liquid-glass-dropdown z-50 overflow-hidden shadow-lg py-1 animate-in fade-in zoom-in-95 duration-150">
                  <div className={`px-3 py-1.5 border-b text-[10px] font-bold uppercase tracking-wider ${isLight ? 'border-black/10 text-neutral-500' : 'border-white/10 text-slate-400'}`}>
                    Theme
                  </div>
                  {[
                    {
                      id: 'dark' as Theme,
                      label: 'Dark',
                      icon: Moon,
                      color: isLight ? 'text-neutral-700' : 'text-slate-300',
                    },
                    {
                      id: 'sepia' as Theme,
                      label: 'Sepia',
                      icon: FileText,
                      color: isLight ? 'text-amber-800' : 'text-amber-300',
                    },
                    {
                      id: 'light' as Theme,
                      label: 'Light',
                      icon: Sun,
                      color: isLight ? 'text-amber-600' : 'text-amber-400',
                    },
                  ].map(item => {
                    const IconComp = item.icon;
                    const isSelected = readerTheme === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          handleThemeChange(item.id);
                          setThemeMenuOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? isLight
                              ? 'bg-black/10 text-black font-semibold'
                              : 'bg-white/15 text-white font-semibold'
                            : isLight
                            ? 'text-neutral-800 hover:bg-black/5 hover:text-black'
                            : 'text-slate-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <IconComp className={`w-4 h-4 shrink-0 ${item.color}`} />
                          <span>{item.label}</span>
                        </div>
                        {isSelected && (
                          <Check className={`w-3.5 h-3.5 ${isLight ? 'text-black' : 'text-sky-400'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Chapter Prev / Next Navigation */}
            {book.chapters && book.chapters.length > 1 && (
              <div className="flex items-center gap-0.5 p-0.5 rounded-full">
                <button
                  disabled={!prevChapter}
                  onClick={() => prevChapter && goToChapter(prevChapter)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                    isLight
                      ? 'text-black hover:bg-black/[0.06]'
                      : 'text-slate-200 hover:text-white hover:bg-white/[0.08]'
                  } disabled:opacity-25 transition cursor-pointer`}
                  title={prevChapter ? `Previous: ${prevChapter.title}` : 'First chapter'}
                >
                  <ChevronLeft className={`w-3.5 h-3.5 ${isLight ? 'text-black' : ''}`} />
                  <span className="hidden sm:inline">Prev</span>
                </button>
                <button
                  disabled={!nextChapter}
                  onClick={() => nextChapter && goToChapter(nextChapter)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                    isLight
                      ? 'text-black hover:bg-black/[0.06]'
                      : 'text-slate-200 hover:text-white hover:bg-white/[0.08]'
                  } disabled:opacity-25 transition cursor-pointer`}
                  title={nextChapter ? `Next: ${nextChapter.title}` : 'Last chapter'}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className={`w-3.5 h-3.5 ${isLight ? 'text-black' : ''}`} />
                </button>
              </div>
            )}

            {/* Active Chapter Reading Status Button: "In Progress" or "Done" */}
            {activeChapter && (
              <button
                onClick={() => toggleChapterComplete(activeChapter.id)}
                className={`px-2.5 py-1.5 rounded-full transition flex items-center gap-1.5 text-xs font-semibold ${
                  isLight ? 'hover:bg-black/[0.06]' : 'hover:bg-white/[0.08]'
                } cursor-pointer`}
                title={
                  completedChapters.includes(activeChapter.id)
                    ? 'Completed! Click to mark In Progress'
                    : 'In Progress. Click to mark as Done'
                }
              >
                {completedChapters.includes(activeChapter.id) ? (
                  <>
                    <CheckCircle2
                      className={`w-3.5 h-3.5 ${isLight ? 'text-black' : 'text-emerald-400'}`}
                    />
                    <span className={isLight ? 'text-black font-bold' : 'text-emerald-300'}>Done</span>
                  </>
                ) : (
                  <>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isLight ? 'bg-black' : 'bg-sky-400'
                      } animate-pulse`}
                    />
                    <span className={isLight ? 'text-black font-semibold' : 'text-sky-300'}>In Progress</span>
                  </>
                )}
              </button>
            )}

            {/* Full Screen Mode Toggle */}
            <button
              onClick={toggleFullScreen}
              className={`p-1.5 rounded-full transition text-xs cursor-pointer ${
                isFullscreen
                  ? isLight
                    ? 'text-black bg-black/[0.08]'
                    : 'text-white bg-white/[0.08]'
                  : isLight
                  ? 'text-black hover:bg-black/[0.06]'
                  : 'text-slate-200 hover:text-white hover:bg-white/[0.08]'
              }`}
              title={isFullscreen ? 'Exit Full Screen (F)' : 'Enter Full Screen (F)'}
            >
              {isFullscreen ? (
                <Minimize2 className={`w-3.5 h-3.5 ${isLight ? 'text-black' : ''}`} />
              ) : (
                <Maximize2 className={`w-3.5 h-3.5 ${isLight ? 'text-black' : ''}`} />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── CONTINUOUS SCROLLING CANVAS (Completely Isolated HTML vs PDF) ── */}
      <main className="flex-1 w-full min-h-0 relative overflow-hidden flex flex-col">
        {formatMode === 'html' ? (
          <LiquidHtmlReader
            key={`html_${book.id}_${activeChapter?.id || 'main'}`}
            bookId={book.id}
            chapterId={activeChapter?.id || ''}
            chapterTitle={activeChapter?.title || book.title}
            bookFolder={book.folder || ''}
            htmlFilename={activeChapter?.htmlFilename || activeChapter?.filename || ''}
            coverUrl={book.coverUrl || ''}
            theme={readerTheme}
            fontSize={fontSize}
            readerWidth={readerWidth}
            nextChapterTitle={nextChapter?.title}
            prevChapterTitle={prevChapter?.title}
            onNextChapter={nextChapter ? () => goToChapter(nextChapter) : undefined}
            onPrevChapter={prevChapter ? () => goToChapter(prevChapter) : undefined}
            onChapterComplete={() => activeChapter && toggleChapterComplete(activeChapter.id)}
            isCompleted={activeChapter ? completedChapters.includes(activeChapter.id) : false}
          />
        ) : (
          <div className="w-full h-full flex-1 relative bg-[#07090e]">
            <iframe
              key={`pdf_${book.id}_${activeChapter?.id || 'main'}`}
              src={`${pdfStreamUrl}#toolbar=1&navpanes=1&view=FitH`}
              title={`${book.title} - ${activeChapter?.title || 'PDF'}`}
              className="w-full h-full border-0 bg-[#07090e]"
            />
          </div>
        )}
      </main>
    </div>
  );
}
