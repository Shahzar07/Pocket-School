import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, loadUser, requireUser } from '@/lib/api-guard';
import { ActionError } from '@/lib/server/actions';
import { startCheckout } from '@/lib/payments/server/engine';
import { canTakeOverBilling, parentPayDecision, quoteFamily } from '@/lib/billing/model';
import {
  createAsk,
  loadFamilyRates,
  loadPlanPrice,
  readFamily,
  respondAsk,
  seatCoverage,
  setSpendingCap,
  transferSponsorship,
} from '@/lib/billing/store';

export const dynamic = 'force-dynamic';

function linesOf(value: unknown): { uid: string; tierId: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const uid = 'uid' in row && typeof row.uid === 'string' ? row.uid : '';
    const tierId = 'tierId' in row && typeof row.tierId === 'string' ? row.tierId : '';
    return uid && tierId ? [{ uid, tierId }] : [];
  });
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const family = await readFamily(user.uid);
  return NextResponse.json(family);
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = typeof body.action === 'string' ? body.action : 'checkout';
  try {
    if (action === 'quote') {
      const interval = body.interval === 'year' ? 'year' : 'month';
      const requested = linesOf(body.lines);
      const priced = [];
      const warnings = [];
      for (const line of requested) {
        const price = await loadPlanPrice(line.tierId, interval);
        if (!price) return NextResponse.json({ error: 'That plan has no config price yet.' }, { status: 400 });
        const seat = await seatCoverage(line.uid);
        const decision = parentPayDecision({
          seatActive: seat.seatActive,
          seatTier: seat.seatTier,
          requestedTier: price.accessTier,
          graduating: body.graduating === true,
        });
        if (decision.action === 'block') return NextResponse.json({ error: decision.reason, code: 'DUPLICATE_SEAT' }, { status: 409 });
        if (decision.action === 'warn') warnings.push({ uid: line.uid, reason: decision.reason });
        priced.push({ uid: line.uid, tierId: line.tierId, accessTier: price.accessTier, listUsd: price.listUsd });
      }
      const rates = await loadFamilyRates();
      return NextResponse.json({ ...quoteFamily(priced, rates), warnings });
    }

    if (action === 'checkout') {
      const result = await startCheckout({
        uid: user.uid,
        email: user.email,
        kind: 'subscription',
        sku: 'family',
        country: typeof body.country === 'string' ? body.country : 'MY',
        interval: typeof body.interval === 'string' ? body.interval : 'month',
        method: typeof body.method === 'string' ? body.method : 'card',
        familyLines: linesOf(body.lines),
        acknowledgeWarning: body.acknowledgeWarning === true,
        origin: req.nextUrl.origin,
        idempotencyKey: typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined,
        successPath: '/dashboard/parent/billing?paid=1',
        cancelPath: '/dashboard/parent/billing',
      });
      return NextResponse.json(result);
    }

    if (action === 'cap') {
      const cap = body.capUsd == null || body.capUsd === '' ? null : Number(body.capUsd);
      if (cap != null && (!Number.isFinite(cap) || cap < 0)) {
        return NextResponse.json({ error: 'Enter a spending cap in US dollars, or clear it.' }, { status: 400 });
      }
      await setSpendingCap(user.uid, cap);
      return NextResponse.json({ ok: true, spendingCapUsd: cap });
    }

    if (action === 'transfer' || action === 'takeover') {
      const childUid = typeof body.childUid === 'string' ? body.childUid : '';
      if (!childUid) return NextResponse.json({ error: 'Choose a child.' }, { status: 400 });
      if (action === 'takeover') {
        const profile = await loadUser(user.uid);
        if (user.uid !== childUid) return NextResponse.json({ error: 'You can only take over your own plan.' }, { status: 403 });
        if (!canTakeOverBilling({ ageTier: profile?.ageTier, dateOfBirth: profile?.dateOfBirth, now: new Date() })) {
          return NextResponse.json({ error: 'Billing can move to the learner when they turn 18.' }, { status: 403 });
        }
        const parentUid = typeof body.payerUid === 'string' ? body.payerUid : '';
        if (!parentUid) return NextResponse.json({ error: 'The current payer is required.' }, { status: 400 });
        await transferSponsorship({ payerUid: parentUid, childUid, nextPayerUid: childUid });
        return NextResponse.json({ ok: true, payerUid: childUid });
      }
      const nextPayerUid = typeof body.nextPayerUid === 'string' ? body.nextPayerUid : '';
      if (!nextPayerUid) return NextResponse.json({ error: 'Choose the guardian who will pay.' }, { status: 400 });
      await transferSponsorship({ payerUid: user.uid, childUid, nextPayerUid });
      return NextResponse.json({ ok: true });
    }

    if (action === 'ask') {
      const parentUid = typeof body.parentUid === 'string' ? body.parentUid : '';
      const kind = body.kind === 'course' ? 'course' : 'plan';
      const id = await createAsk({
        childUid: user.uid,
        parentUid,
        kind,
        tierId: typeof body.tierId === 'string' ? body.tierId : undefined,
        courseId: typeof body.courseId === 'string' ? body.courseId : undefined,
        note: typeof body.note === 'string' ? body.note : undefined,
      });
      return NextResponse.json({ id, status: 'pending' });
    }

    if (action === 'respond') {
      const requestId = typeof body.requestId === 'string' ? body.requestId : '';
      const decision = body.decision === 'approved' ? 'approved' : body.decision === 'rejected' ? 'rejected' : '';
      if (!requestId || !decision) return NextResponse.json({ error: 'Choose approve or decline.' }, { status: 400 });
      const request = await respondAsk({ parentUid: user.uid, requestId, decision });
      if (decision === 'rejected') return NextResponse.json({ ok: true, status: 'rejected' });
      if (request.kind === 'plan' && request.tierId && request.childUid) {
        const result = await startCheckout({
          uid: user.uid,
          email: user.email,
          kind: 'subscription',
          sku: 'family',
          country: typeof body.country === 'string' ? body.country : 'MY',
          interval: body.interval === 'year' ? 'year' : 'month',
          method: typeof body.method === 'string' ? body.method : 'card',
          familyLines: [{ uid: request.childUid, tierId: request.tierId }],
          acknowledgeWarning: body.acknowledgeWarning === true,
          origin: req.nextUrl.origin,
          successPath: '/dashboard/parent/billing?paid=1',
          cancelPath: '/dashboard/parent/billing',
        });
        return NextResponse.json({ ok: true, status: 'approved', checkout: result });
      }
      return NextResponse.json({ ok: true, status: 'approved', courseId: request.courseId, childUid: request.childUid });
    }

    if (action === 'remove') {
      const childUid = typeof body.childUid === 'string' ? body.childUid : '';
      const { adminDb } = await import('@/lib/firebase-admin');
      const { subscriptionDocId, courseUnlockUids } = await import('@/lib/billing/model');
      const { appendBillingAudit } = await import('@/lib/billing/store');
      const { applyStripeSubscription } = await import('@/lib/server/actions');
      const ref = adminDb().doc(`subscriptions/${subscriptionDocId(user.uid)}`);
      const snap = await ref.get();
      const data = snap.data() ?? {};
      if (data.payerUid && data.payerUid !== user.uid) return NextResponse.json({ error: 'Only the payer can change this plan.' }, { status: 403 });
      const beneficiaries = Array.isArray(data.beneficiaryUids) ? data.beneficiaryUids.filter((id: unknown): id is string => typeof id === 'string' && id !== childUid) : [];
      const lines = Array.isArray(data.lines) ? data.lines.filter((line: { uid?: string }) => line.uid !== childUid) : [];
      await ref.set({ beneficiaryUids: beneficiaries, lines, updatedAt: Date.now() }, { merge: true });
      if (courseUnlockUids(user.uid, [childUid]).includes(childUid)) await applyStripeSubscription(childUid, 0);
      await adminDb().doc(`entitlements/${childUid}`).set({ status: 'cancelled', tier: 0, accessTier: 0, updatedAt: Date.now() }, { merge: true });
      await appendBillingAudit({
        type: 'cancelled',
        payerUid: user.uid,
        beneficiaryUids: [childUid],
        subscriptionId: subscriptionDocId(user.uid),
        at: Date.now(),
        detail: `removed ${childUid}`,
        source: typeof data.source === 'string' ? data.source : 'stripe',
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown billing action.' }, { status: 400 });
  } catch (error) {
    if (error instanceof ActionError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.code === 'DUPLICATE_SEAT' ? 409 : 400 });
    const message = error instanceof Error ? error.message : 'Billing could not be updated.';
    const status = /approved guardian|not on this subscription|already answered|not found/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
