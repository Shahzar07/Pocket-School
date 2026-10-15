import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { quoteCheckout, isCheckoutKind, type CheckoutKind } from '@/lib/platform/wallet';

export const dynamic = 'force-dynamic';

/**
 * Wallet checkout for plans, Reads subscriptions, and books.
 * Course purchases stay on `POST /api/stripe/checkout`, which already
 * enrols a student. This route matches the shared `{ kind, id, interval, currency }`
 * body and adds `book` and `reads`.
 */
export async function startWalletCheckout(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Card payments are not switched on yet.', code: 'STRIPE_NOT_CONFIGURED' }, { status: 503 });
  }

  const body = await req.json().catch(() => null) as {
    kind?: string;
    id?: string;
    interval?: 'monthly' | 'annual';
    currency?: string;
    methods?: string[];
  } | null;
  const kind = body?.kind ?? '';
  const id = typeof body?.id === 'string' ? body.id.trim() : '';
  if (!isCheckoutKind(kind)) {
    return NextResponse.json({ error: 'kind must be plan, addon, course, book, or reads.' }, { status: 400 });
  }
  if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 });
  if (kind === 'course') {
    return NextResponse.json({ error: 'Course checkout stays on /api/stripe/checkout.', code: 'USE_COURSE_CHECKOUT' }, { status: 400 });
  }
  if (kind === 'addon') {
    return NextResponse.json({ error: 'Add-on checkout is not on this branch yet.', code: 'ADDON_PENDING' }, { status: 501 });
  }

  const quote = quoteCheckout({
    kind: kind as CheckoutKind,
    id,
    interval: body?.interval,
    currency: body?.currency,
    methods: body?.methods,
  });
  if (!quote) return NextResponse.json({ error: 'That price is not available.' }, { status: 400 });

  const origin = req.nextUrl.origin;
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const unitAmount = Math.round(quote.amount * 100);
  const session = await stripe.checkout.sessions.create({
    mode: quote.mode,
    customer_email: user.email,
    payment_method_types: quote.stripeMethods,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: quote.currency.toLowerCase(),
        unit_amount: unitAmount,
        product_data: { name: quote.name },
        ...(quote.recurring ? { recurring: { interval: quote.recurring } } : {}),
      },
    }],
    metadata: {
      kind: kind === 'reads' ? 'plan' : kind,
      id,
      bookId: kind === 'book' ? id : '',
      studentId: user.uid,
      uid: user.uid,
      interval: body?.interval === 'annual' ? 'annual' : 'monthly',
      currency: quote.currency,
      touchngo: quote.touchNGoRequested ? 'requested' : '',
    },
    success_url: kind === 'book'
      ? `${origin}/reads/book/${id}?paid=1`
      : `${origin}/reads?checkout=success`,
    cancel_url: kind === 'book' ? `${origin}/reads/book/${id}` : `${origin}/reads`,
  });

  if (!session.url) {
    return NextResponse.json({ error: 'Stripe did not return a checkout URL.' }, { status: 502 });
  }
  return NextResponse.json({ url: session.url, amount: quote.amount, currency: quote.currency });
}

export async function POST(req: NextRequest) {
  return startWalletCheckout(req);
}
