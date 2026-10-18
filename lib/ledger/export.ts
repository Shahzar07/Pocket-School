import { createHash } from 'crypto';
import { type ChainEntry } from './chain';

export interface ExportFile {
  body: Uint8Array;
  contentType: string;
  filename: string;
  chainHead: string;
  verificationHash: string;
}

function cell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function row(entry: ChainEntry): string {
  return [
    String(entry.seq),
    entry.actorUid,
    entry.actorRole,
    entry.action,
    String(entry.serverTimestamp),
    entry.prevHash,
    entry.hash,
    entry.stream ?? '',
    JSON.stringify(entry.diff),
    JSON.stringify(entry.device),
  ].map(cell).join(',');
}

/** SHA-256 of the export text before the verificationHash line. */
export function verificationHash(payload: string): string {
  return createHash('sha256').update(payload).digest('hex');
}

export function exportCsv(id: string, kind: 'ticket' | 'alert' | 'admin', entries: ChainEntry[], chainHead: string): ExportFile {
  const header = 'seq,actorUid,actorRole,action,serverTimestamp,prevHash,hash,stream,diff,device\n';
  const payload = `${header}${entries.map(row).join('\n')}${entries.length ? '\n' : ''}chainHead,${chainHead}\n`;
  const hash = verificationHash(payload);
  const text = `${payload}verificationHash,${hash}\n`;
  return {
    body: new TextEncoder().encode(text),
    contentType: 'text/csv; charset=utf-8',
    filename: `${kind}-${id}.csv`,
    chainHead,
    verificationHash: hash,
  };
}

export function exportPdf(id: string, kind: 'ticket' | 'alert' | 'admin', entries: ChainEntry[], chainHead: string): ExportFile {
  const lines = [
    `Poket School ${kind} log ${id}`,
    `Entries ${entries.length}`,
    ...entries.map(entry => `${entry.seq} ${entry.action} ${entry.actorRole} ${entry.hash.slice(0, 12)}`),
    `chainHead ${chainHead}`,
  ];
  const payload = `${lines.join('\n')}\n`;
  const hash = verificationHash(payload);
  const painted = [...lines, `verificationHash ${hash}`];
  return {
    body: paintPdf(painted),
    contentType: 'application/pdf',
    filename: `${kind}-${id}.pdf`,
    chainHead,
    verificationHash: hash,
  };
}

function paintPdf(lines: string[]): Uint8Array {
  const pages: string[] = [];
  for (let start = 0; start < lines.length; start += 40) {
    const chunk = lines.slice(start, start + 40);
    const commands = ['BT', '/F1 10 Tf', '48 760 Td'];
    chunk.forEach((line, index) => {
      if (index > 0) commands.push('0 -16 Td');
      commands.push(`(${escapePdf(line)}) Tj`);
    });
    commands.push('ET');
    pages.push(commands.join('\n'));
  }
  if (!pages.length) pages.push('BT /F1 10 Tf 48 760 Td (empty) Tj ET');
  const objects: string[] = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
  ];
  const pageIds: number[] = [];
  pages.forEach((stream, index) => {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    pageIds.push(pageId);
    objects.push(`<<PAGE ${pageId} ${contentId}>>`);
    objects.push(`${contentId} 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`);
  });
  const fontId = 3 + pages.length * 2;
  objects[0] = '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj';
  const kids = pageIds.map(id => `${id} 0 R`).join(' ');
  objects.splice(1, 0, `2 0 obj << /Type /Pages /Count ${pages.length} /Kids [${kids}] >> endobj`);
  pageIds.forEach((pageId, index) => {
    const slot = objects.findIndex(item => item.startsWith('<<PAGE'));
    objects[slot] = `${pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${pageId + 1} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >> endobj`;
    void index;
  });
  objects.push(`${fontId} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`);
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(body.length);
    body += `${object}\n`;
  }
  const xref = body.length;
  let table = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    table += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  body += `${table}trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(body);
}

function escapePdf(value: string): string {
  return value.replace(/[()\\]/g, ' ').replace(/[^\x20-\x7E]/g, ' ').slice(0, 100);
}
