/**
 * Digital member card. Free for every account. This module never reads a plan,
 * an entitlement, or a paywall. PLAN-superapp.md is not in this repo, so the
 * issued number lives on `users.studentNumber`. `PSM-` is the member form of
 * that field. There is no separate memberNumber.
 */

import { toNamedLevel } from '../programmes';
import type { AgeTier } from '../age-tier';

export const MEMBER_CARD_TITLE = 'Poket School member card';
export const STUDENT_CARD_TITLE = 'Student card';
export const MEMBER_PREFIX = 'PSM-';
export const STUDENT_PREFIX = 'PS-';

export const SHARE_CHANNELS = ['copy', 'whatsapp', 'telegram', 'x', 'email', 'native'] as const;
export type ShareChannel = (typeof SHARE_CHANNELS)[number];

export const CARD_AUDIT_TYPES = ['created', 'revoked', 'regenerated', 'channel', 'view'] as const;
export type CardAuditType = (typeof CARD_AUDIT_TYPES)[number];

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface CardSource {
  name: string;
  level: string;
  pathway: string;
  institutionId: string;
  institutionName: string;
  ageTier: AgeTier;
  avatarUrl: string;
  studyDates: string[];
  badges: string[];
  referralCode: string;
  /** Adult choice. Ignored unless the person is an adult. */
  cardIndexed: boolean;
  /** Verified parent switch. Required before an under-13 card can be shared. */
  cardSharing: boolean;
  revoked: boolean;
}

export interface PublicCard {
  title: string;
  firstName: string;
  levelName: string;
  /** School name is omitted for anyone under 18, and when there is no school. */
  schoolName: string | null;
  showPhoto: boolean;
  avatarUrl: string;
  badges: string[];
  streakDays: number;
  referralCode: string;
  joinPath: string;
  indexable: boolean;
  visible: boolean;
}

export function hasInstitution(institutionId: unknown): boolean {
  return typeof institutionId === 'string' && institutionId.trim().length > 0;
}

/** Next unused number. School accounts use `PS-`. Everyone else uses `PSM-`. */
export function issuedNumber(institution: boolean, seq: number): string {
  if (!Number.isInteger(seq) || seq < 1 || seq > 99999999) {
    throw new Error('Member number sequence is out of range.');
  }
  return `${institution ? STUDENT_PREFIX : MEMBER_PREFIX}${String(seq).padStart(4, '0')}`;
}

export function referralCodeFromBytes(bytes: Uint8Array): string {
  let code = '';
  for (let i = 0; i < 8; i += 1) {
    code += CODE_ALPHABET[(bytes[i] ?? 0) % CODE_ALPHABET.length];
  }
  return code;
}

export function normaliseReferralCode(value: unknown): string {
  if (typeof value !== 'string') return '';
  const code = value.trim().toUpperCase().replace(/[^A-Z2-9]/g, '');
  return /^[A-Z2-9]{8}$/.test(code) ? code : '';
}

export function asShareChannel(value: unknown): ShareChannel | null {
  return SHARE_CHANNELS.includes(value as ShareChannel) ? (value as ShareChannel) : null;
}

export function shareIdAccepts(value: string): boolean {
  return /^[A-Za-z0-9_-]{16,64}$/.test(value);
}

export function firstName(name: string): string {
  const word = name.trim().split(/\s+/)[0] ?? '';
  const clean = word.replace(/[^A-Za-z\u00C0-\u024F'-]/g, '');
  return clean.slice(0, 24) || 'Member';
}

export function previousDay(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function streakDays(dates: readonly string[], today: string): number {
  const known = new Set(dates.filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day)));
  let cursor = today;
  let count = 0;
  while (known.has(cursor) && count < 400) {
    count += 1;
    cursor = previousDay(cursor);
  }
  return count;
}

export function joinPath(code: string): string {
  const clean = normaliseReferralCode(code);
  return clean ? `/signup?ref=${clean}` : '/signup';
}

/**
 * The public card. It never carries a student number, a QR payload, a date of
 * birth, or a photo of someone under 13.
 */
export function publicCard(source: CardSource, today: string): PublicCard {
  const institution = hasInstitution(source.institutionId);
  const adult = source.ageTier === 'adult';
  const under13 = source.ageTier === 'under13';
  const visible = !source.revoked && (!under13 || source.cardSharing);
  const levelName = toNamedLevel(source.level) || toNamedLevel(source.pathway);
  const badges = source.badges.map((badge) => badge.trim()).filter(Boolean).slice(0, 3);
  return {
    title: institution ? STUDENT_CARD_TITLE : MEMBER_CARD_TITLE,
    firstName: firstName(source.name),
    levelName,
    schoolName: adult && institution ? source.institutionName.trim() || null : null,
    showPhoto: !under13 && source.avatarUrl.trim().length > 0,
    avatarUrl: under13 ? '' : source.avatarUrl.trim(),
    badges,
    streakDays: streakDays(source.studyDates, today),
    referralCode: normaliseReferralCode(source.referralCode),
    joinPath: joinPath(source.referralCode),
    indexable: adult && source.cardIndexed === true && visible,
    visible,
  };
}

export interface ReferralRecord {
  inviterUid: string;
  createdAt: number;
  redeemedBy: { uid: string; at: number }[];
}

export function redeemDecision(
  record: ReferralRecord | null,
  uid: string,
): 'missing' | 'self' | 'already' | 'ok' {
  if (!record || !record.inviterUid) return 'missing';
  if (record.inviterUid === uid) return 'self';
  if (record.redeemedBy.some((row) => row.uid === uid)) return 'already';
  return 'ok';
}

export function withRedemption(record: ReferralRecord, uid: string, at: number): ReferralRecord {
  if (redeemDecision(record, uid) !== 'ok') return record;
  return { ...record, redeemedBy: [...record.redeemedBy, { uid, at }] };
}
