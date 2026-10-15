import { formatMoney, PLATFORM_CURRENCY } from '@/lib/money';

/**
 * USD is the stored price. Local currency is a display conversion.
 *
 * FX_PER_USD is a dated table, not a live feed. Swap `rate()` for the
 * admin-managed daily rate when that service exists. `formatMoney` from
 * lib/money.ts prints the figures, including the USD default.
 */
export const FX_AS_OF = '2026-10-15';

/** How many units of this currency equal 1 USD on FX_AS_OF. */
export const FX_PER_USD: Record<string, number> = {
  USD: 1,
  MYR: 4.7,
  GBP: 0.78,
  EUR: 0.92,
  SGD: 1.35,
  INR: 84,
  AUD: 1.53,
};

export interface PriceQuote {
  usd: number;
  localAmount: number;
  localCurrency: string;
  usdLabel: string;
  localLabel: string;
  combined: string;
  asOf: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function codeOf(currency: string | null | undefined): string {
  const code = (currency || PLATFORM_CURRENCY).toUpperCase();
  return code === 'RM' ? 'MYR' : code;
}

export function toUsd(amount: number, currency: string): number {
  const code = codeOf(currency);
  const per = FX_PER_USD[code] ?? 1;
  if (code === 'USD') return round2(amount);
  return round2(amount / per);
}

/** Browser hint only. The first paint stays USD so server and client match. */
export function viewerCurrency(): string {
  if (typeof window === 'undefined') return 'USD';
  const saved = window.localStorage.getItem('poket-currency');
  if (saved && FX_PER_USD[saved.toUpperCase()]) return saved.toUpperCase();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  if (tz.includes('Kuala_Lumpur')) return 'MYR';
  if (tz.includes('Singapore')) return 'SGD';
  if (tz.startsWith('Europe/London')) return 'GBP';
  if (tz.startsWith('Europe/')) return 'EUR';
  if (tz.includes('Kolkata') || tz.includes('Calcutta')) return 'INR';
  if (tz.startsWith('Australia/')) return 'AUD';
  return 'USD';
}

export function quotePrice(amount: number | null | undefined, currency = 'USD', local = 'USD'): PriceQuote {
  const value = amount ?? 0;
  if (value <= 0) {
    return {
      usd: 0,
      localAmount: 0,
      localCurrency: local,
      usdLabel: 'Free',
      localLabel: 'Free',
      combined: 'Free',
      asOf: FX_AS_OF,
    };
  }
  const usd = toUsd(value, currency);
  const localCode = FX_PER_USD[local] ? local : 'USD';
  const localAmount = localCode === 'USD' ? usd : round2(usd * FX_PER_USD[localCode]);
  const usdLabel = formatMoney(usd, 'USD');
  const localLabel = localCode === 'USD' ? usdLabel : formatMoney(localAmount, localCode);
  const combined = localCode === 'USD' || localLabel === usdLabel ? usdLabel : `${localLabel} · ${usdLabel}`;
  return { usd, localAmount, localCurrency: localCode, usdLabel, localLabel, combined, asOf: FX_AS_OF };
}
