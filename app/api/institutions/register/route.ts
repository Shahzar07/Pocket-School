import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { rateLimit } from '@/lib/api-guard';
import { isEmailServiceConfigured, verifyOtpToken } from '@/lib/email-otp';
import { blankProfile } from '@/lib/enterprise';
import { adminAuth, adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { validateInstitutionApplication } from '@/lib/institution-journey';
import { parseOrganisationSize } from '@/lib/institution-self-serve';
import { INSTITUTION_ADMIN_CODE_UNAVAILABLE } from '@/lib/institution-login';
import { mergeUnregisteredAlumni } from '@/lib/server/alumni-claim-store';

export const dynamic = 'force-dynamic';

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}

function alreadyExists(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : '';
  return code === 'auth/email-already-exists' || code === 'email-already-exists';
}

/**
 * Public academy registration. Firestore rules only let a platform admin
 * create an institution, so this route writes with the Admin SDK after the
 * work email code checks out.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`institution-register:${clientIp(req)}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many registration attempts. Wait and try again.' }, { status: 429 });
  }
  if (!isEmailServiceConfigured()) {
    return NextResponse.json({ error: INSTITUTION_ADMIN_CODE_UNAVAILABLE }, { status: 503 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: 'Institution registration needs the server account. Ask Poket School to finish the server setup.' },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const parsed = validateInstitutionApplication(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const size = parseOrganisationSize(body.organisationSize);
  if (!size.ok) return NextResponse.json({ error: size.error }, { status: 400 });

  const email = parsed.value.email;
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const token = typeof body.token === 'string' ? body.token : '';
  const expiresAt = Number(body.expiresAt);
  if (!/^\d{6}$/.test(code) || !token || !verifyOtpToken(email, code, expiresAt, token)) {
    return NextResponse.json({ error: 'That email code is not valid. Request a new one and try again.' }, { status: 400 });
  }

  const application = parsed.value;
  let uid = '';
  try {
    const user = await adminAuth().createUser({
      email: application.email,
      password: application.password,
      displayName: application.name,
      emailVerified: true,
    });
    uid = user.uid;
    const institution = adminDb().collection('institutions').doc();
    const profile = blankProfile({
      type: application.type,
      country: application.country,
      state: application.state,
      listedForSelfJoin: false,
      plan: 'team',
      billingEmail: application.email,
      contacts: [{
        name: application.name,
        email: application.email,
        phone: application.phone,
        role: application.title,
      }],
    });
    const batch = adminDb().batch();
    batch.set(institution, {
      name: application.organisation,
      adminId: uid,
      studentCount: 0,
      teacherCount: 0,
      status: 'pending',
      billingPhase: 'pending_payment',
      reviewHold: false,
      organisationSize: size.size,
      type: application.type,
      country: application.country,
      state: application.state,
      listedForSelfJoin: false,
      plan: 'team',
      signupPolicy: 'invite',
      setupComplete: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    batch.set(adminDb().doc(`users/${uid}`), {
      name: application.name,
      email: application.email,
      phone: application.phone,
      jobTitle: application.title,
      gender: application.gender,
      role: 'institution_admin',
      roles: ['institution_admin'],
      institutionId: institution.id,
      country: application.country,
      region: application.state,
      twoFactorEnabled: true,
      emailVerified: true,
      accountStatus: 'active',
      xp: 0,
      createdAt: FieldValue.serverTimestamp(),
    });
    batch.set(adminDb().doc(`institutions/${institution.id}/members/${uid}`), {
      email: application.email,
      name: application.name,
      role: 'institution_admin',
      academyRole: application.title,
    });
    batch.set(adminDb().doc(`institutions/${institution.id}/settings/profile`), profile);
    await batch.commit();
    await mergeUnregisteredAlumni({
      institutionId: institution.id,
      name: application.organisation,
      country: application.country,
      state: application.state,
    }).catch((error: unknown) => {
      console.error('Alumni group merge skipped', error instanceof Error ? error.message : 'unknown');
    });
    return NextResponse.json({ institutionId: institution.id, uid });
  } catch (error) {
    if (uid) {
      await adminAuth().deleteUser(uid).catch(() => undefined);
    }
    if (alreadyExists(error)) {
      return NextResponse.json(
        { error: 'An account with this work email already exists. Sign in as an institution admin.' },
        { status: 409 },
      );
    }
    console.error('Institution registration failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Could not open that academy. Try again in a moment.' }, { status: 500 });
  }
}
