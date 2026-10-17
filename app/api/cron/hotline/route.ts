import { NextRequest, NextResponse } from 'next/server';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { escalateCriticalDesk, sendDueCheckIns } from '@/lib/server/bullying';
import { escalateDueTickets, remindAuthorityTickets } from '@/lib/server/hotline';
import { escalateUnackedDanger } from '@/lib/server/safety';

export const dynamic = 'force-dynamic';

/** Vercel cron. Does not deploy by itself. Authorization: Bearer CRON_SECRET. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Server is not configured.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const now = Date.now();
  const result = await escalateDueTickets(now);
  const reminders = await remindAuthorityTickets(now);
  const danger = await escalateUnackedDanger(now);
  const desk = await escalateCriticalDesk(now);
  const checkIns = await sendDueCheckIns(now);
  return NextResponse.json({ ok: true, ...result, ...reminders, ...danger, ...desk, ...checkIns });
}
