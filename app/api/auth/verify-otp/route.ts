import { NextRequest, NextResponse } from 'next/server';
import { isEmailServiceConfigured, verifyOtpToken } from '@/lib/email-otp';

export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 8;

// Best-effort per-instance attempt counter against code brute-forcing.
const attempts = new Map<string, { count: number; resetAt: number }>();

export async function POST(req: NextRequest) {
  if (!isEmailServiceConfigured()) {
    return NextResponse.json({ valid: false, error: 'Email verification is not configured.' }, { status: 503 });
  }

  let body: { email?: string; code?: string; token?: string; expiresAt?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? '';
  const code = body.code?.trim() ?? '';
  const token = body.token ?? '';
  const expiresAt = Number(body.expiresAt);

  if (!email || !/^\d{6}$/.test(code) || !token || !expiresAt) {
    return NextResponse.json({ valid: false, error: 'email, code and token are required.' }, { status: 400 });
  }

  const now = Date.now();
  const entry = attempts.get(email);
  if (entry && entry.resetAt > now && entry.count >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { valid: false, error: 'Too many attempts. Request a new code.' },
      { status: 429 }
    );
  }
  attempts.set(email, {
    count: entry && entry.resetAt > now ? entry.count + 1 : 1,
    resetAt: entry && entry.resetAt > now ? entry.resetAt : now + 15 * 60 * 1000,
  });

  const valid = verifyOtpToken(email, code, expiresAt, token);
  if (valid) attempts.delete(email);

  return NextResponse.json(
    valid ? { valid: true } : { valid: false, error: 'Invalid or expired code.' },
    { status: valid ? 200 : 400 }
  );
}
