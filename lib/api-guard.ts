import { NextRequest, NextResponse } from 'next/server';
import { adminFromVerifiedIdentity } from './admin-access';
import { adminAuth, adminDb, isAdminConfigured } from './firebase-admin';

const buckets = new Map<string, { n: number; reset: number }>();

/** In-memory limiter. Good enough to stop a hot loop; each serverless instance has its own map. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  if (bucket.n >= limit) return false;
  bucket.n += 1;
  return true;
}

export interface AuthedUser {
  uid: string;
  email?: string;
  emailVerified: boolean;
  /** Custom claims on the verified ID token. Absent when the claim was never set. */
  role?: string;
  adminRole?: string;
}

export function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

export async function requireUser(
  req: NextRequest,
  opts?: { limit?: number; windowMs?: number; enforceRateLimit?: boolean },
): Promise<AuthedUser | NextResponse> {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      {
        error: 'The server is not configured to verify accounts yet.',
        code: 'ADMIN_NOT_CONFIGURED',
      },
      { status: 503 },
    );
  }
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    return NextResponse.json({ error: 'Sign in required.', code: 'UNAUTHENTICATED' }, { status: 401 });
  }
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    const limit = opts?.limit ?? 60;
    const windowMs = opts?.windowMs ?? 60_000;
    if (opts?.enforceRateLimit !== false && !rateLimit(`${decoded.uid}:${req.nextUrl.pathname}`, limit, windowMs)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment and try again.', code: 'RATE_LIMIT' },
        { status: 429 },
      );
    }
    const claims = decoded as { role?: unknown; adminRole?: unknown };
    return {
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: decoded.email_verified === true,
      role: typeof claims.role === 'string' ? claims.role : undefined,
      adminRole: typeof claims.adminRole === 'string' ? claims.adminRole : undefined,
    };
  } catch {
    return NextResponse.json({ error: 'Sign in required.', code: 'UNAUTHENTICATED' }, { status: 401 });
  }
}

/** Guard for every AI route. Returns a response when the caller must be stopped. */
export async function enforceAiAccess(req: NextRequest): Promise<NextResponse | null> {
  const result = await requireUser(req, { limit: 30, windowMs: 60_000 });
  return isNextResponse(result) ? result : null;
}

export async function loadUser(uid: string): Promise<Record<string, unknown> | null> {
  const snap = await adminDb().doc(`users/${uid}`).get();
  return snap.exists ? (snap.data() as Record<string, unknown>) : null;
}

export async function callerIsAdmin(
  uid: string,
  email?: string,
  claims?: { role?: string | null; adminRole?: string | null },
): Promise<boolean> {
  let profileRole: string | undefined;
  if (isAdminConfigured()) {
    const profile = await loadUser(uid);
    profileRole = typeof profile?.role === 'string' ? profile.role : '';
  }
  return adminFromVerifiedIdentity({
    email,
    role: claims?.role,
    adminRole: claims?.adminRole,
    profileRole,
  });
}

/** Admin gate. The role is the verified token claim, not a field from the body. */
export async function requirePlatformAdmin(req: NextRequest): Promise<AuthedUser | NextResponse> {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  if (!(await callerIsAdmin(user.uid, user.email, user))) {
    return NextResponse.json({ error: 'Admin access required.', code: 'FORBIDDEN' }, { status: 403 });
  }
  return user;
}
