/**
 * Visual student ID. The public share payload still omits the student number.
 * This module only describes what a face draws. It does not sign a token.
 */

export type IdCardTheme = 'poket' | 'rochford';

export interface IdCardBrand {
  theme: IdCardTheme;
  institutionName: string;
  tagline: string;
  motto: string;
  /** Seal letters. Schools set this on institutions/{id}.branding.monogram. */
  monogram: string;
  logoUrl: string;
  emergencyPhone: string;
}

export interface IdCardView {
  brand: IdCardBrand;
  fullName: string;
  studentId: string;
  levelName: string;
  programme: string;
  academicYear: string;
  validUntil: string;
  photoUrl: string;
  verifyPath: string;
  sample: boolean;
}

export const POKET_CARD_NAME = 'Poket School';
export const POKET_TAGLINE = 'Free for every student';
export const POKET_MOTTO = 'Learn ● Grow ● Achieve';
export const CARD_BADGE = 'STUDENT ID CARD';
export const SAFELINE_LABEL = 'Poket SafeLine';
export const SAFELINE_ROW = 'Poket SafeLine · Not an emergency service';
export const BACK_TERMS = 'This card identifies a learner. Partners see a first name and whether the code is live. The date of birth is never printed.';
export const BACK_SAFELINE = 'Poket SafeLine is in the app. It is not an emergency service.';
export const VERIFY_LABEL = 'Verify at poketschool.ai/verify';
export const INDEPENDENT_VALID = 'While you learn';
export const CARD_WIDTH = 820;
export const CARD_HEIGHT = 526;

const CODE39: Record<string, string> = {
  '0': 'nnnwwnwnn',
  '1': 'wnnwnnnnw',
  '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw',
  B: 'nnwnnwnnw',
  C: 'wnwnnwnnn',
  D: 'nnnnwwnnw',
  E: 'wnnnwwnnn',
  F: 'nnwnwwnnn',
  G: 'nnnnnwwnw',
  H: 'wnnnnwwnn',
  I: 'nnwnnwwnn',
  J: 'nnnnwwwnn',
  K: 'wnnnnnnww',
  L: 'nnwnnnnww',
  M: 'wnwnnnnwn',
  N: 'nnnnwnnww',
  O: 'wnnnwnnwn',
  P: 'nnwnwnnwn',
  Q: 'nnnnnnwww',
  R: 'wnnnnnwwn',
  S: 'nnwnnnwwn',
  T: 'nnnnwnwwn',
  U: 'wwnnnnnnw',
  V: 'nwwnnnnnw',
  W: 'wwwnnnnnn',
  X: 'nwnnwnnnw',
  Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw',
  '.': 'wwnnnnwnn',
  ' ': 'nwwnnnwnn',
  '*': 'nwnnwnwnn',
};

export function academicYear(now = new Date()): string {
  const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}/${String(start + 1).slice(-2)}`;
}

export function cardValidUntil(now = new Date()): string {
  const endYear = now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear();
  return `July ${endYear}`;
}

/** Level names only. A stored code such as 300L becomes Degree Year. Bare years stay off the card. */
export function displayLevel(value: string): string {
  const clean = value.trim();
  if (/^[1-9]00L$/i.test(clean)) return 'Degree Year';
  if (/^year\s*\d+\b/i.test(clean) || /^\d{1,2}$/.test(clean)) return 'Learner';
  return clean;
}

export function poketBrand(): IdCardBrand {
  return {
    theme: 'poket',
    institutionName: POKET_CARD_NAME,
    tagline: POKET_TAGLINE,
    motto: POKET_MOTTO,
    monogram: 'PS',
    logoUrl: '',
    emergencyPhone: '',
  };
}

export function brandFromSchool(name: string, branding: Record<string, unknown> | null | undefined): IdCardBrand {
  const clean = name.trim();
  const read = (key: string) => (typeof branding?.[key] === 'string' ? String(branding[key]).trim() : '');
  if (!clean) return poketBrand();
  const rochford = /rochford/i.test(clean);
  const institutionName = read('displayName') || clean;
  return {
    theme: rochford ? 'rochford' : 'poket',
    institutionName,
    tagline: read('tagline') || (rochford ? 'International learning, one community' : 'A Poket School academy'),
    motto: read('motto') || read('certificateFooter') || (rochford ? 'Courage, curiosity, and care.' : POKET_MOTTO),
    monogram: (read('monogram') || monogram(institutionName)).slice(0, 4),
    logoUrl: read('logoUrl'),
    emergencyPhone: read('emergencyPhone'),
  };
}

export function monogram(name: string): string {
  const words = name.replace(/[^A-Za-z\s]/g, ' ').trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((word) => word[0] ?? '').join('');
  return (letters || 'PS').toUpperCase();
}

/** Code 39 bars as runs of black and white, starting with black. */
export function code39Runs(value: string): number[] {
  const text = value.toUpperCase().replace(/[^0-9A-Z. \-$/+%]/g, '');
  const encoded = `*${text}*`;
  const runs: number[] = [];
  let black = true;
  const push = (width: number, ink: boolean) => {
    if (runs.length > 0 && ink === black) {
      runs[runs.length - 1] += width;
      return;
    }
    runs.push(width);
    black = ink;
  };
  for (let index = 0; index < encoded.length; index += 1) {
    const pattern = CODE39[encoded[index] ?? ''];
    if (!pattern) continue;
    for (let bit = 0; bit < pattern.length; bit += 1) {
      push(pattern[bit] === 'w' ? 3 : 1, bit % 2 === 0);
    }
    if (index < encoded.length - 1) push(1, false);
  }
  return runs;
}

export const POKET_SAMPLE_CARD: IdCardView = {
  brand: poketBrand(),
  fullName: 'Alex Student',
  studentId: 'PSM-SAMPLE',
  levelName: 'IGCSE',
  programme: 'Sciences',
  academicYear: '2026/27',
  validUntil: INDEPENDENT_VALID,
  photoUrl: '',
  verifyPath: '/verify/ps1.preview.signature',
  sample: true,
};

export const ROCHFORD_DEMO_CARD: IdCardView = {
  brand: {
    theme: 'rochford',
    institutionName: "Rochford's International School",
    tagline: 'International learning, one community',
    motto: 'Courage, curiosity, and care.',
    monogram: 'RI',
    logoUrl: '',
    emergencyPhone: '03-0000 0199',
  },
  fullName: 'Amina Rahman',
  studentId: 'PS-1042',
  levelName: 'IGCSE',
  programme: 'Sciences',
  academicYear: '2026/27',
  validUntil: 'July 2027',
  photoUrl: '',
  verifyPath: '/verify/ps1.preview.signature',
  sample: false,
};

export function viewFromPublic(card: {
  firstName: string;
  levelName: string;
  schoolName: string | null;
  showPhoto: boolean;
  avatarUrl: string;
  badges: string[];
}, schoolOnCard: boolean): IdCardView {
  const school = schoolOnCard ? (card.schoolName ?? '').trim() : '';
  return {
    brand: school ? brandFromSchool(school, null) : poketBrand(),
    fullName: card.firstName || 'Member',
    studentId: '',
    levelName: card.levelName || 'Learner',
    programme: card.badges[0] || 'General',
    academicYear: academicYear(),
    validUntil: school ? cardValidUntil() : INDEPENDENT_VALID,
    photoUrl: card.showPhoto ? card.avatarUrl : '',
    verifyPath: '/verify',
    sample: false,
  };
}

/** Every card uses the approved app palette. A school changes name, tagline, motto, monogram, and logo. */
export function themePaint(_theme: IdCardTheme): { header: string; accent: string; accentInk: string; frame: string; body: string } {
  return {
    header: 'linear-gradient(90deg, #1E6A83 0%, #2786A4 100%)',
    accent: '#3FE0D0',
    accentInk: '#203337',
    frame: '#1E6A83',
    body: '#F3FEFE',
  };
}

export const CARD_RATIO = CARD_WIDTH / CARD_HEIGHT;

/** One-page PDF whose only content is a JPEG. Page size is in points. */
export function pdfAroundJpeg(
  jpeg: Uint8Array,
  image: { width: number; height: number },
  page: { width: number; height: number },
): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let size = 0;
  const push = (part: Uint8Array | string) => {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part;
    chunks.push(bytes);
    size += bytes.length;
  };
  push('%PDF-1.4\n');
  const mark = () => { offsets.push(size); };
  mark();
  push('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n');
  mark();
  push('2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n');
  mark();
  push(`3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width.toFixed(2)} ${page.height.toFixed(2)}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >> endobj\n`);
  const content = `q ${page.width.toFixed(2)} 0 0 ${page.height.toFixed(2)} 0 0 cm /Im0 Do Q\n`;
  mark();
  push(`4 0 obj << /Length ${content.length} >> stream\n${content}endstream\nendobj\n`);
  mark();
  push(`5 0 obj << /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >> stream\n`);
  push(jpeg);
  push('\nendstream\nendobj\n');
  const xref = size;
  push(`xref\n0 6\n0000000000 65535 f \n`);
  for (let index = 1; index <= 5; index += 1) {
    push(`${String(offsets[index] ?? 0).padStart(10, '0')} 00000 n \n`);
  }
  push(`trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const out = new Uint8Array(size);
  let cursor = 0;
  for (const chunk of chunks) {
    out.set(chunk, cursor);
    cursor += chunk.length;
  }
  return out;
}
