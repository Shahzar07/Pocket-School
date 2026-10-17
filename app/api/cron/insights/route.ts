import { NextRequest, NextResponse } from 'next/server';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { refreshActiveSnapshots, runMissedGoalAlerts, runDueSchedules, runWeeklyDigest } from '@/lib/server/insights-jobs';
import { processMyInvoisQueue } from '@/lib/payments/server/myinvois-queue';

export const dynamic = 'force-dynamic';

/**
 * Vercel cron calls this daily. It does not deploy by itself.
 * Set CRON_SECRET and send `Authorization: Bearer <secret>`.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : req.nextUrl.searchParams.get('secret') ?? '';
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Server is not configured.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const now = new Date();
  const missed = await runMissedGoalAlerts(now);
  const digest = await runWeeklyDigest(now);
  const schedules = await runDueSchedules(now);
  const snapshots = await refreshActiveSnapshots(now);
  const myInvois = await processMyInvoisQueue(now.getTime());
  return NextResponse.json({ ok: true, missed, digest, schedules, snapshots, myInvois, at: now.toISOString() });
}
