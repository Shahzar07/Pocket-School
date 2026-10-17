import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { loadAutomation, logAutomation } from '@/lib/server/automation-store';
import {
  productFromCheckout,
  productFromText,
  refundDecision,
  settleRefund,
  type RefundProduct,
} from '@/lib/site-automation';

export const dynamic = 'force-dynamic';

function isoDate(value: unknown): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    if (date instanceof Date && !Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  return '';
}

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Refunds need the server account.' }, { status: 503 });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const body = await req.json().catch(() => null);
  const checkoutId = body && typeof body.checkoutId === 'string' ? body.checkoutId.trim() : '';
  const invoiceId = body && typeof body.invoiceId === 'string' ? body.invoiceId.trim() : '';
  if (!checkoutId && !invoiceId) {
    return NextResponse.json({ error: 'Choose the payment to refund.' }, { status: 400 });
  }

  let amount = 0;
  let billedOn = '';
  let product: RefundProduct = 'other';
  let paymentIntentId = '';
  let providerMode = '';
  let owned = false;

  if (checkoutId) {
    const snap = await adminDb().doc(`checkouts/${checkoutId}`).get();
    const data = snap.data() ?? {};
    owned = snap.exists && data.userId === user.uid;
    if (!owned) return NextResponse.json({ error: 'That payment is not on this account.' }, { status: 404 });
    if (data.status === 'refunded') return NextResponse.json({ outcome: 'refund', reason: 'This payment is already refunded.', amount: 0 });
    if (data.status !== 'paid') return NextResponse.json({ error: 'Only a paid checkout can be refunded.' }, { status: 400 });
    const quote = data.quote && typeof data.quote === 'object' ? data.quote as { kind?: string; interval?: string; total?: number } : {};
    amount = typeof quote.total === 'number' ? quote.total : 0;
    product = productFromCheckout(typeof quote.kind === 'string' ? quote.kind : '', quote.interval);
    billedOn = isoDate(data.paidAt) || isoDate(data.createdAt);
    paymentIntentId = typeof data.paymentIntentId === 'string' ? data.paymentIntentId : '';
    providerMode = typeof data.providerMode === 'string' ? data.providerMode : '';
  } else {
    const snap = await adminDb().doc(`invoices/${invoiceId}`).get();
    const data = snap.data() ?? {};
    owned = snap.exists && data.studentId === user.uid;
    if (!owned) return NextResponse.json({ error: 'That invoice is not on this account.' }, { status: 404 });
    if (data.status === 'cancelled' && data.refunded === true) {
      return NextResponse.json({ outcome: 'refund', reason: 'This invoice is already refunded.', amount: 0 });
    }
    if (data.status !== 'paid') return NextResponse.json({ error: 'Only a paid invoice can be refunded.' }, { status: 400 });
    amount = typeof data.amount === 'number' ? data.amount : 0;
    const description = typeof data.description === 'string' ? data.description : '';
    product = productFromText(description);
    billedOn = isoDate(data.paidAt) || isoDate(data.createdAt);
    paymentIntentId = typeof data.stripePaymentIntentId === 'string' ? data.stripePaymentIntentId : '';
  }

  const settings = await loadAutomation();
  const decision = refundDecision({
    enabled: settings.rules.student_refund,
    product,
    billedOn,
    today: new Date().toISOString().slice(0, 10),
    amount,
  });
  const hasProvider = Boolean(paymentIntentId && process.env.STRIPE_SECRET_KEY) || providerMode === 'mock';
  const settled = settleRefund({ outcome: decision.outcome, hasProvider, reason: decision.reason });

  if (settled.outcome === 'refund') {
    try {
      if (paymentIntentId && process.env.STRIPE_SECRET_KEY) {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        await stripe.refunds.create({
          payment_intent: paymentIntentId,
          amount: Math.max(1, Math.round(decision.amount * 100)),
        }, { idempotencyKey: `self_refund_${checkoutId || invoiceId}` });
      }
      if (checkoutId) {
        const { applyReversal } = await import('@/lib/payments/server/engine');
        await applyReversal(checkoutId, `self_${checkoutId}`);
      } else {
        await adminDb().doc(`invoices/${invoiceId}`).set({ status: 'cancelled', refunded: true }, { merge: true });
      }
    } catch {
      await logAutomation({
        rule: 'student_refund',
        outcome: 'held',
        summary: 'The refund is inside policy. The payment provider did not accept it.',
        actorId: user.uid,
        refId: checkoutId || invoiceId,
      });
      return NextResponse.json({
        outcome: 'review',
        reason: 'The refund is inside policy. The payment provider did not accept it, so a super admin can send it.',
        amount: 0,
      }, { status: 502 });
    }
  } else if (settled.outcome === 'review') {
    await adminDb().doc(`refund_requests/${checkoutId || invoiceId}`).set({
      checkoutId,
      invoiceId,
      userId: user.uid,
      amount,
      status: 'review',
      reason: settled.reason,
      at: new Date().toISOString(),
    }, { merge: true });
  }

  await logAutomation({
    rule: 'student_refund',
    outcome: settled.outcome === 'refund' ? 'auto' : settled.outcome === 'refuse' ? 'refused' : 'held',
    summary: settled.reason,
    actorId: user.uid,
    refId: checkoutId || invoiceId,
  });
  return NextResponse.json({ outcome: settled.outcome, reason: settled.reason, amount: settled.outcome === 'refund' ? decision.amount : 0 });
}
