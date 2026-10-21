import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requirePlatformAdmin } from '@/lib/api-guard';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { ADMIN_SETUP_MESSAGE } from '@/lib/admin/desk-gate';
import { ActionError } from '@/lib/server/actions';
import { readStoredAdminPushPrefs, saveAdminPushPrefs } from '@/lib/server/admin-tasks';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await requirePlatformAdmin(req);
  if (isNextResponse(user)) return user;
  if (!isAdminConfigured()) {
    return NextResponse.json({ configured: false, setupNeeded: true, message: ADMIN_SETUP_MESSAGE, prefs: null });
  }
  return NextResponse.json({ prefs: await readStoredAdminPushPrefs(user.uid) });
}

export async function POST(req: NextRequest) {
  const user = await requirePlatformAdmin(req);
  if (isNextResponse(user)) return user;
  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: false, setupNeeded: true, message: ADMIN_SETUP_MESSAGE }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as unknown;
  try {
    const prefs = await saveAdminPushPrefs(user.uid, body);
    return NextResponse.json({ ok: true, prefs });
  } catch (error) {
    if (error instanceof ActionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL' }, { status: 500 });
  }
}
