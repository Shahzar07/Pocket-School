import { NextRequest, NextResponse } from 'next/server';
import { getPublicCourseById } from '@/lib/db';
import { ADDONS, TIERS } from '@/lib/entitlements';
import { loadPricingConfig } from '@/lib/pricing-store';
import {
  quoteAddon,
  quoteCourse,
  quotePlan,
  stripeUnitAmount,
  type BillingInterval,
} from '@/lib/pricing';

export const dynamic = 'force-dynamic';

interface CheckoutBody {
  kind?: 'plan' | 'addon' | 'course';
  id?: string;
  interval?: BillingInterval;
  currency?: string;
}

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Stripe not configured. Add STRIPE_SECRET_KEY to environment variables.' },
      { status: 503 },
    );
  }

  let body: CheckoutBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const kind = body.kind;
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  const interval: BillingInterval = body.interval === 'annual' ? 'annual' : 'monthly';
  const requested = typeof body.currency === 'string' ? body.currency : 'USD';
  if (kind !== 'plan' && kind !== 'addon' && kind !== 'course') {
    return NextResponse.json({ error: 'kind must be plan, addon, or course.' }, { status: 400 });
  }
  if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 });

  const config = await loadPricingConfig();
  let amount = 0;
  let currency = 'USD';
  let name = id;
  let mode: 'subscription' | 'payment' = 'subscription';
  let recurring: 'month' | 'year' | null = interval === 'annual' ? 'year' : 'month';

  if (kind === 'plan') {
    const quote = quotePlan(config, id, interval, requested);
    const tier = TIERS.find(item => item.id === id);
    if (!quote || !tier) return NextResponse.json({ error: 'Unknown plan.' }, { status: 400 });
    amount = quote.amount;
    currency = quote.currency;
    name = tier.name;
  } else if (kind === 'addon') {
    const quote = quoteAddon(config, id, requested);
    const addon = ADDONS.find(item => item.id === id);
    if (!quote || !addon) return NextResponse.json({ error: 'Unknown add-on.' }, { status: 400 });
    amount = quote.amount;
    currency = quote.currency;
    name = addon.name;
    recurring = 'month';
  } else {
    const course = await getPublicCourseById(id);
    if (!course) return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    if (!course.price || course.price <= 0) {
      return NextResponse.json({ error: 'Course is free — no payment needed.' }, { status: 400 });
    }
    const quote = quoteCourse(config, course.price, course.currency, requested);
    amount = quote.amount;
    currency = quote.currency;
    name = course.title;
    mode = 'payment';
    recurring = null;
  }

  if (!(amount > 0)) {
    return NextResponse.json({ error: 'This plan is free.' }, { status: 400 });
  }

  const unitAmount = stripeUnitAmount(amount, currency);
  if (!(unitAmount > 0)) {
    return NextResponse.json({ error: 'Price is too small to charge.' }, { status: 400 });
  }

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-04-22.dahlia' as any });
    const origin = req.nextUrl.origin;
    const priceData: {
      currency: string;
      unit_amount: number;
      product_data: { name: string };
      recurring?: { interval: 'month' | 'year' };
    } = {
      currency: currency.toLowerCase(),
      unit_amount: unitAmount,
      product_data: { name },
    };
    if (recurring) priceData.recurring = { interval: recurring };

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ quantity: 1, price_data: priceData }],
      success_url: `${origin}/pricing?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=cancel`,
      metadata: { kind, id, interval, currency },
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Stripe did not return a checkout URL.' }, { status: 502 });
    }
    return NextResponse.json({
      url: session.url,
      amount,
      currency,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Checkout could not be started.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
