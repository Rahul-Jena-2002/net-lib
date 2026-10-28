import type { ReaderWidth, FontSize } from './types';

export const WIDTH_CLASSES: Record<ReaderWidth, string> = {
  narrow: 'max-w-2xl',     // 680px
  standard: 'max-w-4xl',   // 900px
  wide: 'max-w-6xl',       // 1200px
  full: 'max-w-full',      // 100%
};

export const SCALE_MAP: Record<FontSize, number> = {
  sm: 1.0,
  md: 1.3,
  lg: 1.6,
  xl: 2.0,
};

export const FONT_SIZE_STYLES: Record<
  FontSize,
  {
    rootClass: string;
    pClass: string;
    h1Class: string;
    h2Class: string;
    h3Class: string;
  }
> = {
  sm: {
    rootClass: 'text-[15px] leading-relaxed',
    pClass: 'text-[15px] leading-[1.8] mb-5',
    h1Class: 'text-2xl md:text-3xl font-bold tracking-tight mb-6 mt-8',
    h2Class: 'text-xl md:text-2xl font-bold tracking-tight mb-4 mt-6',
    h3Class: 'text-lg font-semibold mb-3 mt-5',
  },
  md: {
    rootClass: 'text-[17px] leading-relaxed',
    pClass: 'text-[17px] leading-[1.85] mb-6',
    h1Class: 'text-3xl md:text-4xl font-bold tracking-tight mb-8 mt-10',
    h2Class: 'text-2xl md:text-3xl font-bold tracking-tight mb-5 mt-8',
    h3Class: 'text-xl font-semibold mb-4 mt-6',
  },
  lg: {
    rootClass: 'text-[20px] leading-relaxed',
    pClass: 'text-[20px] leading-[1.9] mb-7',
    h1Class: 'text-4xl md:text-5xl font-bold tracking-tight mb-10 mt-12',
    h2Class: 'text-3xl md:text-4xl font-bold tracking-tight mb-6 mt-10',
    h3Class: 'text-2xl font-semibold mb-5 mt-8',
  },
  xl: {
    rootClass: 'text-[23px] leading-relaxed',
    pClass: 'text-[23px] leading-[2.0] mb-8',
    h1Class: 'text-5xl md:text-6xl font-bold tracking-tight mb-12 mt-14',
    h2Class: 'text-4xl md:text-5xl font-bold tracking-tight mb-8 mt-12',
    h3Class: 'text-3xl font-semibold mb-6 mt-10',
  },
};

export const READER_LAYOUT = {
  leftRailClass: 'w-14',
  sidebarClass: 'w-80',
  bottomNavClass: 'fixed bottom-0 inset-x-0 h-12',
  mainCanvasClass: 'flex-1',
};

export const READER_RAIL_ACTIONS = ['back_to_library', 'toggle_toc', 'toggle_settings'] as const;

export function computeReadingProgress(currentPage: number, totalPages: number): { page: number; percentage: number } {
  if (totalPages <= 0) return { page: 1, percentage: 0 };
  const clampedPage = Math.max(1, Math.min(currentPage, totalPages));
  const percentage = Math.max(0, Math.min(100, Math.round((clampedPage / totalPages) * 100)));
  return { page: clampedPage, percentage };
}

export function calculateChapterProgress(completedCount: number, totalChapters: number): number {
  if (totalChapters <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((completedCount / totalChapters) * 100)));
}

export function getNextPage(currentPage: number, totalPages: number): number {
  if (totalPages <= 0) return 1;
  return Math.min(currentPage + 1, totalPages);
}

export function getPreviousPage(currentPage: number): number {
  return Math.max(currentPage - 1, 1);
}

export function getNextChapterIndex(currentIndex: number, totalChapters: number): number {
  if (totalChapters <= 0) return -1;
  return Math.min(currentIndex + 1, totalChapters - 1);
}

export function formatPageLabel(page: number, totalPages: number): string {
  return `Page ${page} of ${totalPages}`;
}

export function toggleCompletedChapter(completed: string[], chapterId: string): string[] {
  const next = completed.includes(chapterId)
    ? completed.filter(id => id !== chapterId)
    : [...completed, chapterId];
  return Array.from(new Set(next));
}
