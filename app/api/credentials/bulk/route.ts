import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { bulkIssue, issuerAccess } from '@/lib/server/badge-issue';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Bulk issuance needs the server account.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const access = await issuerAccess(user.uid, user.email, user);
  if (!access) return NextResponse.json({ error: 'School or platform admins can issue certificates.', code: 'FORBIDDEN' }, { status: 403 });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const students = Array.isArray(body.students)
    ? body.students.filter((item): item is string => typeof item === 'string')
    : typeof body.students === 'string'
      ? body.students.split(/[\s,]+/)
      : [];
  const courseId = typeof body.courseId === 'string' ? body.courseId.trim() : '';
  if (!courseId) return NextResponse.json({ error: 'Choose a course.', code: 'INVALID' }, { status: 400 });
  const result = await bulkIssue({
    callerId: user.uid,
    callerEmail: user.email,
    actorRole: access.actorRole,
    institutionId: access.institutionId,
    schoolOnly: access.school && !access.admin,
    courseId,
    moduleId: typeof body.moduleId === 'string' ? body.moduleId.trim() : '',
    students,
  });
  return NextResponse.json(result);
}
