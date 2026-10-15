import { NextRequest, NextResponse } from 'next/server';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { applyStripeSubscription, enrollFromPayment, tierFromId } from '@/lib/server/actions';
import type { AccessTier } from '@/lib/entitlements';
import { parseStripeEvent } from '@/lib/payments/stripe-events';
import { applyReversal, endSubscription, fulfillCheckout, grantLegacyBook, grantLegacyReads, recordDispute } from '@/lib/payments/server/engine';
import { noteWebhook } from '@/lib/payments/server/settings';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Firebase Admin is not configured', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }

  const body = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    let event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch {
      return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
    }

    const parsed = parseStripeEvent({
      id: event.id,
      type: event.type,
      data: { object: event.data.object as unknown as Record<string, unknown> },
    });

    if (parsed.type === 'unified_paid') {
      await fulfillCheckout(parsed.checkoutId, {
        eventId: parsed.eventId,
        provider: 'stripe',
        providerRef: parsed.providerRef,
        paymentIntentId: parsed.paymentIntentId,
      });
    } else if (parsed.type === 'legacy_course') {
      await enrollFromPayment({
        studentId: parsed.studentId,
        courseId: parsed.courseId,
        amount: parsed.amount,
        currency: parsed.currency,
        paymentIntentId: parsed.paymentIntentId,
        description: parsed.title ? `Course purchase: ${parsed.title}` : undefined,
      });
    } else if (parsed.type === 'legacy_subscription') {
      const tier = tierFromId(parsed.tierId) ?? (Number.isFinite(parsed.accessTier) ? parsed.accessTier as AccessTier : null);
      if (tier != null) await applyStripeSubscription(parsed.uid, tier);
    } else if (parsed.type === 'legacy_book') {
      await grantLegacyBook(parsed);
    } else if (parsed.type === 'legacy_reads') {
      await grantLegacyReads(parsed);
    } else if (parsed.type === 'legacy_invoice') {
      const { adminDb } = await import('@/lib/firebase-admin');
      await adminDb().doc(`invoices/${parsed.invoiceId}`).set({ status: 'paid', paidAt: new Date() }, { merge: true });
    } else if (parsed.type === 'dispute') {
      await recordDispute(parsed);
    } else if (parsed.type === 'refund' && parsed.checkoutId) {
      await applyReversal(parsed.checkoutId, parsed.eventId);
    } else if (parsed.type === 'subscription_ended') {
      await endSubscription(parsed.uid, parsed.subscriptionId);
    }

    await noteWebhook('stripe', true, event.type).catch(() => undefined);
    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Webhook processing failed';
    await noteWebhook('stripe', false, message).catch(() => undefined);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
