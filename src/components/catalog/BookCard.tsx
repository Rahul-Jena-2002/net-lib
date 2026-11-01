'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { Book } from '@/lib/types';
import { getBookCoverUrl } from '@/lib/covers';

interface BookCardProps {
  book: Book;
  progress?: number;
}

export default function BookCard({ book }: BookCardProps) {
  const [imageError, setImageError] = useState(false);
  const coverUrl = getBookCoverUrl(book.id, book.coverUrl);

  const chapterCount = book.chapters?.length || 0;
  const isMulti = book.isMultiChapter;

  const hasWeb = Boolean(book.hasFullHtml || (book.htmlChaptersCount && book.htmlChaptersCount > 0));
  const hasPdf = Boolean(!book.isMultiChapter || book.filename || book.chapters?.some(c => c.hasPdf));

  const firstHtmlChapter = book.chapters?.find(c => c.hasHtml) || book.chapters?.[0];
  const firstPdfChapter = book.chapters?.find(c => c.hasPdf) || book.chapters?.[0];

  const webUrl = isMulti && firstHtmlChapter
    ? `/books/${book.id}/read?chapter=${encodeURIComponent(firstHtmlChapter.id)}&format=html`
    : `/books/${book.id}/read?format=html`;

  const pdfUrl = isMulti && firstPdfChapter
    ? `/books/${book.id}/read?chapter=${encodeURIComponent(firstPdfChapter.id)}&format=pdf`
    : `/books/${book.id}/read?format=pdf`;

  return (
    <div className="group relative flex flex-col bg-[#131822] hover:bg-[#171e2c] border border-white/[0.08] hover:border-white/20 rounded-lg p-2.5 transition-colors duration-150">
      {/* Book Cover Frame */}
      <Link
        href={`/books/${book.id}`}
        className="block relative aspect-[4/4.5] w-full rounded-md overflow-hidden mb-2 bg-[#0a0d14] border border-white/10 flex items-center justify-center p-1 shrink-0"
      >
        {/* Cover Format Badges: PDF prioritized as default */}
        <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1">
          {hasPdf && (
            <span className="px-1.5 py-0.5 rounded text-[8.5px] font-semibold tracking-wide bg-sky-950/90 text-sky-200 border border-sky-800/60">
              PDF
            </span>
          )}
          {hasWeb && (
            <span className="px-1.5 py-0.5 rounded text-[8.5px] font-semibold tracking-wide bg-neutral-900/90 text-neutral-300 border border-neutral-700/70">
              HTML
            </span>
          )}
        </div>

        {coverUrl && !imageError ? (
          <img
            src={coverUrl}
            alt={book.title}
            onError={() => setImageError(true)}
            className="w-full h-full object-contain rounded"
            loading="lazy"
          />
        ) : (
          /* Book spine / typographic cover */
          <div className="w-full h-full p-2.5 flex flex-col justify-between bg-[#181f2a] border border-neutral-700/50 rounded select-none">
            <div>
              <span className="text-[8px] tracking-wider uppercase font-semibold text-neutral-400">
                {book.edition || (isMulti ? 'Volume' : 'Guide')}
              </span>
            </div>

            <div>
              <h3 className="font-bold text-[11px] leading-tight line-clamp-2 text-neutral-100 mb-0.5">
                {book.title}
              </h3>
              <p className="text-neutral-400 text-[9px] font-medium truncate">
                {book.author}
              </p>
            </div>

            <div className="text-[8px] text-neutral-400 flex items-center justify-between border-t border-neutral-700/60 pt-1">
              <span>{book.totalPages} pages</span>
              <span>{isMulti ? `${chapterCount} ch` : 'Standalone'}</span>
            </div>
          </div>
        )}
      </Link>

      {/* Compact Book Information */}
      <div className="flex-1 flex flex-col justify-between px-0.5">
        <div className="mb-2">
          <Link href={`/books/${book.id}`}>
            <h3
              className="font-medium text-[12px] leading-snug line-clamp-1 hover:text-sky-300 transition-colors mb-0.5 text-neutral-100"
              title={book.title}
            >
              {book.title}
            </h3>
          </Link>
          <p className="text-neutral-400 text-[10px] truncate mb-0.5 font-normal">
            {book.author}
          </p>

          <div className="flex items-center justify-between text-[9px] text-neutral-400">
            <span>
              {book.edition ? `${book.edition} · ` : ''}
              {isMulti ? `${chapterCount} chapters` : 'Single file'}
            </span>
          </div>
        </div>

        {/* Format Action Buttons: Clean, dignified editorial buttons */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-white/[0.08]">
          <Link
            href={`/books/${book.id}`}
            className="py-1 px-2 rounded text-[10px] font-medium text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors text-center shrink-0 border border-white/10"
            title="View Details & Chapters"
          >
            Details
          </Link>

          <div className="flex-1 flex items-center justify-end gap-1">
            {hasPdf && (
              <Link
                href={pdfUrl}
                className="flex-1 flex items-center justify-center py-1 px-2 rounded text-[10px] font-medium bg-sky-600 hover:bg-sky-500 text-white border border-sky-500/80 transition-colors text-center"
                title="Read PDF Edition (Default)"
              >
                PDF
              </Link>
            )}

            {hasWeb && (
              <Link
                href={webUrl}
                className="flex-1 flex items-center justify-center py-1 px-2 rounded text-[10px] font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors text-center"
                title="Read Web HTML"
              >
                HTML
              </Link>
            )}

            {!hasPdf && !hasWeb && (
              <Link
                href={`/books/${book.id}/read`}
                className="flex-1 flex items-center justify-center py-1 px-2 rounded text-[10px] font-medium bg-sky-600 hover:bg-sky-500 text-white border border-sky-500/80 transition-colors text-center"
                title="Read Book"
              >
                Read
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
