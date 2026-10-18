export const CERTIFICATE_PALETTES = ['blue', 'cyan'] as const;
export const CERTIFICATE_BORDERS = ['none', 'line', 'double', 'corner'] as const;

export type CertificatePalette = (typeof CERTIFICATE_PALETTES)[number];
export type CertificateBorder = (typeof CERTIFICATE_BORDERS)[number];

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

function httpsUrl(value: unknown): string {
  const url = clean(value, 400);
  if (!url) return '';
  if (!/^https:\/\/[^\s]+$/i.test(url)) return '';
  return url;
}

function signatory(value: unknown): CertificateSignatory | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const name = clean(row.name, 80);
  const title = clean(row.title, 80);
  if (!name) return null;
  return { name, title, imageUrl: httpsUrl(row.imageUrl) };
}

export function paletteColours(palette: CertificatePalette): { ink: string; accent: string; wash: string; line: string } {
  if (palette === 'cyan') {
    return { ink: '#203337', accent: '#1E6A83', wash: '#E7FAF7', line: '#3FE0D0' };
  }
  return { ink: '#203337', accent: '#1E6A83', wash: '#F4F7F8', line: '#1E6A83' };
}

export function builtinDesigns(): CertificateDesign[] {
  const shared = {
    title: 'Certificate of Achievement',
    border: 'double' as const,
    showRecipient: true,
    showCourse: true,
    showDate: true,
    showCertificateId: true,
    showQr: true,
    signatories: [
      { name: 'Poket School', title: 'Issuer', imageUrl: '' },
    ],
    logoUrl: '',
    coBrandName: '',
    coBrandLogoUrl: '',
    institutionId: '',
  };
  return [
    { ...shared, id: 'poket-cyan', name: 'Poket cyan', palette: 'cyan', isDefault: true },
    { ...shared, id: 'poket-blue', name: 'Poket blue', palette: 'blue', border: 'line', isDefault: false },
  ];
}

export function normaliseDesign(input: Partial<CertificateDesign> | null | undefined, fallbackId = 'poket-cyan'): CertificateDesign {
  const base = builtinDesigns().find((item) => item.id === fallbackId) ?? builtinDesigns()[0];
  const palette = input?.palette === 'blue' || input?.palette === 'cyan' ? input.palette : base.palette;
  const border = input?.border === 'none' || input?.border === 'line' || input?.border === 'double' || input?.border === 'corner'
    ? input.border
    : base.border;
  const signatories = Array.isArray(input?.signatories)
    ? input.signatories.map(signatory).filter((item): item is CertificateSignatory => !!item).slice(0, 3)
    : base.signatories;
  return {
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
    signatories: signatories.length ? signatories : base.signatories,
    logoUrl: httpsUrl(input?.logoUrl),
    coBrandName: clean(input?.coBrandName, 80),
    coBrandLogoUrl: httpsUrl(input?.coBrandLogoUrl),
    institutionId: clean(input?.institutionId, 120),
    isDefault: input?.isDefault === true && !clean(input?.institutionId, 120),
  };
}

export const CERTIFICATE_KEY_MESSAGE = 'Saving certificate templates needs the Firebase Admin key. This admin tool is coming soon.';
