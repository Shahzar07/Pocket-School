import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, loadUser, requireUser } from '@/lib/api-guard';
import { ActionError } from '@/lib/server/actions';
import {
  approveMembershipByCode,
  confirmInstitutionParentRequest,
  listInstitutionParentRequests,
  lookupStudent,
  requestParentLink,
} from '@/lib/server/student-pass';
import { studentCodeFromScan } from '@/lib/student-number';

export const dynamic = 'force-dynamic';

function statusFor(code: string): number {
  if (code === 'FORBIDDEN') return 403;
  if (code === 'NOT_FOUND') return 404;
  return 400;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req, { limit: 30, windowMs: 60_000 });
  if (isNextResponse(user)) return user;
  try {
    const requests = await listInstitutionParentRequests(user.uid);
    return NextResponse.json({ requests });
  } catch (error) {
    if (error instanceof ActionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: statusFor(error.code) });
    }
    console.error(error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req, { limit: 20, windowMs: 60_000 });
  if (isNextResponse(user)) return user;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = text(body.action);
    const code = studentCodeFromScan(text(body.code));
    if (action === 'lookup' || action === 'membership') {
      const actor = await loadUser(user.uid);
      const institutionId = typeof actor?.institutionId === 'string' ? actor.institutionId : '';
      if (action === 'membership') {
        const card = await approveMembershipByCode(user.uid, code, body.level);
        return NextResponse.json({
          card: { studentNumber: card.studentNumber, name: card.name, level: card.level, photoUrl: card.photoUrl, membership: card.membership },
          message: 'Membership approved.',
        });
      }
      const card = await lookupStudent(code, institutionId);
      return NextResponse.json({
        card: { studentNumber: card.studentNumber, name: card.name, level: card.level, photoUrl: card.photoUrl, membership: card.membership },
      });
    }
    if (action === 'parent') {
      const result = await requestParentLink(user.uid, code);
      return NextResponse.json(result);
    }
    if (action === 'confirm') {
      await confirmInstitutionParentRequest(user.uid, text(body.requestId));
      return NextResponse.json({ ok: true, message: 'Link confirmed. The parent can see progress and Parent Explainer.' });
    }
    return NextResponse.json({ error: 'Choose a join action.', code: 'VALIDATION' }, { status: 400 });
  } catch (error) {
    if (error instanceof ActionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: statusFor(error.code) });
    }
    console.error(error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL' }, { status: 500 });
  }
}
