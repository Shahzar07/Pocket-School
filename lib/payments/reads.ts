import type { PricedItem } from './quote';

/**
 * Poket Reads prices from the published shelf (PR #55).
 * Annual Reads is ten times the monthly price. Books charged in ringgit use
 * the shelf's RM price so FPX, GrabPay and Touch 'n Go can clear.
 * A Firestore `books/{id}` document overrides this list when Book Studio has saved one.
 */

export const READS_PLANS = [
  { id: 'reads', name: 'Poket Reads', usd: 9, permission: 'plan:reads' },
  { id: 'reads-family', name: 'Poket Reads Family', usd: 15, permission: 'plan:reads-family' },
] as const;

export const READS_BOOKS = [
  { id: 'harbour-light', title: 'The Harbour Light', usd: 5, myr: 24 },
  { id: 'cells-to-systems', title: 'Cells to Systems', usd: 8, myr: 36 },
  { id: 'malacca', title: 'A Short History of Malacca', usd: 4, myr: 18 },
  { id: 'plain-contract', title: 'Plain Words for Contract', usd: 10, myr: 49 },
] as const;

export function readsPlanItem(sku: string, interval: 'month' | 'year'): PricedItem | null {
  const plan = READS_PLANS.find((item) => item.id === sku);
  if (!plan) return null;
  const amount = interval === 'year' ? plan.usd * 10 : plan.usd;
  return {
    kind: 'reads',
    sku: plan.id,
    title: plan.name,
    unitAmount: amount,
    currency: 'USD',
    accessTier: 1,
    interval,
    recurringMonthly: interval === 'year' ? Math.round((amount / 12) * 100) / 100 : plan.usd,
    permission: plan.permission,
  };
}

export function readsBookItem(sku: string, currency: string): PricedItem | null {
  const book = READS_BOOKS.find((item) => item.id === sku);
  if (!book) return null;
  const code = currency.toUpperCase() === 'MYR' ? 'MYR' : 'USD';
  return {
    kind: 'book',
    sku: book.id,
    title: book.title,
    unitAmount: code === 'MYR' ? book.myr : book.usd,
    currency: code,
    ownerId: 'platform',
    shelf: true,
  };
}
