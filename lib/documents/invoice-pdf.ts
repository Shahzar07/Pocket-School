import { invoiceLabel, type FinanceRow } from '@/lib/billing-model';
import { buildPdf } from '@/lib/insights/pdf';

export interface InvoiceFace extends FinanceRow {
  totalLabel: string;
  holderName?: string;
  holderEmail?: string;
}

export function invoicePdfLines(row: InvoiceFace): string[] {
  return [
    'Poket School',
    'Invoice',
    invoiceLabel(row),
    '',
    `Bill to: ${row.holderName?.trim() || 'Account holder'}`,
    `Email: ${row.holderEmail?.trim() || 'the address on the account'}`,
    `Item: ${row.title?.trim() || row.id}`,
    `Status: ${row.status || 'open'}`,
    `Total: ${row.totalLabel}`,
    '',
    'The payer can be a parent, an institution, or an adult learner.',
    'This copy is linked to the payment gateway checkout.',
  ];
}

export function invoicePdfBytes(row: InvoiceFace, year = new Date().getFullYear()): Uint8Array {
  return buildPdf(`Poket School invoice ${invoiceLabel(row)}`, invoicePdfLines(row), year);
}

export function invoiceFilename(row: FinanceRow): string {
  return `${invoiceLabel(row)}.pdf`;
}
