import { planById, READS_PLAN_LABELS, seedPricing, snapToStorePricePoint, type PricingConfig } from '@/lib/pricing';
import { storedBookPriceRM } from '@/lib/platform/pricing';
import type { PricedItem } from './quote';

/**
 * Poket Reads prices from `seedPricing()`.
 * Plan amounts are the published monthly and annual prices. A buy-to-own book
 * uses `defaultBookUsd` unless that book sets its own price. The checkout
 * prefers the admin FX quote for a ringgit book. This list is the fallback
 * shelf price. A Firestore `books/{id}` document overrides it.
 */

const READS_PERMISSIONS = {
  reads: 'plan:reads',
  'reads-family': 'plan:reads-family',
} as const;

/** Names and grant strings. Monthly USD comes from `seedPricing()`. */
export const READS_PLANS = (Object.keys(READS_PLAN_LABELS) as Array<keyof typeof READS_PLAN_LABELS>).map(id => ({
  id,
  name: READS_PLAN_LABELS[id],
  usd: planById(seedPricing(), id)?.monthlyUsd ?? 0,
  permission: READS_PERMISSIONS[id],
}));

const shelfUsd = seedPricing().defaultBookUsd;

function catalogueBook(id: string, title: string, usd: number) {
  const price = snapToStorePricePoint(usd);
  return { id, title, usd: price, myr: storedBookPriceRM(price) };
}

export const READS_BOOKS = [
  { id: 'harbour-light', title: 'The Harbour Light', usd: shelfUsd, myr: storedBookPriceRM(shelfUsd) },
  catalogueBook('cells-to-systems', 'Cells to Systems', 8),
  catalogueBook('malacca', 'A Short History of Malacca', 4),
  catalogueBook('plain-contract', 'Plain Words for Contract', 10),
] as const;

export function readsPlanItem(
  sku: string,
  interval: 'month' | 'year',
  config: PricingConfig = seedPricing(),
): PricedItem | null {
  const listed = READS_PLANS.find((item) => item.id === sku);
  const plan = planById(config, sku);
  if (!listed || !plan || plan.monthlyUsd == null || plan.annualUsd == null) return null;
  const amount = interval === 'year' ? plan.annualUsd : plan.monthlyUsd;
  return {
    kind: 'reads',
    sku: listed.id,
    title: listed.name,
    unitAmount: amount,
    currency: 'USD',
    accessTier: 1,
    interval,
    recurringMonthly: interval === 'year' ? Math.round((amount / 12) * 100) / 100 : plan.monthlyUsd,
    permission: listed.permission,
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
