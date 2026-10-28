import fs from 'fs';
import path from 'path';

export const MAX_UPLOAD_BYTES = 250 * 1024 * 1024; // 250MB

export function sanitizeUploadTitle(rawTitle: string): string {
  return rawTitle
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\0/g, '')
    .trim()
    .substring(0, 100);
}

export function normalizePdfFilename(filename: string, title?: string): string {
  const base = title
    ? sanitizeUploadTitle(title)
    : sanitizeUploadTitle(filename.replace(/\.pdf$/i, ''));
  return `${base || 'uploaded_book'}.pdf`;
}

export function validatePdfUpload(filename: string, buffer: Buffer): { valid: boolean; error?: string } {
  if (!filename.toLowerCase().endsWith('.pdf')) {
    return { valid: false, error: 'Only PDF files are allowed' };
  }
  if (buffer.length === 0) {
    return { valid: false, error: 'Uploaded file is empty' };
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    return { valid: false, error: `File exceeds maximum upload size of ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB` };
  }
  if (buffer.length < 5 || !buffer.subarray(0, 5).toString('latin1').startsWith('%PDF-')) {
    return { valid: false, error: 'Invalid PDF file format' };
  }
  return { valid: true };
}

export function getCollisionSafePath(baseDir: string, filename: string): { destPath: string; finalName: string } {
  let candidateName = filename;
  let candidatePath = path.join(baseDir, candidateName);
  if (!fs.existsSync(candidatePath)) {
    return { destPath: candidatePath, finalName: candidateName };
  }

  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let counter = 1;
  while (fs.existsSync(candidatePath)) {
    candidateName = `${base} (${counter})${ext}`;
    candidatePath = path.join(baseDir, candidateName);
    counter++;
  }
  return { destPath: candidatePath, finalName: candidateName };
}
