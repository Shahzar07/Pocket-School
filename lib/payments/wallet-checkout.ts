import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { walletChargeMethod } from '@/lib/payments/methods';
import { startCheckout } from '@/lib/payments/server/engine';
import { ActionError } from '@/lib/server/actions';

interface WalletCheckoutBody {
  kind?: string;
  id?: string;
  interval?: string;
  currency?: string;
  methods?: string[];
  method?: string;
}

/** Book purchase and Reads subscription. Used by the checkout and purchase routes. */
export async function startWalletCheckout(req: NextRequest, parsed?: WalletCheckoutBody) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;

  let incoming = parsed;
  if (!incoming) {
    try {
      incoming = (await req.json()) as WalletCheckoutBody;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }
  }
  if (!incoming) return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  const body = incoming;

  const kind = body.kind ?? '';
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (kind !== 'book' && kind !== 'reads') {
    return NextResponse.json({ error: 'kind must be book or reads.' }, { status: 400 });
  }
  if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 });

  const interval = body.interval === 'annual' ? 'annual' : 'monthly';
  const currency = (typeof body.currency === 'string' && body.currency.trim() ? body.currency : 'USD').toUpperCase();
  const method = walletChargeMethod(kind, body.methods, body.method);
  const origin = req.nextUrl.origin;

  try {
    const result = await startCheckout({
      uid: user.uid,
      email: user.email,
      kind,
      sku: id,
      country: currency === 'MYR' ? 'MY' : 'US',
      currency,
      interval: interval === 'annual' ? 'year' : 'month',
      method,
      idempotencyKey: `reads:${kind}:${id}:${interval}:${currency}:${method}`,
      origin,
      successPath: kind === 'book' ? `/reads/book/${encodeURIComponent(id)}?paid=1` : '/reads?checkout=success',
      cancelPath: kind === 'book' ? `/reads/book/${encodeURIComponent(id)}` : '/reads',
    });
    return NextResponse.json({
      url: result.url ?? null,
      postUrl: 'postUrl' in result ? result.postUrl ?? null : null,
      fields: 'fields' in result ? result.fields ?? null : null,
      amount: result.amount,
      currency: result.currency,
      checkoutId: result.checkoutId,
      sandbox: result.sandbox,
      alreadyPaid: result.alreadyPaid === true,
      method,
    });
  } catch (error) {
    if (error instanceof ActionError) {
      const status = error.code === 'FORBIDDEN' ? 403 : error.code === 'NOT_FOUND' || error.code === 'USER_NOT_FOUND' ? 404 : error.code === 'INSUFFICIENT_WALLET' ? 402 : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    const message = error instanceof Error ? error.message : 'Checkout could not be started.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
