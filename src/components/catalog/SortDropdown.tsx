import React from 'react';
import { ArrowDownAZ, User, ChevronDown } from 'lucide-react';

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
        <ArrowDownAZ className="absolute left-3 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
        <select
          value={selectedSort}
          onChange={e => onSortChange(e.target.value)}
          className="pl-8 pr-7 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/80 text-neutral-300 hover:text-white text-xs font-medium appearance-none cursor-pointer outline-none focus:border-neutral-500 transition-colors"
        >
          <option value="title-asc" className="bg-neutral-900 text-white">Title (A to Z)</option>
          <option value="title-desc" className="bg-neutral-900 text-white">Title (Z to A)</option>
          <option value="author-asc" className="bg-neutral-900 text-white">Author (A to Z)</option>
          <option value="chapters-desc" className="bg-neutral-900 text-white">Most Chapters</option>
          <option value="pages-desc" className="bg-neutral-900 text-white">Most Pages</option>
        </select>
        <ChevronDown className="absolute right-2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
      </div>

      {/* Author Filter Dropdown */}
      {onAuthorChange && authors.length > 0 && (
        <div className="relative flex items-center">
          <User className="absolute left-3 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
          <select
            value={selectedAuthor}
            onChange={e => onAuthorChange(e.target.value)}
            className="pl-8 pr-7 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/80 text-neutral-300 hover:text-white text-xs font-medium appearance-none cursor-pointer outline-none focus:border-neutral-500 transition-colors"
          >
            <option value="All" className="bg-neutral-900 text-white">All Authors</option>
            {authors.map(author => (
              <option key={author} value={author} className="bg-neutral-900 text-white">
                {author}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
        </div>
      )}
    </div>
  );
}
