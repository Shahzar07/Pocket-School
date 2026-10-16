import { NextRequest, NextResponse } from 'next/server';
import { academyAccessWithoutSdk, clientIp, ipAllowed, sanitiseAcademySettings } from '@/lib/academy-settings';
import { callerIsAdmin, isNextResponse, loadUser, requireUser } from '@/lib/api-guard';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';

/**
 * Session gate for an academy IP allowlist.
 * Production refuses the session when the Admin SDK cannot verify it.
 * Local development still opens so a missing service account does not lock the dashboard.
 */
export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    const gate = academyAccessWithoutSdk(process.env.NODE_ENV);
    return NextResponse.json(gate.body, { status: gate.status });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;

  const body = await req.json().catch(() => ({})) as { institutionId?: unknown };
  const institutionId = typeof body.institutionId === 'string' ? body.institutionId : '';
  if (!institutionId) return NextResponse.json({ error: 'Name the academy.' }, { status: 400 });

  const profile = await loadUser(user.uid);
  const admin = await callerIsAdmin(user.uid, user.email, user);
  if (!admin && profile?.institutionId !== institutionId) {
    return NextResponse.json({ error: 'This academy is outside your account.' }, { status: 403 });
  }

  const snap = await adminDb().doc(`institutions/${institutionId}/settings/academy`).get();
  const settings = sanitiseAcademySettings(snap.data() ?? {});
  const allowed = ipAllowed(settings.ipAllowlist, clientIp(req.headers));
  return NextResponse.json({
    enforced: settings.ipAllowlist.length > 0,
    allowed,
    require2fa: settings.require2fa,
    sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
  });
}
