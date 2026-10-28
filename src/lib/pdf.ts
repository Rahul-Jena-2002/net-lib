export interface RangeResult {
  valid: boolean;
  unsatisfiable: boolean;
  start: number;
  end: number;
}

export function parseRange(rangeHeader: string, size: number): RangeResult {
  if (!rangeHeader.startsWith('bytes=')) {
    return { valid: false, unsatisfiable: false, start: 0, end: size - 1 };
  }
  const parts = rangeHeader.replace('bytes=', '').split('-');
  const startStr = parts[0];
  const endStr = parts[1];

  if (startStr === '' && endStr !== '') {
    // Suffix range: bytes=-500 (last 500 bytes)
    const suffix = parseInt(endStr, 10);
    if (isNaN(suffix) || suffix <= 0) {
      return { valid: false, unsatisfiable: false, start: 0, end: size - 1 };
    }
    return {
      valid: true,
      unsatisfiable: false,
      start: Math.max(0, size - suffix),
      end: size - 1,
    };
  }

  const start = parseInt(startStr, 10);
  const end = endStr === '' ? size - 1 : parseInt(endStr, 10);

  if (isNaN(start)) {
    return { valid: false, unsatisfiable: false, start: 0, end: size - 1 };
  }
  if (start >= size || end < start) {
    return { valid: false, unsatisfiable: true, start: 0, end: 0 };
  }

  return {
    valid: true,
    unsatisfiable: false,
    start,
    end: Math.min(end, size - 1),
  };
}

export const PDF_WORKER_LOCAL_PATH = '/pdf.worker.min.mjs';
export const PDF_MIME_TYPE = 'application/pdf';
export const JS_MIME_TYPE = 'application/javascript';
