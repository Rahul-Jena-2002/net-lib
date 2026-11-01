'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Moon,
  ChevronUp,
  ChevronDown,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';

// Configure pdfjs worker to local public path with dynamic basePath detection
if (typeof window !== 'undefined') {
  const isGh = window.location.pathname.startsWith('/net-lib') || (process.env.NEXT_PUBLIC_BASE_PATH === '/net-lib');
  const basePath = isGh ? '/net-lib' : (process.env.NEXT_PUBLIC_BASE_PATH || '');
  pdfjs.GlobalWorkerOptions.workerSrc = `${basePath}/pdf.worker.min.mjs`;
}

interface LiquidReaderProps {
  pdfUrl: string;
  bookTitle: string;
  activeChapterTitle?: string;
  currentPage: number;
  onPageChange: (current: number, total: number) => void;
  scale: number;
  fitWidth: boolean;
  darkInvert: boolean;
  onScrollToPageRequest?: (callback: (page: number) => void) => void;
  nextChapterTitle?: string;
  onNextChapter?: () => void;
}

interface PageItemProps {
  pageNumber: number;
  width: number;
  darkInvert: boolean;
  onVisible: (page: number) => void;
}

// Render each page once and keep it cached in memory permanently
const PageItem = React.memo(function PageItem({
  pageNumber,
  width,
  darkInvert,
  onVisible,
}: PageItemProps) {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
          onVisible(pageNumber);
        }
      },
      {
        threshold: [0.3, 0.6],
        rootMargin: '0px 0px -20% 0px',
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [pageNumber, onVisible]);

  return (
    <div
      ref={elRef}
      id={`pdf-page-${pageNumber}`}
      style={{ width: `${width}px` }}
      className={`relative mx-auto transition-all duration-300 ${
        darkInvert ? 'filter invert-[92%] hue-rotate-180 brightness-95' : ''
      }`}
    >
      <div className="bg-white overflow-hidden rounded-md border border-neutral-700/60 shadow-sm flex justify-center w-full">
        <Page
          pageNumber={pageNumber}
          width={width}
          devicePixelRatio={typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2.5) : 1}
          renderAnnotationLayer={false}
          renderTextLayer={false}
          loading={
            <div
              style={{ width: `${width}px`, height: `${Math.round(width * 1.414)}px` }}
              className="bg-slate-900/40 animate-pulse flex items-center justify-center text-xs opacity-50 text-white"
            >
              Loading Page {pageNumber}...
            </div>
          }
        />
      </div>
    </div>
  );
});

export default function LiquidReader({
  pdfUrl,
  bookTitle,
  activeChapterTitle,
  currentPage,
  onPageChange,
  scale,
  fitWidth,
  darkInvert,
  nextChapterTitle,
  onNextChapter,
}: LiquidReaderProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [containerWidth, setContainerWidth] = useState<number>(900);
  const [loadError, setLoadError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Memoize file object so react-pdf never reloads or re-fetches on state updates
  const fileSource = useMemo(() => ({ url: pdfUrl }), [pdfUrl]);

  // Responsive page width calculation
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const handleDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
      setLoadError(null);
      onPageChange(1, numPages);
    },
    [onPageChange]
  );

  const handleDocumentLoadError = useCallback((err: Error) => {
    console.error('Failed to load PDF in LiquidReader:', err);
    setLoadError('Unable to load document publication.');
  }, []);

  const handlePageVisible = useCallback(
    (page: number) => {
      onPageChange(page, numPages);
    },
    [numPages, onPageChange]
  );

  // Computed page width: Full page edge-to-edge width in fitWidth mode
  const computedPageWidth = useMemo(() => {
    const base = fitWidth ? containerWidth : Math.min(containerWidth, 1100);
    return Math.round(base * scale);
  }, [fitWidth, containerWidth, scale]);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 w-full h-full flex flex-col overflow-y-auto overflow-x-hidden pt-16 sm:pt-20 pb-16 px-0 items-center"
    >
      {loadError ? (
        <div className="m-auto text-center p-8 liquid-glass rounded-2xl max-w-md">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
          <h3 className="font-bold text-sm mb-1 text-rose-300">Unable to Display Publication</h3>
          <p className="text-xs opacity-60 mb-4">{loadError}</p>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-1.5 rounded-full liquid-glass-pill text-xs font-semibold inline-block"
          >
            Open Direct PDF Stream
          </a>
        </div>
      ) : (
        <Document
          file={fileSource}
          onLoadSuccess={handleDocumentLoadSuccess}
          onLoadError={handleDocumentLoadError}
          error={
            <div className="m-auto text-center p-8 liquid-glass rounded-2xl max-w-md my-12">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <h3 className="font-bold text-sm mb-1 text-slate-100">Publication Document Unavailable</h3>
              <p className="text-xs text-slate-400 mb-4">
                This document is part of your local collection and is not stored in cloud memory.
              </p>
              <Link
                href="/"
                className="px-4 py-1.5 rounded-full liquid-glass-pill text-xs font-semibold inline-block text-white"
              >
                Back to Library
              </Link>
            </div>
          }
          loading={
            <div className="m-auto py-24 flex flex-col items-center justify-center gap-3 opacity-60">
              <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
              <span className="text-xs font-medium">Streaming publication pages...</span>
            </div>
          }
          className="flex flex-col gap-6 sm:gap-8 items-center w-full"
        >
          {Array.from(new Array(numPages), (_, index) => (
            <PageItem
              key={`page_${index + 1}`}
              pageNumber={index + 1}
              width={computedPageWidth}
              darkInvert={darkInvert}
              onVisible={handlePageVisible}
            />
          ))}

          {/* End-of-Chapter Transition Card */}
          {numPages > 0 && onNextChapter && nextChapterTitle && (
            <div className="w-full max-w-xl mx-auto my-8 p-6 rounded-xl bg-slate-900/90 text-center border border-white/10 shadow-sm flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Chapter Section Completed</span>
              </div>
              <h4 className="text-sm font-bold text-white max-w-md line-clamp-2">
                Up Next: {nextChapterTitle}
              </h4>
              <p className="text-xs text-slate-300 opacity-75">
                Proceed directly to the next publication chapter.
              </p>
              <button
                onClick={onNextChapter}
                className="mt-2 px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer"
              >
                <span>Read Next Chapter</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </Document>
      )}
    </div>
  );
}
