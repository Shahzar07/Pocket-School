'use client';

/**
 * Turning the student's material into something the AI can read, entirely in
 * the browser: PDFs become text, photos become compressed JPEGs. Nothing is
 * uploaded to storage — only the extracted text is kept.
 */

export interface SourceFile {
  name: string;
  kind: 'pdf' | 'image' | 'text';
  /** Extracted text (PDF / text files). */
  text?: string;
  /** Compressed data URL for photos, read by the vision model. */
  image?: string;
  /** PDF pages that had no text layer (scanned) and were rendered to images. */
  pageImages?: string[];
  pages?: number;
}

const MAX_PDF_PAGES = 120;
const MAX_SCANNED_PAGES = 12;

/** Downscale and re-encode a photo so it is small enough to send. */
export async function compressImage(file: Blob, maxSide = 1600, quality = 0.82): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', quality);
}

/** Crop a data URL to a rectangle given in 0–1 fractions of its size. */
export async function cropImage(dataUrl: string, rect: { x: number; y: number; w: number; h: number }): Promise<string> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const sx = Math.round(rect.x * img.naturalWidth), sy = Math.round(rect.y * img.naturalHeight);
  const sw = Math.max(8, Math.round(rect.w * img.naturalWidth)), sh = Math.max(8, Math.round(rect.h * img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = sw; canvas.height = sh;
  canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL('image/jpeg', 0.9);
}

type PdfJs = typeof import('pdfjs-dist');
let pdfjsPromise: Promise<PdfJs> | null = null;
function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then(m => {
      // Served from /public so the bundler never has to understand the worker.
      m.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      return m;
    });
  }
  return pdfjsPromise;
}

export async function readPdf(file: File, onProgress?: (page: number, total: number) => void): Promise<SourceFile> {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const total = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const parts: string[] = [];
  const scanned: number[] = [];
  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map(it => ('str' in it ? (it.str as string) + ((it as { hasEOL?: boolean }).hasEOL ? '\n' : ' ') : ''))
      .join('')
      .replace(/[ \t]+/g, ' ')
      .trim();
    if (text.length < 25) scanned.push(i);
    else parts.push(`[Page ${i}]\n${text}`);
    onProgress?.(i, total);
  }

  // Scanned pages have no text layer: render a few to images for the vision model.
  const pageImages: string[] = [];
  for (const n of scanned.slice(0, MAX_SCANNED_PAGES)) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: 1.6 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
    pageImages.push(canvas.toDataURL('image/jpeg', 0.75));
  }
  return { name: file.name, kind: 'pdf', text: parts.join('\n\n'), pageImages, pages: pdf.numPages };
}

export async function readSourceFile(file: File, onProgress?: (page: number, total: number) => void): Promise<SourceFile> {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return readPdf(file, onProgress);
  if (file.type.startsWith('image/')) return { name: file.name, kind: 'image', image: await compressImage(file) };
  if (file.type.startsWith('text/') || /\.(txt|md|csv)$/i.test(file.name)) {
    return { name: file.name, kind: 'text', text: (await file.text()).slice(0, 200_000) };
  }
  throw new Error(`${file.name}: use a PDF, a photo, or a text file.`);
}
