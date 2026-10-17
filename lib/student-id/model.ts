/**
 * Digital student ID for partner discounts. The card itself stays free.
 * This module decides the public verification face, checkout pacing,
 * and which offers a minor may see. Signing lives in token.ts so this
 * file can be imported by the dashboard. It does not unlock a paid plan.
 */

import { asAgeTier, type AgeTier } from '../age-tier';
import { firstName } from '../cards/model';

export const TOKEN_STEP_MS = 30_000;
export const CODE_TTL_MS = 2 * 60_000;
export const CODE_ATTEMPT_LIMIT = 5;
export const CODE_LOCKOUT_MS = 15 * 60_000;
export const CODE_ISSUE_LIMIT = 5;
export const CODE_ISSUE_WINDOW_MS = 60_000;
export const STANDING_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const PARTNER_MERCHANT_ROLE = 'partner_merchant';

/** Safety partners that may publish Amber alerts. Merchants are not in this list. */
export const AMBER_PUBLISHER_ROLES = ['police', 'ngo'] as const;

export const BLOCKED_MINOR_CATEGORIES = ['alcohol', 'vape', 'tobacco', 'gambling', 'adult'] as const;

export const PERK_CATEGORIES = [
  { id: 'food', label: 'Food', icon: 'utensils' },
  { id: 'books', label: 'Books', icon: 'book-open' },
  { id: 'transport', label: 'Transport', icon: 'bus' },
  { id: 'tech', label: 'Tech', icon: 'laptop' },
  { id: 'study', label: 'Study', icon: 'graduation-cap' },
  { id: 'fitness', label: 'Fitness', icon: 'activity' },
  { id: 'entertainment', label: 'Entertainment', icon: 'ticket' },
] as const;

export type PerkCategoryId = (typeof PERK_CATEGORIES)[number]['id'];
export type CodeType = 'static' | 'unique' | 'scan';
export type StudentStanding = 'verified' | 'member';
export type AgeBand = '<18' | '18+';
export type VerifyState = 'active' | 'expired';

export interface PublicVerification {
  firstName: string;
  label: 'Verified Poket School student' | 'Member';
  state: VerifyState;
  validUntil: number;
  ageBand: AgeBand;
  showPhoto: boolean;
  avatarUrl: string;
  initial: string;
}

const BLOCKED_PATTERN = /alcohol|vape|tobacco|gambl|adult|nicotine/i;

export function canPublishAmberAlerts(role: string | null | undefined): boolean {
  return (AMBER_PUBLISHER_ROLES as readonly string[]).includes(role ?? '');
}

export function isPartnerMerchant(source: { role?: string | null; roles?: readonly string[] | null } | null | undefined): boolean {
  if (!source) return false;
  if (source.role === PARTNER_MERCHANT_ROLE) return true;
  return (source.roles ?? []).includes(PARTNER_MERCHANT_ROLE);
}

export function tokenWindow(now: number): number {
  return Math.floor(now / TOKEN_STEP_MS);
}

export function isStudentToken(value: string): boolean {
  return /^ps1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

export function issuePaceAllowed(recent: readonly number[], now: number): boolean {
  return recent.filter((at) => now - at < CODE_ISSUE_WINDOW_MS).length < CODE_ISSUE_LIMIT;
}

export interface CodeGate {
  attempts: number;
  lockedUntil: number;
  validUntil: number;
}

export function codeDecision(gate: CodeGate | null, now: number, found: boolean): 'missing' | 'locked' | 'expired' | 'ok' {
  if (gate && gate.lockedUntil > now) return 'locked';
  if (!found || !gate) return 'missing';
  if (gate.validUntil <= now) return 'expired';
  return 'ok';
}

export function nextCodeFailure(attempts: number, now: number): { attempts: number; lockedUntil: number } {
  const next = attempts + 1;
  return { attempts: next, lockedUntil: next >= CODE_ATTEMPT_LIMIT ? now + CODE_LOCKOUT_MS : 0 };
}

export function standingFor(input: { tier: number; seatActive: boolean; enrolled: boolean }): StudentStanding {
  return input.tier >= 1 && (input.seatActive || input.enrolled) ? 'verified' : 'member';
}

export function standingLabel(standing: StudentStanding): PublicVerification['label'] {
  return standing === 'verified' ? 'Verified Poket School student' : 'Member';
}

export function ageBandFor(tier: AgeTier): AgeBand {
  return tier === 'adult' ? '18+' : '<18';
}

export function displayStanding(
  stored: { status?: string; validUntil?: number } | null | undefined,
  now: number,
): StudentStanding {
  if (stored?.status === 'verified' && typeof stored.validUntil === 'number' && stored.validUntil > now) return 'verified';
  return 'member';
}

export function nextStandingRecord(
  standing: StudentStanding,
  previous: { status?: string; verifiedAt?: number | null; validUntil?: number } | null | undefined,
  now: number,
): { status: StudentStanding; verifiedAt: number | null; validUntil: number } {
  if (standing === 'member') {
    return { status: 'member', verifiedAt: previous?.verifiedAt ?? null, validUntil: now };
  }
  const verifiedAt = previous?.status === 'verified' && typeof previous.verifiedAt === 'number'
    ? previous.verifiedAt
    : now;
  return { status: 'verified', verifiedAt, validUntil: now + STANDING_TTL_MS };
}

export function publicVerification(input: {
  name: string;
  ageTier: unknown;
  avatarUrl: string;
  standing: StudentStanding;
  active: boolean;
  validUntil: number;
}): PublicVerification {
  const ageTier = asAgeTier(input.ageTier);
  const name = firstName(input.name);
  const under13 = ageTier === 'under13';
  const photo = !under13 && input.avatarUrl.trim().length > 0;
  return {
    firstName: name,
    label: standingLabel(input.standing),
    state: input.active ? 'active' : 'expired',
    validUntil: input.validUntil,
    ageBand: ageBandFor(ageTier),
    showPhoto: photo,
    avatarUrl: photo ? input.avatarUrl.trim() : '',
    initial: name.slice(0, 1).toUpperCase(),
  };
}

export function categoryBlocked(value: string): boolean {
  const clean = value.trim().toLowerCase();
  return (BLOCKED_MINOR_CATEGORIES as readonly string[]).includes(clean) || BLOCKED_PATTERN.test(clean);
}

export function categoriesBlockedForMinors(categories: readonly string[]): boolean {
  return categories.some(categoryBlocked);
}

export interface OfferFace {
  status: string;
  ageMin: number;
  countries: readonly string[];
  cities: readonly string[];
  startsAt: number;
  endsAt: number;
  categories: readonly string[];
}

export function offerVisible(
  offer: OfferFace,
  viewer: { minor: boolean; country: string; city: string },
  now: number,
): boolean {
  if (offer.status !== 'live') return false;
  if (offer.startsAt && now < offer.startsAt) return false;
  if (offer.endsAt && now >= offer.endsAt) return false;
  if (viewer.minor && categoriesBlockedForMinors(offer.categories)) return false;
  if (viewer.minor && offer.ageMin > 0) return false;
  if (offer.countries.length > 0 && !offer.countries.includes(viewer.country)) return false;
  if (offer.cities.length > 0 && !offer.cities.includes(viewer.city)) return false;
  return true;
}

/** Admin review refuses a blocked category unless the offer is adults only. */
export function reviewOffer(categories: readonly string[], ageMin: number): { ok: boolean; reason: string } {
  if (categoriesBlockedForMinors(categories) && ageMin < 18) {
    return {
      ok: false,
      reason: 'Alcohol, vape, tobacco, gambling, and adult offers are refused for under-18s.',
    };
  }
  return { ok: true, reason: '' };
}

export function newPerkPush(title: string, offerId: string): { category: 'general'; title: string; body: string; link: string } {
  return {
    category: 'general',
    title: 'New perk',
    body: title,
    link: `/dashboard/student/perks?offer=${offerId}`,
  };
}
