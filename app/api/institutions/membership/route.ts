import { NextRequest, NextResponse } from 'next/server';
import { callerIsAdmin, isNextResponse, rateLimit, requireUser } from '@/lib/api-guard';
import { callerOwnsInstitution } from '@/lib/server/institution-activate';
import { decideInstitutionMembership, recordSchoolInvite, requestInstitutionMembership } from '@/lib/server/institution-membership-api';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.action === 'invite-school') {
    const key = req.headers.get('x-forwarded-for') || 'local';
    if (!rateLimit(`school-invite:${key}`, 8, 60_000)) {
      return NextResponse.json({ error: 'Too many invites. Try again shortly.' }, { status: 429 });
    }
    try {
      const saved = await recordSchoolInvite({
        schoolName: typeof body.schoolName === 'string' ? body.schoolName : '',
        email: typeof body.email === 'string' ? body.email : '',
        country: typeof body.country === 'string' ? body.country : '',
        state: typeof body.state === 'string' ? body.state : '',
        role: typeof body.role === 'string' ? body.role : 'student',
      });
      return NextResponse.json(saved);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not record the invite.' }, { status: 400 });
    }
  }

  const user = await requireUser(req);
  if (isNextResponse(user)) return user;

  if (body.action === 'decide') {
    const institutionId = typeof body.institutionId === 'string' ? body.institutionId.trim() : '';
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const decision = body.decision === 'rejected' ? 'rejected' : body.decision === 'approved' ? 'approved' : '';
    if (!institutionId || !userId || !decision) {
      return NextResponse.json({ error: 'Choose a request and a decision.' }, { status: 400 });
    }
    const allowed = await callerIsAdmin(user.uid, user.email, user) || await callerOwnsInstitution(user.uid, institutionId);
    if (!allowed) return NextResponse.json({ error: 'Only the institution admin can decide this.' }, { status: 403 });
    try {
      const result = await decideInstitutionMembership({ actorId: user.uid, institutionId, userId, decision });
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not save the decision.' }, { status: 400 });
    }
  }

  const role = body.role === 'teacher' || body.role === 'parent' ? body.role : 'student';
  const institutionId = typeof body.institutionId === 'string' ? body.institutionId.trim() : '';
  if (!institutionId) return NextResponse.json({ status: 'independent', message: 'No school selected.' });
  const result = await requestInstitutionMembership({
    uid: user.uid,
    role,
    name: typeof body.name === 'string' ? body.name : '',
    email: typeof body.email === 'string' ? body.email : user.email || '',
    institutionId,
    inviteCode: typeof body.inviteCode === 'string' ? body.inviteCode : '',
  });
  return NextResponse.json(result);
}
