// Core data contracts and types for NetLib

export type Theme = 'dark' | 'light';
export type FontSize = 'sm' | 'md' | 'lg' | 'xl';
export type ReaderWidth = 'narrow' | 'standard' | 'wide' | 'full';

export interface Chapter {
  id: string;               // Unique slug (e.g. "1-an-introduction-to-java")
  title: string;            // Clean human-readable title (e.g. "1. An Introduction to Java")
  filename: string;         // Disk filename
  order: number;            // Monotonic 1-based sequential index (1, 2, 3...)
  priority: number;         // Sort tier (0=Cover, 1=Title, 2=TOC, 3=Preface, 4=Numbered, 5=Appendix, 6=Index, 7=Other)
  chapterNumber?: number;   // Parsed chapter integer if numbered (e.g. 1)
  pageCount?: number;       // Number of pages in this chapter
  fileSize?: number;        // File size in bytes
}

export interface Book {
  id: string;               // Deterministic URL slug (e.g. "core-java-vol-i-fundamentals-14th-edition")
  title: string;            // Book display title
  author: string;           // Author name(s)
  publisher: string;        // Publisher (e.g. "Pearson", "O'Reilly")
  edition?: string;         // Edition string (e.g. "14th Edition")
  volume?: string;          // Volume string (e.g. "Volume I")
  description: string;      // Summary / description
  coverColor: string;       // Accent hex code (e.g. "#1a6b8a")
  coverUrl?: string;        // Optional custom or publisher cover image URL
  tags: string[];           // Category tags (e.g. ["Java", "Fundamentals", "Programming"])
  isMultiChapter: boolean;  // True for multi-file folder, false for single PDF
  chapters?: Chapter[];     // Sorted sequential chapters
  folder?: string;          // Relative folder name if multi-chapter
  filename?: string;        // Relative filename if single-file PDF
  totalPages: number;       // Total pages across all chapters or single PDF
  totalSize: number;        // Total size in bytes
  addedAt: string;          // ISO timestamp
  storagePath?: string;     // Filesystem path
}

export interface BookProgress {
  bookId: string;
  chapterId?: string;          // Active chapter ID
  page: number;                // Last read page (1-based)
  completedChapters: string[]; // List of completed chapter IDs
  percentage: number;          // 0 - 100
  lastReadAt: string;          // ISO timestamp
}

export interface ReaderPreferences {
  theme: Theme;
  fontSize: FontSize;
  readerWidth: ReaderWidth;
  sidebarOpen: boolean;
}
