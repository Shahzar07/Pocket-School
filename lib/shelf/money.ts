/**
 * Display money the way Poket sells it.
 *
 * RM is the primary currency. Amounts already stored in another currency are
 * shown in that currency rather than silently relabelled.
 */

export function formatMoney(amount: number | null | undefined, currency = 'MYR'): string {
  const value = amount ?? 0;
  if (value <= 0) return 'Free';
  const code = currency === 'RM' ? 'MYR' : currency || 'MYR';
  try {
    return new Intl.NumberFormat(code === 'MYR' ? 'en-MY' : 'en-GB', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  } catch {
    return `${code} ${value}`;
  }
}
