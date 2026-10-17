import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { blankSubscription, institutionEmail, periodStartFor, readSubscription } from '@/lib/institution-membership';
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
  priceInstitutionOrder,
  quoteSelfServeChange,
  sandboxBannerFor,
} from '@/lib/institution-self-serve';
import { planTierReview, sameSelection, tierForSeats } from '@/lib/institution-catalogue';
import { sendInstitutionMail } from '@/lib/server/institution-mail';
import { countActiveStudents, loadInstitutionCatalogue } from '@/lib/server/institution-catalogue';
import { loadAutomation, logAutomation } from '@/lib/server/automation-store';

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
    activeSeats?: number;
    programmeIds?: string[];
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
  const automation = await loadAutomation();
  if (body.cancel) {
    if (!automation.rules.institution_cancel) {
      await logAutomation({ rule: 'institution_cancel', outcome: 'held', summary: 'Academy cancellation is set to manual.', actorId: user.uid, refId: institutionId });
      return NextResponse.json({ error: 'Cancellation is with a super admin at the moment.' }, { status: 409 });
    }
    const dated = cancellationDate(current.periodEnd);
    if ('error' in dated) return NextResponse.json({ error: dated.error }, { status: 400 });
    await ref.set({ cancelOn: dated.cancelOn }, { merge: true });
    await logAutomation({ rule: 'institution_cancel', outcome: 'auto', summary: `Academy cancels on ${dated.cancelOn}.`, actorId: user.uid, refId: institutionId });
    return NextResponse.json({ cancelOn: dated.cancelOn });
  }
  const planId: VolumePlanId = body.planId === 'primary_secondary' || body.planId === 'professional' || body.planId === 'igcse_alevel'
    ? body.planId
    : current.planId;
  const interval: VolumeInterval = body.interval === 'monthly' ? 'monthly' : body.interval === 'annual' ? 'annual' : current.interval;
  const seats = Math.floor(Number(body.seats));
  if (!Number.isInteger(seats) || seats < 1) return NextResponse.json({ error: 'Choose a seat count.' }, { status: 400 });
  const programmeIds = Array.isArray(body.programmeIds)
    ? body.programmeIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : [];
  const storedProgrammes = Array.isArray(snap.get('programmeIds'))
    ? snap.get('programmeIds').filter((id: unknown): id is string => typeof id === 'string')
    : [];
  const programmesChanged = programmeIds.length > 0 && !sameSelection(programmeIds, storedProgrammes);
  const planChanged = planId !== current.planId || interval !== current.interval || programmesChanged;
  const seatsChanged = seats !== current.seats;
  if (planChanged && !automation.rules.plan_proration) {
    await logAutomation({ rule: 'plan_proration', outcome: 'held', summary: 'Plan changes are set to manual.', actorId: user.uid, refId: institutionId });
    return NextResponse.json({ error: 'Plan changes are with a super admin at the moment.' }, { status: 409 });
  }
  if (seatsChanged && !planChanged && !automation.rules.institution_seats) {
    await logAutomation({ rule: 'institution_seats', outcome: 'held', summary: 'Seat changes are set to manual.', actorId: user.uid, refId: institutionId });
    return NextResponse.json({ error: 'Seat changes are with a super admin at the moment.' }, { status: 409 });
  }
  const academy = await adminDb().doc(`institutions/${institutionId}`).get();
  const country = typeof academy.get('country') === 'string' ? academy.get('country') as string : '';
  const periodStart = periodStartFor(current.periodEnd, current.interval);
  let activeSeats = Number.isInteger(body.activeSeats) ? body.activeSeats as number : seats;
  if (programmeIds.length) {
    try {
      activeSeats = await countActiveStudents(institutionId, periodStart || todayIso());
    } catch {
      activeSeats = Number.isInteger(body.activeSeats) ? body.activeSeats as number : seats;
    }
  }
  const catalogue = programmeIds.length ? await loadInstitutionCatalogue() : null;
  const hybrid = catalogue
    ? priceInstitutionOrder({
      planId,
      interval,
      seats,
      access: 'subscription',
      programmeIds,
      country,
      tender: 'card',
      activeSeats,
      catalogue,
    })
    : null;
  if (hybrid && 'error' in hybrid) return NextResponse.json({ error: hybrid.error }, { status: 400 });
  const currentTier = catalogue ? tierForSeats(catalogue, current.seats) : null;
  const nextTier = catalogue ? tierForSeats(catalogue, seats) : null;
  const tierUpgraded = Boolean(currentTier && nextTier && nextTier.minSeats > currentTier.minSeats);
  if (catalogue && currentTier && nextTier && nextTier.minSeats < currentTier.minSeats) {
    const review = planTierReview({
      catalogue,
      currentTierId: currentTier.id,
      currentSeats: current.seats,
      currentTotal: current.total,
      students: seats,
      itemIds: programmeIds,
      interval,
      country,
      tender: 'card',
      periodStart: periodStart || todayIso(),
      periodEnd: current.periodEnd,
      on: todayIso(),
    });
    if (!('error' in review) && review.action === 'suggest_downgrade') {
      const name = typeof academy.get('name') === 'string' ? academy.get('name') as string : 'Your institution';
      const mail = institutionEmail('tier_renewal', {
        institutionName: name,
        plan: review.toName,
        seats: review.students,
        total: `${review.currency} ${review.savings.toFixed(2)}`,
        renewalOn: current.periodEnd,
      });
      await ref.set({
        renewalSuggestion: {
          tierId: review.toId,
          tierName: review.toName,
          students: review.students,
          nextTotal: review.nextTotal,
          savings: review.savings,
          currency: review.currency,
          periodEnd: current.periodEnd,
          message: review.message,
        },
        tierNoticeKey: review.noticeKey,
      }, { merge: true });
      await adminDb().collection('institutions').doc(institutionId).collection('notifications').add({
        kind: 'tier_renewal',
        title: mail.subject,
        body: mail.text,
        audience: 'admins',
        at: todayIso(),
      });
      if (current.payerEmail) await sendInstitutionMail(current.payerEmail, mail);
      return NextResponse.json({
        suggested: true,
        message: review.message,
        tier: review.toName,
        renewalOn: current.periodEnd,
        savings: review.savings,
        currency: review.currency,
      });
    }
  }
  const nextTotal = hybrid ? hybrid.total : recurringTotal(planId, interval, seats);
  const quote = quoteSelfServeChange({
    currentSeats: current.seats,
    currentTotal: current.total,
    currentInterval: current.interval,
    currentPeriodEnd: current.periodEnd,
    nextSeats: seats,
    nextTotal,
    planChanged: planChanged || tierUpgraded,
    on: todayIso(),
  });
  if ('error' in quote) return NextResponse.json({ error: quote.error }, { status: 400 });
  const sparks = hybrid ? hybrid.sparks : DEFAULT_SPARKS_BY_PLAN[planId] * seats;
  const currency = hybrid ? hybrid.currency : current.currency;
  const change = {
    planId,
    interval,
    seats,
    total: nextTotal,
    sparks,
    currency,
    status: 'open' as const,
    programmeIds: hybrid ? hybrid.programmeIds : programmeIds,
    lines: hybrid ? hybrid.lines : [],
  };
  const keys = await institutionPaymentKeys();
  const channel = checkoutChannel({
    stripe: keys.stripe,
    gateway: keys.gateway,
    currency: currency || 'USD',
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
      currency,
      phase: 'active',
      cancelOn: '',
      ...(hybrid ? { programmeIds: hybrid.programmeIds, lines: hybrid.lines } : {}),
      ...(nextTier ? { tierId: nextTier.id, renewalSuggestion: null } : {}),
    });
    await adminDb().doc(`institutions/${institutionId}`).set({
      billingPhase: 'active',
      status: 'active',
      planId,
      ...(hybrid ? { programmeIds: hybrid.programmeIds } : {}),
    }, { merge: true });
    if (hybrid) {
      await adminDb().doc(`institutions/${institutionId}/settings/access`).set({
        planId,
        access: 'subscription',
        programmeIds: hybrid.programmeIds,
      }, { merge: true });
    }
    await adminDb().doc(`institutions/${institutionId}/settings/profile`).set({ seatCount: seats }, { merge: true });
    await adminDb().doc(`institutions/${institutionId}/sparks_guard/current`).set({ cap: sparks, allowance: sparks, lowAtPercent: 20 }, { merge: true });
    await adminDb().doc(`institutions/${institutionId}/billing/change`).set({ status: 'settled' }, { merge: true });
    return NextResponse.json({
      applied: true,
      charge: quote.charge,
      credit: quote.credit,
      sandbox: channel === 'sandbox' && quote.charge > 0,
      banner: channel === 'sandbox' && quote.charge > 0 ? sandboxBannerFor('sandbox') : '',
      activeSeats,
      currency,
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
      currency,
      activeSeats,
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
        currency: (currency || 'USD').toLowerCase(),
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
  return NextResponse.json({ url: session.url, charge: quote.charge, credit: quote.credit, currency, activeSeats });
}
