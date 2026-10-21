const STORAGE_KEY = 'poket-dismissed-promos';

export function dismissedPromoCodes(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
  } catch {
    return [];
  }
}

export function isPromoDismissed(code: string): boolean {
  return dismissedPromoCodes().includes(code);
}

/** A dismissed promo code stays dismissed on this browser. */
export function dismissPromo(code: string): void {
  if (!code || typeof window === 'undefined') return;
  const next = dismissedPromoCodes();
  if (!next.includes(code)) next.push(code);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(-40)));
  } catch {
    /* private mode */
  }
}
