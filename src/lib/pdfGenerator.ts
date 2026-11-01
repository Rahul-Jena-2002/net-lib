/**
 * High-performance, zero-dependency PDF 1.4 binary generator.
 * Produces valid multi-page PDF documents for books and chapters.
 * Compatible with PDF.js, react-pdf, and all standard PDF viewers.
 */

function sanitizePdfText(str: string): string {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[^\x20-\x7E]/g, ' '); // Clean ASCII
}

export function generateChapterPdfBytes(
  bookTitle: string,
  chapterTitle: string,
  chapterNumber?: number | string,
  author?: string,
  totalPages = 3
): Uint8Array {
  const safeBook = sanitizePdfText(bookTitle || 'Publication');
  const safeChapter = sanitizePdfText(chapterTitle || 'Chapter Overview');
  const safeAuthor = sanitizePdfText(author || 'NetLib Library');
  const chNumStr = chapterNumber !== undefined && chapterNumber !== null ? `Chapter ${chapterNumber}: ` : '';

  const pagesContent: string[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const isFirstPage = pageNum === 1;
    const isLastPage = pageNum === totalPages;

    const streamLines: string[] = [
      'BT',
      // Book title header
      '/F1 18 Tf',
      '50 740 Td',
      `(${safeBook}) Tj`,

      // Chapter title
      '/F1 14 Tf',
      '0 -28 Td',
      `(${chNumStr}${safeChapter}) Tj`,

      // Metadata line
      '/F2 9 Tf',
      '0 -20 Td',
      `(${safeAuthor}  |  NetLib  |  Page ${pageNum} of ${totalPages}) Tj`,

      // Decorative divider
      '/F2 9 Tf',
      '0 -16 Td',
      '(_________________________________________________________________________________) Tj',

      // Section body text
      '0 -32 Td',
      '/F1 12 Tf',
      isFirstPage
        ? '(1. Introduction & Overview) Tj'
        : `(${pageNum}. Key Concepts & Analysis - Section ${pageNum}) Tj`,

      '0 -22 Td',
      '/F2 10 Tf',
      isFirstPage
        ? `(Welcome to ${safeChapter}.) Tj`
        : `(Continuing coverage of core architectural principles and practical implementation details.) Tj`,

      '0 -18 Td',
      '/F2 10 Tf',
      '(The full multi-page document is loaded and ready with continuous scrolling support.) Tj',

      '0 -18 Td',
      '/F2 10 Tf',
      '(All navigational controls, themes, and zoom scales apply uniformly across all pages.) Tj',

      // Middle content block
      '0 -36 Td',
      '/F1 11 Tf',
      '(Topic Highlights & Architecture) Tj',

      '0 -20 Td',
      '/F2 10 Tf',
      `(- Foundation concepts tailored for production deployment and enterprise scale.) Tj`,

      '0 -18 Td',
      '/F2 10 Tf',
      '(- Real-world implementation patterns, code execution models, and benchmark evaluation.) Tj',

      '0 -18 Td',
      '/F2 10 Tf',
      '(- Resilient pipeline integration with automated error recovery and verification.) Tj',
    ];

    if (isLastPage) {
      streamLines.push(
        '0 -42 Td',
        '/F1 11 Tf',
        '(Section Summary & Next Steps) Tj',
        '0 -20 Td',
        '/F2 10 Tf',
        '(You have completed this chapter. Use the navigation bar or buttons below to advance.) Tj',
        '0 -20 Td',
        '/F1 11 Tf',
        '(Proceed to Next Chapter ->) Tj'
      );
    } else {
      streamLines.push(
        '0 -42 Td',
        '/F2 10 Tf',
        '(Scroll down to continue reading the following pages...) Tj'
      );
    }

    // Page footer
    streamLines.push(
      '0 -220 Td',
      '/F2 9 Tf',
      '(_________________________________________________________________________________) Tj',
      '0 -18 Td',
      `/F2 8 Tf`,
      `(${safeBook}  --  ${safeChapter}  --  Page ${pageNum} of ${totalPages}) Tj`,
      'ET'
    );

    pagesContent.push(streamLines.join('\n'));
  }

  let objIdx = 1;
  const objects: string[] = [];

  const catalogObj = objIdx++;
  const pagesObj = objIdx++;
  const fontHelveticaBold = objIdx++;
  const fontHelvetica = objIdx++;

  const pageObjIds: number[] = [];
  const contentObjIds: number[] = [];

  for (let i = 0; i < totalPages; i++) {
    pageObjIds.push(objIdx++);
    contentObjIds.push(objIdx++);
  }

  objects[catalogObj] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objects[pagesObj] = `<< /Type /Pages /Kids [${pageObjIds.map(id => `${id} 0 R`).join(' ')}] /Count ${totalPages} >>`;
  objects[fontHelveticaBold] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`;
  objects[fontHelvetica] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;

  for (let i = 0; i < totalPages; i++) {
    const pageId = pageObjIds[i];
    const contentId = contentObjIds[i];
    objects[pageId] = `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontHelveticaBold} 0 R /F2 ${fontHelvetica} 0 R >> >> /Contents ${contentId} 0 R >>`;
    const stream = pagesContent[i];
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  }

  let body = '%PDF-1.4\n';
  const offsets: number[] = [0];

  for (let i = 1; i < objIdx; i++) {
    offsets[i] = body.length;
    body += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = body.length;
  let xref = `xref\n0 ${objIdx}\n0000000000 65535 f \n`;
  for (let i = 1; i < objIdx; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  body += xref;
  body += `trailer\n<< /Size ${objIdx} /Root ${catalogObj} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const bytes = new Uint8Array(body.length);
  for (let i = 0; i < body.length; i++) {
    bytes[i] = body.charCodeAt(i) & 0xff;
  }

  return bytes;
}

export function generateChapterPdfBlobUrl(
  bookTitle: string,
  chapterTitle: string,
  chapterNumber?: number | string,
  author?: string,
  totalPages = 3
): string {
  const bytes = generateChapterPdfBytes(bookTitle, chapterTitle, chapterNumber, author, totalPages);
  const blob = new Blob([bytes as any], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}
