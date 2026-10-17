import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requirePlatformAdmin } from '@/lib/api-guard';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

/** Super admin refund. A stored Stripe payment is refunded. Other tenders are recorded and the academy is suspended. */
export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Refunds need the server account.' }, { status: 503 });
  }
  const user = await requirePlatformAdmin(req);
  if (isNextResponse(user)) return user;
  const body = await req.json().catch(() => ({})) as { institutionId?: string };
  const institutionId = body.institutionId?.trim() ?? '';
  if (!institutionId) return NextResponse.json({ error: 'Choose an academy.' }, { status: 400 });
  const ref = adminDb().doc(`institutions/${institutionId}`);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'That academy was not found.' }, { status: 404 });
  const bill = await adminDb().doc(`institutions/${institutionId}/billing/current`).get();
  const paymentIntentId = typeof bill.data()?.paymentIntentId === 'string' ? bill.data()?.paymentIntentId : '';
  let refunded: 'stripe' | 'recorded' = 'recorded';
  if (paymentIntentId && process.env.STRIPE_SECRET_KEY) {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    await stripe.refunds.create({ payment_intent: paymentIntentId });
    refunded = 'stripe';
  }
  await ref.set({ status: 'suspended', billingPhase: 'suspended' }, { merge: true });
  await adminDb().doc(`institutions/${institutionId}/billing/current`).set({
    phase: 'suspended',
    refunded: true,
    refundedAt: new Date().toISOString(),
  }, { merge: true });
  return NextResponse.json({ refunded, status: 'suspended' });
}
