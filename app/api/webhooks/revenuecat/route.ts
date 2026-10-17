import { NextRequest, NextResponse } from 'next/server';
import { isAdminConfigured, adminDb } from '@/lib/firebase-admin';
import { secretMatches, mapRevenueCatEvent, purchaseGate, courseUnlockUids, type RevenueCatEvent } from '@/lib/billing/model';
import { applyEntitlementDecision, assertGuardian, claimBillingEvent, finishBillingEvent } from '@/lib/billing/store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!process.env.REVENUECAT_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'RevenueCat webhook is not configured' }, { status: 503 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Firebase Admin is not configured', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  if (!secretMatches(req.headers.get('authorization'), process.env.REVENUECAT_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Webhook authorization failed' }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as { event?: Record<string, unknown> } | null;
  const event = body?.event ?? body;
  if (!event || typeof event !== 'object') return NextResponse.json({ error: 'Missing event' }, { status: 400 });
  const mapped = mapRevenueCatEvent(event as RevenueCatEvent);
  if (!mapped.ok) return NextResponse.json({ received: true, ignored: mapped.reason });

  const claim = await claimBillingEvent('revenuecat', mapped.decision.eventId);
  if (claim === 'skip') return NextResponse.json({ received: true, duplicate: true });

  try {
    const payerSnap = await adminDb().doc(`users/${mapped.decision.payerUid}`).get();
    const payer = payerSnap.data() ?? {};
    const gate = purchaseGate({
      ageTier: payer.ageTier,
      role: payer.role,
      dateOfBirth: payer.dateOfBirth,
      now: new Date(),
    });
    const learners = courseUnlockUids(mapped.decision.payerUid, mapped.decision.beneficiaryUids);
    const selfOnly = learners.length === 1 && learners[0] === mapped.decision.payerUid;
    if (!gate.ok && selfOnly) {
      await finishBillingEvent('revenuecat', mapped.decision.eventId, 'processed');
      return NextResponse.json({ received: true, refused: 'minor' });
    }
    const children = mapped.decision.beneficiaryUids.filter((uid) => uid !== mapped.decision.payerUid);
    if (children.length) await assertGuardian(mapped.decision.payerUid, children);
    await applyEntitlementDecision({ ...mapped.decision, beneficiaryUids: children.length ? children : mapped.decision.beneficiaryUids });
    await finishBillingEvent('revenuecat', mapped.decision.eventId, 'processed');
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed';
    if (/approved guardian/.test(message)) {
      await finishBillingEvent('revenuecat', mapped.decision.eventId, 'processed');
      return NextResponse.json({ received: true, refused: 'guardian' });
    }
    await finishBillingEvent('revenuecat', mapped.decision.eventId, 'error');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
