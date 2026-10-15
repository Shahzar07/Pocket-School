import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Payments are coming soon.', code: 'COMING_SOON' }, { status: 503 });
  }

  const { invoiceId } = await req.json();
  const invoice = invoiceId ? await adminDb().doc(`invoices/${invoiceId}`).get() : null;
  const data = invoice?.data();
  if (!data || (data.studentId !== user.uid && data.createdBy !== user.uid)) {
    return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  }
  const amount = Number(data.amount ?? 0);
  const currency = String(data.currency ?? 'myr').toLowerCase();

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-04-22.dahlia' as any });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      metadata: { invoiceId, studentId: user.uid },
      automatic_payment_methods: { enabled: true },
    });
    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Payment intent creation failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
