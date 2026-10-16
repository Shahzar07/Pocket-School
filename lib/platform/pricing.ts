import {
  formatMoney,
  quoteCourse,
  readCurrencyChoice,
  resolveDisplayCurrency,
  seedPricing,
} from '@/lib/pricing';

/**
 * Shelf display prices. Amounts and rates come from `lib/pricing.ts`
 * (`pricing_config/current`, or `seedPricing()` when that document is absent).
 * Checkout uses the same table. There is no daily FX feed: `dailyFxRate`
 * stays empty until an admin rate service publishes one.
 */
export const ADMIN_RATES = 'admin';

export interface PriceQuote {
  usd: number;
  localAmount: number;
  localCurrency: string;
  usdLabel: string;
  localLabel: string;
  combined: string;
  /** `admin` while rates come from the pricing document, not a dated feed. */
  asOf: string;
}

/** A daily feed is not connected. Callers keep using the admin rate table. */
export function dailyFxRate(_currency: string): null {
  return null;
}

function codeOf(currency: string | null | undefined): string {
  const code = (currency || 'USD').trim().toUpperCase();
  return code === 'RM' ? 'MYR' : code;
}

/**
 * The reader's saved currency. Server render stays USD.
 * A stored code counts only when the reader chose it (`poket-currency-source` = user).
 */
export function viewerCurrency(): string {
  if (typeof window === 'undefined') return 'USD';
  const choice = readCurrencyChoice();
  return resolveDisplayCurrency(seedPricing(), {
    stored: choice.code,
    source: choice.source,
  });
}

export function quotePrice(amount: number | null | undefined, currency = 'USD', local = 'USD'): PriceQuote {
  const shown = codeOf(local);
  if (!(amount && amount > 0)) {
    return {
      usd: 0,
      localAmount: 0,
      localCurrency: shown,
      usdLabel: 'Free',
      localLabel: 'Free',
      combined: 'Free',
      asOf: ADMIN_RATES,
    };
  }
  const money = quoteCourse(seedPricing(), amount, codeOf(currency), shown);
  const usdLabel = formatMoney(money.usd, 'USD');
  const localLabel = formatMoney(money.amount, money.currency);
  const combined = money.currency === 'USD' || localLabel === usdLabel ? usdLabel : `${localLabel} · ${usdLabel}`;
  return {
    usd: money.usd,
    localAmount: money.amount,
    localCurrency: money.currency,
    usdLabel,
    localLabel,
    combined,
    asOf: ADMIN_RATES,
  };
}
