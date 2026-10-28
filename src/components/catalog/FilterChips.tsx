'use client';
import React from 'react';

interface FilterChipsProps {
  tags: string[];
  selectedTag: string;
  onSelectTag: (tag: string) => void;
  tagCounts?: Record<string, number>;
}

export default function FilterChips({
  tags,
  selectedTag,
  onSelectTag,
  tagCounts = {},
}: FilterChipsProps) {
  const allTags = ['All', ...tags.filter(t => t.toLowerCase() !== 'all')];

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none py-1">
      {allTags.map(tag => {
        const isSelected = selectedTag.toLowerCase() === tag.toLowerCase();
        const count = tagCounts[tag];

        return (
          <button
            key={tag}
            onClick={() => onSelectTag(tag)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 backdrop-blur-md ${
              isSelected
                ? 'bg-white/15 text-white border border-white/25 shadow-sm'
                : 'bg-slate-900/40 hover:bg-slate-900/70 text-slate-400 hover:text-slate-200 border border-white/[0.08]'
            }`}
          >
            <span>{tag}</span>
            {typeof count === 'number' && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-white/[0.06] text-slate-400'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
