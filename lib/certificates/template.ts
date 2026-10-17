/**
 * Course certificate facts. Kept apart from the shared certificate document
 * so student number, QR, and the public verify page can change on their own.
 */

export interface CourseCertificateFacts {
  id: string;
  studentName: string;
  courseTitle: string;
  level: string;
  issuedAt: string;
  score: number;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function certificateDateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function pdfText(value: string): string {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 63;
    if (code === 0x5c) out += '\\\\';
    else if (code === 0x28) out += '\\(';
    else if (code === 0x29) out += '\\)';
    else if (code >= 32 && code <= 126) out += ch;
    else out += '?';
  }
  return out;
}

export function courseCertificateLines(facts: CourseCertificateFacts): string[] {
  const lines = [
    'POKET SCHOOL',
    'Certificate of Achievement',
    facts.studentName.trim() || 'Student',
    facts.courseTitle.trim() || 'Course',
  ];
  if (facts.level.trim()) lines.push(facts.level.trim());
  const date = certificateDateLabel(facts.issuedAt);
  if (date) lines.push(date);
  lines.push(`Score  ${Math.round(facts.score)}%`);
  lines.push(`Certificate ID  ${facts.id}`);
  lines.push('Not an official academic qualification');
  return lines;
}

/** One-page PDF of the course certificate facts. No QR drawing lives here. */
export function courseCertificatePdf(facts: CourseCertificateFacts): Uint8Array {
  const commands = ['0.12 0.14 0.16 rg'];
  let y = 520;
  for (const line of courseCertificateLines(facts)) {
    commands.push('BT', '/F1 16 Tf', `72 ${y} Td`, `(${pdfText(line)}) Tj`, 'ET');
    y -= 28;
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
