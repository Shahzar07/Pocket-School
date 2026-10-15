import { TIERS } from '@/lib/entitlements';
import { BOOKS } from '@/lib/reads/seed';

/**
 * Unified wallet checkout.
 *
 * The published stack exposes `POST /api/stripe/create-checkout` with
 * `{ kind: 'plan' | 'addon' | 'course', id, interval, currency }`.
 * FPX, GrabPay and Touch 'n Go are named on the pricing page and are not
 * separate gateway code yet. This module is that route's contract, plus
 * book purchases and the Reads individual and family plans.
 *
 * Stripe's method list includes `card`, `fpx` and `grabpay`. Touch 'n Go
 * is accepted on the request and stored on the session metadata until the
 * gateway exposes a method type for it. Subscriptions stay on card,
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
  amount: number;
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

export function quoteCheckout(request: CheckoutRequest): CheckoutQuote | null {
  const currency = (request.currency || 'USD').toUpperCase();
  const interval = request.interval === 'annual' ? 'annual' : 'monthly';
  const myr = currency === 'MYR';
  const requested = new Set((request.methods ?? ['card', ...(myr ? ['fpx', 'grabpay', 'touchngo'] : [])]).map(item => item.toLowerCase()));

  if (request.kind === 'book') {
    const book = BOOKS.find(item => item.id === request.id && item.status === 'published');
    if (!book || book.priceUsd <= 0) return null;
    return finish(book.priceUsd, currency, book.title, 'payment', false, requested, myr);
  }

  if (request.kind === 'reads' || (request.kind === 'plan' && READS_PLANS.some(plan => plan.id === request.id))) {
    const plan = READS_PLANS.find(item => item.id === request.id);
    if (!plan) return null;
    const monthly = plan.usd;
    const amount = interval === 'annual' ? monthly * 10 : monthly;
    return finish(amount, 'USD', plan.name, 'subscription', interval === 'annual', requested, false);
  }

  if (request.kind === 'plan') {
    const tier = TIERS.find(item => item.id === request.id && item.usd != null && item.usd > 0);
    if (!tier || tier.usd == null) return null;
    const amount = interval === 'annual' ? tier.usd * 10 : tier.usd;
    return finish(amount, 'USD', tier.name, 'subscription', interval === 'annual', requested, false);
  }

  return null;
}

function finish(
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
    amount: usd,
    currency: mode === 'subscription' ? 'USD' : currency,
    name,
    mode,
    stripeMethods,
    touchNGoRequested: mode === 'payment' && myr && requested.has('touchngo'),
    recurring: mode === 'subscription' ? (annual ? 'year' : 'month') : null,
  };
}
