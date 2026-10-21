import { IMAGE_MAX_BYTES, PDF_MAX_BYTES, isSafeRelativePath } from './paths';
import { isImage, isPdf, isPng } from './bytes';

export const MANIFEST_HEADERS = [
  'sku',
  'title',
  'subject',
  'level',
  'exam_board',
  'spec_code',
  'type',
  'price_usd',
  'price_myr',
  'access',
  'description',
  'tags',
  'paper_pdf',
  'markscheme_pdf',
  'thumbnail',
  'preview_images',
  'status',
] as const;

export interface ManifestRow {
  line: number;
  sku: string;
  title: string;
  subject: string;
  level: string;
  examBoard: string;
  specCode: string;
  type: string;
  priceUsd: number | null;
  priceMyr: number | null;
  access: 'paid' | 'free' | '';
  description: string;
  tags: string[];
  paperPdf: string;
  markschemePdf: string;
  thumbnail: string;
  previewImages: string[];
  status: string;
}

export interface FileEntry {
  path: string;
  bytes: number;
}

export interface RowReport {
  line: number;
  sku: string;
  ok: boolean;
  action: 'create' | 'update';
  errors: string[];
  warnings: string[];
}

export interface UploadBytes {
  paper: Uint8Array | null;
  markscheme: Uint8Array | null;
  thumbnail: Uint8Array | null;
  previews: Uint8Array[];
}

const SKU = /^[A-Za-z0-9][A-Za-z0-9._-]{1,80}$/;
const MONEY = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const YEAR_WORD = /\b(?:year|yr|grade|form)\s*\d+\b/i;
const BARE_YEAR = /^(?:19|20)\d{2}$/;
const BARE_NUMBER = /^\d+$/;

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i] ?? '';
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter(cells => cells.some(value => value.trim() !== ''));
}

export function parseMoney(value: string): number | null {
  const trimmed = value.trim();
  if (!MONEY.test(trimmed)) return null;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return amount;
}

function splitList(value: string): string[] {
  return value.split('|').map(item => item.trim()).filter(Boolean);
}

function blankRow(line: number): ManifestRow {
  return {
    line,
    sku: '',
    title: '',
    subject: '',
    level: '',
    examBoard: '',
    specCode: '',
    type: '',
    priceUsd: null,
    priceMyr: null,
    access: '',
    description: '',
    tags: [],
    paperPdf: '',
    markschemePdf: '',
    thumbnail: '',
    previewImages: [],
    status: '',
  };
}

export function parseManifest(csv: string): { headerError: string; rows: ManifestRow[] } {
  const table = parseCsv(csv);
  const header = (table[0] ?? []).map(cell => cell.trim());
  if (header.join(',') !== MANIFEST_HEADERS.join(',')) {
    return { headerError: `manifest.csv headers must be ${MANIFEST_HEADERS.join(',')}`, rows: [] };
  }
  const rows = table.slice(1).map((cells, index) => {
    const value = (name: (typeof MANIFEST_HEADERS)[number]) => (cells[MANIFEST_HEADERS.indexOf(name)] ?? '').trim();
    const accessRaw = value('access').toLowerCase();
    const row = blankRow(index + 2);
    row.sku = value('sku');
    row.title = value('title');
    row.subject = value('subject');
    row.level = value('level');
    row.examBoard = value('exam_board');
    row.specCode = value('spec_code');
    row.type = value('type');
    row.priceUsd = parseMoney(value('price_usd'));
    row.priceMyr = parseMoney(value('price_myr'));
    row.access = accessRaw === 'paid' || accessRaw === 'free' ? accessRaw : '';
    row.description = value('description');
    row.tags = splitList(value('tags'));
    row.paperPdf = value('paper_pdf');
    row.markschemePdf = value('markscheme_pdf');
    row.thumbnail = value('thumbnail');
    row.previewImages = splitList(value('preview_images'));
    row.status = value('status').toLowerCase();
    if (value('price_usd') === '') row.priceUsd = null;
    if (value('price_myr') === '') row.priceMyr = null;
    return row;
  });
  return { headerError: '', rows };
}

function levelError(level: string): string {
  if (!level) return 'level is required and must be a level name, not a year number';
  if (YEAR_WORD.test(level) || BARE_YEAR.test(level) || BARE_NUMBER.test(level)) {
    return 'level uses a level name, not a year number';
  }
  return '';
}

function fileProblem(path: string, files: Map<string, number>, kind: 'pdf' | 'png' | 'image'): string {
  if (!path) return 'missing file';
  if (!isSafeRelativePath(path)) return 'file path must stay inside the ZIP';
  if (!files.has(path)) return 'missing file';
  const size = files.get(path) ?? 0;
  const limit = kind === 'pdf' ? PDF_MAX_BYTES : IMAGE_MAX_BYTES;
  if (size > limit) return 'oversized file';
  if (kind === 'pdf' && !path.toLowerCase().endsWith('.pdf')) return 'file must be a PDF';
  if (kind === 'png' && !path.toLowerCase().endsWith('.png')) return 'thumbnail must be a PNG';
  if (kind === 'image' && !/\.(png|jpe?g|webp|gif)$/i.test(path)) return 'preview must be an image';
  return '';
}

export function reportRows(
  rows: ManifestRow[],
  files: readonly FileEntry[],
  existingSkus: ReadonlySet<string>,
): RowReport[] {
  const sizes = new Map(files.map(file => [file.path, file.bytes]));
  const seen = new Map<string, number>();
  return rows.map(row => {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!SKU.test(row.sku)) errors.push('sku must be letters, numbers, dots, or dashes');
    else if (seen.has(row.sku)) errors.push('duplicate SKU');
    else seen.set(row.sku, row.line);
    if (!row.title) errors.push('title is required');
    if (!row.subject) errors.push('subject is required');
    const level = levelError(row.level);
    if (level) errors.push(level);
    if (!row.examBoard) errors.push('exam_board is required');
    if (!row.type) errors.push('type is required');
    if (row.priceUsd === null || !Number.isFinite(row.priceUsd)) errors.push('bad price (price_usd)');
    if (row.priceMyr === null || !Number.isFinite(row.priceMyr)) errors.push('bad price (price_myr)');
    if (row.access !== 'paid' && row.access !== 'free') errors.push('access must be paid or free');
    if (row.access === 'paid' && (row.priceUsd ?? 0) <= 0 && (row.priceMyr ?? 0) <= 0) {
      errors.push('bad price');
    }
    const paper = fileProblem(row.paperPdf, sizes, 'pdf');
    if (paper) errors.push(`paper_pdf: ${paper}`);
    if (row.access === 'paid' || row.markschemePdf) {
      const scheme = fileProblem(row.markschemePdf, sizes, 'pdf');
      if (scheme) errors.push(`markscheme_pdf: ${scheme}`);
    }
    if (row.paperPdf && row.markschemePdf && row.paperPdf === row.markschemePdf) {
      errors.push('paper and mark scheme must be separate files');
    }
    const thumb = fileProblem(row.thumbnail, sizes, 'png');
    if (thumb) errors.push(`thumbnail: ${thumb}`);
    row.previewImages.forEach((path, index) => {
      const problem = fileProblem(path, sizes, 'image');
      if (problem) errors.push(`preview_images ${index + 1}: ${problem}`);
    });
    if (row.status && row.status !== 'draft') {
      warnings.push('status is saved as draft; an admin publishes separately');
    }
    const uniqueErrors = [...new Set(errors)];
    return {
      line: row.line,
      sku: row.sku,
      ok: uniqueErrors.length === 0,
      action: existingSkus.has(row.sku) ? 'update' : 'create',
      errors: uniqueErrors,
      warnings,
    };
  });
}

export function uploadProblems(row: ManifestRow, bytes: UploadBytes): string[] {
  const errors: string[] = [];
  if (!bytes.paper || !isPdf(bytes.paper)) errors.push('paper_pdf: missing file');
  else if (bytes.paper.length > PDF_MAX_BYTES) errors.push('paper_pdf: oversized file');
  const needsScheme = row.access === 'paid' || bytes.markscheme !== null || row.markschemePdf !== '';
  if (needsScheme) {
    if (!bytes.markscheme || !isPdf(bytes.markscheme)) errors.push('markscheme_pdf: missing file');
    else if (bytes.markscheme.length > PDF_MAX_BYTES) errors.push('markscheme_pdf: oversized file');
  }
  if (bytes.paper && bytes.markscheme && sameBytes(bytes.paper, bytes.markscheme)) {
    errors.push('paper and mark scheme must be separate files');
  }
  if (!bytes.thumbnail || !isPng(bytes.thumbnail)) errors.push('thumbnail: thumbnail must be a PNG');
  else if (bytes.thumbnail.length > IMAGE_MAX_BYTES) errors.push('thumbnail: oversized file');
  bytes.previews.forEach((preview, index) => {
    if (!isImage(preview)) errors.push(`preview_images ${index + 1}: preview must be an image`);
    else if (preview.length > IMAGE_MAX_BYTES) errors.push(`preview_images ${index + 1}: oversized file`);
  });
  if (bytes.previews.length !== row.previewImages.length && row.previewImages.length > 0) {
    errors.push('preview_images: missing file');
  }
  return [...new Set(errors)];
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length || left.length === 0) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

export function errorsToCsv(reports: readonly RowReport[]): string {
  const lines = ['line,sku,errors'];
  for (const report of reports) {
    if (report.errors.length === 0) continue;
    lines.push(`${report.line},${csvCell(report.sku)},${csvCell(report.errors.join(' | '))}`);
  }
  return `${lines.join('\n')}\n`;
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function pendingSkus(reports: readonly RowReport[], done: ReadonlySet<string>): string[] {
  return reports.filter(report => report.ok && !done.has(report.sku)).map(report => report.sku);
}
