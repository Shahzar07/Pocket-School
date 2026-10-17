import { NextRequest, NextResponse } from 'next/server';
import { callerIsAdmin, isNextResponse, requireUser } from '@/lib/api-guard';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { destinationDashboard } from '@/lib/server/learner-record-store';
import { callerOwnsInstitution } from '@/lib/server/institution-activate';
import { confirmVerification, schoolVerificationRequests } from '@/lib/server/job-tracker-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Server is not configured.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const institutionId = req.nextUrl.searchParams.get('institutionId')?.trim() ?? '';
  if (!institutionId) return NextResponse.json({ error: 'Choose an academy.' }, { status: 400 });
  const owns = await callerOwnsInstitution(user.uid, institutionId);
  if (!owns && !(await callerIsAdmin(user.uid, user.email, { role: user.role, adminRole: user.adminRole }))) {
    return NextResponse.json({ error: 'This academy is not on your account.' }, { status: 403 });
  }
  const board = await destinationDashboard(institutionId);
  const requests = await schoolVerificationRequests(institutionId);
  return NextResponse.json({ ...board, requests });
}

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Server is not configured.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const institutionId = typeof body.institutionId === 'string' ? body.institutionId.trim() : '';
  if (!institutionId) return NextResponse.json({ error: 'Choose an academy.' }, { status: 400 });
  const owns = await callerOwnsInstitution(user.uid, institutionId);
  if (!owns) return NextResponse.json({ error: 'This academy is not on your account.' }, { status: 403 });
  const saved = await confirmVerification({
    requestId: typeof body.requestId === 'string' ? body.requestId : '',
    actorId: user.uid,
    by: 'school',
    institutionId,
  });
  if ('error' in saved) return NextResponse.json(saved, { status: 403 });
  return NextResponse.json(saved);
}
