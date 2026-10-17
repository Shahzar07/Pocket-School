import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { blankSubscription, readSubscription } from '@/lib/institution-membership';
import { planName, type VolumeInterval, type VolumePlanId } from '@/lib/institution-pricing';
import {
  callerOwnsInstitution,
  institutionPaymentKeys,
  recurringTotal,
} from '@/lib/server/institution-activate';
import { DEFAULT_SPARKS_BY_PLAN } from '@/lib/institution-membership';
import {
  cancellationDate,
  checkoutChannel,
  quoteSelfServeChange,
  sandboxBannerFor,
} from '@/lib/institution-self-serve';

export const dynamic = 'force-dynamic';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Billing changes need the server account.' }, { status: 503 });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const body = await req.json().catch(() => ({})) as {
    institutionId?: string;
    planId?: string;
    interval?: string;
    seats?: number;
    cancel?: boolean;
    confirmSandbox?: boolean;
  };
  const institutionId = body.institutionId?.trim() ?? '';
  if (!(await callerOwnsInstitution(user.uid, institutionId))) {
    return NextResponse.json({ error: 'Sign in as this academy’s admin to change billing.' }, { status: 403 });
  }
  const ref = adminDb().doc(`institutions/${institutionId}/billing/current`);
  const snap = await ref.get();
  const current = readSubscription(snap.data() as Record<string, unknown> | undefined, blankSubscription('institution', todayIso()));
  if (body.cancel) {
    const dated = cancellationDate(current.periodEnd);
    if ('error' in dated) return NextResponse.json({ error: dated.error }, { status: 400 });
    await ref.set({ cancelOn: dated.cancelOn }, { merge: true });
    return NextResponse.json({ cancelOn: dated.cancelOn });
  }
  const planId: VolumePlanId = body.planId === 'primary_secondary' || body.planId === 'professional' || body.planId === 'igcse_alevel'
    ? body.planId
    : current.planId;
  const interval: VolumeInterval = body.interval === 'monthly' ? 'monthly' : body.interval === 'annual' ? 'annual' : current.interval;
  const seats = Math.floor(Number(body.seats));
  if (!Number.isInteger(seats) || seats < 1) return NextResponse.json({ error: 'Choose a seat count.' }, { status: 400 });
  const nextTotal = recurringTotal(planId, interval, seats);
  const quote = quoteSelfServeChange({
    currentSeats: current.seats,
    currentTotal: current.total,
    currentInterval: current.interval,
    currentPeriodEnd: current.periodEnd,
    nextSeats: seats,
    nextTotal,
    planChanged: planId !== current.planId || interval !== current.interval,
    on: todayIso(),
  });
  if ('error' in quote) return NextResponse.json({ error: quote.error }, { status: 400 });
  const sparks = DEFAULT_SPARKS_BY_PLAN[planId] * seats;
  const change = { planId, interval, seats, total: nextTotal, sparks, currency: current.currency, status: 'open' as const };
  const keys = await institutionPaymentKeys();
  const channel = checkoutChannel({
    stripe: keys.stripe,
    gateway: keys.gateway,
    currency: current.currency || 'USD',
    tender: 'card',
    total: quote.charge,
  });
  if (quote.charge <= 0 || (body.confirmSandbox === true && channel === 'sandbox')) {
    await adminDb().doc(`institutions/${institutionId}/billing/change`).set(change);
    await ref.set({
      ...current,
      planId,
      interval,
      seats,
      total: nextTotal,
      phase: 'active',
      cancelOn: '',
    });
    await adminDb().doc(`institutions/${institutionId}`).set({ billingPhase: 'active', status: 'active', planId }, { merge: true });
    await adminDb().doc(`institutions/${institutionId}/settings/profile`).set({ seatCount: seats }, { merge: true });
    await adminDb().doc(`institutions/${institutionId}/sparks_guard/current`).set({ cap: sparks, allowance: sparks, lowAtPercent: 20 }, { merge: true });
    await adminDb().doc(`institutions/${institutionId}/billing/change`).set({ status: 'settled' }, { merge: true });
    return NextResponse.json({
      applied: true,
      charge: quote.charge,
      credit: quote.credit,
      sandbox: channel === 'sandbox' && quote.charge > 0,
      banner: channel === 'sandbox' && quote.charge > 0 ? sandboxBannerFor('sandbox') : '',
    });
  }
  if (channel === 'sandbox') {
    await adminDb().doc(`institutions/${institutionId}/billing/change`).set(change);
    return NextResponse.json({
      sandbox: true,
      banner: sandboxBannerFor('sandbox'),
      charge: quote.charge,
      credit: quote.credit,
      total: nextTotal,
      currency: current.currency,
    });
  }
  await adminDb().doc(`institutions/${institutionId}/billing/change`).set(change);
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: user.email,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: (current.currency || 'USD').toLowerCase(),
        unit_amount: Math.round(quote.charge * 100),
        product_data: { name: `Poket School — ${planName(planId)} · ${seats} seats, pro-rated` },
      },
    }],
    metadata: {
      kind: 'institution_billing',
      institutionId,
      interval,
      planId,
      selfServe: '1',
    },
    success_url: `${req.nextUrl.origin}/dashboard/institution/billing?paid=1`,
    cancel_url: `${req.nextUrl.origin}/dashboard/institution/billing`,
  });
  return NextResponse.json({ url: session.url, charge: quote.charge, credit: quote.credit, currency: current.currency });
}
