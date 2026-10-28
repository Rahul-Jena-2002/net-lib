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
  const firstChapterId = book.chapters?.[0]?.id;

  const readUrl = isMulti && firstChapterId
    ? `/books/${book.id}/read?chapter=${encodeURIComponent(firstChapterId)}`
    : `/books/${book.id}/read`;

  return (
    <div className="group relative flex flex-col liquid-glass rounded-xl sm:rounded-2xl p-2 sm:p-2.5 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1">
      {/* Book Cover Frame (Slightly Reduced Height aspect-[3/4] with Glass Bezel) */}
      <Link
        href={`/books/${book.id}`}
        className="block relative aspect-[3/4] w-full rounded-lg sm:rounded-xl overflow-hidden mb-1.5 bg-[#05070e] border border-white/10 flex items-center justify-center p-1 transition-all duration-300"
      >
        {coverUrl && !imageError ? (
          <img
            src={coverUrl}
            alt={book.title}
            onError={() => setImageError(true)}
            className="w-full h-full object-contain rounded-md transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          /* Elegant Apple-style typography cover fallback */
          <div className="w-full h-full p-2.5 flex flex-col justify-between bg-gradient-to-br from-slate-800 to-slate-950 relative overflow-hidden select-none">
            <div className="absolute inset-y-0 left-0 w-1.5 bg-white/[0.08] border-r border-white/10" />

            <div className="pl-1">
              <span className="text-[8px] tracking-wider uppercase font-semibold opacity-70">
                {book.edition || (isMulti ? 'Volume' : 'Guide')}
              </span>
            </div>

            <div className="pl-1">
              <h3 className="font-bold text-[11px] leading-snug line-clamp-2 mb-0.5">
                {book.title}
              </h3>
              <p className="opacity-70 text-[9px] font-medium truncate">
                {book.author}
              </p>
            </div>

            <div className="pl-1 text-[8px] opacity-60 flex items-center justify-between border-t border-white/10 pt-1">
              <span>{book.totalPages}p</span>
              <span>{isMulti ? `${chapterCount}ch` : 'PDF'}</span>
            </div>
          </div>
        )}
      </Link>

      {/* Compact Book Information (Reduced Height) */}
      <div className="flex-1 flex flex-col justify-between px-0.5">
        <div className="mb-1">
          <Link href={`/books/${book.id}`}>
            <h3
              className="font-semibold text-xs leading-tight line-clamp-1 hover:opacity-80 transition-opacity mb-0.5"
              title={book.title}
            >
              {book.title}
            </h3>
          </Link>
          <p className="opacity-60 text-[10px] truncate mb-1 font-medium">
            {book.author}
          </p>

          <div className="flex items-center justify-between text-[9px] opacity-50">
            <span>{book.edition || (isMulti ? `${chapterCount} ch` : 'PDF')}</span>
            <span>{book.totalPages} pgs</span>
          </div>
        </div>

        {/* Sleek Minimal Transparent Action Buttons */}
        <div className="flex items-center gap-1 pt-1.5 border-t border-white/[0.08]">
          <Link
            href={`/books/${book.id}`}
            className="flex-1 text-center py-1 px-1.5 rounded-full text-[10px] font-medium opacity-80 hover:opacity-100 hover:bg-white/[0.08] transition"
          >
            Overview
          </Link>
          <Link
            href={readUrl}
            className="flex-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded-full text-[10px] font-semibold text-sky-400 opacity-90 hover:opacity-100 hover:bg-white/[0.08] transition"
          >
            <span>Read</span>
            <ArrowUpRight className="w-2.5 h-2.5 opacity-80" />
          </Link>
        </div>
      </div>
    </div>
  );
}
