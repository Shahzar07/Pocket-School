import { NextRequest, NextResponse } from 'next/server';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { runAdminTaskCron } from '@/lib/server/admin-tasks';

export const dynamic = 'force-dynamic';

/** Vercel cron. Wakes snoozed tasks and sends admin digests. Authorization: Bearer CRON_SECRET. */
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
  const result = await runAdminTaskCron(Date.now());
  return NextResponse.json({ ok: true, ...result });
}
