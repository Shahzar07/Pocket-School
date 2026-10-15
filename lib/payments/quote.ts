import { discountMinor, commissionMinor, type Coupon } from './coupons';
import { fromMinor, toMinor } from './minor';
import { taxOnMinor, taxRateFor, type TaxConfig, DEFAULT_TAX } from './tax';

export type CheckoutKind =
  | 'subscription'
  | 'sparks'
  | 'course'
  | 'book'
  | 'reads'
  | 'booking'
  | 'resource'
  | 'wallet'
  | 'invoice';

/** Second and later siblings pay half the plan price. The buyer is seat one. */
export const SIBLING_RATE = 0.5;
export const MAX_FAMILY_SEATS = 6;

export interface PricedItem {
  kind: CheckoutKind;
  sku: string;
  title: string;
  /** Price for one seat, or the full price for everything else. Major units. */
  unitAmount: number;
  currency: string;
  accessTier?: number;
  sparks?: number;
  ownerId?: string;
  /** Teacher share of the pre-tax subtotal, in basis points. */
  teacherShareBps?: number;
  interval?: 'month' | 'year';
  /** Amount counted toward MRR, in major units. */
  recurringMonthly?: number;
  /** Poket Reads shelf purchase. Grants the library copy, not a course enrolment. */
  shelf?: boolean;
  /** Permission written for a Reads plan, such as plan:reads-family. */
  permission?: string;
}

export interface QuoteLine {
  label: string;
  amount: number;
}

export interface Quote {
  kind: CheckoutKind;
  sku: string;
  title: string;
  currency: string;
  interval?: 'month' | 'year';
  seats: number;
  lines: QuoteLine[];
  subtotal: number;
  discount: number;
  couponCode?: string;
  affiliateId?: string;
  commission: number;
  taxRate: number;
  taxLabel: 'SST';
  tax: number;
  total: number;
  accessTier?: number;
  sparks?: number;
  ownerId?: string;
  teacherShareBps?: number;
  recurringMonthly?: number;
  shelf?: boolean;
  permission?: string;
}

export class QuoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuoteError';
  }
}

export function seatCount(kind: CheckoutKind, requested?: number): number {
  if (kind !== 'subscription') return 1;
  const seats = Math.floor(requested ?? 1);
  if (seats < 1 || seats > MAX_FAMILY_SEATS) {
    throw new QuoteError(`Choose between 1 and ${MAX_FAMILY_SEATS} seats.`);
  }
  return seats;
}

/** Subtotal in minor units for the item and seat count. */
export function subtotalMinor(item: PricedItem, seats: number): number {
  const unit = toMinor(item.unitAmount);
  if (item.kind !== 'subscription' || seats <= 1) return unit;
  const extra = Math.round(unit * SIBLING_RATE);
  return unit + extra * (seats - 1);
}

export function buildQuote(input: {
  item: PricedItem;
  seats?: number;
  coupon?: Coupon | null;
  country: string;
  tax?: TaxConfig;
}): Quote {
  const seats = seatCount(input.item.kind, input.seats);
  const baseMinor = subtotalMinor(input.item, seats);
  const coupon = input.coupon ?? null;
  const offMinor = coupon ? discountMinor(baseMinor, coupon) : 0;
  const discounted = baseMinor - offMinor;
  const rate = taxRateFor(input.item.kind, input.country, input.item.currency, input.tax ?? DEFAULT_TAX);
  const { taxMinor, totalMinor } = taxOnMinor(discounted, rate);
  const lines: QuoteLine[] = [];
  if (input.item.kind === 'subscription' && seats > 1) {
    lines.push({ label: `${input.item.title} · first seat`, amount: fromMinor(toMinor(input.item.unitAmount)) });
    const extra = Math.round(toMinor(input.item.unitAmount) * SIBLING_RATE);
    lines.push({
      label: `Sibling seats × ${seats - 1} at half price`,
      amount: fromMinor(extra * (seats - 1)),
    });
  } else {
    lines.push({ label: input.item.title, amount: fromMinor(baseMinor) });
  }
  return {
    kind: input.item.kind,
    sku: input.item.sku,
    title: input.item.title,
    currency: input.item.currency.toUpperCase(),
    interval: input.item.interval,
    seats,
    lines,
    subtotal: fromMinor(baseMinor),
    discount: fromMinor(offMinor),
    couponCode: coupon?.code,
    affiliateId: coupon?.affiliateId,
    commission: fromMinor(commissionMinor(discounted, coupon)),
    taxRate: rate,
    taxLabel: 'SST',
    tax: fromMinor(taxMinor),
    total: fromMinor(totalMinor),
    accessTier: input.item.accessTier,
    sparks: input.item.sparks,
    ownerId: input.item.ownerId,
    teacherShareBps: input.item.teacherShareBps,
    shelf: input.item.shelf,
    permission: input.item.permission,
    recurringMonthly: input.item.kind === 'subscription'
      ? fromMinor(input.item.interval === 'year' ? Math.round(baseMinor / 12) : baseMinor)
      : input.item.kind === 'reads'
        ? input.item.recurringMonthly
        : undefined,
  };
}
