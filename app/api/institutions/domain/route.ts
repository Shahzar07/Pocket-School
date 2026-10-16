import { NextRequest, NextResponse } from 'next/server';
import { canUseCustomDomain } from '@/lib/enterprise';
import { callerIsAdmin, isNextResponse, loadUser, requireUser } from '@/lib/api-guard';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { normaliseCustomDomain } from '@/lib/oem';
import { attachCustomDomain } from '@/lib/server/vercel-domains';

/** Attach a custom domain when the Vercel token exists. Otherwise return DNS instructions only. */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;

  const body = await req.json().catch(() => ({})) as { institutionId?: unknown; domain?: unknown };
  const institutionId = typeof body.institutionId === 'string' ? body.institutionId : '';
  const domain = normaliseCustomDomain(typeof body.domain === 'string' ? body.domain : '');
  if (!institutionId || !domain) {
    return NextResponse.json({ error: 'Use a hostname the academy owns.' }, { status: 400 });
  }

  const profile = await loadUser(user.uid);
  const admin = await callerIsAdmin(user.uid, user.email);
  const owns = profile?.role === 'institution_admin' && profile.institutionId === institutionId;
  if (!admin && !owns) {
    return NextResponse.json({ error: 'This academy is outside your account.' }, { status: 403 });
  }

  if (isAdminConfigured()) {
    const snap = await adminDb().doc(`institutions/${institutionId}`).get();
    if (!canUseCustomDomain(typeof snap.data()?.plan === 'string' ? snap.data()?.plan : '')) {
      return NextResponse.json({ error: 'A custom domain is available on Enterprise and OEM plans.' }, { status: 403 });
    }
  }

  const result = await attachCustomDomain(process.env, domain);
  if (isAdminConfigured()) {
    await adminDb().doc(`institutions/${institutionId}`).set({
      customDomain: domain,
      customDomainStatus: result.status,
      customDomainMessage: result.message,
    }, { merge: true });
  }
  return NextResponse.json({ domain, ...result });
}
