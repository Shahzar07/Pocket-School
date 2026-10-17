import { NextRequest, NextResponse } from 'next/server';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { runAlertMaintenance } from '@/lib/server/emergency';

export const dynamic = 'force-dynamic';

/** Pauses sharing when a review lapses, and reminds staff about authorities. Bearer CRON_SECRET. */
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
  return NextResponse.json({ ok: true, ...(await runAlertMaintenance(Date.now())) });
}
