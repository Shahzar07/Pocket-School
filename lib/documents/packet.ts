import { buildPdf } from '@/lib/insights/pdf';
import type { Deliverable } from './delivery';

export function textDocument(input: {
  id: string;
  title: string;
  lines: string[];
  filename?: string;
  holderEmail?: string;
  studentId?: string;
}): Deliverable {
  const safe = input.title.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'poket';
  return {
    id: input.id,
    title: input.title,
    filename: input.filename || `poket-${safe}.pdf`,
    lines: ['Poket School', input.title, '', ...input.lines.filter(Boolean)],
    holderEmail: input.holderEmail,
    studentId: input.studentId,
  };
}

export function documentPdf(document: Deliverable, year = new Date().getFullYear()): Uint8Array {
  return buildPdf(`Poket School — ${document.title}`, document.lines, year);
}

export function billingDocument(input: {
  id: string;
  description: string;
  totalLabel: string;
  status: string;
  studentName?: string;
  studentId?: string;
  holderEmail?: string;
}): Deliverable {
  const slug = input.id.replace(/[^\w]+/g, '').slice(0, 24) || 'document';
  return textDocument({
    id: input.id,
    title: `Invoice · ${input.description || input.id}`,
    filename: `poket-invoice-${slug}.pdf`,
    holderEmail: input.holderEmail,
    studentId: input.studentId,
    lines: [
      'Invoice',
      input.studentName ? `Student: ${input.studentName}` : '',
      input.description,
      `Amount: ${input.totalLabel}`,
      `Status: ${input.status}`,
    ],
  });
}

export function rowsToCsv(headers: string[], rows: string[][]): string {
  const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return [headers, ...rows].map((row) => row.map(cell).join(',')).join('\n');
}
