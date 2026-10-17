import { createHmac, timingSafeEqual } from 'node:crypto';

export type WebhookStatus = 'delivered' | 'opened' | 'failed';

export function resendEventStatus(type: string): WebhookStatus | null {
  if (type === 'email.delivered') return 'delivered';
  if (type === 'email.opened') return 'opened';
  if (type === 'email.bounced' || type === 'email.complained') return 'failed';
  return null;
}

export function verifyResendSignature(input: {
  secret: string;
  id: string;
  timestamp: string;
  signature: string;
  body: string;
  nowSeconds?: number;
}): boolean {
  if (!input.secret || !input.id || !input.timestamp || !input.signature || !input.body) return false;
  const stamped = Number(input.timestamp);
  if (!Number.isFinite(stamped)) return false;
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - stamped) > 5 * 60) return false;
  const key = input.secret.startsWith('whsec_')
    ? Buffer.from(input.secret.slice('whsec_'.length), 'base64')
    : Buffer.from(input.secret);
  const expected = createHmac('sha256', key).update(`${input.id}.${input.timestamp}.${input.body}`).digest('base64');
  const candidates = input.signature.split(' ').map(part => (part.startsWith('v1,') ? part.slice(3) : part)).filter(Boolean);
  return candidates.some(part => {
    const left = Buffer.from(part);
    const right = Buffer.from(expected);
    return left.length === right.length && timingSafeEqual(left, right);
  });
}

export function resendEmailId(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return '';
  const id = (data as { email_id?: unknown }).email_id;
  return typeof id === 'string' ? id : '';
}
