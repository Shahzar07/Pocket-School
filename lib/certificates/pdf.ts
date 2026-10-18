import type { CertificateDesign, CertificateSample } from './design';

function escapePdf(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7E]/g, '?');
}

/** One-page certificate PDF. Logos and signature images stay on the live preview. */
export function certificatePdf(design: CertificateDesign, sample: CertificateSample): Uint8Array {
  const lines = [
    'Poket School',
    design.title || 'Certificate',
    design.showRecipient ? sample.recipient : '',
    design.showCourse ? sample.course : '',
    design.showDate ? sample.date : '',
    design.showCertificateId ? sample.certificateId : '',
    ...design.signatories.map((person) => [person.name, person.title].filter(Boolean).join(', ')),
    design.coBrandName ? `With ${design.coBrandName}` : '',
    design.showQr ? sample.verifyUrl : '',
  ].filter(Boolean);
  const commands = ['BT', '/F1 18 Tf', '72 740 Td', '18 TL'];
  for (const line of lines) commands.push(`(${escapePdf(line)}) Tj`, 'T*');
  commands.push('ET');
  const stream = commands.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n`;
  body += '0000000000 65535 f \n';
  for (let index = 1; index < offsets.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(body);
}
