import { NextResponse } from 'next/server';
import { isQuietHour } from '@/lib/reads/quiet';

export const runtime = 'nodejs';

/**
 * Validate a reading tick. Do not persist it and do not trust a client
 * "credited" flag. Quiet hours (22:00–05:59 local) are reported back so
 * the reader can say the minutes will not count. The ledger waits for
 * the Admin SDK.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    bookId?: string;
    activeSeconds?: number;
    localHour?: number;
  } | null;

  const hour = body?.localHour;
  if (!body?.bookId || typeof body.activeSeconds !== 'number' || typeof hour !== 'number') {
    return NextResponse.json({ credited: false, reason: 'invalid' }, { status: 400 });
  }
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return NextResponse.json({ credited: false, reason: 'invalid' }, { status: 400 });
  }
  if (body.activeSeconds <= 0 || body.activeSeconds > 120) {
    return NextResponse.json({ credited: false, reason: 'invalid' }, { status: 400 });
  }

  const probe = new Date();
  probe.setHours(hour, 30, 0, 0);
  const quiet = isQuietHour(probe);
  return NextResponse.json({
    credited: false,
    reason: quiet ? 'quiet_hours' : 'ledger_pending',
    quiet,
  });
}
