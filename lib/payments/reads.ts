import { planById, READS_PLAN_LABELS, seedPricing, type PricingConfig } from '@/lib/pricing';
import type { PricedItem } from './quote';

/**
 * Poket Reads prices from the published shelf (PR #55).
 * Annual Reads is ten times the monthly price. The checkout prefers the admin
 * FX quote for a ringgit book. This list is the fallback shelf price.
 * A Firestore `books/{id}` document overrides this list when Book Studio has saved one.
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

export const READS_BOOKS = [
  { id: 'harbour-light', title: 'The Harbour Light', usd: 5, myr: 24 },
  { id: 'cells-to-systems', title: 'Cells to Systems', usd: 8, myr: 36 },
  { id: 'malacca', title: 'A Short History of Malacca', usd: 4, myr: 18 },
  { id: 'plain-contract', title: 'Plain Words for Contract', usd: 10, myr: 49 },
] as const;

export function readsPlanItem(
  sku: string,
  interval: 'month' | 'year',
  config: PricingConfig = seedPricing(),
): PricedItem | null {
  const listed = READS_PLANS.find((item) => item.id === sku);
  const plan = planById(config, sku);
  if (!listed || !plan) return null;
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
