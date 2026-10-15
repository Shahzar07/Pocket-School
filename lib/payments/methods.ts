/**
 * Payment methods shown for a country and currency.
 * Apple Pay and Google Pay ride on Stripe cards (dynamic wallets).
 * FPX and GrabPay are Stripe methods. Touch 'n Go, Boost, ShopeePay and
 * DuitNow QR go through the Malaysian gateway adapter.
 */

import { isFlagEnabled } from './flags';

export type MethodId =
  | 'card'
  | 'apple_pay'
  | 'google_pay'
  | 'fpx'
  | 'grabpay'
  | 'tng'
  | 'boost'
  | 'shopeepay'
  | 'duitnow_qr'
  | 'wallet';

export type PaymentProviderId = 'stripe' | 'my_gateway' | 'wallet';

export interface PaymentMethod {
  id: MethodId;
  label: string;
  provider: PaymentProviderId;
  /** Flag that must be on before the method is offered. */
  flag: string;
  /** ISO country codes, or '*' for every country. */
  countries: readonly string[] | '*';
  currencies: readonly string[];
  /** Stripe Checkout payment_method_types. Empty means dynamic methods. */
  stripeTypes: readonly string[];
  blurb: string;
}

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  {
    id: 'card',
    label: 'Card',
    provider: 'stripe',
    flag: 'payments.stripe',
    countries: '*',
    currencies: ['USD', 'MYR', 'SGD', 'GBP', 'EUR'],
    stripeTypes: ['card'],
    blurb: 'Visa, Mastercard and other cards. Apple Pay and Google Pay appear on the card sheet when the domain is verified.',
  },
  {
    id: 'apple_pay',
    label: 'Apple Pay',
    provider: 'stripe',
    flag: 'payments.stripe',
    countries: '*',
    currencies: ['USD', 'MYR', 'SGD', 'GBP', 'EUR'],
    stripeTypes: ['card'],
    blurb: 'Shown by Stripe on supported Apple devices. Requires the domain to be registered in Stripe.',
  },
  {
    id: 'google_pay',
    label: 'Google Pay',
    provider: 'stripe',
    flag: 'payments.stripe',
    countries: '*',
    currencies: ['USD', 'MYR', 'SGD', 'GBP', 'EUR'],
    stripeTypes: ['card'],
    blurb: 'Shown by Stripe on supported Android and Chrome devices.',
  },
  {
    id: 'fpx',
    label: 'FPX',
    provider: 'stripe',
    flag: 'payments.stripe',
    countries: ['MY'],
    currencies: ['MYR'],
    stripeTypes: ['fpx'],
    blurb: 'Malaysian online banking via Stripe.',
  },
  {
    id: 'grabpay',
    label: 'GrabPay',
    provider: 'stripe',
    flag: 'payments.stripe',
    countries: ['MY'],
    currencies: ['MYR'],
    stripeTypes: ['grabpay'],
    blurb: 'GrabPay wallet via Stripe.',
  },
  {
    id: 'tng',
    label: "Touch 'n Go",
    provider: 'my_gateway',
    flag: 'payments.my_gateway',
    countries: ['MY'],
    currencies: ['MYR'],
    stripeTypes: [],
    blurb: "Touch 'n Go eWallet via the Malaysian gateway.",
  },
  {
    id: 'boost',
    label: 'Boost',
    provider: 'my_gateway',
    flag: 'payments.my_gateway',
    countries: ['MY'],
    currencies: ['MYR'],
    stripeTypes: [],
    blurb: 'Boost eWallet via the Malaysian gateway.',
  },
  {
    id: 'shopeepay',
    label: 'ShopeePay',
    provider: 'my_gateway',
    flag: 'payments.my_gateway',
    countries: ['MY'],
    currencies: ['MYR'],
    stripeTypes: [],
    blurb: 'ShopeePay via the Malaysian gateway.',
  },
  {
    id: 'duitnow_qr',
    label: 'DuitNow QR',
    provider: 'my_gateway',
    flag: 'payments.my_gateway',
    countries: ['MY'],
    currencies: ['MYR'],
    stripeTypes: [],
    blurb: 'DuitNow QR via the Malaysian gateway.',
  },
  {
    id: 'wallet',
    label: 'Poket wallet',
    provider: 'wallet',
    flag: 'payments.wallet',
    countries: '*',
    currencies: ['USD', 'MYR'],
    stripeTypes: [],
    blurb: 'Spend a balance you have already topped up.',
  },
];

const METHOD_ALIASES: Record<string, MethodId> = {
  touchngo: 'tng',
  touchngoewallet: 'tng',
  'touch n go': 'tng',
  tng: 'tng',
  applepay: 'apple_pay',
  googlepay: 'google_pay',
  grab: 'grabpay',
};

/** `touchngo` from the Reads client is the gateway method `tng`. */
export function canonicalMethod(id: string): string {
  const key = id.trim().toLowerCase().replace(/['’]/g, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const compact = key.replace(/ /g, '');
  return METHOD_ALIASES[key] ?? METHOD_ALIASES[compact] ?? compact;
}

export function methodById(id: string): PaymentMethod | undefined {
  const canonical = canonicalMethod(id);
  return PAYMENT_METHODS.find((method) => method.id === canonical);
}

export function methodsFor(input: {
  country: string;
  currency: string;
  overrides?: Record<string, boolean> | null;
  envList?: string | null;
}): PaymentMethod[] {
  const country = input.country.trim().toUpperCase();
  const currency = input.currency.trim().toUpperCase();
  return PAYMENT_METHODS.filter((method) => {
    if (!isFlagEnabled(method.flag, input.overrides, input.envList)) return false;
    if (!method.currencies.includes(currency)) return false;
    if (method.countries !== '*' && !method.countries.includes(country)) return false;
    return true;
  });
}

/** Stripe types for a chosen method. `dynamic` omits the list so Stripe decides. */
export function stripeMethodTypes(methodId: string): string[] | 'dynamic' {
  if (methodId === 'dynamic') return 'dynamic';
  const method = methodById(methodId);
  if (!method || method.provider !== 'stripe') return 'dynamic';
  return [...method.stripeTypes];
}

/**
 * One-time ringgit charges keep FPX and GrabPay on the card sheet.
 * A caller who picked only FPX or only GrabPay stays on that type.
 * Subscriptions, including Poket Reads, stay on the method's own types.
 */
export function stripeTypesForCharge(methodId: string, currency: string, kind: string): string[] | 'dynamic' {
  const types = stripeMethodTypes(methodId);
  const subscription = kind === 'subscription' || kind === 'reads';
  const myr = currency.toUpperCase() === 'MYR';
  const cardSheet = methodId === 'card' || methodId === 'apple_pay' || methodId === 'google_pay' || methodId === 'dynamic';
  if (!subscription && myr && cardSheet) return ['card', 'fpx', 'grabpay'];
  return types;
}

/**
 * Method charged for a book or Reads request.
 * Reads is always a card. Touch 'n Go is the gateway only when it is the
 * chosen method, or the only method in the list. A mixed list that still
 * includes a card stays on the card sheet, which also offers FPX and GrabPay.
 */
export function walletChargeMethod(kind: string, methods: readonly string[] | undefined, method?: string): string {
  if (kind === 'reads') return 'card';
  if (method && method.trim()) {
    const chosen = canonicalMethod(method);
    if (chosen === 'tng' || chosen === 'fpx' || chosen === 'grabpay' || chosen === 'card') return chosen;
  }
  const set = new Set((methods ?? []).map((item) => canonicalMethod(item)));
  if (set.has('tng') && !set.has('card') && !set.has('fpx') && !set.has('grabpay')) return 'tng';
  if (set.has('fpx') && !set.has('card')) return 'fpx';
  if (set.has('grabpay') && !set.has('card') && !set.has('fpx')) return 'grabpay';
  return 'card';
}
