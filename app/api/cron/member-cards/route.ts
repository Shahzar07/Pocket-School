import { NextRequest, NextResponse } from 'next/server';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { backfillMemberNumbers } from '@/lib/cards/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Daily backfill for accounts that signed up before member numbers existed. */
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
  const result = await backfillMemberNumbers(40);
  return NextResponse.json(result);
}
