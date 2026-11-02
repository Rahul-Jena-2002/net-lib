'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  BookOpen,
  Loader2,
} from 'lucide-react';
import type { Theme, FontSize, ReaderWidth } from '@/lib/types';

import { extractAndCleanChapterHtml } from '@/lib/htmlCleaner';

interface LiquidHtmlReaderProps {
  bookId: string;
  chapterId: string;
  chapterTitle: string;
  bookFolder?: string;
  htmlFilename?: string;
  coverUrl?: string;
  theme?: Theme;
  fontSize?: FontSize;
  readerWidth?: ReaderWidth;
  nextChapterTitle?: string;
  prevChapterTitle?: string;
  onNextChapter?: () => void;
  onPrevChapter?: () => void;
  onChapterComplete?: () => void;
  isCompleted?: boolean;
}

export default function LiquidHtmlReader({
  bookId,
  chapterId,
  chapterTitle,
  bookFolder,
  htmlFilename,
  coverUrl,
  theme = 'dark',
  fontSize = 'md',
  readerWidth = 'full', // Full screen view by default!
}: LiquidHtmlReaderProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [contentHtml, setContentHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null);
  const [readingProgress, setReadingProgress] = useState<number>(0);
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Fetch chapter HTML (API first, then static fallback for GitHub Pages)
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    const fetchChapter = async () => {
      const bp = (process.env.NEXT_PUBLIC_BASE_PATH || '');

      // 1. If cover chapter, render cover directly
      if (chapterId === 'cover' && coverUrl) {
        if (isMounted) {
          setContentHtml(`
<div id="sbo-rt-content">
  <section class="cover-chapter flex flex-col items-center justify-center min-h-[75vh] py-8 text-center">
    <figure class="cover my-0 mx-auto max-w-lg w-full">
      <img alt="${chapterTitle} Cover" src="${coverUrl}" class="rounded-xl shadow-2xl mx-auto max-h-[85vh] w-auto object-contain border border-white/10" />
    </figure>
  </section>
</div>`);
          setLoading(false);
        }
        return;
      }

      // 2. Try API endpoint (if not static GitHub Pages)
      if (!bp) {
        try {
          const res = await fetch(
            `/api/html?book=${encodeURIComponent(bookId)}&chapter=${encodeURIComponent(chapterId)}`
          );
          if (res.ok) {
            const data = await res.json();
            if (isMounted && data.contentHtml) {
              setContentHtml(data.contentHtml);
              setLoading(false);
              return;
            }
          }
        } catch {
          // Fall through to static loader
        }
      }

      // 3. Static file loader (GitHub Pages / export mode)
      try {
        if (bookFolder && htmlFilename) {
          const staticUrl = `${bp}/books/${encodeURIComponent(bookFolder)}/${encodeURIComponent(htmlFilename)}`;
          const res = await fetch(staticUrl);
          if (res.ok) {
            const rawHtml = await res.text();
            const cleaned = extractAndCleanChapterHtml(rawHtml, bookFolder, bp);
            if (isMounted) {
              setContentHtml(cleaned);
              setLoading(false);
              return;
            }
          }
        }
        throw new Error('Chapter content could not be loaded');
      } catch (err: any) {
        if (isMounted) {
          console.error('Failed to load chapter HTML:', err);
          setError(err.message || 'Failed to load chapter');
          setLoading(false);
        }
      }
    };

    fetchChapter();
    return () => {
      isMounted = false;
    };
  }, [bookId, chapterId]);

  // Track reading progress on scroll
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const el = scrollContainerRef.current;
    const total = el.scrollHeight - el.clientHeight;
    if (total <= 0) {
      setReadingProgress(100);
      return;
    }
    const current = (el.scrollTop / total) * 100;
    setReadingProgress(Math.min(100, Math.max(0, Math.round(current))));
  }, []);

  // Post-process rendered DOM to add clean copy buttons to code blocks
  useEffect(() => {
    if (!contentContainerRef.current || loading) return;

    const preElements = contentContainerRef.current.querySelectorAll('pre');
    preElements.forEach((pre, idx) => {
      // Avoid duplicate copy buttons
      if (pre.parentElement?.classList.contains('code-block-wrapper')) return;

      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper relative my-5 group rounded-xl overflow-hidden border border-white/10 bg-[#0d121d]';

      const btn = document.createElement('button');
      btn.className =
        'code-copy-btn absolute top-2.5 right-2.5 px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all text-xs font-mono flex items-center gap-1.5 opacity-60 group-hover:opacity-100 z-10 backdrop-blur-sm cursor-pointer';
      btn.innerHTML = `
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
        </svg>
        <span>Copy</span>
      `;

      pre.parentNode?.insertBefore(wrapper, pre);
      wrapper.appendChild(btn);
      wrapper.appendChild(pre);

      pre.classList.add(
        'p-4',
        'sm:p-5',
        'overflow-x-auto',
        'font-mono',
        'text-[13.5px]',
        'leading-relaxed',
        'text-slate-100',
        'm-0'
      );

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const codeText = pre.innerText || pre.textContent || '';
        navigator.clipboard.writeText(codeText).then(() => {
          setCopiedCodeIdx(idx);
          btn.innerHTML = `
            <svg class="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span class="text-emerald-400">Copied!</span>
          `;
          setTimeout(() => {
            btn.innerHTML = `
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
              </svg>
              <span>Copy</span>
            `;
            setCopiedCodeIdx(null);
          }, 2000);
        });
      });
    });
  }, [contentHtml, loading]);

  // Width classes: Full screen view by default!
  const widthClasses = {
    narrow: 'max-w-3xl px-4 sm:px-8',
    standard: 'max-w-5xl px-4 sm:px-10',
    wide: 'max-w-7xl px-4 sm:px-12',
    full: 'w-full max-w-none px-6 sm:px-12 md:px-20 lg:px-28 xl:px-36',
  }[readerWidth];

  // Font size classes
  const fontSizeClass = {
    sm: 'text-[15px] leading-relaxed',
    md: 'text-[17px] leading-relaxed',
    lg: 'text-[20px] leading-relaxed',
    xl: 'text-[23px] leading-relaxed',
  }[fontSize];

  // Reader themes (warm paper sepia, clean subtle light, deep editorial dark)
  const themeStyles = {
    dark: {
      bg: 'bg-[#0c1017]',
      text: 'text-slate-100',
      heading: 'text-white',
      accent: 'text-sky-400',
    },
    sepia: {
      bg: 'bg-[#fbf8f1]',
      text: 'text-[#2d261e]',
      heading: 'text-[#2d261e]',
      accent: 'text-amber-800',
    },
    light: {
      bg: 'bg-[#f8f9fa]',
      text: 'text-slate-800',
      heading: 'text-slate-950',
      accent: 'text-sky-700',
    },
  }[theme];

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      style={{
        backgroundColor: theme === 'sepia' ? '#fbf8f1' : theme === 'light' ? '#f8f9fa' : '#0c1017',
        color: theme === 'sepia' ? '#2d261e' : theme === 'light' ? '#1e293b' : '#f1f5f9',
      }}
      className={`h-full w-full overflow-y-auto overflow-x-hidden relative transition-colors duration-200 ${
        theme === 'sepia' ? 'reader-theme-sepia' : theme === 'light' ? 'reader-theme-light' : 'reader-theme-dark'
      }`}
    >
      {/* ── Reading Progress Top Bar (Docked right under header border) ── */}
      <div
        className={`sticky top-0 left-0 right-0 h-0.5 z-20 pointer-events-none ${
          theme === 'sepia' ? 'bg-black/10' : 'bg-white/10'
        }`}
      >
        <div
          className={`h-full transition-all duration-150 ${
            theme === 'sepia' ? 'bg-black/60' : 'bg-white/50'
          }`}
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      {/* ── Single Content Div: Seamless, edge-to-edge typography with room for floating liquid glass navbar ── */}
      <div className={`relative z-10 pt-20 sm:pt-24 pb-32 mx-auto w-full transition-all duration-300 ${widthClasses}`}>
        {loading ? (
          <div className="py-36 flex flex-col items-center justify-center gap-4 text-center">
            <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold tracking-wide">
                Loading chapter...
              </span>
              <span className="text-xs opacity-60">
                Preparing typography and figures
              </span>
            </div>
          </div>
        ) : error ? (
          <div className="py-24 text-center flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-rose-300">Unable to load chapter</h2>
            <p className="text-xs opacity-70 max-w-md">{error}</p>
          </div>
        ) : (
          <>
            {/* Pure Chapter Body with NetLib Custom Typography */}
            <div
              ref={contentContainerRef}
              className={`liquid-html-content theme-${theme} ${fontSizeClass} select-text`}
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />

            {/* End of Chapter Subtle Anchor */}
            <div
              className={`mt-20 pt-8 border-t flex items-center justify-between text-xs ${
                theme === 'sepia' ? 'border-neutral-200 text-neutral-500' : 'border-white/10 opacity-40'
              }`}
            >
              <span>End of chapter: {chapterTitle}</span>
              <span>{readingProgress}% completed</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
