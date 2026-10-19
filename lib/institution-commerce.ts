/**
 * Who pays, how a course is bought, and who may publish it.
 * Seat quotes stay in lib/institution-pricing.ts.
 * Billing phases stay in lib/institution-membership.ts.
 */

import type { VolumePlanId } from './institution-pricing';
import { annualFromMonthly } from './pricing';

export const SECOND_CHILD_DISCOUNT = 0.3;
export const LOW_SPARKS_PERCENT = 20;
export const TEACHER_SHARE_BPS = 7000;
export const PDPA_CONSENT_VERSION = '2024-pdpa';
export const MINOR_AGE = 18;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const LEVELS = new Set<string>(['primary_secondary', 'igcse_alevel', 'professional']);

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface TeacherPlan {
  id: 'teacher';
  name: 'Teacher';
  monthlyUsd: number;
  annualUsd: number;
  sparks: number;
  shareBps: number;
}

/** Seed matches the course-builder add-on. A super admin can replace it. */
export function defaultTeacherPlan(): TeacherPlan {
  const monthlyUsd = 29;
  return {
    id: 'teacher',
    name: 'Teacher',
    monthlyUsd,
    annualUsd: annualFromMonthly(monthlyUsd, 0.25),
    sparks: 800,
    shareBps: TEACHER_SHARE_BPS,
  };
}

export type CommerceRole = 'student' | 'parent' | 'teacher' | 'institution_admin';
export type CommerceMembership = 'independent' | 'institution';

export interface AccountFee {
  billedTo: 'none' | 'individual' | 'institution';
  product: 'parent' | 'staff' | 'seat' | 'teacher_plan' | 'plan';
  amountUsd: number;
  note: string;
}

export function accountFee(input: {
  role: CommerceRole;
  membership: CommerceMembership;
  planUsd: number;
  teacherUsd?: number;
}): AccountFee {
  if (input.role === 'parent') {
    return {
      billedTo: 'none',
      product: 'parent',
      amountUsd: 0,
      note: 'A parent account is free. Independent children are billed on the parent. Children at an institution are covered by that institution.',
    };
  }
  if (input.membership === 'institution') {
    if (input.role === 'student') {
      return {
        billedTo: 'institution',
        product: 'seat',
        amountUsd: 0,
        note: 'The institution pays per student seat. Poket School does not charge this student.',
      };
    }
    return {
      billedTo: 'none',
      product: 'staff',
      amountUsd: 0,
      note: 'Teachers and institution admins are free staff accounts. Their Sparks come from the institution pool.',
    };
  }
  if (input.role === 'teacher' || input.role === 'institution_admin') {
    return {
      billedTo: 'individual',
      product: 'teacher_plan',
      amountUsd: round2(input.teacherUsd ?? defaultTeacherPlan().monthlyUsd),
      note: 'An independent teacher pays the Teacher plan: course builder and a monthly Sparks allowance. Marketplace sales pay out through Stripe Connect.',
    };
  }
  return {
    billedTo: 'individual',
    product: 'plan',
    amountUsd: round2(Math.max(0, input.planUsd)),
    note: 'An independent student pays their level plan: core programmes for that level, plus the monthly Sparks allowance.',
  };
}

export interface ChildBillLine {
  index: number;
  membership: CommerceMembership;
  listUsd: number;
  amountUsd: number;
  discountPercent: number;
  billedTo: 'parent' | 'institution';
}

/** The first independent child pays the plan. Each later independent child is 30% off. */
export function householdBill(children: readonly { membership: CommerceMembership; listUsd: number }[]): {
  lines: ChildBillLine[];
  parentTotalUsd: number;
} {
  let independentSeen = 0;
  const lines = children.map((child, index) => {
    const listUsd = round2(Math.max(0, child.listUsd));
    if (child.membership === 'institution') {
      return { index: index + 1, membership: child.membership, listUsd, amountUsd: 0, discountPercent: 0, billedTo: 'institution' as const };
    }
    independentSeen += 1;
    const discountPercent = independentSeen >= 2 ? SECOND_CHILD_DISCOUNT * 100 : 0;
    return {
      index: index + 1,
      membership: child.membership,
      listUsd,
      amountUsd: round2(listUsd * (1 - discountPercent / 100)),
      discountPercent,
      billedTo: 'parent' as const,
    };
  });
  return {
    lines,
    parentTotalUsd: round2(lines.reduce((sum, line) => sum + (line.billedTo === 'parent' ? line.amountUsd : 0), 0)),
  };
}

export type MarketplaceTender = 'card' | 'wallet' | 'sparks' | 'institution_invoice';

export function payMarketplace(input: {
  tender: MarketplaceTender;
  priceUsd: number;
  walletBalance?: number;
}): { channel: 'card' | 'wallet' | 'institution_invoice'; amountUsd: number } | { error: string } {
  const price = round2(input.priceUsd);
  if (!Number.isFinite(price) || price <= 0) return { error: 'This course has no price.' };
  if (input.tender === 'sparks') {
    return { error: 'Sparks cannot buy marketplace courses. Pay with a card, the wallet, or an institution invoice.' };
  }
  if (input.tender === 'wallet') {
    const balance = input.walletBalance ?? 0;
    if (balance + 0.001 < price) return { error: 'The wallet does not cover this course.' };
    return { channel: 'wallet', amountUsd: price };
  }
  if (input.tender === 'institution_invoice') return { channel: 'institution_invoice', amountUsd: price };
  return { channel: 'card', amountUsd: price };
}

export function teacherPayout(input: {
  grossUsd: number;
  shareBps?: number;
  connectAccountId: string;
}): { teacherUsd: number; platformUsd: number; shareBps: number } | { error: string } {
  if (!input.connectAccountId.trim()) return { error: 'Connect a Stripe account before a marketplace payout.' };
  if (!Number.isFinite(input.grossUsd) || input.grossUsd < 0) return { error: 'The sale amount is missing.' };
  const shareBps = Math.max(0, Math.min(10_000, Math.round(input.shareBps ?? TEACHER_SHARE_BPS)));
  const teacherUsd = round2(input.grossUsd * shareBps / 10_000);
  return { teacherUsd, platformUsd: round2(input.grossUsd - teacherUsd), shareBps };
}

export type CourseAccessMode = 'subscription' | 'a_la_carte' | 'both';

export function asAccessMode(value: unknown): CourseAccessMode {
  return value === 'a_la_carte' || value === 'both' ? value : 'subscription';
}

export function setAccessMode(input: {
  mode: CourseAccessMode;
  alaCarteEligible: boolean;
  alaCarteUsd: number;
  actor: 'creator' | 'admin';
}): { mode: CourseAccessMode; alaCarteUsd: number; pendingApproval: boolean } | { error: string } {
  const needsPrice = input.mode === 'a_la_carte' || input.mode === 'both';
  if (needsPrice && (!input.alaCarteEligible || !(input.alaCarteUsd > 0))) {
    return { error: 'Lifetime access is only offered on courses marked a la carte, with a price.' };
  }
  return {
    mode: input.mode,
    alaCarteUsd: input.mode === 'subscription' ? 0 : round2(input.alaCarteUsd),
    pendingApproval: input.actor === 'creator',
  };
}

export function checkoutChoices(mode: CourseAccessMode): ('subscription' | 'a_la_carte')[] {
  if (mode === 'a_la_carte') return ['a_la_carte'];
  if (mode === 'both') return ['subscription', 'a_la_carte'];
  return ['subscription'];
}

export function accessBadge(mode: CourseAccessMode): { title: string; detail: string } {
  if (mode === 'a_la_carte') return { title: 'A la carte', detail: 'One payment. Lifetime access to this course.' };
  if (mode === 'both') return { title: 'Subscribe or buy', detail: 'Choose a subscription or a one-time lifetime purchase at checkout.' };
  return { title: 'Subscription', detail: 'Access lasts while the subscription is active, and ends when it ends.' };
}

/** A la carte stays. Subscription access closes when the person or the institution lapses. */
export function holdsAccess(input: { choice: 'subscription' | 'a_la_carte'; subscriptionOpen: boolean; purchased: boolean }): boolean {
  if (input.choice === 'a_la_carte') return input.purchased;
  return input.subscriptionOpen;
}

export interface Publication {
  origin: 'platform' | 'institution';
  library: 'draft' | 'pending' | 'approved' | 'rejected';
  marketplace: 'hidden' | 'pending' | 'approved' | 'rejected';
  featured: boolean;
  core: boolean;
  levels: VolumePlanId[];
  institutionIds: string[];
  /** Higher numbers lead the featured carousel. Ignored unless featured. */
  priority?: number;
  featuredFrom?: string;
  featuredUntil?: string;
}

export function blankPublication(origin: Publication['origin'] = 'institution'): Publication {
  return { origin, library: 'draft', marketplace: 'hidden', featured: false, core: false, levels: [], institutionIds: [] };
}

export function teacherSubmits(pub: Publication): Publication {
  const marketplace = pub.marketplace === 'approved' || pub.marketplace === 'pending' ? 'pending' : 'hidden';
  return { ...pub, library: 'pending', marketplace, featured: false };
}

export function institutionDecides(pub: Publication, decision: 'approved' | 'rejected'): Publication | { error: string } {
  if (pub.library !== 'pending') return { error: 'This course is not waiting for the institution admin.' };
  if (decision === 'rejected') return { ...pub, library: 'rejected', marketplace: 'hidden', featured: false };
  return { ...pub, library: 'approved' };
}

export function requestMarketplace(pub: Publication): Publication | { error: string } {
  if (pub.library !== 'approved') return { error: 'The institution admin approves the course for the academy library first.' };
  return { ...pub, marketplace: 'pending' };
}

export function platformPlaces(pub: Publication, placement: {
  marketplace: 'approved' | 'rejected' | 'hidden';
  featured: boolean;
  core: boolean;
  levels: readonly string[];
  institutionIds: readonly string[];
  priority?: number;
  featuredFrom?: string;
  featuredUntil?: string;
}): Publication | { error: string } {
  const levels = [...new Set(placement.levels.filter((id): id is VolumePlanId => LEVELS.has(id)))];
  if (placement.core && levels.length === 0) return { error: 'A core programme needs a level.' };
  if (pub.origin === 'institution' && placement.marketplace === 'approved' && pub.library !== 'approved') {
    return { error: 'The public marketplace waits until the institution admin has approved the course.' };
  }
  let priority = 0;
  if (placement.priority != null) {
    if (!Number.isInteger(placement.priority) || placement.priority < 0 || placement.priority > 999) {
      return { error: 'Featured priority is a whole number from 0 to 999.' };
    }
    priority = placement.priority;
  }
  const featuredFrom = (placement.featuredFrom ?? '').trim();
  const featuredUntil = (placement.featuredUntil ?? '').trim();
  if (featuredFrom && !DATE.test(featuredFrom)) return { error: 'The featured start date uses YYYY-MM-DD.' };
  if (featuredUntil && !DATE.test(featuredUntil)) return { error: 'The featured end date uses YYYY-MM-DD.' };
  if (featuredFrom && featuredUntil && featuredFrom > featuredUntil) {
    return { error: 'The featured start date is after the end date.' };
  }
  const featured = placement.marketplace === 'approved' && placement.featured;
  return {
    origin: pub.origin,
    library: pub.origin === 'platform' ? 'approved' : pub.library,
    marketplace: placement.marketplace,
    featured,
    core: placement.core,
    levels,
    institutionIds: [...new Set(placement.institutionIds.map((id) => id.trim()).filter(Boolean))],
    priority: featured ? priority : 0,
    featuredFrom: featured ? featuredFrom : '',
    featuredUntil: featured ? featuredUntil : '',
  };
}

export function inInstitutionLibrary(pub: Publication): boolean {
  return pub.library === 'approved';
}

export function onPublicMarketplace(pub: Publication): boolean {
  return pub.marketplace === 'approved';
}

function daysBetween(from: string, to: string): number | null {
  if (!DATE.test(from) || !DATE.test(to)) return null;
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Adds or removes seats inside the current period and prices only the days left. */
export function scaleSeats(input: {
  seats: number;
  activeStudents: number;
  periodStart: string;
  periodEnd: string;
  on: string;
  perSeat: number;
}): { seats: number; charge: number; credit: number; daysRemaining: number; daysInPeriod: number } | { error: string } {
  const daysInPeriod = daysBetween(input.periodStart, input.periodEnd);
  const daysRemaining = daysBetween(input.on, input.periodEnd);
  if (daysInPeriod == null || daysRemaining == null || daysInPeriod <= 0) return { error: 'The billing period needs a start and an end date.' };
  if (input.on < input.periodStart || input.on > input.periodEnd) return { error: 'Seat changes apply inside the current period.' };
  if (!Number.isInteger(input.seats) || input.seats < 0) return { error: 'Seat count is a whole number.' };
  if (!Number.isInteger(input.activeStudents) || input.activeStudents < 0) return { error: 'Active students is a whole number.' };
  if (!Number.isFinite(input.perSeat) || input.perSeat < 0) return { error: 'The per-student price is missing.' };
  const delta = input.activeStudents - input.seats;
  const fraction = daysRemaining / daysInPeriod;
  return {
    seats: input.activeStudents,
    charge: delta > 0 ? round2(input.perSeat * delta * fraction) : 0,
    credit: delta < 0 ? round2(input.perSeat * -delta * fraction) : 0,
    daysRemaining,
    daysInPeriod,
  };
}

export function usageRoi(input: {
  currency: string;
  invoiceUsd: number;
  activeStudents: number;
  lessonsCompleted: number;
  certificatesIssued: number;
  attendanceRate: number;
  sparksSpent: number;
  sparksAllowance: number;
}): {
  costPerStudent: number;
  costPerLesson: number;
  costPerCertificate: number;
  attendancePercent: number;
  sparksUsedPercent: number;
  headline: string;
} {
  const students = Math.max(0, input.activeStudents);
  const costPerStudent = students > 0 ? round2(input.invoiceUsd / students) : 0;
  const costPerLesson = input.lessonsCompleted > 0 ? round2(input.invoiceUsd / input.lessonsCompleted) : 0;
  const costPerCertificate = input.certificatesIssued > 0 ? round2(input.invoiceUsd / input.certificatesIssued) : 0;
  const sparksUsedPercent = input.sparksAllowance > 0
    ? Math.min(100, Math.round((Math.max(0, input.sparksSpent) / input.sparksAllowance) * 100))
    : 0;
  const attendancePercent = Math.round(Math.min(1, Math.max(0, input.attendanceRate)) * 100);
  const money = `${input.currency} ${costPerStudent.toFixed(2)}`;
  const headline = students > 0
    ? `${money} per active student this period.`
    : 'No active students in this period.';
  return { costPerStudent, costPerLesson, costPerCertificate, attendancePercent, sparksUsedPercent, headline };
}

export function guardSparkSpend(input: {
  allowance: number;
  spent: number;
  amount: number;
  cap: number | null;
  lowAtPercent?: number;
}): { spent: number; remaining: number; low: boolean; alert: string | null } | { error: string } {
  if (!Number.isInteger(input.amount) || input.amount <= 0) return { error: 'Spend a whole number of Sparks.' };
  if (input.cap != null && input.spent + input.amount > input.cap) {
    return { error: `This would pass the spending cap of ${input.cap} Sparks.` };
  }
  if (input.spent + input.amount > input.allowance) {
    return { error: 'That is more Sparks than the allowance. Buy a top-up or wait for the next month.' };
  }
  const spent = input.spent + input.amount;
  const remaining = input.allowance - spent;
  const threshold = input.lowAtPercent ?? LOW_SPARKS_PERCENT;
  const low = input.allowance > 0 && remaining / input.allowance <= threshold / 100;
  return {
    spent,
    remaining,
    low,
    alert: low ? `${remaining} Sparks left of ${input.allowance}.` : null,
  };
}

export type WalletKind = 'topup' | 'purchase' | 'gift_out' | 'gift_in' | 'refund';

export function postWallet(balance: number, movement: { kind: WalletKind; amount: number }): { balance: number } | { error: string } {
  if (!Number.isFinite(movement.amount) || movement.amount <= 0) return { error: 'Enter an amount greater than zero.' };
  const debit = movement.kind === 'purchase' || movement.kind === 'gift_out';
  const next = round2(balance + (debit ? -movement.amount : movement.amount));
  if (next < -0.001) return { error: 'The wallet does not go below zero.' };
  return { balance: Math.max(0, next) };
}

export function pdpaGate(input: { terms: boolean; privacy: boolean; minor: boolean; parentalVerified: boolean }): { ok: true } | { error: string } {
  if (!input.terms || !input.privacy) {
    return { error: 'Accept the Terms and the PDPA Privacy Policy before creating an account.' };
  }
  if (input.minor && !input.parentalVerified) {
    return { error: 'A parent or guardian must approve this account before a learner under 18 can join.' };
  }
  return { ok: true };
}

export function requiresParentalConsent(age: number | null): boolean {
  return age != null && age < MINOR_AGE;
}

export function deletionPlan(userId: string): { erase: string[]; retain: { path: string; reason: string }[] } {
  return {
    erase: [
      `users/${userId}`,
      `public_profiles/${userId}`,
      `subscriber_billing/${userId}`,
      `wallets/${userId}`,
    ],
    retain: [
      { path: 'invoices', reason: 'Tax records stay for 7 years, with the name removed.' },
      { path: 'institutions/*/audit', reason: 'The audit log keeps the action and drops the personal name.' },
    ],
  };
}

export interface DataExport {
  exportedAt: string;
  profile: Record<string, string>;
  consents: { kind: string; at: string }[];
  wallet: { balance: number; currency: string };
  children: string[];
}

export function buildExport(input: DataExport): DataExport {
  return {
    exportedAt: input.exportedAt,
    profile: { ...input.profile },
    consents: input.consents.map((row) => ({ ...row })),
    wallet: { ...input.wallet },
    children: [...input.children],
  };
}

export function mayChangeLearningRecord(role: string): boolean {
  return role === 'teacher' || role === 'institution_admin' || role === 'admin';
}

export function commerceEmail(
  kind: 'low_sparks' | 'seat_scaled' | 'course_pending' | 'course_approved' | 'marketplace_pending' | 'data_export' | 'deletion',
  name: string,
): { subject: string; text: string } {
  const who = name.trim() || 'there';
  const letters: Record<typeof kind, { subject: string; text: string }> = {
    low_sparks: {
      subject: 'Sparks are running low',
      text: `Hello ${who},\n\nThe Sparks pool at your institution is under the alert line. Raise the cap, buy a top-up, or wait for the next month. Sparks cannot buy marketplace courses.\n\nPoket School`,
    },
    seat_scaled: {
      subject: 'Student seats were adjusted',
      text: `Hello ${who},\n\nActive students changed during this billing period. The invoice shows a pro-rated charge or credit for the days left. Teachers and parents are not seats.\n\nPoket School`,
    },
    course_pending: {
      subject: 'A course is waiting for your approval',
      text: `Hello ${who},\n\nA teacher submitted a course. It stays out of the institution library until you approve it.\n\nPoket School`,
    },
    course_approved: {
      subject: 'Your course is in the institution library',
      text: `Hello ${who},\n\nThe institution admin approved your course. It is visible to the classes you set. The public marketplace still needs Poket School approval.\n\nPoket School`,
    },
    marketplace_pending: {
      subject: 'A course is waiting for marketplace placement',
      text: `Hello ${who},\n\nAn institution course is ready for the public marketplace. You choose whether it is listed, featured, or a core programme, and which levels it serves.\n\nPoket School`,
    },
    data_export: {
      subject: 'Your Poket School data export',
      text: `Hello ${who},\n\nYour export is ready. It includes your profile, consents, wallet, and linked children.\n\nPoket School`,
    },
    deletion: {
      subject: 'Your deletion request',
      text: `Hello ${who},\n\nWe will erase your profile, wallet, and learning records. Invoices stay for 7 years with your name removed, as the Malaysian PDPA and tax rules require.\n\nPoket School`,
    },
  };
  return letters[kind];
}
