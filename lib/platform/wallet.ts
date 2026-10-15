import { ADDONS, TIERS } from '@/lib/entitlements';
import { BOOKS } from '@/lib/reads/seed';
import {
  quoteAddon,
  quoteCourse,
  quotePlan,
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
 * Stripe can charge `card`, `fpx`, and `grabpay`. Touch 'n Go is recorded
 * on the session metadata until Stripe exposes a method type for it.
 * Subscriptions stay on card, because FPX and GrabPay are one-time methods.
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
  /** Touch 'n Go was requested and is waiting on a gateway method type. */
  touchNGoRequested: boolean;
  recurring: 'month' | 'year' | null;
}

const READS_PLANS = [
  { id: 'reads', name: 'Poket Reads', usd: 9 },
  { id: 'reads-family', name: 'Poket Reads Family', usd: 15 },
] as const;

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

  if (request.kind === 'reads' || (request.kind === 'plan' && READS_PLANS.some(plan => plan.id === request.id))) {
    const plan = READS_PLANS.find(item => item.id === request.id);
    if (!plan) return null;
    const amount = interval === 'annual' ? plan.usd * 10 : plan.usd;
    return finish(amount, amount, 'USD', plan.name, 'subscription', interval === 'annual', requested, false);
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
