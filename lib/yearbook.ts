/**
 * Yearbook pages, the signing wall, and the alumni map.
 * Pure decisions. A page never occupies a seat.
 */

import { asAgeTier, isMinorTier, type AgeTier } from './age-tier';
import { screenPost, type ScreenedPost } from './alumni-network';
import { BRAND, brandPdfRgb } from './brand-theme';
import { moderateText } from './community/moderation';

/** Older books stored forest, gold, coral, or blue. */
export const YEARBOOK_TEMPLATES = ['deep', 'mid', 'bright', 'mist'] as const;
export type YearbookTemplate = (typeof YEARBOOK_TEMPLATES)[number];

export const YEARBOOK_FIELDS = ['photo', 'name', 'className', 'quote', 'mostLikely', 'clubs', 'achievements', 'destination'] as const;
export type YearbookField = (typeof YEARBOOK_FIELDS)[number];

export const AUDIENCES = ['classmates', 'institution', 'alumni', 'public'] as const;
export type YearbookAudience = (typeof AUDIENCES)[number];

/** Older notes stored leaf, gold, or coral. */
export const STICKERS = ['star', 'spark', 'deep', 'mid', 'bright'] as const;
export type YearbookSticker = (typeof STICKERS)[number];

export const MIN_PLACE_BUCKET = 5;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const RANK: Record<YearbookAudience, number> = { classmates: 1, institution: 2, alumni: 3, public: 4 };

const INK: Record<YearbookTemplate, string> = {
  deep: brandPdfRgb(BRAND.blueDeep),
  mid: brandPdfRgb(BRAND.primary),
  bright: brandPdfRgb(BRAND.blueBright),
  mist: brandPdfRgb(BRAND.wash),
};

const LEGACY_TEMPLATE: Record<string, YearbookTemplate> = {
  forest: 'deep',
  gold: 'mid',
  coral: 'bright',
  blue: 'bright',
};

const LEGACY_STICKER: Record<string, YearbookSticker> = {
  leaf: 'deep',
  gold: 'mid',
  coral: 'bright',
};

export interface YearbookAudiences {
  photo: YearbookAudience;
  name: YearbookAudience;
  className: YearbookAudience;
  quote: YearbookAudience;
  mostLikely: YearbookAudience;
  clubs: YearbookAudience;
  achievements: YearbookAudience;
  destination: YearbookAudience;
}

export function defaultAudiences(): YearbookAudiences {
  return {
    photo: 'classmates',
    name: 'classmates',
    className: 'classmates',
    quote: 'classmates',
    mostLikely: 'classmates',
    clubs: 'classmates',
    achievements: 'classmates',
    destination: 'classmates',
  };
}

export function readTemplate(value: unknown): YearbookTemplate {
  if (typeof value !== 'string') return 'deep';
  if ((YEARBOOK_TEMPLATES as readonly string[]).includes(value)) return value as YearbookTemplate;
  return LEGACY_TEMPLATE[value] ?? 'deep';
}

export function readAudience(value: unknown): YearbookAudience {
  return AUDIENCES.find((item) => item === value) ?? 'classmates';
}

export function readAudiences(data: unknown): YearbookAudiences {
  const base = defaultAudiences();
  if (!data || typeof data !== 'object') return base;
  const raw = data as Partial<YearbookAudiences>;
  for (const field of YEARBOOK_FIELDS) base[field] = readAudience(raw[field]);
  return base;
}

export function readSticker(value: unknown): YearbookSticker | '' {
  if (typeof value !== 'string') return '';
  if ((STICKERS as readonly string[]).includes(value)) return value as YearbookSticker;
  return LEGACY_STICKER[value] ?? '';
}

/** The field audience is the widest group. A narrower viewer still sees it. */
export function fieldVisible(fieldAudience: YearbookAudience, viewer: YearbookAudience): boolean {
  return RANK[viewer] <= RANK[fieldAudience];
}

export function lockDateFrom(leftOn: string): string {
  if (!DATE.test(leftOn)) return '';
  const [year, month, day] = leftOn.split('-').map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, (day ?? 1) + 30));
  return date.toISOString().slice(0, 10);
}

export function canEditYearbook(today: string, lockOn: string): boolean {
  return DATE.test(today) && DATE.test(lockOn) && today <= lockOn;
}

export function canSubmitPage(input: { today: string; lockOn: string; ageTier: AgeTier; parentApproved: boolean }): { ok: boolean; reason: string } {
  if (!canEditYearbook(input.today, input.lockOn)) return { ok: false, reason: 'This yearbook is locked.' };
  if (isMinorTier(asAgeTier(input.ageTier)) && !input.parentApproved) {
    return { ok: false, reason: 'A parent agrees before this page can be submitted.' };
  }
  return { ok: true, reason: '' };
}

/** Classmates, other alumni, and the public wait for a parent when the student is under 18. */
export function pageReleased(input: { ageTier: AgeTier; parentApproved: boolean; approved: boolean; viewer: 'self' | 'parent' | 'institution' | YearbookAudience }): boolean {
  if (input.viewer === 'self' || input.viewer === 'parent' || input.viewer === 'institution') return true;
  if (!input.approved) return false;
  if (isMinorTier(asAgeTier(input.ageTier)) && !input.parentApproved) return false;
  return true;
}

/** Own writing. Contact details and threats stay off the printed page. Admin approval is the moderation step. */
export function screenOwnPage(text: string): { ok: boolean; reason: string } {
  if (!text.trim()) return { ok: true, reason: '' };
  const result = moderateText(text);
  if (result.decision === 'allow') return { ok: true, reason: '' };
  return { ok: false, reason: 'Rewrite that line before it goes in the yearbook.' };
}

/** Wall notes and signatures. Minors are held for a moderator. A sticker can stand alone. */
export function screenSignature(body: string, sticker: string, ageTier: AgeTier): ScreenedPost {
  const mark = readSticker(sticker);
  const text = body.trim() || mark;
  return screenPost(text, asAgeTier(ageTier));
}

export function canConnect(a: { id: string; ageTier: AgeTier; directory: boolean }, b: { id: string; ageTier: AgeTier; directory: boolean }, blocked: boolean): boolean {
  if (!a.id || a.id === b.id || blocked) return false;
  if (!a.directory || !b.directory) return false;
  if (isMinorTier(asAgeTier(a.ageTier)) || isMinorTier(asAgeTier(b.ageTier))) return false;
  return true;
}

export interface PlaceRow {
  country: string;
  shareName: boolean;
  name: string;
}

export function placeBoard(rows: readonly PlaceRow[]): { countries: { country: string; count: number; names: string[] }[]; hiddenCountries: number } {
  const buckets = new Map<string, { count: number; names: string[] }>();
  for (const row of rows) {
    const country = row.country.trim();
    if (!country) continue;
    const bucket = buckets.get(country) ?? { count: 0, names: [] };
    bucket.count += 1;
    if (row.shareName && row.name.trim()) bucket.names.push(row.name.trim());
    buckets.set(country, bucket);
  }
  const countries = [];
  let hiddenCountries = 0;
  for (const [country, bucket] of buckets) {
    if (bucket.count < MIN_PLACE_BUCKET) {
      hiddenCountries += 1;
      continue;
    }
    countries.push({ country, count: bucket.count, names: bucket.names.slice(0, 8) });
  }
  countries.sort((left, right) => right.count - left.count);
  return { countries, hiddenCountries };
}

/** A feed line can repeat a recorded title. A title that is not on the record is refused. */
export function suggestionAllowed(title: string, known: readonly string[]): boolean {
  const needle = title.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!needle) return false;
  return known.some((item) => item.replace(/\s+/g, ' ').trim().toLowerCase() === needle);
}

export interface PortraitInput {
  name: string;
  className: string;
  quote: string;
  mostLikely: string;
  clubs: string;
  achievements: readonly string[];
  destination: string;
  audiences: YearbookAudiences;
  released: boolean;
}

export function portraitLines(page: PortraitInput, viewer: YearbookAudience): string[] {
  if (!page.released) return [];
  const lines: string[] = [];
  const take = (field: YearbookField, label: string, value: string) => {
    const clean = value.replace(/\s+/g, ' ').trim();
    if (!clean || clean.includes('@')) return;
    if (!fieldVisible(page.audiences[field], viewer)) return;
    lines.push(`${label}: ${clean}`.slice(0, 120));
  };
  take('name', 'Name', page.name);
  take('className', 'Class', page.className);
  take('quote', 'Quote', page.quote);
  take('mostLikely', 'Most likely to', page.mostLikely);
  take('clubs', 'Clubs', page.clubs);
  take('destination', 'Destination', page.destination);
  if (fieldVisible(page.audiences.achievements, viewer)) {
    for (const item of page.achievements) take('achievements', 'Achievement', item);
  }
  return lines;
}

export interface YearbookSheet {
  heading: string;
  lines: string[];
}

export function yearbookPdf(input: { template: YearbookTemplate; academy: string; sheets: readonly YearbookSheet[] }): Uint8Array {
  const template = readTemplate(input.template);
  const sheets = (input.sheets.length ? input.sheets : [{ heading: input.academy || 'Yearbook', lines: [] }]).slice(0, 8);
  const count = sheets.length;
  const fontId = 3 + count * 2;
  const objects: string[] = [];
  objects.push('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n');
  const kids = sheets.map((_, index) => `${3 + index * 2} 0 R`).join(' ');
  objects.push(`2 0 obj << /Type /Pages /Kids [${kids}] /Count ${count} >> endobj\n`);
  const ink = INK[template];
  sheets.forEach((sheet, index) => {
    const pageId = 3 + index * 2;
    const streamId = pageId + 1;
    const lines = [sheet.heading, ...sheet.lines].slice(0, 28).map((line) => pdfEscape(line).slice(0, 90));
    const commands = [
      `${ink} rg`,
      '0 790 595 52 re f',
      `${template === 'bright' || template === 'mist' ? brandPdfRgb(BRAND.ink) : '1 1 1'} rg`,
      'BT /F1 16 Tf 36 808 Td (Poket School) Tj ET',
      `${brandPdfRgb(BRAND.ink)} rg`,
      'BT /F1 12 Tf 16 TL 36 760 Td',
    ];
    lines.forEach((line, lineIndex) => {
      commands.push(lineIndex === 0 ? `(${line}) Tj` : `T* (${line}) Tj`);
    });
    commands.push('ET');
    const stream = commands.join('\n');
    objects.push(`${pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${streamId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >> endobj\n`);
    objects.push(`${streamId} 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream\nendobj\n`);
  });
  objects.push(`${fontId} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n`);
  let cursor = '%PDF-1.4\n'.length;
  const offsets = objects.map((object) => {
    const offset = cursor;
    cursor += object.length;
    return offset;
  });
  const size = objects.length + 1;
  const xref = [
    'xref\n',
    `0 ${size}\n`,
    '0000000000 65535 f \n',
    ...offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`),
    `trailer << /Size ${size} /Root 1 0 R >>\n`,
    'startxref\n',
    `${cursor}\n`,
    '%%EOF',
  ].join('');
  return new TextEncoder().encode(`%PDF-1.4\n${objects.join('')}${xref}`);
}

function pdfEscape(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, ' ').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

export const COUNTRY_DOTS: Record<string, { x: number; y: number }> = {
  Malaysia: { x: 76, y: 58 },
  Singapore: { x: 78, y: 62 },
  'United Kingdom': { x: 46, y: 30 },
  'United States': { x: 20, y: 40 },
  Australia: { x: 84, y: 76 },
  Canada: { x: 18, y: 28 },
  India: { x: 68, y: 48 },
};
