import { copyrightLine } from './copyright';

function pdfEscape(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/©/g, '\\251')
    .replace(/[^\x20-\x7E©]/g, '?');
}

function wrap(value: string, width = 90): string[] {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

/**
 * A small text PDF. Multi-page, Helvetica, copyright on the last line of the last page.
 * Enough for a report card and a KPI export without a PDF library.
 */
export function buildPdf(title: string, lines: string[], year: number): Uint8Array {
  const content = wrap(title).concat([''], lines.flatMap(line => wrap(line)), ['', copyrightLine(year)]);
  const perPage = 42;
  const pages: string[][] = [];
  for (let i = 0; i < content.length; i += perPage) pages.push(content.slice(i, i + perPage));
  if (!pages.length) pages.push([copyrightLine(year)]);

  const objects: string[] = [];
  const pageIds: number[] = [];
  // 1: catalog, 2: pages, 3: font. Page objects follow.
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(''); // pages placeholder
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');

  pages.forEach((pageLines, pageIndex) => {
    const commands = ['BT', '/F1 11 Tf', '50 800 Td', '14 TL'];
    pageLines.forEach((line, i) => {
      if (i === 0) commands.push(`(${pdfEscape(line)}) Tj`);
      else commands.push(`T* (${pdfEscape(line)}) Tj`);
    });
    commands.push('ET');
    const stream = commands.join('\n');
    const contentId = 4 + pageIndex * 2;
    const pageId = contentId + 1;
    pageIds.push(pageId);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentId} 0 R ` +
      `/Resources << /Font << /F1 3 0 R >> >> >>`,
    );
  });

  const kids = pageIds.map(id => `${id} 0 R`).join(' ');
  objects[1] = `<< /Type /Pages /Count ${pages.length} /Kids [${kids}] >>`;

  let body = '%PDF-1.4\n';
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  let xrefBody = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) xrefBody += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  body += xrefBody;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(body);
}
