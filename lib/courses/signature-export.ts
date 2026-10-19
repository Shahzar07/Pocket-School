export interface SignatureRow {
  id: string;
  typedFullName: string;
  context: string;
  courseId: string;
  signedAt: string;
  ip: string;
  userAgent: string;
}

export function signaturesCsv(rows: SignatureRow[]): string {
  const header = ['id', 'name', 'context', 'courseId', 'signedAt', 'ip', 'userAgent'];
  const lines = rows.map((row) => [row.id, row.typedFullName, row.context, row.courseId, row.signedAt, row.ip, row.userAgent]
    .map((cell) => `"${cell.replace(/"/g, '""')}"`)
    .join(','));
  return [header.join(','), ...lines].join('\n');
}

/** A one-page text PDF. Admins can open it without another library. */
export function signaturesPdf(rows: SignatureRow[]): Uint8Array {
  const lines = ['Poket School copyright signatures', ...rows.slice(0, 28).map((row) => `${row.signedAt}  ${row.typedFullName}  ${row.context}  ${row.courseId}`)];
  const text = lines.join('\\n').replace(/[()\\]/g, ' ');
  const stream = `BT /F1 11 Tf 48 760 Td (${text}) Tj ET`;
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
    '2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj\n',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n',
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj\n`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(body.length);
    body += object;
  }
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n`;
  body += '0000000000 65535 f \n';
  for (const offset of offsets.slice(1)) body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(body);
}
