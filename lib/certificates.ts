import { countCompleted, progressPercent } from './progress';
import { QR_QUIET_ZONE, qrMatrix, qrSvg } from './certificate-qr';
import { copyrightLine } from './insights/copyright';

export const CERTIFICATE_ISSUER_ID = 'poket-school';
export const CERTIFICATE_ISSUER_NAME = 'Poket School';
export const CERTIFICATE_DISCLAIMER =
  'Poket School certificates record that a student finished a module on this platform. They are not official academic qualifications.';

export interface CertificateAward {
  id: string;
  fresh: boolean;
  studentId: string;
  studentName: string;
  courseId: string;
  courseTitle: string;
  moduleId: string;
  moduleTitle: string;
  issuedAt: string;
  issuedByName: string;
}

export type CertificateStatus = 'valid' | 'revoked';

export interface CertificateFace {
  id: string;
  studentName: string;
  courseTitle: string;
  moduleTitle?: string;
  moduleId?: string;
  courseId?: string;
  issuedAt?: string | Date | { toDate?: () => Date } | null;
  issuedByName?: string;
  /** Missing means valid. Older certificates were issued before status existed. */
  status?: CertificateStatus | string | null;
  /** Hex accent from the institution brand. Invalid values are ignored. */
  accent?: string | null;
  /** When false, a white-label certificate omits the Poket School line. */
  showPoweredBy?: boolean | null;
  /** Partner endorsement. Poket School stays the creator. */
  partnerName?: string | null;
  recognisedBy?: string | null;
  partnerLogoUrl?: string | null;
  /** Academy logo. Https, or a root-relative path on this site. */
  logoUrl?: string | null;
  /** Printed under the disclaimer. Stored on the academy brand. */
  certificateFooter?: string | null;
}

export function safeLogoUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** A logo that can render on a page. Emails stay on safeLogoUrl so the address is absolute https. */
export function displayLogoUrl(value: string | null | undefined): string | null {
  const remote = safeLogoUrl(value);
  if (remote) return remote;
  const path = (value ?? '').trim();
  if (/^\/[A-Za-z0-9._~/-]+$/.test(path)) return path;
  return null;
}

export function certificateRecognition(face: Pick<CertificateFace, 'partnerName' | 'recognisedBy'>): string | null {
  const line = (face.recognisedBy || (face.partnerName ? `Recognised by ${face.partnerName}` : '')).replace(/\s+/g, ' ').trim();
  return line ? line.slice(0, 160) : null;
}

export function certificateStatus(status: unknown): CertificateStatus {
  return status === 'revoked' ? 'revoked' : 'valid';
}

export function certificateAccent(value: string | null | undefined): string | null {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : null;
}

export function certificateHeader(face: Pick<CertificateFace, 'issuedByName' | 'showPoweredBy'>): { brand: string; poweredBy: boolean } {
  const name = (face.issuedByName || CERTIFICATE_ISSUER_NAME).trim() || CERTIFICATE_ISSUER_NAME;
  const own = name.toLowerCase() === 'poket school';
  return {
    brand: name.toUpperCase(),
    poweredBy: !own && face.showPoweredBy !== false,
  };
}

/** Profile names are stored as written. Blank names stay a person, not an empty line. */
export function certificateStudentName(name: unknown): string {
  const text = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim() : '';
  return (text || 'Student').slice(0, 120);
}

export function certificateKey(studentId: string, courseId: string, moduleId: string): string {
  return `${studentId}__${courseId}__${moduleId}`;
}

/**
 * A module is complete only when it has published lessons and every one of them
 * is in the completed set. Drafts are absent from `publishedIds`, so they neither
 * block a certificate nor create one on their own.
 */
export function moduleIsComplete(publishedIds: readonly string[], completedIds: readonly string[]): boolean {
  if (publishedIds.length === 0) return false;
  const done = new Set(completedIds);
  return publishedIds.every((id) => done.has(id));
}

/** Progress uses the published lesson list only. Unknown and draft ids do not move it. */
export function publishedProgress(completedIds: readonly string[], publishedIds: readonly string[]): number {
  const published = publishedIds.map((id) => ({ id }));
  return progressPercent(countCompleted(completedIds, published), published.length);
}

export function formatCertificateDate(value: CertificateFace['issuedAt']): string {
  try {
    const date = value instanceof Date
      ? value
      : value && typeof value === 'object' && typeof value.toDate === 'function'
        ? value.toDate()
        : typeof value === 'string' || typeof value === 'number'
          ? new Date(value)
          : null;
    if (!date || Number.isNaN(date.getTime())) return 'Date unavailable';
    return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return 'Date unavailable';
  }
}

export function certificateVerifyPath(id: string): string {
  return `/verify/${encodeURIComponent(id)}`;
}

/** Public site origin. Clients prefix this onto a stored `/verify/{id}` path. */
export function publicSiteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://poketschool.ai').replace(/\/$/, '');
}

export function certificateVerifyUrl(id: string, origin = 'https://poketschool.ai'): string {
  return `${origin.replace(/\/$/, '')}${certificateVerifyPath(id)}`;
}

/** Absolute verify URL for an API response. Stored certificates keep the path only. */
export function absoluteVerifyUrl(path: string): string {
  const trimmed = path.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const suffix = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${publicSiteOrigin()}${suffix}`;
}

/** Issue year from the certificate date, so a download keeps the year it was awarded. */
export function certificateCopyright(issuedAt: CertificateFace['issuedAt']): string {
  let year = new Date().getUTCFullYear();
  try {
    const date = issuedAt instanceof Date
      ? issuedAt
      : issuedAt && typeof issuedAt === 'object' && typeof issuedAt.toDate === 'function'
        ? issuedAt.toDate()
        : typeof issuedAt === 'string' || typeof issuedAt === 'number'
          ? new Date(issuedAt)
          : null;
    if (date && !Number.isNaN(date.getTime())) year = date.getUTCFullYear();
  } catch {
    year = new Date().getUTCFullYear();
  }
  return copyrightLine(year);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pdfText(value: string): string {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 63;
    if (code === 0x5c) out += '\\\\';
    else if (code === 0x28) out += '\\(';
    else if (code === 0x29) out += '\\)';
    else if (code >= 32 && code <= 126) out += ch;
    else if (code <= 255) out += `\\${code.toString(8).padStart(3, '0')}`;
    else out += '?';
  }
  return out;
}

function pdfNum(value: number): string {
  return value.toFixed(3);
}

/** Vector QR so a printed PDF scans without an embedded image decoder. */
function pdfQrCommands(value: string, x: number, y: number, sizePt: number): string[] {
  const matrix = qrMatrix(value);
  const n = matrix.size + QR_QUIET_ZONE * 2;
  const cell = sizePt / n;
  const commands = [
    '1 1 1 rg',
    `${pdfNum(x)} ${pdfNum(y)} ${pdfNum(sizePt)} ${pdfNum(sizePt)} re f`,
    '0 0 0 rg',
  ];
  for (let row = 0; row < matrix.size; row += 1) {
    for (let col = 0; col < matrix.size; col += 1) {
      if (!matrix.dark(row, col)) continue;
      const cx = x + (col + QR_QUIET_ZONE) * cell;
      const cy = y + sizePt - (row + QR_QUIET_ZONE + 1) * cell;
      commands.push(`${pdfNum(cx)} ${pdfNum(cy)} ${pdfNum(cell)} ${pdfNum(cell)} re f`);
    }
  }
  return commands;
}

/** One-page landscape PDF. Standard fonts, so the file opens without a viewer plugin. */
export function buildCertificatePdf(face: CertificateFace, origin?: string): Uint8Array {
  const moduleTitle = face.moduleTitle?.trim() || face.courseTitle;
  const verify = certificateVerifyUrl(face.id, origin);
  const status = certificateStatus(face.status);
  const header = certificateHeader(face);
  const lines: { text: string; size: number; gap: number }[] = [
    { text: header.brand, size: 12, gap: 28 },
    ...(certificateRecognition(face) ? [{ text: certificateRecognition(face) as string, size: 11, gap: 20 }] : []),
    { text: 'Certificate of Achievement', size: 28, gap: 36 },
    { text: 'This is to certify that', size: 12, gap: 28 },
    { text: face.studentName, size: 24, gap: 32 },
    { text: 'has completed the module', size: 12, gap: 26 },
    { text: moduleTitle, size: 18, gap: 22 },
    { text: face.moduleTitle ? face.courseTitle : 'Poket School', size: 13, gap: 28 },
    { text: formatCertificateDate(face.issuedAt), size: 12, gap: 22 },
    { text: `Status  ${status === 'revoked' ? 'Revoked' : 'Valid'}`, size: 12, gap: 22 },
    { text: `Certificate ID  ${face.id}`, size: 11, gap: 16 },
    { text: verify, size: 9, gap: 18 },
    { text: 'Scan the QR code to open this verification page', size: 9, gap: 16 },
    { text: 'Not an official academic qualification', size: 9, gap: 14 },
    { text: certificateCopyright(face.issuedAt), size: 9, gap: 12 },
    ...(face.certificateFooter?.trim() ? [{ text: face.certificateFooter.trim().slice(0, 180), size: 9, gap: 12 }] : []),
    ...(header.poweredBy ? [{ text: 'Powered by Poket School', size: 9, gap: 12 }] : []),
  ];
  const commands = [
    '0.12 0.35 0.42 RG',
    '10 w',
    '28 28 736 556 re S',
    '0.15 0.53 0.64 RG',
    '1.5 w',
    '40 40 712 532 re S',
    '0.12 0.14 0.16 rg',
  ];
  let y = 520;
  for (const line of lines) {
    commands.push('BT', `/F1 ${line.size} Tf`, `72 ${y} Td`, `(${pdfText(line.text)}) Tj`, 'ET');
    y -= line.gap;
  }
  commands.push(...pdfQrCommands(verify, 620, 78, 132));
  commands.push('0.12 0.14 0.16 rg', 'BT', '/F1 9 Tf', '620 64 Td', '(Scan to verify) Tj', 'ET');
  const stream = commands.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 792 612] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((obj, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n`;
  body += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    body += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(body);
}

export function certificateDocumentHtml(face: CertificateFace, origin?: string): string {
  const moduleTitle = face.moduleTitle?.trim() || '';
  const verify = certificateVerifyUrl(face.id, origin);
  const date = formatCertificateDate(face.issuedAt);
  const status = certificateStatus(face.status);
  const statusLabel = status === 'revoked' ? 'Revoked' : 'Valid';
  const header = certificateHeader(face);
  const accent = certificateAccent(face.accent) ?? '#1E6A83';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Poket School certificate — ${escapeHtml(face.studentName)}</title>
  <style>
    body { margin: 0; background: #f4f7f8; font-family: Georgia, "Times New Roman", serif; color: #1c2b30; }
    .sheet { width: 900px; margin: 32px auto; background: #fff; border: 10px solid ${accent}; padding: 18px; }
    .inner { border: 2px solid #1E6A83; padding: 48px 56px 36px; text-align: center; }
    .brand { letter-spacing: 0.32em; font-size: 13px; color: #1E6A83; font-family: "Gill Sans", "Trebuchet MS", sans-serif; }
    h1 { font-weight: normal; font-size: 40px; margin: 18px 0 8px; }
    .lead, .meta { color: #526066; font-size: 16px; }
    .name { font-size: 36px; font-style: italic; color: #1E6A83; margin: 18px 0; }
    .module { font-size: 26px; margin: 8px 0 4px; }
    .course { font-size: 16px; color: #526066; }
    .id { margin-top: 28px; font-family: "Courier New", monospace; font-size: 13px; word-break: break-all; }
    .qr { width: 148px; height: 148px; margin: 18px auto 0; }
    .qr svg { width: 148px; height: 148px; }
    .status { display: inline-block; margin-top: 16px; padding: 4px 12px; border-radius: 999px; font-family: "Gill Sans", "Trebuchet MS", sans-serif; font-size: 12px; letter-spacing: 0.14em; }
    .valid { color: #0F6E56; background: #E7F6F1; }
    .revoked { color: #9B1C1C; background: #FDE8E8; }
    .disclaimer, .copyright { margin-top: 22px; font-size: 12px; color: #6b7c82; }
    .copyright { margin-top: 10px; }
    @media print { body { background: #fff; } .sheet { margin: 0; width: auto; } }
  </style>
</head>
<body>
  <div class="sheet"><div class="inner">
    <div class="brand">${escapeHtml(header.brand)}</div>
    ${displayLogoUrl(face.logoUrl) ? `<img alt="" src="${escapeHtml(displayLogoUrl(face.logoUrl) ?? '')}" width="72" height="72" style="margin-top:12px;object-fit:contain" />` : ''}
    ${certificateRecognition(face) ? `<p class="meta">${escapeHtml(certificateRecognition(face) ?? '')}</p>` : ''}
    ${safeLogoUrl(face.partnerLogoUrl) ? `<img alt="" src="${escapeHtml(safeLogoUrl(face.partnerLogoUrl) ?? '')}" width="96" height="48" style="margin-top:12px;object-fit:contain" />` : ''}
    <h1>Certificate of Achievement</h1>
    <p class="lead">This is to certify that</p>
    <div class="name">${escapeHtml(face.studentName)}</div>
    <p class="lead">has completed the module</p>
    <div class="module">${escapeHtml(moduleTitle || face.courseTitle)}</div>
    ${moduleTitle ? `<div class="course">${escapeHtml(face.courseTitle)}</div>` : ''}
    <p class="meta">${escapeHtml(date)} · ${escapeHtml(face.issuedByName || CERTIFICATE_ISSUER_NAME)}</p>
    <div class="status ${status}">${statusLabel}</div>
    <div class="id">Certificate ID<br>${escapeHtml(face.id)}</div>
    <div class="qr">${qrSvg(verify)}</div>
    <p class="meta">Scan the QR code to open ${escapeHtml(verify)}</p>
    <p class="disclaimer">${escapeHtml(CERTIFICATE_DISCLAIMER)}</p>
    ${face.certificateFooter?.trim() ? `<p class="copyright">${escapeHtml(face.certificateFooter.trim().slice(0, 240))}</p>` : ''}
    <p class="copyright">${escapeHtml(certificateCopyright(face.issuedAt))}</p>
    ${header.poweredBy ? '<p class="copyright">Powered by Poket School</p>' : ''}
  </div></div>
  <script>window.onload = function () { window.print(); }<\/script>
</body>
</html>`;
}
