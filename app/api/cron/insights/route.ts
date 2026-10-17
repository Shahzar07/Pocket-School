import { NextRequest, NextResponse } from 'next/server';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { refreshActiveSnapshots, runMissedGoalAlerts, runDueSchedules, runWeeklyDigest } from '@/lib/server/insights-jobs';
import { processMyInvoisQueue } from '@/lib/payments/server/myinvois-queue';
import { runDailyProgressAlerts } from '@/lib/alerts/progress-server';

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
  let progress: { checked: number; opened: number; resolved: number; error?: string } = { checked: 0, opened: 0, resolved: 0 };
  try {
    progress = await runDailyProgressAlerts(now.getTime());
  } catch (error) {
    progress = { checked: 0, opened: 0, resolved: 0, error: error instanceof Error ? error.message : 'Progress alerts failed' };
  }
  return NextResponse.json({ ok: true, missed, digest, schedules, snapshots, myInvois, progress, at: now.toISOString() });
}
