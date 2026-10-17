import { NextRequest, NextResponse } from 'next/server';
import { callerIsAdmin, isNextResponse, requireUser } from '@/lib/api-guard';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { moderateHeldPost } from '@/lib/server/alumni-network-store';
import { callerOwnsInstitution } from '@/lib/server/institution-activate';
import {
  addYearbookGallery,
  approveYearbookPage,
  institutionYearbook,
  releaseYearbook,
  saveYearbookStaff,
  yearbookFile,
} from '@/lib/server/yearbook-store';
import { readAudience } from '@/lib/yearbook';

export const dynamic = 'force-dynamic';

async function gate(req: NextRequest, institutionId: string) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const claims = { role: user.role, adminRole: user.adminRole };
  const owns = await callerOwnsInstitution(user.uid, institutionId);
  if (!owns && !(await callerIsAdmin(user.uid, user.email, claims))) {
    return NextResponse.json({ error: 'This academy is not on your account.' }, { status: 403 });
  }
  return user;
}

export async function GET(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Server is not configured.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const institutionId = req.nextUrl.searchParams.get('institutionId')?.trim() ?? '';
  if (!institutionId) return NextResponse.json({ error: 'Choose an academy.' }, { status: 400 });
  const user = await gate(req, institutionId);
  if (isNextResponse(user)) return user;
  const bookId = req.nextUrl.searchParams.get('bookId')?.trim() ?? '';
  return NextResponse.json(await institutionYearbook(institutionId, bookId));
}

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Server is not configured.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const institutionId = typeof body.institutionId === 'string' ? body.institutionId.trim() : '';
  if (!institutionId) return NextResponse.json({ error: 'Choose an academy.' }, { status: 400 });
  const user = await gate(req, institutionId);
  if (isNextResponse(user)) return user;
  const action = typeof body.action === 'string' ? body.action : '';
  const bookId = typeof body.bookId === 'string' ? body.bookId : '';

  if (action === 'staff') {
    const saved = await saveYearbookStaff({
      institutionId,
      bookId,
      template: body.template,
      lockOn: body.lockOn,
      principalMessage: body.principalMessage,
      teacherMessage: body.teacherMessage,
    });
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'approve') {
    const studentId = typeof body.studentId === 'string' ? body.studentId : '';
    const saved = await approveYearbookPage(institutionId, bookId, studentId);
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'release') {
    const saved = await releaseYearbook(institutionId, bookId);
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'gallery') {
    const saved = await addYearbookGallery({
      institutionId,
      bookId,
      caption: body.caption,
      imageUrl: body.imageUrl,
    });
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'pdf') {
    const saved = await yearbookFile(institutionId, bookId, readAudience(body.viewer || 'classmates'));
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'moderate') {
    const queueId = typeof body.queueId === 'string' ? body.queueId : '';
    const saved = await moderateHeldPost({ institutionId, queueId, release: body.release !== false });
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  return NextResponse.json({ error: 'Choose a step.' }, { status: 400 });
}
