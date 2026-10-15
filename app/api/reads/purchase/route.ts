import { NextRequest, NextResponse } from 'next/server';
import { startWalletCheckout } from '@/app/api/stripe/create-checkout/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Book purchase and Reads subscription both go through the wallet checkout.
 * The body is `{ bookId }` or `{ planId: 'reads' | 'reads-family', interval }`.
 * The webhook grants `alloc:marketplace:{bookId}` or `plan:reads` / `plan:reads-family`.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as {
    bookId?: string;
    planId?: string;
    interval?: string;
    currency?: string;
    methods?: string[];
    method?: string;
  } | null;
  const id = body?.bookId || body?.planId;
  const kind = body?.bookId ? 'book' : 'reads';
  if (!id) return NextResponse.json({ error: 'A book or a Reads plan is required.' }, { status: 400 });

  const headers = new Headers(request.headers);
  headers.delete('content-length');
  headers.set('content-type', 'application/json');
  const forwarded = new NextRequest(new URL('/api/stripe/create-checkout', request.url), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      kind,
      id,
      interval: body?.interval === 'annual' ? 'annual' : 'monthly',
      currency: typeof body?.currency === 'string' && body.currency.trim() ? body.currency : 'USD',
      methods: Array.isArray(body?.methods) ? body.methods : undefined,
      method: typeof body?.method === 'string' ? body.method : undefined,
    }),
  });
  return startWalletCheckout(forwarded);
}
