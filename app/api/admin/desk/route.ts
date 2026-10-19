import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, loadUser, requirePlatformAdmin } from '@/lib/api-guard';
import { isSuperDesk } from '@/lib/admin/desk';
import { ADMIN_SETUP_MESSAGE } from '@/lib/admin/desk-gate';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { ActionError } from '@/lib/server/actions';
import { actorFromProfile, exportDeskLog, loadAdminDesk, runDeskAction, searchDesk } from '@/lib/server/admin-desk';

export const dynamic = 'force-dynamic';

async function actorFor(uid: string) {
  const data = await loadUser(uid);
  return actorFromProfile(uid, data ?? undefined);
}

export async function GET(req: NextRequest) {
  const user = await requirePlatformAdmin(req);
  if (isNextResponse(user)) return user;
  if (!isAdminConfigured()) {
    return NextResponse.json({ configured: false, setupNeeded: true, message: ADMIN_SETUP_MESSAGE });
  }
  const actor = await actorFor(user.uid);
  if (!actor.staffRole) return NextResponse.json({ error: 'This account cannot use the admin desk.', code: 'FORBIDDEN' }, { status: 403 });
  const format = req.nextUrl.searchParams.get('export');
  if (format === 'csv' || format === 'pdf') {
    if (!isSuperDesk(actor)) return NextResponse.json({ error: 'Super admins export the activity chain.', code: 'FORBIDDEN' }, { status: 403 });
    try {
      const file = await exportDeskLog(format, {
        action: req.nextUrl.searchParams.get('action') ?? '',
        actor: req.nextUrl.searchParams.get('actor') ?? '',
      });
      return new NextResponse(Buffer.from(file.body), {
        headers: {
          'Content-Type': file.contentType,
          'Content-Disposition': `attachment; filename="${file.filename}"`,
          'X-Verification-Hash': file.verificationHash,
        },
      });
    } catch (error) {
      const message = error instanceof ActionError ? error.message : 'The export is coming soon.';
      return NextResponse.json({ error: message, code: 'BAD_REQUEST' }, { status: 400 });
    }
  }
  const q = req.nextUrl.searchParams.get('q') ?? '';
  if (q) return NextResponse.json(await searchDesk(actor, q));
  return NextResponse.json(await loadAdminDesk(actor));
}

export async function POST(req: NextRequest) {
  const user = await requirePlatformAdmin(req);
  if (isNextResponse(user)) return user;
  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: false, setupNeeded: true, message: ADMIN_SETUP_MESSAGE }, { status: 503 });
  }
  const actor = await actorFor(user.uid);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    return NextResponse.json(await runDeskAction(actor, body));
  } catch (error) {
    if (error instanceof ActionError) {
      const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'FORBIDDEN' ? 403 : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error(error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL' }, { status: 500 });
  }
}
