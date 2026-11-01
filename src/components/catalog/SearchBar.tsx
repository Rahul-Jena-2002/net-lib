'use client';
import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  count?: number;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Search by title, author, or keyword...',
  count,
}: SearchBarProps) {
  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="relative flex items-center">
        <Search className="absolute left-3.5 w-4 h-4 text-neutral-400 pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-24 py-2.5 rounded-lg bg-neutral-900 hover:bg-neutral-800/90 focus:bg-neutral-900 border border-neutral-700/80 focus:border-neutral-500 text-neutral-100 placeholder-neutral-500 text-sm outline-none transition-colors"
        />
        <div className="absolute right-3 flex items-center gap-2">
          {value && (
            <button
              onClick={() => onChange('')}
              className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {typeof count === 'number' && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700/60">
              {count} {count === 1 ? 'book' : 'books'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
