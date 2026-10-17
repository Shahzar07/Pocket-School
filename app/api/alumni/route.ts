import { NextRequest, NextResponse } from 'next/server';
import { transcriptLines } from '@/lib/alumni';
import { isNextResponse, rateLimit, requireUser } from '@/lib/api-guard';
import { deletionClosed } from '@/lib/account-settings';
import { isAdminConfigured, adminDb } from '@/lib/firebase-admin';
import { askSchool, findCountBySlug, honourHolderDeletion, readPublicAlumni, setAlumniPublic } from '@/lib/server/alumni-store';

export const dynamic = 'force-dynamic';

function ipOf(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}

export async function GET(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ preview: true, alumni: 0, profile: null });
  }
  if (!rateLimit(`alumni:${ipOf(req)}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429 });
  }
  const number = req.nextUrl.searchParams.get('number')?.trim() ?? '';
  if (number) {
    const profile = await readPublicAlumni(number);
    return NextResponse.json({ profile });
  }
  const slug = req.nextUrl.searchParams.get('slug')?.trim().toLowerCase() ?? '';
  if (slug) {
    const count = await findCountBySlug(slug);
    return NextResponse.json(count);
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const snap = await adminDb().doc(`users/${user.uid}`).get();
  return NextResponse.json({
    alumniOf: snap.get('alumniOf') ?? '',
    alumniName: snap.get('alumniName') ?? '',
    alumniGraceEnds: snap.get('alumniGraceEnds') ?? '',
    alumniDiscount: snap.get('alumniDiscount') ?? 0,
    alumniPublic: snap.get('alumniPublic') === true,
    institutionAccess: snap.get('institutionAccess') ?? '',
    studentNumber: snap.get('studentNumber') ?? '',
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Server is not configured.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = typeof body.action === 'string' ? body.action : '';
  if (action === 'public') {
    const profile = await setAlumniPublic(user.uid, body.optIn === true);
    return NextResponse.json({ profile, optIn: body.optIn === true });
  }
  if (action === 'ask') {
    const title = typeof body.title === 'string' ? body.title : '';
    return NextResponse.json(await askSchool(user.uid, title));
  }
  if (action === 'transcript') {
    const snap = await adminDb().doc(`users/${user.uid}`).get();
    const rows = Array.isArray(body.rows) ? body.rows.flatMap((row) => {
      if (!row || typeof row !== 'object') return [];
      const item = row as { title?: unknown; status?: unknown };
      const title = typeof item.title === 'string' ? item.title.trim().slice(0, 80) : '';
      if (!title) return [];
      return [{ title, status: typeof item.status === 'string' ? item.status.trim().slice(0, 40) : 'Completed' }];
    }).slice(0, 24) : [];
    const studentNumber = typeof snap.get('studentNumber') === 'string' ? snap.get('studentNumber') as string : '';
    const lines = transcriptLines({
      name: typeof snap.get('name') === 'string' ? snap.get('name') as string : '',
      studentNumber,
      institutionName: typeof snap.get('alumniName') === 'string' ? snap.get('alumniName') as string : 'Poket School',
      rows,
      verifyUrl: `https://poketschool.ai/p/${encodeURIComponent(studentNumber)}`,
    });
    return NextResponse.json({ lines });
  }
  if (action === 'honour-deletion') {
    const snap = await adminDb().doc(`users/${user.uid}`).get();
    const request = snap.get('deletionRequest');
    const scheduled = request && typeof request === 'object' && typeof (request as { scheduledFor?: unknown }).scheduledFor === 'number'
      ? { requestedAt: 0, scheduledFor: (request as { scheduledFor: number }).scheduledFor }
      : null;
    if (!deletionClosed(scheduled, Date.now())) {
      return NextResponse.json({ updated: 0 });
    }
    const updated = await honourHolderDeletion(user.uid);
    return NextResponse.json({ updated });
  }
  return NextResponse.json({ error: 'Choose a step.' }, { status: 400 });
}
