import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, loadUser, rateLimit, requireUser } from '@/lib/api-guard';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { resolveStaffRole } from '@/lib/admin-console';
import { isSuperAdminEmail } from '@/lib/roles';
import {
  activityCsv,
  clientMayReport,
  filterActivity,
  isActivityAction,
  isPublicAuditAction,
  requestClient,
} from '@/lib/audit/model';
import {
  getRetentionDays,
  listActivity,
  listInstitutionActivity,
  listOwnAuth,
  purgeExpiredActivity,
  recordActivity,
  setRetentionDays,
} from '@/lib/audit/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function actorRole(uid: string, email?: string): Promise<string> {
  const profile = await loadUser(uid);
  const role = typeof profile?.role === 'string' ? profile.role : '';
  const staff = resolveStaffRole({
    email,
    role,
    adminRole: typeof profile?.adminRole === 'string' ? profile.adminRole : '',
  });
  return staff || role || 'student';
}

async function superAdmin(user: { uid: string; email?: string; role?: string; adminRole?: string }): Promise<boolean> {
  if (isSuperAdminEmail(user.email)) return true;
  if (user.adminRole === 'super_admin') return true;
  if (user.role && user.role !== 'admin') return false;
  if (user.adminRole && user.adminRole !== 'super_admin') return false;
  return (await actorRole(user.uid, user.email)) === 'super_admin';
}

export async function GET(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Activity log needs the server account.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const scope = req.nextUrl.searchParams.get('scope') ?? 'mine';
  if (scope === 'institution') {
    const profile = await loadUser(user.uid);
    const role = typeof profile?.role === 'string' ? profile.role : '';
    const ownInstitution = typeof profile?.institutionId === 'string' ? profile.institutionId : '';
    const requested = req.nextUrl.searchParams.get('institutionId') || ownInstitution;
    const platform = role === 'admin' || await superAdmin(user);
    if (!platform && role !== 'institution_admin') {
      return NextResponse.json({ error: 'This activity log is for the institution.', code: 'FORBIDDEN' }, { status: 403 });
    }
    if (!requested || (!platform && requested !== ownInstitution)) {
      return NextResponse.json({ error: 'That activity log is for another institution.', code: 'FORBIDDEN' }, { status: 403 });
    }
    const events = await listInstitutionActivity(requested);
    return NextResponse.json({ events, institutionId: requested });
  }
  if (scope !== 'all') {
    const events = await listOwnAuth(user.uid);
    return NextResponse.json({ events });
  }
  if (!(await superAdmin(user))) {
    return NextResponse.json({ error: 'Super admins can read the activity log.', code: 'FORBIDDEN' }, { status: 403 });
  }
  const events = filterActivity(await listActivity(), {
    q: req.nextUrl.searchParams.get('q') ?? '',
    category: req.nextUrl.searchParams.get('category') ?? '',
    action: req.nextUrl.searchParams.get('action') ?? '',
    actor: req.nextUrl.searchParams.get('actor') ?? '',
    target: req.nextUrl.searchParams.get('target') ?? '',
    from: Number(req.nextUrl.searchParams.get('from')) || undefined,
    to: Number(req.nextUrl.searchParams.get('to')) || undefined,
  });
  if (req.nextUrl.searchParams.get('format') === 'csv') {
    return new NextResponse(activityCsv(events), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="poket-school-activity.csv"',
      },
    });
  }
  return NextResponse.json({ events, retentionDays: await getRetentionDays() });
}

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Activity log needs the server account.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = typeof body.action === 'string' ? body.action : '';
  const client = requestClient(req.headers);

  if (isPublicAuditAction(action)) {
    if (!rateLimit(`audit-public:${client.ip || 'unknown'}`, 20, 60_000)) {
      return NextResponse.json({ error: 'Too many attempts.', code: 'RATE_LIMIT' }, { status: 429 });
    }
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 200) : '';
    await recordActivity({
      action,
      actorId: 'anonymous',
      actorEmail: '',
      actorRole: 'anonymous',
      ip: client.ip,
      device: client.device,
      targetType: 'account',
      targetId: email || 'unknown',
      targetLabel: email,
    });
    return NextResponse.json({ ok: true });
  }

  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const role = await actorRole(user.uid, user.email);

  if (action === 'retention.set' || action === 'retention.purge') {
    if (!(await superAdmin(user))) {
      return NextResponse.json({ error: 'Super admins set the retention window.', code: 'FORBIDDEN' }, { status: 403 });
    }
    const actor = {
      action,
      actorId: user.uid,
      actorEmail: user.email || '',
      actorRole: role,
      ip: client.ip,
      device: client.device,
      targetType: 'audit_settings',
      targetId: 'retention',
    };
    if (action === 'retention.purge') {
      return NextResponse.json(await purgeExpiredActivity(actor));
    }
    const days = await setRetentionDays({ ...actor, days: Number(body.days) });
    return NextResponse.json({ days });
  }

  if (!isActivityAction(action) || !clientMayReport(action, role)) {
    return NextResponse.json({ error: 'That activity cannot be recorded from here.', code: 'FORBIDDEN' }, { status: 403 });
  }
  await recordActivity({
    action,
    actorId: user.uid,
    actorEmail: user.email || '',
    actorRole: role,
    ip: client.ip,
    device: client.device,
    targetType: typeof body.targetType === 'string' ? body.targetType : 'record',
    targetId: typeof body.targetId === 'string' ? body.targetId : user.uid,
    targetLabel: typeof body.targetLabel === 'string' ? body.targetLabel : '',
    before: body.before,
    after: body.after,
  });
  if (action === 'auth.login' && role === 'student') {
    try {
      const { noteLearner } = await import('@/lib/alerts/progress-server');
      await noteLearner(user.uid);
    } catch {
      /* Sign-in still succeeds when a progress check cannot run. */
    }
  }
  return NextResponse.json({ ok: true });
}
