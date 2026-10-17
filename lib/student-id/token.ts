/**
 * HMAC helpers for the free student-ID QR and checkout code.
 * Server and tests only. Client pages import the rules module instead.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { chainHash } from '../billing/model';
import { isStudentToken, tokenWindow, TOKEN_STEP_MS } from './model';

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url').slice(0, 22);
}

function signaturesMatch(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Stateless HMAC. A new token every 30 seconds. The payload is uid and window only. */
export function signStudentToken(uid: string, now: number, secret: string): { token: string; validUntil: number } {
  const window = tokenWindow(now);
  const payload = Buffer.from(`${uid}.${window}`).toString('base64url');
  const token = `ps1.${payload}.${signPayload(payload, secret)}`;
  return { token, validUntil: (window + 1) * TOKEN_STEP_MS };
}

export function readStudentToken(
  token: string,
  now: number,
  secret: string,
): { uid: string; validUntil: number; active: boolean } | null {
  if (!isStudentToken(token) || !secret) return null;
  const [, payload, sig] = token.split('.');
  if (!payload || !sig || !signaturesMatch(sig, signPayload(payload, secret))) return null;
  const decoded = Buffer.from(payload, 'base64url').toString('utf8');
  const dot = decoded.lastIndexOf('.');
  if (dot <= 0) return null;
  const uid = decoded.slice(0, dot);
  const window = Number(decoded.slice(dot + 1));
  if (!uid || !Number.isInteger(window)) return null;
  const current = tokenWindow(now);
  if (window !== current && window !== current - 1) return null;
  const validUntil = (window + 1) * TOKEN_STEP_MS;
  return { uid, validUntil, active: now < validUntil };
}

export function codeDigest(code: string, secret: string): string {
  return createHmac('sha256', secret).update(`code.${code}`).digest('hex');
}

export function perkAuditHash(prevHash: string, payload: Record<string, unknown>): string {
  return chainHash(prevHash, payload);
}
