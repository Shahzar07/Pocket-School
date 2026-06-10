import { NextRequest, NextResponse } from 'next/server';
import {
  CODE_TTL_MS,
  RESEND_COOLDOWN_MS,
  generateCode,
  isEmailServiceConfigured,
  sendOtpEmail,
  signOtp,
} from '@/lib/email-otp';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Best-effort per-instance cooldown to stop rapid-fire resends.
const lastSentAt = new Map<string, number>();

export async function POST(req: NextRequest) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? '';
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
  }

  // No SMTP credentials on this deployment — tell the client so it can
  // proceed without email verification instead of blocking signups.
  if (!isEmailServiceConfigured()) {
    return NextResponse.json({ configured: false });
  }

  const last = lastSentAt.get(email) ?? 0;
  if (Date.now() - last < RESEND_COOLDOWN_MS) {
    return NextResponse.json(
      { error: 'Please wait a moment before requesting another code.' },
      { status: 429 }
    );
  }

  const code = generateCode();
  const expiresAt = Date.now() + CODE_TTL_MS;
  const token = signOtp(email, code, expiresAt);

  try {
    await sendOtpEmail(email, code);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send verification email.';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  lastSentAt.set(email, Date.now());
  return NextResponse.json({ configured: true, token, expiresAt });
}
