import fs from 'fs';

export interface ContentBlock {
  type: 'h1' | 'h2' | 'h3' | 'p' | 'list_item' | 'note' | 'code' | 'image';
  text: string;
  pageNumber: number;
  metadata?: {
    language?: string;
    imageSrc?: string;
    caption?: string;
  };
}

export interface ParsedChapterContent {
  bookId: string;
  chapterId?: string;
  totalPages: number;
  currentPageRange: { start: number; end: number };
  blocks: ContentBlock[];
}

// In-memory cache for fast repeated reads
const contentCache = new Map<string, ParsedChapterContent>();

function detectCode(text: string): { isCode: boolean; language: string } {
  if (
    /^(def\s+\w+|import\s+[\w*{]|from\s+\w+\s+import|class\s+\w+|function\s+\w+|const\s+\w+\s*=|let\s+\w+\s*=|public\s+class\s+\w+|public\s+static\s+void|SELECT\s+.*FROM|curl\s+-\w+|npm\s+install|pip\s+install|git\s+\w+)/m.test(
      text
    ) ||
    (text.includes(';') && (text.includes('{') || text.includes('}')) && text.split('\n').length >= 2)
  ) {
    let lang = 'code';
    if (/def\s+|from\s+\w+\s+import|import\s+torch|import\s+numpy|import\s+openai/.test(text)) lang = 'python';
    else if (/public\s+class|public\s+static|System\.out|@Override/.test(text)) lang = 'java';
    else if (/const\s+|let\s+|function\s+|export\s+default|interface\s+/.test(text)) lang = 'typescript';
    else if (/SELECT\s+|INSERT\s+|CREATE\s+TABLE/.test(text)) lang = 'sql';
    else if (/curl\s+|docker\s+|kubectl\s+|git\s+|npm\s+/.test(text)) lang = 'bash';
    return { isCode: true, language: lang };
  }
  return { isCode: false, language: '' };
}

/**
 * Extract structured text and image blocks from a PDF file.
 */
export async function extractPdfContent(
  filePath: string,
  bookId: string,
  chapterId?: string,
  startPage: number = 1,
  maxPages: number = 60
): Promise<ParsedChapterContent> {
  const cacheKey = `${filePath}:${startPage}:${maxPages}`;
  if (contentCache.has(cacheKey)) {
    return contentCache.get(cacheKey)!;
  }

  // Pre-load worker into global scope
  await import('pdfjs-dist/legacy/build/pdf.worker.mjs' as any);
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const fileData = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjs.getDocument({ data: fileData }).promise;
  const totalPages = doc.numPages;

  const endPage = Math.min(startPage + maxPages - 1, totalPages);
  const blocks: ContentBlock[] = [];

  for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const ops = await page.getOperatorList();

    // Check if page has image operators
    let pageImageCount = 0;
    for (let i = 0; i < ops.fnArray.length; i++) {
      if (ops.fnArray[i] === 85) pageImageCount++;
    }

    // Group items into lines by clustered Y coordinate (tolerance ~3px)
    const lineBuckets: { y: number; items: any[] }[] = [];
    for (const rawItem of content.items) {
      if (!('str' in rawItem)) continue;
      const itemStr = (rawItem as any).str;
      if (!itemStr || !itemStr.trim()) continue;

      const y = Math.round((rawItem as any).transform[5]);
      let bucket = lineBuckets.find(b => Math.abs(b.y - y) <= 3);
      if (!bucket) {
        bucket = { y, items: [] };
        lineBuckets.push(bucket);
      }
      bucket.items.push(rawItem);
    }

    // Sort lines from top to bottom (descending Y)
    lineBuckets.sort((a, b) => b.y - a.y);

    if (lineBuckets.length === 0) continue;

    // Determine font sizes and median line spacing
    const fontSizes: number[] = [];
    const diffs: number[] = [];
    for (let i = 0; i < lineBuckets.length; i++) {
      const firstItem = lineBuckets[i].items[0];
      const sz = Math.round(firstItem.transform[0] || 10);
      fontSizes.push(sz);
      if (i > 0) {
        const d = lineBuckets[i - 1].y - lineBuckets[i].y;
        if (d > 0 && d < 60) diffs.push(d);
      }
    }

    diffs.sort((a, b) => a - b);
    const medianDiff = diffs.length > 0 ? diffs[Math.floor(diffs.length / 2)] : 18;

    // Body font size is typically the most frequent font size
    const sizeCounts: Record<number, number> = {};
    for (const sz of fontSizes) {
      sizeCounts[sz] = (sizeCounts[sz] || 0) + 1;
    }
    let bodyFontSize = 10;
    let maxCount = 0;
    for (const [szStr, count] of Object.entries(sizeCounts)) {
      if (count > maxCount) {
        maxCount = count;
        bodyFontSize = Number(szStr);
      }
    }

    let currentParagraph: string[] = [];
    let prevY: number | null = null;

    const flushParagraph = () => {
      if (currentParagraph.length === 0) return;
      const fullText = currentParagraph.join(' ').trim();
      currentParagraph = [];
      if (!fullText) return;

      // Check if figure caption followed by image
      const codeCheck = detectCode(fullText);
      if (codeCheck.isCode) {
        blocks.push({
          type: 'code',
          text: fullText,
          pageNumber: pageNum,
          metadata: { language: codeCheck.language },
        });
      } else if (/^(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\b/i.test(fullText)) {
        blocks.push({
          type: 'note',
          text: fullText,
          pageNumber: pageNum,
        });
      } else if (/^(\d+\.|\*|-|•)\s+/.test(fullText)) {
        blocks.push({
          type: 'list_item',
          text: fullText,
          pageNumber: pageNum,
        });
      } else {
        blocks.push({
          type: 'p',
          text: fullText,
          pageNumber: pageNum,
        });
      }
    };

    for (let i = 0; i < lineBuckets.length; i++) {
      const bucket = lineBuckets[i];
      bucket.items.sort((a, b) => a.transform[4] - b.transform[4]);
      const lineText = bucket.items.map(it => it.str).join(' ').trim();
      const firstItem = bucket.items[0];
      const fontSize = Math.round(firstItem.transform[0] || bodyFontSize);
      const diff = prevY !== null ? prevY - bucket.y : 0;

      // Filter out running headers/footers, leaked page numbers like "Page 7 of 36", and "Summarize"
      if (
        /^page\s+\d+(\s+of\s+\d+)?$/i.test(lineText) ||
        /^\d+\s+of\s+\d+$/i.test(lineText) ||
        (/^\d+$/.test(lineText) && (bucket.y < 60 || bucket.y > 780)) ||
        lineText.toLowerCase() === 'summarize' ||
        (lineText.toLowerCase().includes('summarize') && lineText.length < 20)
      ) {
        prevY = bucket.y;
        continue;
      }

      // Check if this line is a main chapter/title heading
      if (fontSize >= bodyFontSize + 6) {
        flushParagraph();
        blocks.push({
          type: 'h1',
          text: lineText,
          pageNumber: pageNum,
        });
        prevY = bucket.y;
        continue;
      }

      // Check if section heading
      if (fontSize >= bodyFontSize + 2 && fontSize < bodyFontSize + 6) {
        flushParagraph();
        blocks.push({
          type: 'h2',
          text: lineText,
          pageNumber: pageNum,
        });
        prevY = bucket.y;
        continue;
      }

      // Check if list item
      const isListItem = /^(\d+\.|\*|-|•)\s+/.test(lineText);
      if (isListItem) {
        flushParagraph();
        currentParagraph.push(lineText);
        prevY = bucket.y;
        continue;
      }

      // Check paragraph break
      if (diff > medianDiff * 1.35 && currentParagraph.length > 0) {
        flushParagraph();
      }

      // De-hyphenation across line breaks
      if (currentParagraph.length > 0 && currentParagraph[currentParagraph.length - 1].endsWith('-')) {
        const lastIndex = currentParagraph.length - 1;
        const last = currentParagraph[lastIndex];
        currentParagraph[lastIndex] = last.slice(0, -1) + lineText;
      } else {
        currentParagraph.push(lineText);
      }

      prevY = bucket.y;
    }

    flushParagraph();

    // If this page has images, insert image block right after page text
    if (pageImageCount > 0) {
      for (let imgIdx = 0; imgIdx < pageImageCount; imgIdx++) {
        blocks.push({
          type: 'image',
          text: `Figure on page ${pageNum}`,
          pageNumber: pageNum,
          metadata: {
            imageSrc: `/api/pdf/image?book=${bookId}&chapter=${chapterId || ''}&page=${pageNum}&index=${imgIdx}`,
          },
        });
      }
    }
  }

  const result: ParsedChapterContent = {
    bookId,
    chapterId,
    totalPages,
    currentPageRange: { start: startPage, end: endPage },
    blocks,
  };

  contentCache.set(cacheKey, result);
  return result;
}
