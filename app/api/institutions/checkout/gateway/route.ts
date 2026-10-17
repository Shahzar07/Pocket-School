import { NextRequest, NextResponse } from 'next/server';
import { verifyGatewayNotice } from '@/lib/payments/gateway-notice';
import { secretValue } from '@/lib/payments/server/settings';
import { gatewayVendor } from '@/lib/institution-self-serve';
import { settleInstitutionOrder } from '@/lib/server/institution-activate';

export const dynamic = 'force-dynamic';

/**
 * Malaysian gateway callback for an institution order.
 * Student checkouts stay on /api/payments/webhook/gateway.
 */
export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? '';
  const params: Record<string, string> = {};
  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') params[key] = String(value);
    }
  } else {
    const form = new URLSearchParams(await req.text());
    for (const [key, value] of form.entries()) params[key] = value;
  }
  const vendor = gatewayVendor(params.provider || process.env.MY_GATEWAY_PROVIDER);
  const secretId = vendor === 'ipay88' ? 'ipay88_key' : vendor === 'rms' ? 'rms_secret' : 'billplz_signature';
  const secret = await secretValue(secretId).catch(() => undefined);
  const notice = verifyGatewayNotice(vendor, secret, params);
  if (!notice.ok) return NextResponse.json({ error: notice.reason ?? 'Rejected' }, { status: 400 });
  if (!notice.paid || !notice.checkoutId) return NextResponse.json({ received: true, paid: false });
  await settleInstitutionOrder(notice.checkoutId, { providerRef: `${vendor}:${notice.eventId}` });
  return NextResponse.json({ received: true });
}
