import { NextRequest, NextResponse } from 'next/server';
import { callerIsAdmin, isNextResponse, requireUser } from '@/lib/api-guard';
import {
  getProgressSettings,
  parseProgressSettings,
  saveProgressSettings,
  viewerFromProfile,
} from '@/lib/alerts/progress-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const platformAdmin = await callerIsAdmin(user.uid, user.email, user);
  const viewer = await viewerFromProfile(user.uid, user.email || '', platformAdmin);
  const requested = req.nextUrl.searchParams.get('institutionId') ?? '';
  if (requested === 'platform') {
    if (!platformAdmin) return NextResponse.json({ error: 'Admin access required.', code: 'FORBIDDEN' }, { status: 403 });
    return NextResponse.json({ id: 'platform', settings: await getProgressSettings(null) });
  }
  const institutionId = requested || viewer.institutionId || '';
  if (!institutionId) return NextResponse.json({ error: 'This account is not attached to an institution.', code: 'NO_INSTITUTION' }, { status: 400 });
  const own = viewer.role === 'institution_admin' && viewer.institutionId === institutionId;
  if (!platformAdmin && !own) return NextResponse.json({ error: 'You cannot open these settings.', code: 'FORBIDDEN' }, { status: 403 });
  return NextResponse.json({ id: institutionId, settings: await getProgressSettings(institutionId) });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const platformAdmin = await callerIsAdmin(user.uid, user.email, user);
  const viewer = await viewerFromProfile(user.uid, user.email || '', platformAdmin);
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const requested = body && typeof body.institutionId === 'string' ? body.institutionId.trim() : '';
  const id = requested === 'platform' ? 'platform' : requested || viewer.institutionId || '';
  if (!id) return NextResponse.json({ error: 'Choose an institution.', code: 'NO_INSTITUTION' }, { status: 400 });
  if (id === 'platform' && !platformAdmin) {
    return NextResponse.json({ error: 'Admin access required.', code: 'FORBIDDEN' }, { status: 403 });
  }
  const own = viewer.role === 'institution_admin' && viewer.institutionId === id;
  if (!platformAdmin && !own) return NextResponse.json({ error: 'You cannot change these settings.', code: 'FORBIDDEN' }, { status: 403 });
  const settings = parseProgressSettings(body?.settings ?? body);
  await saveProgressSettings(id, settings, viewer);
  return NextResponse.json({ id, settings });
}
