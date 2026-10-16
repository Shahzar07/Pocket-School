import { NextRequest, NextResponse } from 'next/server';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { advanceOpenBills } from '@/lib/server/institution-billing';

export const dynamic = 'force-dynamic';

/** Daily dunning. Send `Authorization: Bearer <CRON_SECRET>`. Rules are not deployed from here. */
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
  const result = await advanceOpenBills();
  return NextResponse.json({ ok: true, ...result });
}
