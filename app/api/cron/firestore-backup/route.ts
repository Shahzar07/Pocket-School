import { NextRequest, NextResponse } from 'next/server';
import { scheduledFirestoreExport } from '@/lib/server/firestore-backup';

export const dynamic = 'force-dynamic';

/**
 * Not scheduled. FIRESTORE_BACKUP_ENABLED stays unset until Harry approves
 * the Blaze-plan bucket. A bearer CRON_SECRET would still be required.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await scheduledFirestoreExport();
  return NextResponse.json(result, { status: result.enabled ? 200 : 503 });
}
