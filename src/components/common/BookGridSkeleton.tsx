import React from 'react';

interface BookGridSkeletonProps {
  count?: number;
}

export default function BookGridSkeleton({ count = 12 }: BookGridSkeletonProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6 gap-4 sm:gap-5 lg:gap-6 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col bg-[#131822] border border-white/[0.06] rounded-lg p-2.5"
        >
          {/* Cover frame skeleton */}
          <div className="aspect-[4/4.5] w-full rounded-md bg-neutral-800/60 mb-2 relative overflow-hidden" />

          {/* Title skeleton */}
          <div className="h-3.5 bg-neutral-800/80 rounded w-4/5 mb-1.5" />

          {/* Author skeleton */}
          <div className="h-2.5 bg-neutral-800/50 rounded w-3/5 mb-2" />

          {/* Metadata skeleton */}
          <div className="h-2 bg-neutral-800/40 rounded w-2/5 mb-2.5" />

          {/* Button actions skeleton */}
          <div className="pt-2 border-t border-white/[0.06] flex items-center gap-1.5">
            <div className="h-6 w-12 bg-neutral-800/60 rounded" />
            <div className="flex-1 flex justify-end gap-1">
              <div className="h-6 w-11 bg-neutral-800/60 rounded" />
              <div className="h-6 w-11 bg-neutral-800/60 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
