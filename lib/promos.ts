/** Affiliate short links and timed promos. Commission stays on the existing coupon share. */

export type PromoKind = 'course' | 'programme' | 'book';

export interface PromoDraft {
  item: string;
  kind: PromoKind;
  percentOff: number;
  quantityLimit: number;
  redeemed: number;
  endsAt: string;
  banner?: boolean;
  active?: boolean;
  clicks?: number;
}

export interface ParsedPromo {
  item: string;
  kind: PromoKind;
  percentOff: number;
  quantityLimit: number;
  expiresAt: string;
}

export function parsePromo(input: {
  item?: string;
  kind?: string;
  percentOff?: number;
  quantityLimit?: number;
  expiresAt?: string;
}): { ok: true; promo: ParsedPromo } | { ok: false; error: string } {
  const item = (input.item ?? '').trim().slice(0, 80);
  if (!item) return { ok: false, error: 'Name the course, programme, or book.' };
  const kind: PromoKind = input.kind === 'programme' || input.kind === 'book' ? input.kind : 'course';
  const percentOff = Number(input.percentOff);
  if (!Number.isFinite(percentOff) || percentOff <= 0 || percentOff > 100) {
    return { ok: false, error: 'Set a discount from 1 to 100.' };
  }
  const quantityLimit = Math.floor(Number(input.quantityLimit));
  if (!Number.isFinite(quantityLimit) || quantityLimit < 1) {
    return { ok: false, error: 'Set how many people can use this.' };
  }
  const expiresAt = (input.expiresAt ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) return { ok: false, error: 'Set an end date.' };
  return { ok: true, promo: { item, kind, percentOff, quantityLimit, expiresAt } };
}

export function promoRemaining(promo: Pick<PromoDraft, 'quantityLimit' | 'redeemed'>): number {
  return Math.max(0, promo.quantityLimit - promo.redeemed);
}

export function promoLive(promo: PromoDraft, today: string): boolean {
  if (promo.active === false || promo.banner === false) return false;
  if (!promo.item.trim()) return false;
  if (promo.endsAt < today) return false;
  return promoRemaining(promo) > 0 && promo.percentOff > 0 && promo.percentOff <= 100;
}

export function countdownLabel(endsAt: string, today: string): string {
  if (endsAt < today) return 'Ended';
  const end = Date.parse(`${endsAt}T23:59:59Z`);
  const start = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(end) || !Number.isFinite(start)) return endsAt;
  const days = Math.max(0, Math.round((end - start) / 86_400_000));
  if (days <= 0) return 'Ends today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

export function bannerCopy(promo: PromoDraft, today: string): string | null {
  if (!promoLive(promo, today)) return null;
  const left = promoRemaining(promo);
  return `${promo.percentOff}% off ${promo.item} · ${left} left · ${countdownLabel(promo.endsAt, today)}`;
}

export function shortLink(origin: string, code: string): string {
  const base = origin.replace(/\/$/, '');
  return `${base}/r/${encodeURIComponent(code)}`;
}

export function conversionRate(clicks: number, conversions: number): number {
  if (clicks <= 0) return 0;
  return Math.max(0, conversions) / clicks;
}
