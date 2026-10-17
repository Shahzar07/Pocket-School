import { NextRequest, NextResponse } from 'next/server';
import { alumniCsv, alumniStats, readAlumniPolicy } from '@/lib/alumni';
import type { ReadyGraduate } from '@/lib/graduation';
import { callerIsAdmin, isNextResponse, requireUser } from '@/lib/api-guard';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import {
  beginAlumni,
  confirmGraduations,
  listAlumni,
  loadAlumniPolicy,
  previewBulkGraduation,
  recordGraduationSuggestions,
  saveAlumniPolicy,
  sendAlumniLetters,
  undoGraduation,
} from '@/lib/server/alumni-store';
import {
  approveMentorship,
  createAlumniEvent,
  moderateHeldPost,
  networkDesk,
  releaseScheduledAlumni,
  saveCampaign,
} from '@/lib/server/alumni-network-store';
import { callerOwnsInstitution } from '@/lib/server/institution-activate';
import { listInstitutionAlumniClaims, reviewAlumniClaim } from '@/lib/server/alumni-claim-store';

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
  const staff = { role: user.role, adminRole: user.adminRole };
  const owns = await callerOwnsInstitution(user.uid, institutionId);
  if (!owns && !(await callerIsAdmin(user.uid, user.email, staff))) {
    return NextResponse.json({ error: 'This academy is not on your account.' }, { status: 403 });
  }
  const today = todayIso();
  await releaseScheduledAlumni(today, 10);
  const [people, policy, academy, suggestions, network, claims] = await Promise.all([
    listAlumni(institutionId),
    loadAlumniPolicy(institutionId),
    adminDb().doc(`institutions/${institutionId}`).get(),
    recordGraduationSuggestions(institutionId, today),
    networkDesk(institutionId),
    listInstitutionAlumniClaims(institutionId),
  ]);
  const stats = alumniStats(people);
  const name = typeof academy.get('name') === 'string' ? academy.get('name') : '';
  if (req.nextUrl.searchParams.get('export') === 'csv') {
    return new NextResponse(alumniCsv(people), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8' },
    });
  }
  return NextResponse.json({ people, policy, stats, name, suggestions: suggestions.people, network, claims });
}

function readyPeople(body: Record<string, unknown>): ReadyGraduate[] {
  const rows = Array.isArray(body.people) ? body.people : [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const item = row as Record<string, unknown>;
    const email = typeof item.email === 'string' ? item.email.trim().toLowerCase() : '';
    const studentId = typeof item.studentId === 'string' ? item.studentId.trim() : '';
    if (!email && !studentId) return [];
    return [{
      studentId,
      schoolStudentId: typeof item.schoolStudentId === 'string' ? item.schoolStudentId.trim().slice(0, 40) : '',
      name: typeof item.name === 'string' ? item.name.trim().slice(0, 120) : '',
      email,
      studentNumber: typeof item.studentNumber === 'string' ? item.studentNumber.trim().slice(0, 20) : '',
      level: typeof item.level === 'string' ? item.level.trim().slice(0, 40) : '',
    }];
  }).slice(0, 100);
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
  if (action === 'preview') {
    const preview = await previewBulkGraduation(institutionId, todayIso(), readyPeople(body));
    return NextResponse.json(preview);
  }
  if (action === 'confirm') {
    const ready = readyPeople(body);
    const people = ready.length > 0 ? ready : (await recordGraduationSuggestions(institutionId, todayIso())).people;
    const marked = await confirmGraduations(institutionId, people, todayIso(), user.uid);
    return NextResponse.json({ marked });
  }
  if (action === 'undo') {
    const alumniId = typeof body.alumniId === 'string' && body.alumniId.trim()
      ? body.alumniId.trim()
      : typeof body.studentId === 'string' ? body.studentId.trim() : '';
    if (!alumniId) return NextResponse.json({ error: 'Choose a graduate.' }, { status: 400 });
    const result = await undoGraduation(institutionId, alumniId, todayIso(), user.uid);
    if ('error' in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  }
  if (action === 'newsletter') {
    const note = typeof body.note === 'string' ? body.note : '';
    const sent = await sendAlumniLetters(institutionId, note, user.uid);
    return NextResponse.json({ sent });
  }
  if (action === 'campaign') {
    const saved = await saveCampaign({
      institutionId,
      kind: body.kind,
      note: body.note,
      filter: body.filter,
      sendOn: body.sendOn,
      today: todayIso(),
    });
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'event') {
    const created = await createAlumniEvent({
      institutionId,
      title: body.title,
      when: body.when,
      place: body.place,
    });
    if ('error' in created) return NextResponse.json(created, { status: 400 });
    return NextResponse.json(created);
  }
  if (action === 'moderate-post') {
    const queueId = typeof body.queueId === 'string' ? body.queueId : '';
    const result = await moderateHeldPost({ institutionId, queueId, release: body.release !== false });
    if ('error' in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  }
  if (action === 'review-claim') {
    const studentId = typeof body.studentId === 'string' ? body.studentId : '';
    const result = await reviewAlumniClaim(institutionId, studentId, body.approve !== false);
    if ('error' in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  }
  if (action === 'approve-mentor') {
    const mentorshipId = typeof body.mentorshipId === 'string' ? body.mentorshipId : '';
    const result = await approveMentorship(institutionId, mentorshipId);
    if ('error' in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: 'Choose a step.' }, { status: 400 });
}
