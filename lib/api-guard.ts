import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, isAdminConfigured } from './firebase-admin';
import { isSuperAdminEmail } from './roles';

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
}

export function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

export async function requireUser(
  req: NextRequest,
  opts?: { limit?: number; windowMs?: number },
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
    if (!rateLimit(`${decoded.uid}:${req.nextUrl.pathname}`, limit, windowMs)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment and try again.', code: 'RATE_LIMIT' },
        { status: 429 },
      );
    }
    return {
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: decoded.email_verified === true,
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

export async function callerIsAdmin(uid: string, email?: string): Promise<boolean> {
  if (isSuperAdminEmail(email)) return true;
  const profile = await loadUser(uid);
  return profile?.role === 'admin';
}
