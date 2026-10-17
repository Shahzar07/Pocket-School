/**
 * Student numbers are PS-XXXX-XXXX. The alphabet skips letters that look like digits
 * so a code read off a screen or a QR scan is unambiguous.
 */

import { VOLUME_PLANS } from './institution-pricing';

export const STUDENT_NUMBER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const STUDENT_NUMBER_RE = /^PS-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;

export function randomStudentNumber(random: () => number = Math.random): string {
  const chunk = () => Array.from({ length: 4 }, () => {
    const index = Math.floor(random() * STUDENT_NUMBER_ALPHABET.length);
    return STUDENT_NUMBER_ALPHABET[index] ?? 'A';
  }).join('');
  return `PS-${chunk()}-${chunk()}`;
}

export function normaliseStudentNumber(value: string | null | undefined): string {
  const compact = (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!compact.startsWith('PS') || compact.length !== 10) return '';
  return `PS-${compact.slice(2, 6)}-${compact.slice(6, 10)}`;
}

export function isStudentNumber(value: string | null | undefined): boolean {
  return STUDENT_NUMBER_RE.test(normaliseStudentNumber(value));
}

/** Pull a student number out of a typed code or a scanned join URL. */
export function studentCodeFromScan(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  const fromPath = raw.match(/\/join\/(PS[- ]?[A-Z0-9]{4}[- ]?[A-Z0-9]{4})/i);
  if (fromPath?.[1]) return normaliseStudentNumber(fromPath[1]);
  const loose = raw.match(/PS[- ]?[A-Z0-9]{4}[- ]?[A-Z0-9]{4}/i);
  return normaliseStudentNumber(loose?.[0] ?? raw);
}

export function studentJoinPath(code: string): string {
  return `/join/${normaliseStudentNumber(code)}`;
}

export function studentJoinUrl(origin: string, code: string): string {
  const base = origin.replace(/\/$/, '');
  return `${base}${studentJoinPath(code)}`;
}

/** First free code. Returns null when every attempt collides. */
export function nextFreeStudentNumber(taken: ReadonlySet<string>, random: () => number = Math.random, attempts = 8): string | null {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const code = randomStudentNumber(random);
    if (!taken.has(code) && isStudentNumber(code)) return code;
  }
  return null;
}

/** A learner under 13, or with no age tier yet, is confirmed by the institution admin. */
export function linkConfirmer(ageTier: unknown): 'student' | 'institution_admin' {
  return ageTier === 'teen' || ageTier === 'adult' ? 'student' : 'institution_admin';
}

export function learnerLevelLabel(data: { level?: unknown; yearGroup?: unknown; pathway?: unknown } | null | undefined): string {
  const year = typeof data?.yearGroup === 'string' ? data.yearGroup.trim() : '';
  if (year && !/^year\s+\d+/i.test(year)) return year;
  const level = typeof data?.level === 'string' ? data.level.trim() : '';
  const plan = VOLUME_PLANS.find((item) => item.id === level);
  if (plan) return plan.name;
  if (level && !/^year\s+\d+/i.test(level)) return level;
  const pathway = typeof data?.pathway === 'string' ? data.pathway.trim() : '';
  return pathway || 'Learner';
}

export function safePhotoUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const url = value.trim();
  if (url.startsWith('https://') || url.startsWith('/')) return url;
  return '';
}
