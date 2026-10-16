import { NextRequest, NextResponse } from 'next/server';
import { getPublicCourseById } from '@/lib/db';
import { ADDONS, TIERS, planProgrammes } from '@/lib/entitlements';
import { loadPricingConfig } from '@/lib/pricing-store';
import {
  quoteAddon,
  quoteCourse,
  quotePlan,
  stripeUnitAmount,
  type BillingInterval,
} from '@/lib/pricing';
import { isCheckoutKind, type CheckoutKind } from '@/lib/platform/wallet';
import { startWalletCheckout } from '@/lib/payments/wallet-checkout';

export const dynamic = 'force-dynamic';

interface CheckoutBody {
  kind?: string;
  id?: string;
  interval?: BillingInterval;
  currency?: string;
  methods?: string[];
  method?: string;
}

/**
 * One checkout for school plans, add-ons, courses, books, and Reads.
 * Book and Reads purchases share the unified wallet. School plans, add-ons,
 * and courses keep the catalogue Stripe session.
 */
export async function POST(req: NextRequest) {
  let body: CheckoutBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const kind = body.kind ?? '';
  if (!isCheckoutKind(kind)) {
    return NextResponse.json({ error: 'kind must be plan, addon, course, book, or reads.' }, { status: 400 });
  }
  if (kind === 'book' || kind === 'reads') return startWalletCheckout(req, body);
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Payments are coming soon.', code: 'COMING_SOON' },
      { status: 503 },
    );
  }
  return catalogCheckout(req, body, kind);
}

async function catalogCheckout(req: NextRequest, body: CheckoutBody, kind: Exclude<CheckoutKind, 'book' | 'reads'>) {
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  const interval: BillingInterval = body.interval === 'annual' ? 'annual' : 'monthly';
  const requested = typeof body.currency === 'string' ? body.currency : 'USD';
  if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 });

  const config = await loadPricingConfig();
  let amount = 0;
  let currency = 'USD';
  let name = id;
  let description = '';
  let mode: 'subscription' | 'payment' = 'subscription';
  let recurring: 'month' | 'year' | null = interval === 'annual' ? 'year' : 'month';

  if (kind === 'plan') {
    const quote = quotePlan(config, id, interval, requested);
    const tier = TIERS.find(item => item.id === id);
    if (!quote || !tier) return NextResponse.json({ error: 'Unknown plan.' }, { status: 400 });
    amount = quote.amount;
    currency = quote.currency;
    name = tier.name;
    description = planProgrammes(id).join(' · ');
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

  const origin = req.nextUrl.origin;
  const session = await openSession({
    name,
    description,
    amount,
    currency,
    mode,
    recurring,
    metadata: { kind, id, interval, currency },
    successUrl: `${origin}/pricing?checkout=success`,
    cancelUrl: `${origin}/pricing?checkout=cancel`,
  });
  if (session instanceof NextResponse) return session;
  return NextResponse.json({ url: session.url, amount, currency });
}

async function openSession(input: {
  name: string;
  description?: string;
  amount: number;
  currency: string;
  mode: 'subscription' | 'payment';
  recurring: 'month' | 'year' | null;
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
  paymentMethodTypes?: Array<'card' | 'fpx' | 'grabpay'>;
  customerEmail?: string;
}) {
  if (!(input.amount > 0)) {
    return NextResponse.json({ error: 'This plan is free.' }, { status: 400 });
  }
  const unitAmount = stripeUnitAmount(input.amount, input.currency);
  if (!(unitAmount > 0)) {
    return NextResponse.json({ error: 'Price is too small to charge.' }, { status: 400 });
  }

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' as any });
    const priceData: {
      currency: string;
      unit_amount: number;
      product_data: { name: string; description?: string };
      recurring?: { interval: 'month' | 'year' };
    } = {
      currency: input.currency.toLowerCase(),
      unit_amount: unitAmount,
      product_data: {
        name: input.name,
        ...(input.description ? { description: input.description } : {}),
      },
    };
    if (input.recurring) priceData.recurring = { interval: input.recurring };

    const session = await stripe.checkout.sessions.create({
      mode: input.mode,
      line_items: [{ quantity: 1, price_data: priceData }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: input.metadata,
      ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
      ...(input.paymentMethodTypes ? { payment_method_types: input.paymentMethodTypes } : {}),
    });
    if (!session.url) {
      return NextResponse.json({ error: 'Stripe did not return a checkout URL.' }, { status: 502 });
    }
    return session;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Checkout could not be started.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
