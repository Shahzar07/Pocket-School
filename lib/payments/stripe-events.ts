/** Turns a Stripe event into a decision the webhook can apply. No Stripe SDK and no I/O. */

export interface StripeEventLike {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

export type ParsedStripeEvent =
  | { type: 'unified_paid'; eventId: string; checkoutId: string; providerRef: string; paymentIntentId?: string; amount: number; currency: string }
  | { type: 'legacy_course'; eventId: string; studentId: string; courseId: string; amount: number; currency: string; paymentIntentId?: string; title?: string }
  | { type: 'legacy_subscription'; eventId: string; uid: string; tierId: string; accessTier: number }
  | { type: 'legacy_invoice'; eventId: string; invoiceId: string }
  | { type: 'legacy_book'; eventId: string; studentId: string; bookId: string }
  | { type: 'legacy_reads'; eventId: string; uid: string; planId: string }
  | { type: 'dispute'; eventId: string; disputeId: string; amount: number; currency: string; reason: string; chargeId: string }
  | { type: 'refund'; eventId: string; checkoutId?: string; amount: number; currency: string; chargeId: string }
  | { type: 'subscription_ended'; eventId: string; subscriptionId: string; uid?: string }
  | { type: 'ignored'; eventId: string };

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function meta(object: Record<string, unknown>): Record<string, string> {
  const raw = object.metadata;
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

export function parseStripeEvent(event: StripeEventLike): ParsedStripeEvent {
  const object = event.data?.object ?? {};
  const metadata = meta(object);

  if (event.type === 'checkout.session.completed') {
    const amount = Number(object.amount_total ?? 0) / 100;
    const currency = str(object.currency).toUpperCase() || 'USD';
    const paymentIntentId = str(object.payment_intent) || undefined;
    const providerRef = str(object.id) || event.id;
    if (metadata.checkoutId) {
      return { type: 'unified_paid', eventId: event.id, checkoutId: metadata.checkoutId, providerRef, paymentIntentId, amount, currency };
    }
    if (metadata.kind === 'course' && metadata.studentId && metadata.courseId) {
      return {
        type: 'legacy_course', eventId: event.id, studentId: metadata.studentId, courseId: metadata.courseId,
        amount, currency, paymentIntentId, title: metadata.courseTitle,
      };
    }
    if (metadata.kind === 'subscription' && metadata.uid) {
      return {
        type: 'legacy_subscription', eventId: event.id, uid: metadata.uid,
        tierId: metadata.tierId ?? '', accessTier: Number(metadata.accessTier),
      };
    }
    if (metadata.kind === 'book' && metadata.studentId && metadata.bookId) {
      return { type: 'legacy_book', eventId: event.id, studentId: metadata.studentId, bookId: metadata.bookId };
    }
    if (metadata.kind === 'plan' && metadata.uid && (metadata.id === 'reads' || metadata.id === 'reads-family')) {
      return { type: 'legacy_reads', eventId: event.id, uid: metadata.uid, planId: metadata.id };
    }
  }

  if (event.type === 'payment_intent.succeeded') {
    const invoiceId = meta(object).invoiceId;
    if (invoiceId) return { type: 'legacy_invoice', eventId: event.id, invoiceId };
  }

  if (event.type === 'charge.dispute.created') {
    return {
      type: 'dispute',
      eventId: event.id,
      disputeId: str(object.id) || event.id,
      amount: Number(object.amount ?? 0) / 100,
      currency: str(object.currency).toUpperCase() || 'USD',
      reason: str(object.reason) || 'unspecified',
      chargeId: str(object.charge),
    };
  }

  if (event.type === 'charge.refunded') {
    return {
      type: 'refund',
      eventId: event.id,
      checkoutId: metadata.checkoutId || undefined,
      amount: Number(object.amount_refunded ?? object.amount ?? 0) / 100,
      currency: str(object.currency).toUpperCase() || 'USD',
      chargeId: str(object.id),
    };
  }

  if (event.type === 'customer.subscription.deleted') {
    return {
      type: 'subscription_ended',
      eventId: event.id,
      subscriptionId: str(object.id),
      uid: metadata.uid || undefined,
    };
  }

  return { type: 'ignored', eventId: event.id };
}
