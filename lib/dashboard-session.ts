import { SignJWT } from 'jose/jwt/sign';
import { jwtVerify } from 'jose/jwt/verify';
import type { DashboardActor } from './dashboard-access';

export const DASHBOARD_COOKIE = 'poket_dash';
/** Lets one request through after a session attempt, so a missing secret cannot loop. */
export const DASHBOARD_ATTEMPT_COOKIE = 'poket_dash_attempt';

export interface DashboardSession extends DashboardActor {
  uid: string;
  trusted: boolean;
}

function secretBytes(): Uint8Array | null {
  const raw = (process.env.DASHBOARD_SESSION_SECRET || process.env.OTP_SECRET || '').trim();
  if (raw.length < 16) return null;
  return new TextEncoder().encode(raw);
}

export function sessionSecretConfigured(): boolean {
  return secretBytes() !== null;
}

export async function signDashboardSession(session: DashboardSession): Promise<string | null> {
  const secret = secretBytes();
  if (!secret) return null;
  return new SignJWT({
    email: session.email ?? '',
    role: session.role ?? '',
    roles: session.roles ?? [],
    adminRole: session.adminRole ?? '',
    institutionId: session.institutionId ?? '',
    cms: session.cms === true,
    trusted: session.trusted === true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(session.uid)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}

export async function verifyDashboardSession(token: string): Promise<DashboardSession | null> {
  const secret = secretBytes();
  if (!secret || !token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    const uid = typeof payload.sub === 'string' ? payload.sub : '';
    if (!uid) return null;
    const roles = Array.isArray(payload.roles)
      ? payload.roles.filter((role): role is string => typeof role === 'string')
      : [];
    return {
      uid,
      email: typeof payload.email === 'string' ? payload.email : '',
      role: typeof payload.role === 'string' ? payload.role : '',
      roles,
      adminRole: typeof payload.adminRole === 'string' ? payload.adminRole : '',
      institutionId: typeof payload.institutionId === 'string' ? payload.institutionId : '',
      cms: payload.cms === true,
      trusted: payload.trusted === true,
    };
  } catch {
    return null;
  }
}
