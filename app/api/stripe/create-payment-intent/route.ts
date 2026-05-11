import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2026-04-22.dahlia' as any });

export async function POST(req: NextRequest) {
  const { invoiceId, amount, currency } = await req.json();

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured. Add STRIPE_SECRET_KEY to .env.local.' }, { status: 503 });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency ?? 'usd',
      metadata: { invoiceId },
      automatic_payment_methods: { enabled: true },
    });
    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Payment intent creation failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
