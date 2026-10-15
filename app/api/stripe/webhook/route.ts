import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { applyStripeSubscription, enrollFromPayment, tierFromId } from '@/lib/server/actions';
import type { AccessTier } from '@/lib/entitlements';

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

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const meta = session.metadata ?? {};
      if (meta.kind === 'course' && meta.studentId && meta.courseId) {
        await enrollFromPayment({
          studentId: meta.studentId,
          courseId: meta.courseId,
          amount: (session.amount_total ?? 0) / 100,
          currency: (session.currency ?? 'myr').toUpperCase(),
          paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
          description: meta.courseTitle ? `Course purchase: ${meta.courseTitle}` : undefined,
        });
      }
      if (meta.kind === 'subscription' && meta.uid) {
        const tier = tierFromId(meta.tierId ?? '') ?? (Number(meta.accessTier) as AccessTier);
        if (tier != null) await applyStripeSubscription(meta.uid, tier);
      }
      if (meta.kind === 'book' && meta.studentId && meta.bookId) {
        await adminDb().doc(`users/${meta.studentId}`).set({
          permissions: FieldValue.arrayUnion(`alloc:marketplace:${meta.bookId}`),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        await adminDb().doc(`library/${meta.studentId}/books/${meta.bookId}`).set({
          bookId: meta.bookId,
          source: 'purchase',
          purchasedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      if (meta.kind === 'plan' && meta.uid && (meta.id === 'reads' || meta.id === 'reads-family')) {
        await applyStripeSubscription(meta.uid, 1);
        await adminDb().doc(`users/${meta.uid}`).set({
          permissions: FieldValue.arrayUnion(meta.id === 'reads-family' ? 'plan:reads-family' : 'plan:reads'),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      const invoiceId = pi.metadata?.invoiceId;
      if (invoiceId) {
        await adminDb().doc(`invoices/${invoiceId}`).set({ status: 'paid', paidAt: new Date() }, { merge: true });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Webhook processing failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
