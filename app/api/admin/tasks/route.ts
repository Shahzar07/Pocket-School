import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, loadUser, requirePlatformAdmin } from '@/lib/api-guard';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { ADMIN_SETUP_MESSAGE } from '@/lib/admin/desk-gate';
import { actorFromProfile } from '@/lib/server/admin-desk';
import { ActionError } from '@/lib/server/actions';
import { actOnAdminTask, listAdminTasks, readStoredAdminPushPrefs } from '@/lib/server/admin-tasks';

export const dynamic = 'force-dynamic';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function GET(req: NextRequest) {
  const user = await requirePlatformAdmin(req);
  if (isNextResponse(user)) return user;
  if (!isAdminConfigured()) {
    return NextResponse.json({ configured: false, setupNeeded: true, message: ADMIN_SETUP_MESSAGE, tasks: [], prefs: null });
  }
  const profile = await loadUser(user.uid);
  const actor = actorFromProfile(user.uid, profile ?? undefined);
  if (!actor.staffRole) return NextResponse.json({ error: 'This account cannot use the Action Centre.', code: 'FORBIDDEN' }, { status: 403 });
  const [tasks, prefs] = await Promise.all([
    listAdminTasks(actor),
    readStoredAdminPushPrefs(user.uid),
  ]);
  return NextResponse.json({ tasks, prefs });
}

export async function POST(req: NextRequest) {
  const user = await requirePlatformAdmin(req);
  if (isNextResponse(user)) return user;
  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: false, setupNeeded: true, message: ADMIN_SETUP_MESSAGE }, { status: 503 });
  }
  const profile = await loadUser(user.uid);
  const actor = actorFromProfile(user.uid, profile ?? undefined);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const task = await actOnAdminTask(actor, user.email ?? str(profile?.email), {
      id: str(body.id),
      action: str(body.action),
      reason: str(body.reason),
      snoozedUntil: typeof body.snoozedUntil === 'number' ? body.snoozedUntil : undefined,
    });
    return NextResponse.json({ ok: true, task });
  } catch (error) {
    if (error instanceof ActionError) {
      const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'FORBIDDEN' ? 403 : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error(error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL' }, { status: 500 });
  }
}
