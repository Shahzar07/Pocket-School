import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { isAdminConfigured } from '@/lib/firebase-admin';
import {
  alumniClaimHome,
  approveChildAlumniClaim,
  postUnverifiedAlumni,
  releaseUnverifiedPost,
  requestAlumniSchool,
  searchAlumniSchools,
} from '@/lib/server/alumni-claim-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Server is not configured.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const user = await requireUser(req, { limit: 60, windowMs: 60_000 });
  if (isNextResponse(user)) return user;
  const query = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (query) return NextResponse.json({ schools: await searchAlumniSchools(query) });
  return NextResponse.json(await alumniClaimHome(user.uid));
}

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Server is not configured.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const user = await requireUser(req, { limit: 20, windowMs: 60_000 });
  if (isNextResponse(user)) return user;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = typeof body.action === 'string' ? body.action : 'request';
  if (action === 'approve-child') {
    const result = await approveChildAlumniClaim(
      user.uid,
      typeof body.childId === 'string' ? body.childId : '',
      typeof body.claimId === 'string' ? body.claimId : '',
    );
    if ('error' in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  }
  if (action === 'post') {
    const result = await postUnverifiedAlumni({
      uid: user.uid,
      schoolKey: typeof body.schoolKey === 'string' ? body.schoolKey : '',
      body: body.body,
    });
    if ('error' in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  }
  if (action === 'release') {
    const result = await releaseUnverifiedPost({
      uid: user.uid,
      schoolKey: typeof body.schoolKey === 'string' ? body.schoolKey : '',
      postId: typeof body.postId === 'string' ? body.postId : '',
    });
    if ('error' in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  }
  const result = await requestAlumniSchool(user.uid, body);
  if ('error' in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
