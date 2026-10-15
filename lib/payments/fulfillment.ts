import { fromMinor, toMinor } from './minor';
import type { CheckoutKind } from './quote';

export interface FulfillmentInput {
  checkoutId: string;
  userId: string;
  buyerName: string;
  kind: CheckoutKind;
  sku: string;
  title: string;
  currency: string;
  total: number;
  subtotal: number;
  discount: number;
  tax: number;
  taxRate: number;
  accessTier?: number;
  sparks?: number;
  seats: number;
  childIds: string[];
  ownerId?: string;
  teacherShareBps?: number;
  affiliateId?: string;
  commission: number;
  couponCode?: string;
  interval?: 'month' | 'year';
  recurringMonthly?: number;
  shelf?: boolean;
  permission?: string;
  provider: string;
  providerRef?: string;
}

export type GrantAction =
  | 'set_subscription'
  | 'grant_sparks'
  | 'enroll_course'
  | 'revoke_course'
  | 'grant_library'
  | 'revoke_library'
  | 'grant_reads'
  | 'revoke_reads'
  | 'record_booking'
  | 'cancel_booking'
  | 'record_resource'
  | 'revoke_resource'
  | 'credit_wallet'
  | 'debit_wallet'
  | 'mark_invoice'
  | 'refund_invoice'
  | 'affiliate'
  | 'reverse_affiliate'
  | 'payout'
  | 'reverse_payout'
  | 'notify';

export interface PlannedGrant {
  action: GrantAction;
  userId: string;
  accessTier?: number;
  sparks?: number;
  courseId?: string;
  offerId?: string;
  resourceId?: string;
  invoiceId?: string;
  amount?: number;
  currency?: string;
  payeeId?: string;
  affiliateId?: string;
  title: string;
  message?: string;
  link?: string;
  interval?: 'month' | 'year';
  recurringMonthly?: number;
  seats?: number;
  permission?: string;
  bookId?: string;
}

/**
 * What a paid checkout is allowed to change. The server applies these in order
 * and writes one invoice. Course enrolment reuses the existing payment enrol
 * path and does not create a second invoice.
 */
export function planGrants(input: FulfillmentInput): PlannedGrant[] {
  const grants: PlannedGrant[] = [];
  const link = '/dashboard/student/billing';

  if (input.kind === 'subscription' && input.accessTier != null) {
    const holders = [input.userId, ...input.childIds.filter((id) => id && id !== input.userId)];
    const unique = [...new Set(holders)].slice(0, input.seats);
    for (const userId of unique) {
      grants.push({
        action: 'set_subscription',
        userId,
        accessTier: input.accessTier,
        title: input.title,
        interval: input.interval,
        recurringMonthly: input.recurringMonthly,
        seats: input.seats,
        currency: input.currency,
        amount: input.total,
      });
    }
  }

  if (input.kind === 'sparks' && input.sparks && input.sparks > 0) {
    grants.push({
      action: 'grant_sparks',
      userId: input.userId,
      sparks: input.sparks,
      title: input.title,
    });
  }

  if (input.kind === 'book' && input.shelf) {
    grants.push({
      action: 'grant_library',
      userId: input.userId,
      bookId: input.sku,
      amount: input.total,
      currency: input.currency,
      title: input.title,
    });
  } else if (input.kind === 'course' || input.kind === 'book') {
    grants.push({
      action: 'enroll_course',
      userId: input.userId,
      courseId: input.sku,
      amount: input.total,
      currency: input.currency,
      title: input.title,
    });
  }

  if (input.kind === 'reads') {
    grants.push({
      action: 'grant_reads',
      userId: input.userId,
      accessTier: input.accessTier ?? 1,
      permission: input.permission,
      title: input.title,
      interval: input.interval,
      recurringMonthly: input.recurringMonthly,
      currency: input.currency,
      amount: input.total,
      seats: 1,
    });
  }

  if (input.kind === 'booking') {
    grants.push({
      action: 'record_booking',
      userId: input.userId,
      offerId: input.sku,
      amount: input.total,
      currency: input.currency,
      title: input.title,
      payeeId: input.ownerId,
    });
  }

  if (input.kind === 'resource') {
    grants.push({
      action: 'record_resource',
      userId: input.userId,
      resourceId: input.sku,
      title: input.title,
      amount: input.total,
      currency: input.currency,
    });
  }

  if (input.kind === 'wallet') {
    grants.push({
      action: 'credit_wallet',
      userId: input.userId,
      amount: input.total,
      currency: input.currency,
      title: input.title,
    });
  }

  if (input.kind === 'invoice') {
    grants.push({
      action: 'mark_invoice',
      userId: input.userId,
      invoiceId: input.sku,
      title: input.title,
      amount: input.total,
      currency: input.currency,
    });
  }

  if (input.affiliateId && input.commission > 0) {
    grants.push({
      action: 'affiliate',
      userId: input.userId,
      affiliateId: input.affiliateId,
      amount: input.commission,
      currency: input.currency,
      title: input.couponCode ? `Coupon ${input.couponCode}` : 'Referral',
    });
  }

  if ((input.kind === 'course' || (input.kind === 'book' && !input.shelf) || input.kind === 'booking') && input.ownerId && input.ownerId !== 'platform') {
    const payout = teacherPayoutMajor(input.subtotal, input.teacherShareBps);
    if (payout > 0) {
      grants.push({
        action: 'payout',
        userId: input.userId,
        payeeId: input.ownerId,
        amount: payout,
        currency: input.currency,
        title: input.title,
      });
    }
  }

  grants.push({
    action: 'notify',
    userId: input.userId,
    title: 'Payment received',
    message: `${input.title} is paid. Your receipt is on Billing.`,
    link,
  });

  return grants;
}

/** Teacher share of the pre-tax subtotal. 7000 basis points is 70%. */
export function teacherPayoutMajor(subtotal: number, teacherShareBps: number | undefined): number {
  const share = Math.max(0, Math.min(10_000, teacherShareBps ?? 7000));
  return fromMinor(Math.round(toMinor(subtotal) * share / 10_000));
}

/** Grants that undo a paid checkout. The server applies them once per refund event. */
export function planReversal(input: FulfillmentInput): PlannedGrant[] {
  const grants: PlannedGrant[] = [];
  if (input.kind === 'subscription') {
    for (const userId of [input.userId, ...input.childIds]) {
      grants.push({ action: 'set_subscription', userId, accessTier: 0, title: 'Subscription refunded', seats: 1 });
    }
  }
  if (input.kind === 'sparks' && input.sparks) {
    grants.push({ action: 'grant_sparks', userId: input.userId, sparks: -input.sparks, title: 'Sparks refund' });
  }
  if (input.kind === 'book' && input.shelf) {
    grants.push({ action: 'revoke_library', userId: input.userId, bookId: input.sku, title: input.title });
  } else if (input.kind === 'course' || input.kind === 'book') {
    grants.push({ action: 'revoke_course', userId: input.userId, courseId: input.sku, title: input.title });
  }
  if (input.kind === 'reads') {
    grants.push({
      action: 'revoke_reads', userId: input.userId, permission: input.permission,
      accessTier: 0, title: 'Reads refunded',
    });
  }
  if (input.kind === 'booking') {
    grants.push({ action: 'cancel_booking', userId: input.userId, offerId: input.sku, title: input.title });
  }
  if (input.kind === 'resource') {
    grants.push({ action: 'revoke_resource', userId: input.userId, resourceId: input.sku, title: input.title });
  }
  if (input.kind === 'wallet') {
    grants.push({
      action: 'debit_wallet', userId: input.userId, amount: input.total, currency: input.currency, title: 'Wallet refund',
    });
  }
  if (input.kind === 'invoice') {
    grants.push({ action: 'refund_invoice', userId: input.userId, invoiceId: input.sku, title: input.title });
  }
  if (input.affiliateId && input.commission > 0) {
    grants.push({
      action: 'reverse_affiliate', userId: input.userId, affiliateId: input.affiliateId,
      amount: input.commission, currency: input.currency, title: input.couponCode ?? 'Referral',
    });
  }
  if (input.ownerId && input.ownerId !== 'platform') {
    const payout = teacherPayoutMajor(input.subtotal, input.teacherShareBps);
    if (payout > 0) {
      grants.push({
        action: 'reverse_payout', userId: input.userId, payeeId: input.ownerId,
        amount: payout, currency: input.currency, title: input.title,
      });
    }
  }
  grants.push({
    action: 'notify', userId: input.userId, title: 'Refund issued',
    message: `${input.title} was refunded.`, link: '/dashboard/student/billing',
  });
  return grants;
}
