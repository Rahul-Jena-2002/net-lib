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
  placeholder = 'Search by title, author, or keyword…',
  count,
}: SearchBarProps) {
  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="relative flex items-center">
        <Search className="absolute left-4 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-11 pr-24 py-3 rounded-2xl bg-slate-900/60 hover:bg-slate-900/80 focus:bg-slate-900/90 border border-white/[0.1] focus:border-white/30 text-white placeholder-slate-500 text-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] backdrop-blur-xl outline-none transition-all duration-200"
        />
        <div className="absolute right-3 flex items-center gap-2">
          {value && (
            <button
              onClick={() => onChange('')}
              className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {typeof count === 'number' && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/[0.08] text-slate-300 border border-white/[0.1]">
              {count} {count === 1 ? 'book' : 'books'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
