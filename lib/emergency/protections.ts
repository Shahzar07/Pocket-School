/**
 * Review window, retract, abuse reports, and guardian consent.
 * Consent versions are immutable. Publishing a missing child alert waits for one.
 */

export const DEFAULT_REVIEW_MS = 24 * 60 * 60 * 1000;
export const MAX_REVIEW_MS = 48 * 60 * 60 * 1000;
export const REPORTS_PER_DAY = 3;
export const FALSE_REPORTS_BEFORE_BAN = 2;

export interface GuardianConsent {
  details: string;
  photo: boolean;
  regions: string[];
  channels: string[];
  disclaimer: string;
  guardianName: string;
  relation: string;
  signature: string;
  signatureKind: 'drawn' | 'typed';
  at: number;
  ip: string;
  device: string;
}

export function clampReviewEvery(ms: number | undefined): number {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return DEFAULT_REVIEW_MS;
  return Math.min(Math.round(ms), MAX_REVIEW_MS);
}

export function reviewExpired(reviewDueAt: number | null, now: number, status: string): boolean {
  if (status !== 'active' && status !== 'updated') return false;
  if (reviewDueAt == null || !Number.isFinite(reviewDueAt)) return false;
  return now >= reviewDueAt;
}

export function consentProblems(input: Partial<GuardianConsent>): string | null {
  if (!input.details || input.details.trim().length < 3) return 'Record what the guardian agreed to share.';
  if (!input.regions || input.regions.length < 1) return 'Record the regions covered by this consent.';
  if (!input.channels || input.channels.length < 1) return 'Record the channels covered by this consent.';
  if (!input.disclaimer || input.disclaimer.trim().length < 8) return 'The disclaimer has to be recorded.';
  if (!input.guardianName || input.guardianName.trim().length < 2) return 'The guardian name is required.';
  if (!input.relation || input.relation.trim().length < 2) return 'The relation to the child is required.';
  if (input.signatureKind !== 'drawn' && input.signatureKind !== 'typed') return 'The signature is drawn or typed.';
  if (!input.signature || input.signature.trim().length < 2) return 'A signature is required.';
  if (input.signatureKind === 'drawn' && !input.signature.startsWith('data:image/')) {
    return 'A drawn signature is an image.';
  }
  return null;
}

export function reportAllowed(input: { countToday: number; banned: boolean }): string | null {
  if (input.banned) return 'Reporting is closed for this account.';
  if (input.countToday >= REPORTS_PER_DAY) return 'Three reports a day is the limit.';
  return null;
}

/** Anonymous visitors are rate limited. A captcha is required when the site has configured one. */
export function anonymousReportAllowed(input: { countToday: number; captchaRequired: boolean; captchaOk: boolean }): string | null {
  if (input.countToday >= REPORTS_PER_DAY) return 'Three reports a day is the limit.';
  if (input.captchaRequired && !input.captchaOk) return 'Confirm you are a person before reporting.';
  return null;
}

export function losesReportingRights(previousFalseCount: number): boolean {
  return previousFalseCount + 1 >= FALSE_REPORTS_BEFORE_BAN;
}

export function captchaRequired(): boolean {
  return Boolean(process.env.CAPTCHA_SECRET);
}

/** Rate limit covers anonymous visitors when no captcha is configured. */
export async function captchaSatisfied(token: string): Promise<boolean> {
  if (!captchaRequired()) return true;
  const url = process.env.CAPTCHA_VERIFY_URL;
  if (!url || token.trim().length < 8) return false;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret: process.env.CAPTCHA_SECRET, token }),
  });
  if (!response.ok) return false;
  const body = await response.json().catch(() => ({})) as { success?: boolean };
  return body.success === true;
}
