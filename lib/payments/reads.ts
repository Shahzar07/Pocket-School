import { quoteCourse, seedPricing } from '@/lib/pricing';
import type { PricedItem } from './quote';

/**
 * Poket Reads prices. Monthly and yearly amounts are stored, not multiplied:
 * a year is not ten times the month. Every book you can buy is the same
 * own-forever price. Local currency uses the admin FX quote.
 * A Firestore `books/{id}` document overrides this list when Book Studio has saved one.
 */

export const READS_BOOK_USD = 1.99;

export const READS_PLANS = [
  { id: 'reads', name: 'Poket Reads', monthlyUsd: 4.99, yearlyUsd: 49.99, permission: 'plan:reads' },
  { id: 'reads-family', name: 'Poket Reads Family', monthlyUsd: 7.99, yearlyUsd: 79.99, permission: 'plan:reads-family' },
] as const;

export const READS_BOOKS = [
  { id: 'harbour-light', title: 'The Harbour Light', usd: READS_BOOK_USD },
  { id: 'cells-to-systems', title: 'Cells to Systems', usd: READS_BOOK_USD },
  { id: 'malacca', title: 'A Short History of Malacca', usd: READS_BOOK_USD },
  { id: 'plain-contract', title: 'Plain Words for Contract', usd: READS_BOOK_USD },
] as const;

const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'] as const;

export function formatShelfUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/** How many owned books it takes before their price passes one month of Reads. */
export function booksDearerThanUnlimited(): number {
  const month = readsPlanItem('reads', 'month');
  if (!month || !(READS_BOOK_USD > 0)) return 0;
  return Math.floor(month.unitAmount / READS_BOOK_USD) + 1;
}

/** Own-or-subscribe line. Amounts come from this module. */
export function ownOrReadLine(): string {
  const month = readsPlanItem('reads', 'month');
  if (!month) throw new Error('Reads price is missing from the shared shelf.');
  return `Own any book for ${formatShelfUsd(READS_BOOK_USD)}, or read everything for ${formatShelfUsd(month.unitAmount)}/month`;
}

/** Honest comparison: three books at the own-price exceed one month of unlimited reading. */
export function booksVersusUnlimitedLine(): string {
  const count = booksDearerThanUnlimited();
  const word = COUNT_WORDS[count] ?? String(count);
  const titled = word.charAt(0).toUpperCase() + word.slice(1);
  return `${titled} books cost more than a month of unlimited`;
}

/** Monthly price spread over 30 days, rounded to cents. Label it as approximate. */
export function readsDailyUsd(sku: 'reads' | 'reads-family' = 'reads'): number {
  const month = readsPlanItem(sku, 'month');
  if (!month) throw new Error(`Unknown Reads plan ${sku}`);
  return Math.round((month.unitAmount / 30) * 100) / 100;
}

export function readsOwnBookAmount(currency: string): { amount: number; currency: string } {
  const code = currency.toUpperCase() === 'MYR' ? 'MYR' : 'USD';
  const money = quoteCourse(seedPricing(), READS_BOOK_USD, 'USD', code);
  return { amount: money.amount, currency: money.currency };
}

export function readsPlanItem(sku: string, interval: 'month' | 'year'): PricedItem | null {
  const plan = READS_PLANS.find((item) => item.id === sku);
  if (!plan) return null;
  const amount = interval === 'year' ? plan.yearlyUsd : plan.monthlyUsd;
  return {
    kind: 'reads',
    sku: plan.id,
    title: plan.name,
    unitAmount: amount,
    currency: 'USD',
    accessTier: 1,
    interval,
    recurringMonthly: interval === 'year' ? Math.round((amount / 12) * 100) / 100 : plan.monthlyUsd,
    permission: plan.permission,
  };
}

export function readsBookItem(sku: string, currency: string): PricedItem | null {
  const book = READS_BOOKS.find((item) => item.id === sku);
  if (!book) return null;
  const money = readsOwnBookAmount(currency);
  return {
    kind: 'book',
    sku: book.id,
    title: book.title,
    unitAmount: money.amount,
    currency: money.currency,
    ownerId: 'platform',
    shelf: true,
  };
}
