import { TIERS } from '../entitlements';
import { PLATFORM_CURRENCY } from '../money';
import { seedPricing } from '../pricing';
import type { CheckoutKind, PricedItem } from './quote';

export const SPARK_PACKS: readonly { id: string; sparks: number; usd: number; title: string }[] = [
  { id: 'sparks_100', sparks: 100, usd: 5, title: '100 Sparks' },
  { id: 'sparks_500', sparks: 500, usd: 20, title: '500 Sparks' },
  { id: 'sparks_2000', sparks: 2000, usd: 60, title: '2,000 Sparks' },
];

export const WALLET_TOPUPS = [10, 25, 50, 100] as const;

export function subscriptionItem(tierId: string, interval: 'month' | 'year'): PricedItem | null {
  const tier = TIERS.find((item) => item.id === tierId);
  const plan = seedPricing().plans.find((item) => item.id === tierId);
  if (!tier || !plan || plan.monthlyUsd <= 0 || tier.tier >= 5) return null;
  const amount = interval === 'year' ? plan.annualUsd : plan.monthlyUsd;
  return {
    kind: 'subscription',
    sku: tier.id,
    title: `Poket School — ${tier.name}`,
    unitAmount: amount,
    currency: PLATFORM_CURRENCY,
    accessTier: tier.tier,
    interval,
    recurringMonthly: interval === 'year' ? Math.round((amount / 12) * 100) / 100 : plan.monthlyUsd,
  };
}

export function sparkPackItem(sku: string): PricedItem | null {
  const pack = SPARK_PACKS.find((item) => item.id === sku);
  if (!pack) return null;
  return {
    kind: 'sparks',
    sku: pack.id,
    title: pack.title,
    unitAmount: pack.usd,
    currency: PLATFORM_CURRENCY,
    sparks: pack.sparks,
  };
}

export function walletTopUpItem(sku: string, currency: string): PricedItem | null {
  const amount = Number(sku);
  if (!WALLET_TOPUPS.includes(amount as (typeof WALLET_TOPUPS)[number])) return null;
  const code = currency.toUpperCase();
  if (code !== 'USD' && code !== 'MYR') return null;
  return {
    kind: 'wallet',
    sku: String(amount),
    title: `Wallet top-up ${code} ${amount}`,
    unitAmount: amount,
    currency: code,
  };
}

export function fixedPriceItem(input: {
  kind: CheckoutKind;
  sku: string;
  title: string;
  amount: number;
  currency?: string | null;
  ownerId?: string;
  teacherShareBps?: number;
}): PricedItem | null {
  if (!Number.isFinite(input.amount) || input.amount <= 0) return null;
  return {
    kind: input.kind,
    sku: input.sku,
    title: input.title,
    unitAmount: input.amount,
    currency: (input.currency || PLATFORM_CURRENCY).toUpperCase(),
    ownerId: input.ownerId,
    teacherShareBps: input.teacherShareBps,
  };
}
