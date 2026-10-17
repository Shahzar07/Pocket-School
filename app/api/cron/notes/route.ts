import { NextRequest, NextResponse } from 'next/server';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { deliverNoteReminders, purgeNoteTrash } from '@/lib/notes/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Sends due note reminders outside quiet hours and clears trash older than 30 days. */
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
  const [reminders, trash] = await Promise.all([
    deliverNoteReminders(),
    purgeNoteTrash(),
  ]);
  return NextResponse.json({ reminders, trash });
}
