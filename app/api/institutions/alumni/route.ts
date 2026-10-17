import { NextRequest, NextResponse } from 'next/server';
import { alumniCsv, alumniStats, readAlumniPolicy } from '@/lib/alumni';
import { callerIsAdmin, isNextResponse, requireUser } from '@/lib/api-guard';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import {
  beginAlumni,
  listAlumni,
  loadAlumniPolicy,
  saveAlumniPolicy,
  sendAlumniLetters,
} from '@/lib/server/alumni-store';
import { callerOwnsInstitution } from '@/lib/server/institution-activate';

export const dynamic = 'force-dynamic';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Server is not configured.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const institutionId = req.nextUrl.searchParams.get('institutionId')?.trim() ?? '';
  if (!institutionId) return NextResponse.json({ error: 'Choose an academy.' }, { status: 400 });
  const claims = { role: user.role, adminRole: user.adminRole };
  const owns = await callerOwnsInstitution(user.uid, institutionId);
  if (!owns && !(await callerIsAdmin(user.uid, user.email, claims))) {
    return NextResponse.json({ error: 'This academy is not on your account.' }, { status: 403 });
  }
  const [people, policy, academy] = await Promise.all([
    listAlumni(institutionId),
    loadAlumniPolicy(institutionId),
    adminDb().doc(`institutions/${institutionId}`).get(),
  ]);
  const stats = alumniStats(people);
  const name = typeof academy.get('name') === 'string' ? academy.get('name') : '';
  if (req.nextUrl.searchParams.get('export') === 'csv') {
    return new NextResponse(alumniCsv(people), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8' },
    });
  }
  return NextResponse.json({ people, policy, stats, name });
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
  const claims = { role: user.role, adminRole: user.adminRole };
  const owns = await callerOwnsInstitution(user.uid, institutionId);
  if (!owns && !(await callerIsAdmin(user.uid, user.email, claims))) {
    return NextResponse.json({ error: 'This academy is not on your account.' }, { status: 403 });
  }
  const action = typeof body.action === 'string' ? body.action : '';
  if (action === 'save') {
    const policy = await saveAlumniPolicy(institutionId, readAlumniPolicy(body.policy), user.uid);
    return NextResponse.json({ policy });
  }
  if (action === 'mark') {
    const rows = Array.isArray(body.people) ? body.people : [];
    const marked = [];
    for (const row of rows.slice(0, 100)) {
      if (!row || typeof row !== 'object') continue;
      const item = row as Record<string, unknown>;
      const email = typeof item.email === 'string' ? item.email.trim().toLowerCase() : '';
      const studentId = typeof item.studentId === 'string' ? item.studentId.trim() : '';
      if (!email && !studentId) continue;
      marked.push(await beginAlumni({
        institutionId,
        studentId,
        schoolStudentId: typeof item.schoolStudentId === 'string' ? item.schoolStudentId.trim().slice(0, 40) : '',
        name: typeof item.name === 'string' ? item.name.trim().slice(0, 120) : '',
        email,
        studentNumber: typeof item.studentNumber === 'string' ? item.studentNumber.trim().slice(0, 20) : '',
        level: typeof item.level === 'string' ? item.level.trim().slice(0, 40) : '',
        reason: 'marked',
        today: todayIso(),
      }));
    }
    return NextResponse.json({ marked: marked.length });
  }
  if (action === 'newsletter') {
    const note = typeof body.note === 'string' ? body.note : '';
    const sent = await sendAlumniLetters(institutionId, note, user.uid);
    return NextResponse.json({ sent });
  }
  return NextResponse.json({ error: 'Choose a step.' }, { status: 400 });
}
