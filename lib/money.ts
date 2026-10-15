/** Yearly billing is three months free: 25% off twelve monthly charges. */
export const ANNUAL_DISCOUNT = 0.25;

/** One flat price, in US dollars, for every country. */
export const PLATFORM_CURRENCY = 'USD';

const SYMBOLS: Record<string, string> = {
  MYR: 'RM',
  USD: '$',
  GBP: '£',
  EUR: '€',
};

/** Format a price. Plan prices are USD. A marketplace course may store its own currency. */
export function formatMoney(amount: number, currency: string = PLATFORM_CURRENCY): string {
  const code = (currency || PLATFORM_CURRENCY).toUpperCase();
  const digits = Number.isInteger(amount) ? 0 : 2;
  if (code === 'USD') return `$${amount.toFixed(digits)}`;
  try {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(amount);
  } catch {
    const symbol = SYMBOLS[code] ?? `${code} `;
    return `${symbol}${amount.toFixed(digits)}`;
  }
}

/** Short label for a course card. Free stays the word Free. */
export function formatCoursePrice(amount: number | null | undefined, currency?: string | null): string {
  if (!amount || amount <= 0) return 'Free';
  return formatMoney(amount, currency || PLATFORM_CURRENCY);
}

/** Annual charge after the platform discount. `monthly` is the monthly price. */
export function annualAmount(monthly: number, discount: number = ANNUAL_DISCOUNT): number {
  return Math.round(monthly * 12 * (1 - discount));
}

/** Monthly price shown when yearly billing is selected. $49 becomes $36.75. */
export function annualMonthlyEquivalent(monthly: number, discount: number = ANNUAL_DISCOUNT): number {
  return Math.round(monthly * (1 - discount) * 100) / 100;
}

/** "3 months free" when the discount is 25%. Built from ANNUAL_DISCOUNT so the copy cannot drift. */
export function annualSavingsLabel(discount: number = ANNUAL_DISCOUNT): string {
  const monthsFree = Math.round(discount * 12);
  if (monthsFree <= 0) return 'billed yearly';
  return monthsFree === 1 ? '1 month free' : `${monthsFree} months free`;
}
