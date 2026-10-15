/** Affiliates are coupons with a revenue share. Commission is on the pre-tax total. */

export interface Coupon {
  code: string;
  percentOff?: number;
  amountOff?: number;
  currency?: string;
  affiliateId?: string;
  /** Share of the discounted subtotal, in basis points. 1000 = 10%. */
  revenueShareBps: number;
  active: boolean;
  /** Inclusive last day, YYYY-MM-DD. */
  expiresAt?: string;
  maxRedemptions?: number;
  redemptions: number;
}

export function normaliseCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

export function couponRejection(coupon: Coupon, currency: string, today: string): string | null {
  if (!coupon.active) return 'That code is not active.';
  if (coupon.expiresAt && coupon.expiresAt < today) return 'That code has expired.';
  if (coupon.maxRedemptions != null && coupon.redemptions >= coupon.maxRedemptions) {
    return 'That code has been used up.';
  }
  if (coupon.amountOff && coupon.currency && coupon.currency.toUpperCase() !== currency.toUpperCase()) {
    return 'That code does not apply to this currency.';
  }
  if (coupon.percentOff != null && (coupon.percentOff <= 0 || coupon.percentOff > 100)) {
    return 'That code is not valid.';
  }
  return null;
}

/** Discount in minor units, never more than the subtotal. */
export function discountMinor(subtotalMinor: number, coupon: Coupon): number {
  let off = 0;
  if (coupon.percentOff) off += Math.round(subtotalMinor * coupon.percentOff / 100);
  if (coupon.amountOff) off += Math.round(coupon.amountOff * 100);
  return Math.max(0, Math.min(subtotalMinor, off));
}

export function commissionMinor(discountedSubtotalMinor: number, coupon: Coupon | null): number {
  if (!coupon?.affiliateId) return 0;
  const bps = Math.max(0, Math.min(10_000, coupon.revenueShareBps));
  return Math.round(discountedSubtotalMinor * bps / 10_000);
}

/** Referral code from a display name. The suffix keeps two Harrys apart. */
export function referralCode(name: string, suffix: string): string {
  const base = name.normalize('NFKD').replace(/[^a-zA-Z]/g, '').slice(0, 8).toUpperCase() || 'POKET';
  const tail = suffix.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
  return `${base}${tail}`;
}
