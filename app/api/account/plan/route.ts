import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { loadAutomation, logAutomation } from '@/lib/server/automation-store';
import { planCancelOn } from '@/lib/site-automation';

export const dynamic = 'force-dynamic';

/** A student cancels at the end of the current period. */
export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Plan changes need the server account.' }, { status: 503 });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const body = await req.json().catch(() => null);
  if (!body || body.action !== 'cancel') {
    return NextResponse.json({ error: 'Choose cancel.' }, { status: 400 });
  }
  const interval = body.interval === 'year' ? 'year' : 'month';
  const settings = await loadAutomation();
  if (!settings.rules.student_cancel) {
    await logAutomation({
      rule: 'student_cancel',
      outcome: 'held',
      summary: 'A student asked to cancel and the rule is manual.',
      actorId: user.uid,
    });
    return NextResponse.json({ error: 'Cancellation is with a super admin at the moment.' }, { status: 409 });
  }
  const today = new Date().toISOString().slice(0, 10);
  const cancelOn = planCancelOn(today, interval);
  if (typeof cancelOn !== 'string') return NextResponse.json({ error: cancelOn.error }, { status: 400 });
  await adminDb().doc(`users/${user.uid}`).set({ planCancelOn: cancelOn }, { merge: true });
  await logAutomation({
    rule: 'student_cancel',
    outcome: 'auto',
    summary: `Plan cancels on ${cancelOn}.`,
    actorId: user.uid,
  });
  return NextResponse.json({ cancelOn });
}
