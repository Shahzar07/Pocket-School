import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export interface FeedClaims {
  uid: string;
  nonce: string;
}

export function newFeedNonce(): string {
  return randomBytes(16).toString('base64url');
}

export function signFeedToken(uid: string, nonce: string, secret: string): string {
  const payload = Buffer.from(JSON.stringify({ uid, nonce })).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyFeedToken(token: string, secret: string): FeedClaims | null {
  const split = token.split('.');
  if (split.length !== 2) return null;
  const [payload, sig] = split;
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<FeedClaims>;
    if (!parsed.uid || !parsed.nonce) return null;
    return { uid: parsed.uid, nonce: parsed.nonce };
  } catch {
    return null;
  }
}

export function feedUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, '')}/api/calendar/ics/${token}`;
}

export const EMPTY_ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Poket School//Calendar//EN',
  'END:VCALENDAR',
].join('\r\n');
