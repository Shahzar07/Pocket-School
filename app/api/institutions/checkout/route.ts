import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { planName } from '@/lib/institution-pricing';
import { ipay88Amount, ipay88Signature } from '@/lib/payments/signatures';
import { secretValue } from '@/lib/payments/server/settings';
import {
  callerOwnsInstitution,
  institutionPaymentKeys,
  saveInstitutionOrder,
  settleInstitutionOrder,
} from '@/lib/server/institution-activate';
import {
  checkoutChannel,
  parseInstitutionOrder,
  priceInstitutionOrder,
  sandboxBannerFor,
} from '@/lib/institution-self-serve';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Institution checkout needs the server account.' }, { status: 503 });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const institutionId = typeof body.institutionId === 'string' ? body.institutionId.trim() : '';
  if (!(await callerOwnsInstitution(user.uid, institutionId))) {
    return NextResponse.json({ error: 'Sign in as this academy’s admin to check out.' }, { status: 403 });
  }
  const parsed = parseInstitutionOrder(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const academy = await adminDb().doc(`institutions/${institutionId}`).get();
  if (!academy.exists) return NextResponse.json({ error: 'That academy was not found.' }, { status: 404 });
  const country = typeof academy.data()?.country === 'string' ? academy.data()?.country ?? '' : '';
  const priced = priceInstitutionOrder({ ...parsed.value, country });
  if ('error' in priced) return NextResponse.json({ error: priced.error }, { status: 400 });
  await saveInstitutionOrder(institutionId, parsed.value, priced);
  const keys = await institutionPaymentKeys();
  const channel = checkoutChannel({
    stripe: keys.stripe,
    gateway: keys.gateway,
    currency: priced.currency,
    tender: parsed.value.tender,
    total: priced.total,
  });
  const banner = sandboxBannerFor(channel);
  if (channel === 'unsupported') {
    return NextResponse.json({ error: 'FPX charges Malaysian ringgit. Pay by card for this price list.' }, { status: 400 });
  }
  if (channel === 'invoice' || channel === 'free') {
    const settled = await settleInstitutionOrder(institutionId);
    return NextResponse.json({ ...settled, channel, banner, total: priced.total, currency: priced.currency, sparks: priced.sparks, tax: priced.tax });
  }
  if (channel === 'sandbox') {
    return NextResponse.json({
      sandbox: true,
      channel,
      banner,
      total: priced.total,
      currency: priced.currency,
      tax: priced.tax,
      sparks: priced.sparks,
    });
  }
  if (channel === 'stripe') {
    try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email || undefined,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: priced.currency.toLowerCase(),
          unit_amount: Math.round(priced.total * 100),
          product_data: {
            name: priced.tax > 0
              ? `Poket School — ${priced.planLabel} · ${priced.seats} seats (incl. tax)`
              : `Poket School — ${planName(priced.planId)} · ${priced.seats} seats`,
          },
        },
      }],
      payment_method_types: parsed.value.tender === 'fpx' ? ['fpx'] : ['card'],
      metadata: {
        kind: 'institution_billing',
        institutionId,
        interval: priced.interval,
        planId: priced.planId,
        selfServe: '1',
      },
      success_url: `${req.nextUrl.origin}/institutions/checkout?paid=1`,
      cancel_url: `${req.nextUrl.origin}/institutions/checkout`,
    });
    return NextResponse.json({ url: session.url, channel, total: priced.total, currency: priced.currency, tax: priced.tax, sparks: priced.sparks });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Stripe did not start the payment.';
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }
  try {
    const gateway = await openGateway({
      vendor: keys.vendor,
      institutionId,
      email: user.email ?? '',
      name: typeof academy.data()?.name === 'string' ? academy.data()?.name ?? 'Institution' : 'Institution',
      total: priced.total,
      title: `Poket School — ${priced.planLabel}`,
      origin: req.nextUrl.origin,
    });
    return NextResponse.json({ ...gateway, channel, total: priced.total, currency: priced.currency, tax: priced.tax, sparks: priced.sparks });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The Malaysian gateway did not start the payment.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

async function openGateway(input: {
  vendor: 'billplz' | 'ipay88' | 'rms';
  institutionId: string;
  email: string;
  name: string;
  total: number;
  title: string;
  origin: string;
}): Promise<{ url?: string; postUrl?: string; fields?: Record<string, string> }> {
  const callback = `${input.origin}/api/institutions/checkout/gateway`;
  const done = `${input.origin}/institutions/checkout?paid=1`;
  if (input.vendor === 'billplz') {
    const api = await secretValue('billplz_key');
    const collection = await secretValue('billplz_collection');
    const host = process.env.MY_GATEWAY_MODE === 'live' ? 'https://www.billplz.com' : 'https://www.billplz-sandbox.com';
    const body = new URLSearchParams({
      collection_id: collection ?? '',
      email: input.email || 'academy@poketschool.ai',
      name: input.name,
      amount: String(Math.round(input.total * 100)),
      description: input.title.slice(0, 200),
      callback_url: callback,
      redirect_url: done,
      reference_1_label: 'Institution',
      reference_1: input.institutionId,
    });
    const response = await fetch(`${host}/api/v3/bills`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${api}:`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const payload = await response.json().catch(() => ({})) as { url?: string };
    if (!response.ok || !payload.url) {
      throw new Error('The Malaysian gateway did not start the payment.');
    }
    return { url: payload.url };
  }
  if (input.vendor === 'ipay88') {
    const code = await secretValue('ipay88_code');
    const key = await secretValue('ipay88_key');
    const fields: Record<string, string> = {
      MerchantCode: code ?? '',
      PaymentId: '',
      RefNo: input.institutionId,
      Amount: input.total.toFixed(2),
      Currency: 'MYR',
      ProdDesc: input.title.slice(0, 100),
      UserName: input.name,
      UserEmail: input.email || 'academy@poketschool.ai',
      Signature: ipay88Signature({
        merchantKey: key ?? '',
        merchantCode: code ?? '',
        paymentId: '',
        refNo: input.institutionId,
        amount: ipay88Amount(input.total),
        currency: 'MYR',
      }),
      ResponseURL: done,
      BackendURL: callback,
    };
    return { postUrl: 'https://payment.ipay88.com.my/ePayment/entry.asp', fields };
  }
  const merchant = await secretValue('rms_merchant');
  const host = process.env.MY_GATEWAY_MODE === 'live' ? 'https://pay.merchant.razer.com' : 'https://sandbox.merchant.razer.com';
  return {
    postUrl: `${host}/RMS/pay/${merchant}/`,
    fields: {
      amount: input.total.toFixed(2),
      orderid: input.institutionId,
      bill_name: input.name,
      bill_email: input.email || 'academy@poketschool.ai',
      bill_desc: input.title.slice(0, 100),
      currency: 'MYR',
      returnurl: done,
      callbackurl: callback,
    },
  };
}
