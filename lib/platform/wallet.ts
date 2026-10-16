import { ADDONS, TIERS } from '@/lib/entitlements';
import { BOOKS } from '@/lib/reads/seed';
import {
  isReadsPlan,
  planById,
  quoteAddon,
  quoteCourse,
  quotePlan,
  READS_PLAN_LABELS,
  seedPricing,
  type PricingConfig,
} from '@/lib/pricing';

/**
 * Unified wallet quotes for `POST /api/stripe/create-checkout`.
 *
 * School plans and add-ons use the admin pricing table in `lib/pricing.ts`,
 * including its exchange rates. Book prices are stored in USD and converted
 * with that same table. Reads subscriptions stay in USD on card.
 *
 * Stripe charges `card`, `fpx`, and `grabpay` together on a one-time MYR
 * session. Touch 'n Go is charged by the Malaysian gateway when that method
 * is selected (`tng`). `touchNGoRequested` stays true when the quote includes
 * it, including the default MYR method list. Subscriptions stay on card,
 * because FPX and GrabPay are one-time methods.
 */

export const CHECKOUT_KINDS = ['plan', 'addon', 'course', 'book', 'reads'] as const;
export type CheckoutKind = (typeof CHECKOUT_KINDS)[number];

export const WALLET_METHODS = ['card', 'fpx', 'grabpay', 'touchngo'] as const;
export type WalletMethod = (typeof WALLET_METHODS)[number];

export interface CheckoutRequest {
  kind: CheckoutKind;
  id: string;
  interval?: 'monthly' | 'annual';
  currency?: string;
  methods?: string[];
}

export interface CheckoutQuote {
  /** Amount charged, in `currency`. */
  amount: number;
  /** Catalogue amount in USD before conversion. */
  usd: number;
  currency: string;
  name: string;
  mode: 'payment' | 'subscription';
  /** Methods Stripe Checkout can charge on this quote. */
  stripeMethods: Array<'card' | 'fpx' | 'grabpay'>;
  /** Touch 'n Go was requested. The checkout charges it through the Malaysian gateway. */
  touchNGoRequested: boolean;
  recurring: 'month' | 'year' | null;
}

export function isCheckoutKind(value: string): value is CheckoutKind {
  return (CHECKOUT_KINDS as readonly string[]).includes(value);
}

export function quoteCheckout(
  request: CheckoutRequest,
  config: PricingConfig = seedPricing(),
): CheckoutQuote | null {
  const currency = (request.currency || 'USD').toUpperCase();
  const interval = request.interval === 'annual' ? 'annual' : 'monthly';
  const myr = currency === 'MYR';
  const requested = new Set(
    (request.methods ?? ['card', ...(myr ? ['fpx', 'grabpay', 'touchngo'] : [])]).map(item => item.toLowerCase()),
  );

  if (request.kind === 'book') {
    const book = BOOKS.find(item => item.id === request.id && item.status === 'published');
    if (!book || book.priceUsd <= 0) return null;
    const money = quoteCourse(config, book.priceUsd, 'USD', currency);
    return finish(money.amount, money.usd, money.currency, book.title, 'payment', false, requested, myr);
  }

  if (request.kind === 'reads' || (request.kind === 'plan' && isReadsPlan(request.id))) {
    const plan = planById(config, request.id);
    if (!plan || !isReadsPlan(plan.id)) return null;
    const amount = interval === 'annual' ? plan.annualUsd : plan.monthlyUsd;
    if (!(amount != null && amount > 0)) return null;
    return finish(amount, amount, 'USD', READS_PLAN_LABELS[plan.id], 'subscription', interval === 'annual', requested, false);
  }

  if (request.kind === 'plan') {
    const money = quotePlan(config, request.id, interval, currency);
    const tier = TIERS.find(item => item.id === request.id);
    if (!money || !tier || !(money.amount > 0)) return null;
    return finish(
      money.amount,
      money.usd,
      money.currency,
      tier.name,
      'subscription',
      interval === 'annual',
      requested,
      false,
    );
  }

  if (request.kind === 'addon') {
    const money = quoteAddon(config, request.id, currency);
    const addon = ADDONS.find(item => item.id === request.id);
    if (!money || !addon || !(money.amount > 0)) return null;
    return finish(money.amount, money.usd, money.currency, addon.name, 'subscription', false, requested, false);
  }

  return null;
}

function finish(
  amount: number,
  usd: number,
  currency: string,
  name: string,
  mode: 'payment' | 'subscription',
  annual: boolean,
  requested: Set<string>,
  myr: boolean,
): CheckoutQuote {
  const stripeMethods: Array<'card' | 'fpx' | 'grabpay'> = [];
  if (requested.has('card') || mode === 'subscription') stripeMethods.push('card');
  if (mode === 'payment' && myr && requested.has('fpx')) stripeMethods.push('fpx');
  if (mode === 'payment' && myr && requested.has('grabpay')) stripeMethods.push('grabpay');
  if (stripeMethods.length === 0) stripeMethods.push('card');
  return {
    amount,
    usd,
    currency,
    name,
    mode,
    stripeMethods,
    touchNGoRequested: mode === 'payment' && myr && requested.has('touchngo'),
    recurring: mode === 'subscription' ? (annual ? 'year' : 'month') : null,
  };
}
