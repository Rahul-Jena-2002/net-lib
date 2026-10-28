'use client';
import React from 'react';
import { ArrowDownAZ, User } from 'lucide-react';

interface SortDropdownProps {
  selectedSort: string;
  onSortChange: (sort: string) => void;
  authors?: string[];
  selectedAuthor?: string;
  onAuthorChange?: (author: string) => void;
}

export default function SortDropdown({
  selectedSort,
  onSortChange,
  authors = [],
  selectedAuthor = 'All',
  onAuthorChange,
}: SortDropdownProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {/* Sort Dropdown */}
      <div className="relative flex items-center">
        <ArrowDownAZ className="absolute left-3 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        <select
          value={selectedSort}
          onChange={e => onSortChange(e.target.value)}
          className="pl-8 pr-7 py-1.5 rounded-xl bg-slate-900/50 hover:bg-slate-900/80 border border-white/[0.08] text-slate-300 hover:text-white text-xs font-medium appearance-none cursor-pointer outline-none focus:border-white/30 backdrop-blur-md transition"
        >
          <option value="title-asc" className="bg-slate-900 text-white">Title (A to Z)</option>
          <option value="title-desc" className="bg-slate-900 text-white">Title (Z to A)</option>
          <option value="author-asc" className="bg-slate-900 text-white">Author (A to Z)</option>
          <option value="chapters-desc" className="bg-slate-900 text-white">Most Chapters</option>
          <option value="pages-desc" className="bg-slate-900 text-white">Most Pages</option>
        </select>
        <span className="absolute right-2 text-slate-500 pointer-events-none text-[9px]">▼</span>
      </div>

      {/* Author Filter Dropdown */}
      {onAuthorChange && authors.length > 0 && (
        <div className="relative flex items-center">
          <User className="absolute left-3 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <select
            value={selectedAuthor}
            onChange={e => onAuthorChange(e.target.value)}
            className="pl-8 pr-7 py-1.5 rounded-xl bg-slate-900/50 hover:bg-slate-900/80 border border-white/[0.08] text-slate-300 hover:text-white text-xs font-medium appearance-none cursor-pointer outline-none focus:border-white/30 backdrop-blur-md transition"
          >
            <option value="All" className="bg-slate-900 text-white">All Authors</option>
            {authors.map(author => (
              <option key={author} value={author} className="bg-slate-900 text-white">
                {author}
              </option>
            ))}
          </select>
          <span className="absolute right-2 text-slate-500 pointer-events-none text-[9px]">▼</span>
        </div>
      )}
    </div>
  );
}
