import fs from 'fs';
import path from 'path';

const COVERS_FILE = path.join(process.cwd(), 'custom_covers.json');

// In-memory cache of custom user-provided covers
let inMemoryCovers: Record<string, string> | null = null;

export function getCustomCovers(): Record<string, string> {
  if (inMemoryCovers !== null) {
    return inMemoryCovers;
  }

  try {
    if (fs.existsSync(COVERS_FILE)) {
      const data = fs.readFileSync(COVERS_FILE, 'utf-8');
      inMemoryCovers = JSON.parse(data);
      return inMemoryCovers || {};
    }
  } catch (err) {
    console.error('Failed to read custom_covers.json:', err);
  }

  inMemoryCovers = {};
  return inMemoryCovers;
}

export function saveCustomCover(bookId: string, coverUrl: string): void {
  if (!bookId || !coverUrl) return;

  const current = getCustomCovers();
  current[bookId] = coverUrl;
  inMemoryCovers = current;

  try {
    fs.writeFileSync(COVERS_FILE, JSON.stringify(current, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save to custom_covers.json:', err);
  }
}
