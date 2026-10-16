import { NextResponse } from 'next/server';
import { sessionClaimsFromVerified } from '@/lib/admin-access';
import { hasCmsAddon } from '@/lib/entitlements';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { bearerToken, lookupIdToken } from '@/lib/identity-token';
import { DASHBOARD_COOKIE, signDashboardSession } from '@/lib/dashboard-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Exchange a verified Firebase ID token for an httpOnly dashboard session.
 * The cookie role is the ID-token claim. The Firestore profile of that uid
 * fills the role only when the token has none, and never upgrades a parent,
 * student, or teacher claim to admin.
 */
export async function POST(request: Request) {
  const identity = await lookupIdToken(bearerToken(request.headers.get('authorization')));
  if (!identity) {
    return NextResponse.json({ error: 'Sign in required.', code: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const tokenRole = typeof identity.customAttributes.role === 'string' ? identity.customAttributes.role : '';
  const tokenAdminRole = typeof identity.customAttributes.adminRole === 'string' ? identity.customAttributes.adminRole : '';
  let profileRole = '';
  let profileAdminRole = '';
  let profileRoles: string[] = [];
  let institutionId = '';
  let permissions: string[] = [];
  let accessTier: number | null = null;
  let subscriptionTier: string | null = null;

  if (isAdminConfigured()) {
    const snap = await adminDb().doc(`users/${identity.uid}`).get();
    const data = snap.data() ?? {};
    if (typeof data.role === 'string') profileRole = data.role;
    if (typeof data.adminRole === 'string') profileAdminRole = data.adminRole;
    if (Array.isArray(data.roles)) profileRoles = data.roles.filter((item): item is string => typeof item === 'string');
    if (typeof data.institutionId === 'string') institutionId = data.institutionId;
    if (Array.isArray(data.permissions)) {
      permissions = data.permissions.filter((item): item is string => typeof item === 'string');
    }
    if (typeof data.accessTier === 'number') accessTier = data.accessTier;
    if (typeof data.subscriptionTier === 'string') subscriptionTier = data.subscriptionTier;
  }

  const claims = sessionClaimsFromVerified({
    tokenRole,
    tokenAdminRole,
    profileRole: isAdminConfigured() ? profileRole : undefined,
    profileAdminRole: isAdminConfigured() ? profileAdminRole : undefined,
    profileRoles,
  });
  const role = claims.role;
  const adminRole = claims.adminRole;
  const roles = claims.roles;
  const trusted = tokenRole.length > 0 || (isAdminConfigured() && role.length > 0);

  const token = await signDashboardSession({
    uid: identity.uid,
    email: identity.email,
    role,
    roles,
    adminRole,
    institutionId,
    cms: hasCmsAddon({ role, permissions, accessTier, subscriptionTier }),
    trusted: trusted && role.length > 0,
  });
  if (!token) {
    return NextResponse.json({
      error: 'Dashboard session signing is not configured.',
      code: 'SESSION_UNCONFIGURED',
    }, { status: 503 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(DASHBOARD_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60,
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}
