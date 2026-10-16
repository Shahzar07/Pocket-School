export type PayerKind = 'parent' | 'institution' | 'learner';

export const PAYER_NOTE =
  'One bill. The payer can be a parent, an institution, or an adult learner. Invoices are issued in admin finance. Cash and Sparks sit together in the wallet.';

export interface FinanceRow {
  id: string;
  title?: string;
  invoiceId?: string;
  status?: string;
}

export function filterFinanceRows<T extends FinanceRow>(rows: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) =>
    [row.id, row.title, row.invoiceId, row.status].filter(Boolean).join(' ').toLowerCase().includes(needle),
  );
}

export function invoiceLabel(row: FinanceRow): string {
  const raw = (row.invoiceId || row.id).replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase();
  return `INV-${raw.padStart(8, '0')}`;
}
