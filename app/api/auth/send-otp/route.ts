import { NextResponse } from 'next/server';
import {
  SMTP_NOT_CONFIGURED,
  parseEmailAllowlist,
  smtpFallbackFactors,
  staffRoleForMfa,
  type MfaFallback,
} from '@/lib/admin-mfa';
import {
  CODE_TTL_MS,
  RESEND_COOLDOWN_MS,
  generateCode,
  isEmailServiceConfigured,
  sendOtpEmail,
  signOtp,
} from '@/lib/email-otp';
import { bearerToken, lookupIdToken } from '@/lib/identity-token';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Best-effort per-instance cooldown to stop rapid-fire resends.
const lastSentAt = new Map<string, number>();

/**
 * Google or authenticator, only for a signed-in super admin on SUPER_ADMIN_EMAILS.
 * A missing or foreign token gets nothing — the response must not reveal the allowlist.
 */
async function fallbackFor(req: Request, email: string): Promise<MfaFallback[]> {
  const identity = await lookupIdToken(bearerToken(req.headers.get('authorization')));
  if (!identity || identity.email !== email) return [];
  return smtpFallbackFactors({
    email: identity.email,
    allowlist: parseEmailAllowlist(process.env.SUPER_ADMIN_EMAILS),
    staffRole: staffRoleForMfa({
      email: identity.email,
      role: identity.customAttributes.role,
      adminRole: identity.customAttributes.adminRole,
    }),
  });
}

export async function POST(req: Request) {
  let body: { email?: string; language?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? '';
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
  }

  // No SMTP on this deployment. Signup still sees configured:false and can continue.
  // Admin sign-in must not: a second factor is added only for an allowlisted super admin.
  if (!isEmailServiceConfigured()) {
    const fallback = await fallbackFor(req, email);
    return NextResponse.json({
      configured: false,
      code: SMTP_NOT_CONFIGURED,
      ...(fallback.length ? { fallback } : {}),
    });
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
    const headerLanguage = req.headers.get('accept-language')?.split(',')[0]?.split('-')[0] ?? 'en';
    await sendOtpEmail(email, code, body.language || headerLanguage);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send verification email.';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  lastSentAt.set(email, Date.now());
  return NextResponse.json({ configured: true, token, expiresAt });
}
