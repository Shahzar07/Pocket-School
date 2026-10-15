import { countCompleted, progressPercent } from './progress';

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

export interface CertificateFace {
  id: string;
  studentName: string;
  courseTitle: string;
  moduleTitle?: string;
  moduleId?: string;
  courseId?: string;
  issuedAt?: string | Date | { toDate?: () => Date } | null;
  issuedByName?: string;
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

export function certificateVerifyUrl(id: string, origin = 'https://poketschool.ai'): string {
  return `${origin.replace(/\/$/, '')}${certificateVerifyPath(id)}`;
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

/** One-page landscape PDF. Standard fonts, so the file opens without a viewer plugin. */
export function buildCertificatePdf(face: CertificateFace, origin?: string): Uint8Array {
  const moduleTitle = face.moduleTitle?.trim() || face.courseTitle;
  const lines: { text: string; size: number; gap: number }[] = [
    { text: 'POKET SCHOOL', size: 12, gap: 28 },
    { text: 'Certificate of Achievement', size: 28, gap: 36 },
    { text: 'This is to certify that', size: 12, gap: 28 },
    { text: face.studentName, size: 24, gap: 32 },
    { text: 'has completed the module', size: 12, gap: 26 },
    { text: moduleTitle, size: 18, gap: 22 },
    { text: face.moduleTitle ? face.courseTitle : 'Poket School', size: 13, gap: 28 },
    { text: formatCertificateDate(face.issuedAt), size: 12, gap: 26 },
    { text: `Certificate ID  ${face.id}`, size: 10, gap: 16 },
    { text: certificateVerifyUrl(face.id, origin), size: 10, gap: 22 },
    { text: 'Not an official academic qualification', size: 9, gap: 12 },
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
  let y = 500;
  for (const line of lines) {
    commands.push('BT', `/F1 ${line.size} Tf`, `72 ${y} Td`, `(${pdfText(line.text)}) Tj`, 'ET');
    y -= line.gap;
  }
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
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Poket School certificate — ${escapeHtml(face.studentName)}</title>
  <style>
    body { margin: 0; background: #f4f7f8; font-family: Georgia, "Times New Roman", serif; color: #1c2b30; }
    .sheet { width: 900px; margin: 32px auto; background: #fff; border: 10px solid #1E6A83; padding: 18px; }
    .inner { border: 2px solid #2786A4; padding: 48px 56px 36px; text-align: center; }
    .brand { letter-spacing: 0.32em; font-size: 13px; color: #1E6A83; font-family: "Gill Sans", "Trebuchet MS", sans-serif; }
    h1 { font-weight: normal; font-size: 40px; margin: 18px 0 8px; }
    .lead, .meta { color: #526066; font-size: 16px; }
    .name { font-size: 36px; font-style: italic; color: #1E6A83; margin: 18px 0; }
    .module { font-size: 26px; margin: 8px 0 4px; }
    .course { font-size: 16px; color: #526066; }
    .id { margin-top: 28px; font-family: "Courier New", monospace; font-size: 13px; word-break: break-all; }
    .disclaimer { margin-top: 22px; font-size: 12px; color: #6b7c82; }
    @media print { body { background: #fff; } .sheet { margin: 0; width: auto; } }
  </style>
</head>
<body>
  <div class="sheet"><div class="inner">
    <div class="brand">POKET SCHOOL</div>
    <h1>Certificate of Achievement</h1>
    <p class="lead">This is to certify that</p>
    <div class="name">${escapeHtml(face.studentName)}</div>
    <p class="lead">has completed the module</p>
    <div class="module">${escapeHtml(moduleTitle || face.courseTitle)}</div>
    ${moduleTitle ? `<div class="course">${escapeHtml(face.courseTitle)}</div>` : ''}
    <p class="meta">${escapeHtml(date)} · ${escapeHtml(face.issuedByName || CERTIFICATE_ISSUER_NAME)}</p>
    <div class="id">Certificate ID<br>${escapeHtml(face.id)}<br>${escapeHtml(verify)}</div>
    <p class="disclaimer">${escapeHtml(CERTIFICATE_DISCLAIMER)}</p>
  </div></div>
  <script>window.onload = function () { window.print(); }<\/script>
</body>
</html>`;
}
