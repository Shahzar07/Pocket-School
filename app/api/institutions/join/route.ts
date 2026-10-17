import { NextRequest, NextResponse } from 'next/server';
import { callerIsAdmin, isNextResponse, rateLimit, requireUser } from '@/lib/api-guard';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { defaultJoinPolicy, readJoinConfig, type JoinAttempt } from '@/lib/institution-join';
import { callerOwnsInstitution } from '@/lib/server/institution-activate';
import {
  attachJoin,
  bulkMoveJoin,
  claimJoin,
  findInstitutionBySlug,
  joinAdminReport,
  leaveInstitution,
  linkParentChild,
  loadJoinConfig,
  offboardJoin,
  previewJoin,
  rolloverJoin,
  saveImportRoster,
  saveJoinSettings,
  uploadJoinRoster,
} from '@/lib/server/institution-join-store';

export const dynamic = 'force-dynamic';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function attemptFrom(body: Record<string, unknown>): JoinAttempt | { error: string } {
  const role = body.role === 'parent' ? 'parent' : body.role === 'student' ? 'student' : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
  if (!role) return { error: 'Choose student or parent.' };
  if (!EMAIL.test(email)) return { error: 'Enter a valid email.' };
  if (!name) return { error: 'Enter the name to show on the register.' };
  const dob = typeof body.dob === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dob) ? body.dob : '';
  return {
    role,
    email,
    name,
    dob,
    today: todayIso(),
    studentId: typeof body.studentId === 'string' ? body.studentId.trim().slice(0, 40) : '',
    inviteCode: typeof body.inviteCode === 'string' ? body.inviteCode.trim().slice(0, 16) : '',
    parentConsent: body.parentConsent === true,
    programmeId: typeof body.programmeId === 'string' ? body.programmeId.trim().slice(0, 40) : '',
    level: typeof body.level === 'string' ? body.level.trim().slice(0, 40) : '',
  };
}

async function owns(uid: string, email: string | undefined, institutionId: string, claims: { role?: string; adminRole?: string }): Promise<boolean> {
  if (await callerIsAdmin(uid, email, claims)) return true;
  return callerOwnsInstitution(uid, institutionId);
}

export async function GET(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ preview: true, policy: defaultJoinPolicy(), codes: [], inviteCodes: [] });
  }
  const institutionId = req.nextUrl.searchParams.get('institutionId')?.trim() ?? '';
  if (institutionId) {
    const user = await requireUser(req);
    if (isNextResponse(user)) return user;
    if (!(await owns(user.uid, user.email, institutionId, user))) {
      return NextResponse.json({ error: 'Sign in as this academy’s admin.' }, { status: 403 });
    }
    const report = await joinAdminReport(institutionId);
    return NextResponse.json(report);
  }
  const slug = req.nextUrl.searchParams.get('slug')?.trim() ?? '';
  const academy = slug ? await findInstitutionBySlug(slug) : null;
  if (!academy) return NextResponse.json({ error: 'This academy page is not set up yet.' }, { status: 404 });
  const config = await loadJoinConfig(academy.id);
  return NextResponse.json({
    name: academy.name,
    slug: academy.slug,
    policy: config.policy,
    domains: config.policy.emailDomains,
    joinPolicy: config.policy.verification ?? null,
    codes: config.codes.map((code) => ({ code: code.code, level: code.level, className: code.className })),
    overage: config.overage,
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Academy join needs the server account.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = typeof body.action === 'string' ? body.action : '';
  const origin = req.nextUrl.origin;

  if (action === 'decide' || action === 'claim') {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    if (!rateLimit(`join:${ip}`, 30, 60_000)) {
      return NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429 });
    }
    const slug = typeof body.slug === 'string' ? body.slug : '';
    if (action === 'claim') {
      const token = typeof body.token === 'string' ? body.token : '';
      const claimed = await claimJoin(slug, token, origin);
      if ('error' in claimed) return NextResponse.json(claimed, { status: 400 });
      return NextResponse.json(claimed);
    }
    const attempt = attemptFrom(body);
    if ('error' in attempt) return NextResponse.json(attempt, { status: 400 });
    const preview = await previewJoin(slug, attempt);
    if ('error' in preview) return NextResponse.json(preview, { status: 404 });
    return NextResponse.json(preview);
  }

  const user = await requireUser(req);
  if (isNextResponse(user)) return user;

  if (action === 'attach') {
    const attempt = attemptFrom(body);
    if ('error' in attempt) return NextResponse.json(attempt, { status: 400 });
    const result = await attachJoin({
      uid: user.uid,
      slug: typeof body.slug === 'string' ? body.slug : '',
      attempt,
      childStudentNumber: typeof body.childStudentNumber === 'string' ? body.childStudentNumber : '',
      takeCredit: body.takeCredit !== false,
    });
    if ('error' in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  }

  if (action === 'leave') {
    const left = await leaveInstitution(user.uid);
    if ('error' in left) return NextResponse.json(left, { status: 400 });
    return NextResponse.json(left);
  }

  if (action === 'link') {
    const studentNumber = typeof body.studentNumber === 'string' ? body.studentNumber : '';
    const institutionId = typeof body.institutionId === 'string' ? body.institutionId : '';
    const name = typeof body.name === 'string' ? body.name : '';
    const linked = await linkParentChild(user.uid, studentNumber, institutionId, name);
    if ('error' in linked) return NextResponse.json(linked, { status: 400 });
    return NextResponse.json({ links: linked });
  }

  const institutionId = typeof body.institutionId === 'string' ? body.institutionId.trim() : '';
  if (!institutionId || !(await owns(user.uid, user.email, institutionId, user))) {
    return NextResponse.json({ error: 'Sign in as this academy’s admin.' }, { status: 403 });
  }
  const academy = typeof body.slug === 'string' ? await findInstitutionBySlug(body.slug) : null;
  const name = academy?.name || 'Academy';
  const slug = academy?.slug || '';

  if (action === 'save') {
    const saved = await saveJoinSettings(institutionId, readJoinConfig(body.config), user.uid);
    return NextResponse.json({ config: saved });
  }
  if (action === 'importRoster') {
    const saved = await saveImportRoster(institutionId, body.roster ?? body);
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'roster') {
    const csv = typeof body.csv === 'string' ? body.csv.slice(0, 200_000) : '';
    if (!slug) return NextResponse.json({ error: 'Publish a subdomain before sending claim links.' }, { status: 400 });
    const uploaded = await uploadJoinRoster(institutionId, csv, origin, slug, name);
    return NextResponse.json(uploaded);
  }
  if (action === 'rollover') {
    return NextResponse.json(await rolloverJoin(institutionId, user.uid));
  }
  if (action === 'bulkMove') {
    const studentIds = Array.isArray(body.studentIds) ? body.studentIds.filter((id): id is string => typeof id === 'string') : [];
    const level = typeof body.level === 'string' ? body.level.trim().slice(0, 40) : '';
    const className = typeof body.className === 'string' ? body.className.trim().slice(0, 40) : '';
    if (!level) return NextResponse.json({ error: 'Choose the next level name.' }, { status: 400 });
    const rows = await bulkMoveJoin(institutionId, studentIds, level, className);
    return NextResponse.json({ rows });
  }
  if (action === 'offboard') {
    const studentIds = Array.isArray(body.studentIds) ? body.studentIds.filter((id): id is string => typeof id === 'string') : [];
    const rows = await offboardJoin(institutionId, studentIds);
    return NextResponse.json({ rows });
  }
  return NextResponse.json({ error: 'Choose a join action.' }, { status: 400 });
}
