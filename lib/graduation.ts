/**
 * Graduation polish: suggestions, the bill before confirm, a 7-day undo,
 * the achievement summary, and the alumni upgrade.
 * Certificates are still issued only when a final assessment has passed.
 */

import { alumniPrice, publicName } from './alumni';
import { planTierReview, type InstitutionCatalogue, type TierReview } from './institution-catalogue';
import { nextLevel } from './institution-join';
import type { Coupon } from './payments/coupons';
import { seedPricing } from './pricing';

export const UNDO_DAYS = 7;
export const GRADUATE_BADGE = 'Graduate';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function addDays(iso: string, days: number): string {
  const ms = Date.parse(`${iso}T00:00:00Z`);
  if (!DATE.test(iso) || Number.isNaN(ms)) return iso;
  return new Date(ms + days * 86_400_000).toISOString().slice(0, 10);
}

function clip(value: string, max = 100): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

export interface ReadyGraduate {
  studentId: string;
  schoolStudentId: string;
  name: string;
  email: string;
  studentNumber: string;
  level: string;
}

export interface GraduationCandidate {
  role: string;
  status: string;
  level: string;
  studentId: string;
  schoolStudentId: string;
  name: string;
  email: string;
  studentNumber: string;
}

/** Joined students whose next level is Graduated. Parents and leavers stay. */
export function graduationSuggestions(rows: readonly GraduationCandidate[]): GraduationCandidate[] {
  return rows.filter((row) => row.role === 'student' && row.status === 'joined' && nextLevel(row.level).graduated);
}

export function undoUntil(leftOn: string): string {
  return addDays(leftOn, UNDO_DAYS);
}

/** Inclusive through the seventh day. 17 October stays open through 24 October. */
export function canUndoGraduation(input: {
  leftOn: string;
  today: string;
  undoneOn?: string;
  seatFreed?: boolean;
}): boolean {
  if (input.undoneOn) return false;
  if (input.seatFreed === false) return false;
  if (!DATE.test(input.leftOn) || !DATE.test(input.today)) return false;
  return input.today <= undoUntil(input.leftOn);
}

export interface GraduationBillPreview {
  graduating: number;
  seatsFreed: number;
  studentsAfter: number;
  action: TierReview['action'] | 'no_bill';
  message: string;
  currency: string;
  currentTotal: number;
  nextTotal: number;
  charge: number;
  savings: number;
  fromName: string;
  toName: string;
}

function seatsPhrase(count: number): string {
  return count === 1 ? '1 seat is free today' : `${count} seats are free today`;
}

/**
 * Shows seats freed and the next bill before anyone is graduated.
 * A cheaper tier is suggested at renewal. The paid bill is not cut mid-cycle.
 */
export function previewGraduationBill(input: {
  graduating: number;
  currentStudents: number;
  currentSeats: number;
  currentTotal: number;
  currentTierId?: string;
  itemIds: readonly string[];
  interval: 'monthly' | 'annual';
  country: string;
  periodStart: string;
  periodEnd: string;
  today: string;
  billingActive: boolean;
  catalogue?: InstitutionCatalogue;
}): GraduationBillPreview {
  const graduating = Math.max(0, Math.floor(input.graduating));
  const currentStudents = Math.max(0, Math.floor(input.currentStudents));
  const seatsFreed = Math.min(graduating, currentStudents);
  const studentsAfter = Math.max(0, currentStudents - graduating);
  const base = {
    graduating,
    seatsFreed,
    studentsAfter,
    currency: '',
    currentTotal: Number.isFinite(input.currentTotal) ? input.currentTotal : 0,
    nextTotal: Number.isFinite(input.currentTotal) ? input.currentTotal : 0,
    charge: 0,
    savings: 0,
    fromName: '',
    toName: '',
  };
  if (!input.billingActive) {
    return {
      ...base,
      action: 'no_bill',
      message: `${seatsPhrase(seatsFreed)}. The tier is reviewed when a bill is active.`,
    };
  }
  const review = planTierReview({
    catalogue: input.catalogue,
    currentTierId: input.currentTierId,
    currentSeats: input.currentSeats,
    currentTotal: input.currentTotal,
    students: studentsAfter,
    itemIds: input.itemIds,
    interval: input.interval,
    country: input.country,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    on: input.today,
  });
  if ('error' in review) {
    return { ...base, action: 'stay', message: `${seatsPhrase(seatsFreed)}. ${review.error}` };
  }
  const priced = {
    ...base,
    action: review.action,
    currency: review.currency,
    nextTotal: review.action === 'stay' ? base.currentTotal : review.nextTotal,
    charge: review.charge,
    savings: review.savings,
    fromName: review.fromName,
    toName: review.toName,
  };
  if (review.action === 'stay') {
    const bill = studentsAfter < 1
      ? 'The paid bill stays for this period.'
      : `${review.fromName || 'This tier'} still matches ${studentsAfter} unique students, so this period's bill stays.`;
    return { ...priced, message: `${seatsPhrase(seatsFreed)}. ${bill}` };
  }
  return { ...priced, message: `${seatsPhrase(seatsFreed)}. ${review.message}` };
}

export function graduationLetter(input: {
  audience: 'student' | 'parent';
  institutionName: string;
  studentName: string;
  discount: number;
  reviewOpen: boolean;
  graceEndsOn: string;
  upgradeUrl: string;
}): { subject: string; text: string } {
  const percent = Math.round(Math.max(0, Math.min(0.8, input.discount)) * 100);
  const student = input.studentName.trim() || (input.audience === 'parent' ? 'Your child' : 'Hello');
  const academy = input.institutionName.trim() || 'the academy';
  const greeting = input.audience === 'parent' ? 'Hello,' : `${student},`;
  const whose = input.audience === 'parent' ? `${student}'s` : 'Your';
  const review = input.reviewOpen
    ? `Academy courses stay open to review until ${input.graceEndsOn}. The seat is already free.`
    : 'The academy seat is free. Completed academy courses stay on the Completed shelf.';
  const offer = percent > 0
    ? `An alumni discount of ${percent}% applies when checkout continues: ${input.upgradeUrl}`
    : `Continue to an individual plan: ${input.upgradeUrl}`;
  return {
    subject: input.audience === 'parent'
      ? `${student} graduated from ${academy}`
      : `You graduated from ${academy}`,
    text: [
      greeting,
      `${whose} Poket School account is now an individual account.`,
      'Records kept: profile, student number, certificates, badges, the Graduate badge, transcript, and progress.',
      'Still free: the profile, student number, certificates, badges, transcript, progress, and completed academy courses.',
      'Paid from here: new courses and an individual plan.',
      review,
      offer,
    ].join('\n'),
  };
}

export function achievementLines(input: {
  name: string;
  studentNumber: string;
  institutionName: string;
  level: string;
  graduatedOn: string;
  badge: string;
  courses: readonly string[];
  certificates: readonly string[];
  discount: number;
  verifyUrl: string;
}): string[] {
  const percent = Math.round(Math.max(0, Math.min(0.8, input.discount)) * 100);
  const lines = [
    'Poket School achievement summary',
    clip(input.name || 'Student'),
    clip(input.studentNumber.trim().toUpperCase()),
    clip(input.institutionName.trim() || 'Poket School'),
    input.level.trim() ? clip(input.level.trim()) : '',
    DATE.test(input.graduatedOn) ? `Graduated ${input.graduatedOn}` : '',
    input.badge.trim() ? `Badge: ${clip(input.badge, 90)}` : '',
    'Records kept: profile, student number, certificates, badges, transcript, progress.',
    'Still free: profile, student number, certificates, badges, transcript, completed courses.',
    'Paid from here: new courses and an individual plan.',
    percent > 0 ? `Alumni discount ${percent}% applies when checkout continues.` : '',
    'Completed courses',
    ...input.courses.slice(0, 8).map((title) => clip(title)),
    'Certificates',
    ...input.certificates.slice(0, 6).map((title) => clip(title)),
    input.verifyUrl.trim() ? clip(`Verify ${input.verifyUrl.trim()}`) : '',
  ].filter(Boolean);
  return lines.slice(0, 42).map((line) => line.slice(0, 100));
}

export interface GraduationCard {
  badge: typeof GRADUATE_BADGE;
  name: string;
  publicName: string;
  institutionName: string;
  level: string;
  studentNumber: string;
  graduatedOn: string;
  qrUrl: string;
}

export function graduationCard(input: {
  name: string;
  institutionName: string;
  level: string;
  studentNumber: string;
  graduatedOn: string;
}): GraduationCard {
  const studentNumber = input.studentNumber.trim().toUpperCase();
  return {
    badge: GRADUATE_BADGE,
    name: input.name.trim() || 'Graduate',
    publicName: publicName(input.name),
    institutionName: input.institutionName.trim() || 'Poket School',
    level: input.level.trim(),
    studentNumber,
    graduatedOn: DATE.test(input.graduatedOn) ? input.graduatedOn : '',
    qrUrl: studentNumber ? `https://poketschool.ai/p/${studentNumber}` : 'https://poketschool.ai',
  };
}

/** Law and Medicine use their own plan when that plan has a price. Otherwise the professional plan. */
export function individualPlanSku(level: string): 'primary_secondary' | 'igcse_alevel' | 'professional' | 'llb' | 'mbbs' {
  const wanted = level === 'Law'
    ? 'llb'
    : level === 'Medicine' || level === 'MBBS'
      ? 'mbbs'
      : level === 'Primary' || level === 'Lower Secondary'
        ? 'primary_secondary'
        : level === 'Degree' || level === 'Professional' || level === 'Graduated'
          ? 'professional'
          : 'igcse_alevel';
  const plan = seedPricing().plans.find((item) => item.id === wanted);
  if (!plan) return 'professional';
  if ((wanted === 'llb' || wanted === 'mbbs') && !(typeof plan.monthlyUsd === 'number' && plan.monthlyUsd > 0)) return 'professional';
  return wanted;
}

export function individualOffer(level: string, discount: number): {
  sku: string;
  listMonthly: number;
  monthly: number;
  percent: number;
  href: string;
} {
  const sku = individualPlanSku(level);
  const stored = seedPricing().plans.find((item) => item.id === sku)?.monthlyUsd;
  const published = sku === 'primary_secondary' ? 49 : sku === 'professional' || sku === 'llb' ? 99 : 0;
  const listMonthly = typeof stored === 'number' && stored > 0 ? stored : published;
  const priced = alumniPrice(listMonthly, discount);
  return {
    sku,
    listMonthly,
    monthly: priced.monthly,
    percent: Math.round(priced.discount * 100),
    href: `/dashboard/checkout?kind=subscription&sku=${encodeURIComponent(sku)}&interval=month`,
  };
}

export function alumniUpgradeUrl(level: string, origin = 'https://poketschool.ai'): string {
  const offer = individualOffer(level, 0);
  return `${origin.replace(/\/$/, '')}${offer.href}`;
}

/** In-memory percent. It is not a referral code and does not need the affiliates flag. */
export function alumniCheckoutCoupon(discount: number): Coupon | null {
  const percentOff = Math.round(Math.max(0, Math.min(0.8, discount)) * 100);
  if (percentOff <= 0) return null;
  return { code: 'ALUMNI', percentOff, revenueShareBps: 0, active: true, redemptions: 0 };
}
