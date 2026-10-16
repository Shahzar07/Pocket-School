// Server-only helpers for the email verification-code flow.
// Codes are stateless: the server returns an HMAC-signed token binding
// (email, code, expiry) and verifies it later — no database needed, safe
// on serverless where instances don't share memory.

import { createHmac, randomInt, timingSafeEqual } from 'crypto';

export const CODE_TTL_MS = 10 * 60 * 1000; // codes valid for 10 minutes
export const RESEND_COOLDOWN_MS = 30 * 1000;

export function getOtpSecret(): string {
  return process.env.OTP_SECRET || '';
}

/** SMTP and a dedicated OTP secret. SMTP_PASS is not a substitute for OTP_SECRET. */
export function isEmailServiceConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.OTP_SECRET);
}

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function signOtp(email: string, code: string, expiresAt: number): string {
  return createHmac('sha256', getOtpSecret())
    .update(`${email.trim().toLowerCase()}|${code}|${expiresAt}`)
    .digest('hex');
}

export function verifyOtpToken(email: string, code: string, expiresAt: number, token: string): boolean {
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;
  const expected = Buffer.from(signOtp(email, code, expiresAt), 'hex');
  let provided: Buffer;
  try {
    provided = Buffer.from(token, 'hex');
  } catch {
    return false;
  }
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export async function sendOtpEmail(to: string, code: string, language = 'en'): Promise<void> {
  const nodemailer = (await import('nodemailer')).default;
  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  const { catalogs } = await import('./i18n/catalog');
  const { isSupportedLanguage } = await import('./languages');
  const codeKey = isSupportedLanguage(language) ? language : 'en';
  const emailCopy = (catalogs[codeKey as keyof typeof catalogs] as { email?: {
    otpSubject: string; otpText: string; otpIntro: string; otpExpiry: string;
  } }).email;
  const fill = (template: string) => template.split('{{code}}').join(code);
  const subject = fill(emailCopy?.otpSubject ?? '{{code}} is your Poket School verification code');
  const text = fill(emailCopy?.otpText ?? 'Your Poket School verification code is {{code}}.');
  const intro = emailCopy?.otpIntro ?? 'Use this code to verify your email address.';
  const expiry = emailCopy?.otpExpiry ?? 'This code expires in 10 minutes.';

  await transport.sendMail({
    from: process.env.SMTP_FROM || `Poket School <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#06060F;border-radius:16px;color:#fff" dir="auto">
        <h1 style="font-size:20px;margin:0 0 8px;color:#fff">Poket School</h1>
        <p style="color:rgba(255,255,255,0.6);font-size:14px;margin:0 0 24px">${intro}</p>
        <div style="background:rgba(26,115,232,0.15);border:1px solid rgba(26,115,232,0.4);border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
          <span style="font-size:32px;font-weight:bold;letter-spacing:0.4em;color:#60A5FA">${code}</span>
        </div>
        <p style="color:rgba(255,255,255,0.4);font-size:12px;margin:0">${expiry}</p>
      </div>`,
  });
}
