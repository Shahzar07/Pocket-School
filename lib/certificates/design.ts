import { designForIssue } from './sample-placeholders';

export const CERTIFICATE_PALETTES = ['blue', 'cyan'] as const;
export const CERTIFICATE_BORDERS = ['none', 'line', 'double', 'corner'] as const;
export const CERTIFICATE_PAGE_SIZES = ['a4-landscape', 'a4-portrait', 'letter'] as const;
export const BUILTIN_TEMPLATE_IDS = ['poket-cyan', 'poket-blue'] as const;

export type CertificatePalette = (typeof CERTIFICATE_PALETTES)[number];
export type CertificateBorder = (typeof CERTIFICATE_BORDERS)[number];
export type CertificatePageSize = (typeof CERTIFICATE_PAGE_SIZES)[number];

/** Points at 72 per inch. A4 landscape is the default. US Letter is landscape too. */
export const CERTIFICATE_PAGE_POINTS: Record<CertificatePageSize, { width: number; height: number }> = {
  'a4-landscape': { width: 841.89, height: 595.28 },
  'a4-portrait': { width: 595.28, height: 841.89 },
  letter: { width: 792, height: 612 },
};

export const CERTIFICATE_PAGE_LABELS: Record<CertificatePageSize, string> = {
  'a4-landscape': 'A4 landscape',
  'a4-portrait': 'A4 portrait',
  letter: 'US Letter',
};

export interface CertificateSignatory {
  name: string;
  title: string;
  imageUrl: string;
}

export interface CertificateDesign {
  id: string;
  name: string;
  title: string;
  palette: CertificatePalette;
  border: CertificateBorder;
  showRecipient: boolean;
  showCourse: boolean;
  showDate: boolean;
  showCertificateId: boolean;
  showQr: boolean;
  signatories: CertificateSignatory[];
  logoUrl: string;
  coBrandName: string;
  coBrandLogoUrl: string;
  institutionId: string;
  isDefault: boolean;
  pageSize: CertificatePageSize;
}

export interface CertificateSample {
  recipient: string;
  course: string;
  date: string;
  certificateId: string;
  verifyUrl: string;
}

export const CERTIFICATE_SAMPLE: CertificateSample = {
  recipient: 'Amina Yusuf',
  course: 'IGCSE Mathematics',
  date: '18 Oct 2026',
  certificateId: 'PS-1042',
  verifyUrl: 'https://poketschool.ai/verify/PS-1042',
};

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

const DATA_URL_MAX = 120_000;

function httpsUrl(value: unknown): string {
  const url = clean(value, 400);
  if (!url) return '';
  if (!/^https:\/\/[^\s]+$/i.test(url)) return '';
  return url;
}

/** https link, or a PNG/JPG data URL small enough to store on the template. */
export function imageSource(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  if (/^data:image\/(png|jpeg|jpg);base64,[A-Za-z0-9+/=]+$/i.test(raw)) {
    return raw.length <= DATA_URL_MAX ? raw : '';
  }
  return httpsUrl(raw);
}

export function imageFieldError(value: string): string {
  const url = value.trim();
  if (!url) return '';
  if (url.startsWith('data:')) {
    if (!/^data:image\/(png|jpeg|jpg);base64,[A-Za-z0-9+/=]+$/i.test(url)) return 'Upload a PNG or JPG.';
    if (url.length > DATA_URL_MAX) return 'That image is too large. Use a file under 80 KB.';
    return '';
  }
  if (!/^https:\/\/\S+$/i.test(url)) return 'Use an https:// link, or upload a PNG or JPG.';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return 'Use an https:// link, or upload a PNG or JPG.';
  } catch {
    return 'That link is not a valid URL.';
  }
  return '';
}

export function designFieldErrors(design: Pick<CertificateDesign, 'name' | 'title' | 'logoUrl' | 'coBrandLogoUrl' | 'signatories'>): string[] {
  const errors = [
    imageFieldError(design.logoUrl),
    imageFieldError(design.coBrandLogoUrl),
    ...design.signatories.map((person) => imageFieldError(person.imageUrl)),
  ].filter(Boolean);
  if (!design.name.trim()) errors.push('Name the template.');
  if (!design.title.trim()) errors.push('Add a certificate title.');
  return errors;
}

function signatory(value: unknown): CertificateSignatory | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const name = clean(row.name, 80);
  const title = clean(row.title, 80);
  if (!name) return null;
  return { name, title, imageUrl: imageSource(row.imageUrl) };
}

export function paletteColours(palette: CertificatePalette): { ink: string; accent: string; wash: string; line: string } {
  if (palette === 'cyan') {
    return { ink: '#203337', accent: '#1E6A83', wash: '#E7FAF7', line: '#3FE0D0' };
  }
  return { ink: '#203337', accent: '#1E6A83', wash: '#F4F7F8', line: '#1E6A83' };
}

function freshSignatories(): CertificateSignatory[] {
  return [{ name: 'Poket School', title: 'Issuer', imageUrl: '' }];
}

export function isBuiltinTemplate(id: string): boolean {
  return (BUILTIN_TEMPLATE_IDS as readonly string[]).includes(id);
}

export function builtinDesigns(): CertificateDesign[] {
  const shared = {
    title: 'Certificate of Achievement',
    showRecipient: true,
    showCourse: true,
    showDate: true,
    showCertificateId: true,
    showQr: true,
    logoUrl: '',
    coBrandName: '',
    coBrandLogoUrl: '',
    institutionId: '',
    pageSize: 'a4-landscape' as const,
  };
  return [
    { ...shared, id: 'poket-cyan', name: 'Poket cyan', palette: 'cyan', border: 'double', isDefault: true, signatories: freshSignatories() },
    { ...shared, id: 'poket-blue', name: 'Poket blue', palette: 'blue', border: 'line', isDefault: false, signatories: freshSignatories() },
  ];
}

/** One row per id, each with its own signatory list. */
export function uniqueDesigns(rows: CertificateDesign[]): CertificateDesign[] {
  const seen = new Set<string>();
  const out: CertificateDesign[] = [];
  for (const row of rows) {
    if (!row.id || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push({ ...row, signatories: row.signatories.map((person) => ({ ...person })) });
  }
  return out;
}

export function scopeDesignForActor(
  design: CertificateDesign,
  actor: { staff: string | null; institutionId: string },
): CertificateDesign {
  if (actor.staff === 'super_admin') return design;
  const institutionId = actor.institutionId || design.institutionId;
  return {
    ...design,
    institutionId,
    isDefault: false,
    id: institutionId ? `institution-${institutionId}` : design.id,
  };
}

export interface TemplateSampleRecord {
  id: string;
  studentName: string;
  courseTitle: string;
  issuedAt: string;
  verifyUrl: string;
  sample: true;
}

/** The designer preview id. A stored certificate with the same id wins over this. */
export function templateSampleRecord(id: string): TemplateSampleRecord | null {
  if (id.trim() !== CERTIFICATE_SAMPLE.certificateId) return null;
  return {
    id: CERTIFICATE_SAMPLE.certificateId,
    studentName: CERTIFICATE_SAMPLE.recipient,
    courseTitle: CERTIFICATE_SAMPLE.course,
    issuedAt: '2026-10-18T00:00:00.000Z',
    verifyUrl: CERTIFICATE_SAMPLE.verifyUrl,
    sample: true,
  };
}

export function normaliseDesign(input: Partial<CertificateDesign> | null | undefined, fallbackId = 'poket-cyan'): CertificateDesign {
  const base = builtinDesigns().find((item) => item.id === fallbackId) ?? builtinDesigns()[0];
  const palette = input?.palette === 'blue' || input?.palette === 'cyan' ? input.palette : base.palette;
  const border = input?.border === 'none' || input?.border === 'line' || input?.border === 'double' || input?.border === 'corner'
    ? input.border
    : base.border;
  const signatories = Array.isArray(input?.signatories)
    ? input.signatories.map(signatory).filter((item): item is CertificateSignatory => !!item).slice(0, 3)
    : base.signatories.map((person) => ({ ...person }));
  const pageSize = input?.pageSize === 'a4-portrait' || input?.pageSize === 'letter' || input?.pageSize === 'a4-landscape'
    ? input.pageSize
    : base.pageSize;
  const draft: CertificateDesign = {
    id: clean(input?.id, 80) || base.id,
    name: clean(input?.name, 80) || base.name,
    title: clean(input?.title, 120) || base.title,
    palette,
    border,
    showRecipient: input?.showRecipient !== false,
    showCourse: input?.showCourse !== false,
    showDate: input?.showDate !== false,
    showCertificateId: input?.showCertificateId !== false,
    showQr: input?.showQr !== false,
    signatories: signatories.length ? signatories.map((person) => ({ ...person })) : base.signatories.map((person) => ({ ...person })),
    logoUrl: imageSource(input?.logoUrl),
    coBrandName: clean(input?.coBrandName, 80),
    coBrandLogoUrl: imageSource(input?.coBrandLogoUrl),
    institutionId: clean(input?.institutionId, 120),
    isDefault: input?.isDefault === true && !clean(input?.institutionId, 120),
    pageSize,
  };
  return designForIssue(draft);
}

export const CERTIFICATE_KEY_MESSAGE = 'Saving certificate templates needs the Firebase Admin key. This admin tool is coming soon.';
