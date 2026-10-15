import { NextRequest, NextResponse } from 'next/server';
import { fulfillCheckout } from '@/lib/payments/server/engine';
import { noteWebhook, secretValue } from '@/lib/payments/server/settings';
import { verifyGatewayNotice } from '@/lib/payments/gateway-notice';
import type { GatewayVendor } from '@/lib/payments/providers';

export const dynamic = 'force-dynamic';

function vendorOf(value: string | undefined): GatewayVendor {
  if (value === 'ipay88' || value === 'rms') return value;
  return 'billplz';
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? '';
  const params: Record<string, string> = {};
  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') params[key] = String(value);
    }
  } else {
    const text = await req.text();
    const form = new URLSearchParams(text);
    for (const [key, value] of form.entries()) params[key] = value;
  }

  const vendor = vendorOf(params.provider || process.env.MY_GATEWAY_PROVIDER);
  const secretId = vendor === 'ipay88' ? 'ipay88_key' : vendor === 'rms' ? 'rms_secret' : 'billplz_signature';
  const secret = await secretValue(secretId).catch(() => undefined);
  const notice = verifyGatewayNotice(vendor, secret, params);
  if (!notice.ok) {
    await noteWebhook('gateway', false, notice.reason ?? 'rejected').catch(() => undefined);
    return NextResponse.json({ error: notice.reason ?? 'Rejected' }, { status: 400 });
  }
  if (!notice.paid || !notice.checkoutId) {
    return NextResponse.json({ received: true, paid: false });
  }
  try {
    await fulfillCheckout(notice.checkoutId, { eventId: `${vendor}:${notice.eventId}`, provider: 'my_gateway', providerRef: notice.eventId });
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fulfillment failed';
    await noteWebhook('gateway', false, message).catch(() => undefined);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
