import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { ActionError } from '@/lib/server/actions';
import { canonicalMethod } from '@/lib/payments/methods';
import { startCheckout } from '@/lib/payments/server/engine';

export const dynamic = 'force-dynamic';

/**
 * The Reads client calls this with `{ kind, id, interval, currency, methods }`.
 * It uses the same checkout as `/api/payments/checkout`. Touch 'n Go is a
 * Malaysian-gateway charge, not metadata on a Stripe session.
 * Course purchases stay on `/api/stripe/checkout`.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;

  const body = await req.json().catch(() => null) as {
    kind?: string;
    id?: string;
    interval?: string;
    currency?: string;
    method?: string;
    methods?: string[];
    country?: string;
  } | null;

  const rawKind = body?.kind ?? '';
  const id = typeof body?.id === 'string' ? body.id.trim() : '';
  if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 });
  if (rawKind === 'course') {
    return NextResponse.json({ error: 'Course checkout stays on /api/stripe/checkout.', code: 'USE_COURSE_CHECKOUT' }, { status: 400 });
  }
  if (rawKind === 'addon') {
    return NextResponse.json({ error: 'Add-on checkout is not available yet.', code: 'ADDON_PENDING' }, { status: 501 });
  }

  const readsPlan = id === 'reads' || id === 'reads-family';
  const kind = rawKind === 'reads' || (rawKind === 'plan' && readsPlan) ? 'reads' : rawKind === 'book' ? 'book' : '';
  if (!kind) {
    return NextResponse.json({ error: 'kind must be book or reads.', code: 'INVALID' }, { status: 400 });
  }

  const interval = body?.interval === 'annual' || body?.interval === 'year' ? 'year' : 'month';
  const currency = kind === 'reads' ? 'USD' : (body?.currency || 'USD').toUpperCase();
  const method = pickMethod(body?.method, body?.methods, kind);
  const origin = req.nextUrl.origin;
  const successPath = kind === 'book'
    ? `/reads/book/${encodeURIComponent(id)}?paid=1`
    : '/reads?checkout=success';
  const cancelPath = kind === 'book' ? `/reads/book/${encodeURIComponent(id)}` : '/reads';

  try {
    const result = await startCheckout({
      uid: user.uid,
      email: user.email,
      kind,
      sku: id,
      country: typeof body?.country === 'string' ? body.country : 'MY',
      currency,
      interval,
      method,
      origin,
      successPath,
      cancelPath,
      idempotencyKey: `reads:${kind}:${id}:${interval}:${currency}:${method}`,
    });
    return NextResponse.json({
      url: result.url ?? null,
      postUrl: result.postUrl ?? null,
      fields: result.fields ?? null,
      amount: result.amount,
      currency: result.currency,
      checkoutId: result.checkoutId,
      sandbox: result.sandbox,
      alreadyPaid: result.alreadyPaid,
      method,
    });
  } catch (error) {
    if (error instanceof ActionError) {
      const status = error.code === 'FORBIDDEN' ? 403 : error.code === 'NOT_FOUND' ? 404 : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error(error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL' }, { status: 500 });
  }
}

function pickMethod(method: string | undefined, methods: string[] | undefined, kind: string): string {
  if (kind === 'reads') return 'card';
  if (method) return canonicalMethod(method);
  const requested = (methods ?? []).map((item) => canonicalMethod(item));
  if (requested.length === 1) return requested[0];
  const stripe = requested.filter((item) => item === 'card' || item === 'fpx' || item === 'grabpay' || item === 'apple_pay' || item === 'google_pay');
  if (requested.includes('tng') && stripe.length === 0) return 'tng';
  if (requested.includes('fpx') && !requested.includes('card')) return 'fpx';
  if (requested.includes('grabpay') && !requested.includes('card') && !requested.includes('fpx')) return 'grabpay';
  return 'card';
}
