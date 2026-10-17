/**
 * Institution membership, billing, Sparks pools, course access, and co-branding.
 * Firestore writes stay in lib/institution-membership-store.ts.
 * Seat prices stay in lib/institution-pricing.ts.
 */

import { normaliseState } from './institution-states';
import {
  planName,
  quoteInstitution,
  quoteLines,
  seedInstitutionPricing,
  type InstitutionVolumeSchedule,
  type VolumeInterval,
  type VolumePlanId,
  type VolumeQuote,
} from './institution-pricing';

export const GRACE_DAYS = 7;
export const DUNNING_DAY_OFFSETS = [1, 3, 6] as const;
export const MAX_SPARKS_PER_SEAT = 20_000;

export const DEFAULT_SPARKS_BY_PLAN: Record<VolumePlanId, number> = {
  primary_secondary: 300,
  igcse_alevel: 800,
  professional: 1000,
};

export type JoinRole = 'student' | 'teacher' | 'parent';
export type EnrolPath = 'independent' | 'institution';
export type BillingPhase = 'pending_payment' | 'active' | 'grace' | 'suspended';
export type BillingSubject = 'institution' | 'individual';
export type ChargeProduct = 'seat' | 'marketplace' | 'topup';
export type PaymentGatewayId = 'stripe' | 'billplz';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLAN_IDS = new Set<string>(['primary_secondary', 'igcse_alevel', 'professional']);

export function addIsoDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function addInterval(iso: string, interval: VolumeInterval): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  if (interval === 'annual') date.setUTCFullYear(date.getUTCFullYear() + 1);
  else date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

export interface SparksPlanConfig {
  primary_secondary: number;
  igcse_alevel: number;
  professional: number;
}

export function defaultSparksConfig(): SparksPlanConfig {
  return { ...DEFAULT_SPARKS_BY_PLAN };
}

/** A blank or infinite allowance is rejected. Sparks are always a finite monthly number. */
export function normaliseSparksConfig(input: Partial<Record<VolumePlanId, unknown>> | null | undefined): { config: SparksPlanConfig; error: string | null } {
  const config = defaultSparksConfig();
  for (const plan of Object.keys(config) as VolumePlanId[]) {
    const raw = input?.[plan];
    if (raw == null || raw === '') continue;
    const value = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > MAX_SPARKS_PER_SEAT || !Number.isInteger(value)) {
      return { config, error: `${planName(plan)} needs a whole number of Sparks from 0 to ${MAX_SPARKS_PER_SEAT}. There is no unlimited allowance.` };
    }
    config[plan] = value;
  }
  return { config, error: null };
}

export function sparksForPlan(config: SparksPlanConfig, planId: VolumePlanId): number {
  const value = config[planId];
  return Number.isFinite(value) ? value : DEFAULT_SPARKS_BY_PLAN[planId];
}

export interface SparkPool {
  planId: VolumePlanId;
  seats: number;
  perSeat: number;
  allowance: number;
  topUps: number;
  allocated: number;
  available: number;
}

export function buildSparkPool(input: { planId: VolumePlanId; seats: number; perSeat: number; topUps?: number; allocated?: number }): SparkPool | { error: string } {
  const seats = Math.floor(input.seats);
  const perSeat = input.perSeat;
  const topUps = input.topUps ?? 0;
  const allocated = input.allocated ?? 0;
  if (!Number.isInteger(seats) || seats < 0) return { error: 'Seat count is a whole number.' };
  if (!Number.isFinite(perSeat) || perSeat < 0 || perSeat > MAX_SPARKS_PER_SEAT) {
    return { error: 'The per-seat allowance is a finite number. Unlimited Sparks are not offered.' };
  }
  if (!Number.isFinite(topUps) || topUps < 0) return { error: 'A top-up is a finite number of Sparks.' };
  const allowance = seats * perSeat;
  const available = allowance + topUps - allocated;
  return {
    planId: input.planId,
    seats,
    perSeat,
    allowance,
    topUps,
    allocated,
    available,
  };
}

export interface SparkAllocation {
  subjectId: string;
  amount: number;
  classId: string;
}

export function allocateSparks(
  pool: SparkPool,
  current: readonly SparkAllocation[],
  next: SparkAllocation,
): { pool: SparkPool; allocations: SparkAllocation[] } | { error: string } {
  if (!next.subjectId.trim()) return { error: 'Choose a student or class.' };
  if (!Number.isFinite(next.amount) || next.amount < 0 || !Number.isInteger(next.amount)) {
    return { error: 'Allocation is a whole number of Sparks.' };
  }
  const allocations = current.filter((row) => row.subjectId !== next.subjectId);
  if (next.amount > 0) allocations.push({ subjectId: next.subjectId, amount: next.amount, classId: next.classId });
  const allocated = allocations.reduce((sum, row) => sum + row.amount, 0);
  const capacity = pool.allowance + pool.topUps;
  if (allocated > capacity) {
    return { error: `That uses ${allocated} Sparks. The pool has ${capacity}. Buy a top-up or lower an allocation.` };
  }
  return {
    pool: { ...pool, allocated, available: capacity - allocated },
    allocations,
  };
}

export function buySparkTopUp(pool: SparkPool, sparks: number): SparkPool | { error: string } {
  if (!Number.isFinite(sparks) || sparks <= 0 || !Number.isInteger(sparks)) return { error: 'A top-up is a positive whole number of Sparks.' };
  const built = buildSparkPool({ ...pool, topUps: pool.topUps + sparks, allocated: pool.allocated });
  return built;
}

export interface SparkUsageRow {
  subjectId: string;
  name: string;
  allowance: number;
  spent: number;
}

export function sparkUsageReport(pool: SparkPool, rows: readonly SparkUsageRow[]): {
  allowance: number;
  topUps: number;
  spent: number;
  remaining: number;
  rows: SparkUsageRow[];
} {
  const spent = rows.reduce((sum, row) => sum + Math.max(0, row.spent), 0);
  const capacity = pool.allowance + pool.topUps;
  return {
    allowance: pool.allowance,
    topUps: pool.topUps,
    spent,
    remaining: Math.max(0, capacity - spent),
    rows: rows.map((row) => ({ ...row, spent: Math.max(0, row.spent), allowance: Math.max(0, row.allowance) })),
  };
}

export interface JoinDirectoryRow {
  id: string;
  name: string;
  country: string;
  state: string;
  status: string;
  listedForSelfJoin: boolean;
  /** Absent on academies created before automated billing. */
  billingPhase?: BillingPhase | '';
}

export function institutionsForSelfJoin(
  rows: readonly JoinDirectoryRow[],
  country: string,
  state: string,
): JoinDirectoryRow[] {
  const wantedCountry = country.trim().toUpperCase();
  const wantedState = normaliseState(state);
  if (!wantedCountry || !wantedState) return [];
  return rows
    .filter((row) => {
      if (row.status !== 'active' || !row.listedForSelfJoin) return false;
      if (row.billingPhase === 'suspended' || row.billingPhase === 'pending_payment') return false;
      if (row.country.trim().toUpperCase() !== wantedCountry) return false;
      return normaliseState(row.state) === wantedState;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface EnrolmentChoice {
  path: EnrolPath;
  payment: 'online' | 'institution';
  institutionId: string;
  reason: '' | 'chosen' | 'not_listed';
  gateway: PaymentGatewayId;
}

export function chooseEnrolment(input: {
  path: EnrolPath;
  country: string;
  institution: JoinDirectoryRow | null;
}): EnrolmentChoice {
  const gateway = paymentGateway(input.country);
  const listed = input.institution
    && input.institution.status === 'active'
    && input.institution.listedForSelfJoin
    && input.institution.billingPhase !== 'suspended'
    && input.institution.billingPhase !== 'pending_payment';
  if (input.path === 'institution' && listed && input.institution) {
    return { path: 'institution', payment: 'institution', institutionId: input.institution.id, reason: '', gateway };
  }
  return {
    path: 'independent',
    payment: 'online',
    institutionId: '',
    reason: input.path === 'institution' ? 'not_listed' : 'chosen',
    gateway,
  };
}

export function paymentGateway(country: string): PaymentGatewayId {
  return country.trim().toUpperCase() === 'MY' ? 'billplz' : 'stripe';
}

/**
 * Institution students, teachers, and parents are not billed for the seat.
 * A parent account is free on either path. Marketplace courses are paid by the
 * buyer, or by the institution when it bulk-buys them onto its invoice.
 * Sparks are not a marketplace tender. Top-ups of an institution pool are paid
 * by the institution. Person-level prices live in lib/institution-commerce.ts.
 */
export function chargeFor(input: {
  membership: EnrolPath;
  product: ChargeProduct;
  role?: JoinRole;
  marketplacePayer?: 'individual' | 'institution';
}): 'waived' | 'individual' | 'institution' {
  if (input.product === 'marketplace') return input.marketplacePayer === 'institution' ? 'institution' : 'individual';
  if (input.role === 'parent') return 'waived';
  if (input.membership === 'institution') return input.product === 'topup' ? 'institution' : 'waived';
  return 'individual';
}

export interface JoinRequest {
  userId: string;
  institutionId: string;
  role: JoinRole;
  name: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  level: VolumePlanId | '';
  classIds: string[];
  courseIds: string[];
  childEmails: string[];
}

export function draftJoinRequest(input: {
  userId: string;
  institutionId: string;
  role: JoinRole;
  name: string;
  email: string;
  childEmails?: readonly string[];
}): JoinRequest | { error: string } {
  const email = input.email.trim().toLowerCase();
  const name = input.name.replace(/\s+/g, ' ').trim();
  if (!input.userId || !input.institutionId) return { error: 'Choose an institution.' };
  if (!name || name.length > 120) return { error: 'Enter the name to show on the register.' };
  if (!EMAIL.test(email)) return { error: 'Enter a valid email.' };
  const childEmails = (input.childEmails ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (childEmails.some((value) => !EMAIL.test(value))) return { error: 'Each child email needs to be valid.' };
  return {
    userId: input.userId,
    institutionId: input.institutionId,
    role: input.role,
    name,
    email,
    status: 'pending',
    level: '',
    classIds: [],
    courseIds: [],
    childEmails,
  };
}

export function reviewJoin(
  request: JoinRequest,
  decision: { status: 'approved' | 'rejected'; level?: VolumePlanId | ''; classIds?: readonly string[]; courseIds?: readonly string[] },
): JoinRequest | { error: string } {
  if (request.status !== 'pending') return { error: 'This request has already been decided.' };
  if (decision.status === 'rejected') {
    return { ...request, status: 'rejected', level: '', classIds: [], courseIds: [] };
  }
  const level = decision.level ?? '';
  if (request.role === 'student' && !PLAN_IDS.has(level)) {
    return { error: 'Choose a level: Primary & Lower Secondary, IGCSE & A-Level, or Professional & Degrees.' };
  }
  return {
    ...request,
    status: 'approved',
    level: PLAN_IDS.has(level) ? level as VolumePlanId : '',
    classIds: [...new Set((decision.classIds ?? []).map((id) => id.trim()).filter(Boolean))],
    courseIds: [...new Set((decision.courseIds ?? []).map((id) => id.trim()).filter(Boolean))],
  };
}

export interface RosterRow {
  email: string;
  name: string;
  role: JoinRole;
  childEmail: string;
}

export function parseRosterCsv(text: string): { rows: RosterRow[]; errors: string[] } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rows: RosterRow[] = [];
  const errors: string[] = [];
  lines.forEach((line, index) => {
    if (index === 0 && /^e-?mail\b/i.test(line)) return;
    const [emailRaw = '', nameRaw = '', roleRaw = '', childRaw = ''] = line.split(',').map((part) => part.trim());
    const email = emailRaw.toLowerCase();
    if (!EMAIL.test(email)) {
      errors.push(`Line ${index + 1} needs an email address.`);
      return;
    }
    const roleText = roleRaw.toLowerCase();
    const role: JoinRole | null = roleText === 'teacher' ? 'teacher' : roleText === 'parent' ? 'parent' : roleText === 'student' || roleText === '' ? 'student' : null;
    if (!role) {
      errors.push(`Line ${index + 1}: role must be student, parent, or teacher.`);
      return;
    }
    const childEmail = childRaw.toLowerCase();
    if (role === 'parent' && childEmail && !EMAIL.test(childEmail)) {
      errors.push(`Line ${index + 1}: the child email is not valid.`);
      return;
    }
    rows.push({ email, name: nameRaw || email, role, childEmail: role === 'parent' ? childEmail : '' });
  });
  return { rows, errors };
}

const JOIN_CODE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

export function inviteCodeUsable(code: string, institutionStatus: string): boolean {
  return institutionStatus === 'active' && JOIN_CODE.test(code.trim().toUpperCase());
}

export interface SubscriptionState {
  subject: BillingSubject;
  phase: BillingPhase;
  planId: VolumePlanId;
  interval: VolumeInterval;
  seats: number;
  currency: string;
  total: number;
  periodEnd: string;
  failedOn: string;
  graceEndsOn: string;
  suspendedOn: string;
  remindersSent: string[];
  payerEmail: string;
}

export interface BillingNotice {
  kind: 'payment_link' | 'dunning' | 'suspend' | 'restore' | 'invoice';
  on: string;
  day?: number;
}

export function openSubscription(input: {
  subject: BillingSubject;
  planId: VolumePlanId;
  interval: VolumeInterval;
  seats: number;
  currency: string;
  total: number;
  payerEmail: string;
  on: string;
}): { state: SubscriptionState; notices: BillingNotice[] } {
  const state: SubscriptionState = {
    subject: input.subject,
    phase: 'pending_payment',
    planId: input.planId,
    interval: input.interval,
    seats: Math.max(0, Math.floor(input.seats)),
    currency: input.currency,
    total: input.total,
    periodEnd: '',
    failedOn: '',
    graceEndsOn: '',
    suspendedOn: '',
    remindersSent: [],
    payerEmail: input.payerEmail.trim().toLowerCase(),
  };
  return { state, notices: [{ kind: 'payment_link', on: input.on }] };
}

export function recordPayment(state: SubscriptionState, paidOn: string, interval: VolumeInterval = state.interval): { state: SubscriptionState; notices: BillingNotice[] } {
  if (!DATE.test(paidOn)) return { state, notices: [] };
  const base = state.phase === 'active' && state.periodEnd && state.periodEnd > paidOn ? state.periodEnd : paidOn;
  const restored = state.phase === 'grace' || state.phase === 'suspended';
  const next: SubscriptionState = {
    ...state,
    phase: 'active',
    interval,
    periodEnd: addInterval(base, interval),
    failedOn: '',
    graceEndsOn: '',
    suspendedOn: '',
    remindersSent: [],
  };
  const notices: BillingNotice[] = [{ kind: 'invoice', on: paidOn }];
  if (restored) notices.unshift({ kind: 'restore', on: paidOn });
  return { state: next, notices };
}

export function failRenewal(state: SubscriptionState, today: string): { state: SubscriptionState; notices: BillingNotice[] } {
  if (!DATE.test(today) || state.phase === 'suspended') return { state, notices: [] };
  if (state.phase === 'grace') return advanceSubscription(state, today);
  const failedOn = state.periodEnd && DATE.test(state.periodEnd) ? state.periodEnd : today;
  const entered: SubscriptionState = {
    ...state,
    phase: 'grace',
    failedOn,
    graceEndsOn: addIsoDays(failedOn, GRACE_DAYS),
    suspendedOn: '',
  };
  return advanceSubscription(entered, today);
}

/** Moves grace forward, sends each reminder once, and suspends on the seventh day. */
export function advanceSubscription(state: SubscriptionState, today: string): { state: SubscriptionState; notices: BillingNotice[] } {
  if (!DATE.test(today) || state.phase !== 'grace' || !DATE.test(state.failedOn)) return { state, notices: [] };
  const notices: BillingNotice[] = [];
  const remindersSent = [...state.remindersSent];
  for (const offset of DUNNING_DAY_OFFSETS) {
    const on = addIsoDays(state.failedOn, offset);
    if (today >= on && !remindersSent.includes(on)) {
      remindersSent.push(on);
      notices.push({ kind: 'dunning', on, day: offset });
    }
  }
  let next: SubscriptionState = { ...state, remindersSent };
  if (state.graceEndsOn && today >= state.graceEndsOn) {
    next = { ...next, phase: 'suspended', suspendedOn: state.graceEndsOn };
    notices.push({ kind: 'suspend', on: state.graceEndsOn });
  }
  return { state: next, notices };
}

export function learningOpen(phase: BillingPhase): boolean {
  return phase === 'active' || phase === 'grace';
}

export function institutionInvoiceLines(input: {
  institutionName: string;
  issuedOn: string;
  quote: VolumeQuote;
  poNumber?: string;
}): string[] {
  return quoteLines({ kind: 'invoice', institutionName: input.institutionName, issuedOn: input.issuedOn, quote: input.quote, poNumber: input.poNumber });
}

export function quoteForInstitution(input: {
  schedule?: InstitutionVolumeSchedule;
  seats: number;
  planId: VolumePlanId;
  interval: VolumeInterval;
}): VolumeQuote {
  return quoteInstitution({
    schedule: input.schedule ?? seedInstitutionPricing(),
    seats: input.seats,
    override: { planId: input.planId, interval: input.interval, discountPercent: 0, addons: [], waivePlatformFee: false, customPerStudent: null },
  });
}

export interface CoreProgramme {
  id: string;
  level: VolumePlanId;
  title: string;
}

export function entitledProgrammes(paidLevels: readonly VolumePlanId[], programmes: readonly CoreProgramme[]): CoreProgramme[] {
  const paid = new Set(paidLevels);
  return programmes.filter((programme) => paid.has(programme.level));
}

const PROGRAMME_PLAN: Record<string, VolumePlanId> = {
  primary: 'primary_secondary',
  'lower secondary': 'primary_secondary',
  secondary: 'primary_secondary',
  igcse: 'igcse_alevel',
  'a-level': 'igcse_alevel',
  'a level': 'igcse_alevel',
  'llb law': 'professional',
  'mbbs medicine': 'professional',
  engineering: 'professional',
  nursing: 'professional',
  'micro degree': 'professional',
  'professional certification': 'professional',
  professional: 'professional',
};

export function volumePlanForProgramme(name: string): VolumePlanId | null {
  return PROGRAMME_PLAN[name.trim().toLowerCase()] ?? null;
}

export interface AccessViewer {
  userId: string;
  role: 'student' | 'parent' | 'teacher' | 'institution_admin' | 'admin';
  institutionId: string;
  level: VolumePlanId | '';
  classIds: readonly string[];
  childIds: readonly string[];
  purchasedCourseIds: readonly string[];
  entitledLevels: readonly VolumePlanId[];
}

export interface AccessCourse {
  id: string;
  institutionId?: string;
  visibility?: 'core' | 'institution' | 'marketplace' | 'legacy' | '';
  level?: VolumePlanId | '';
  marketplaceApproved?: boolean;
  /** Absent on courses created before the library gate. Those stay visible. */
  libraryApproved?: boolean;
  classIds?: readonly string[];
  ownerId?: string;
}

export interface AccessStudent {
  id: string;
  institutionId: string;
  classIds: readonly string[];
}

function overlaps(left: readonly string[], right: readonly string[]): boolean {
  const set = new Set(left);
  return right.some((id) => set.has(id));
}

export function canSeeStudent(viewer: AccessViewer, student: AccessStudent): boolean {
  if (viewer.role === 'admin') return true;
  if (viewer.userId === student.id) return true;
  if (viewer.role === 'parent') return viewer.childIds.includes(student.id);
  if (!viewer.institutionId || viewer.institutionId !== student.institutionId) return false;
  if (viewer.role === 'institution_admin') return true;
  if (viewer.role === 'teacher') return overlaps(viewer.classIds, student.classIds);
  return false;
}

export function canSeeCourse(viewer: AccessViewer, course: AccessCourse): boolean {
  if (viewer.role === 'admin') return true;
  const visibility = course.visibility || 'legacy';
  if (visibility === 'legacy') return true;
  if (visibility === 'marketplace') {
    return course.marketplaceApproved === true || !course.institutionId;
  }
  if (visibility === 'core') {
    if (viewer.role === 'parent') return false;
    return !!course.level && viewer.entitledLevels.includes(course.level) && (viewer.role !== 'student' || viewer.level === course.level || viewer.level === '');
  }
  if (!course.institutionId || viewer.institutionId !== course.institutionId) return false;
  const inLibrary = course.libraryApproved !== false;
  if (viewer.role === 'institution_admin') return true;
  if (viewer.role === 'teacher') {
    if (course.ownerId && course.ownerId === viewer.userId) return true;
    if (!inLibrary) return false;
    if (!course.classIds || course.classIds.length === 0) return false;
    return overlaps(viewer.classIds, course.classIds);
  }
  if (!inLibrary) return false;
  if (viewer.role === 'student') {
    if (course.classIds && course.classIds.length > 0) return overlaps(viewer.classIds, course.classIds);
    return true;
  }
  return false;
}

/** Core programmes for the student's level are listed even before an enrolment row exists. */
export function autoVisibleCourseIds(viewer: AccessViewer, courses: readonly AccessCourse[]): string[] {
  if (viewer.role !== 'student' || !viewer.level) return [];
  return courses
    .filter((course) => course.visibility === 'core' && course.level === viewer.level && viewer.entitledLevels.includes(viewer.level as VolumePlanId))
    .map((course) => course.id);
}

export interface PartnerOrg {
  id: string;
  name: string;
  logoUrl: string;
  recognisedBy: string;
}

export interface CobrandSetting {
  enabled: boolean;
  partnerId: string;
}

export interface ResolvedCobrand {
  creator: 'Poket School';
  partnerName: string;
  logoUrl: string;
  recognisedBy: string;
}

export function resolveCobrand(setting: CobrandSetting | null | undefined, partners: readonly PartnerOrg[]): ResolvedCobrand | null {
  if (!setting?.enabled || !setting.partnerId) return null;
  const partner = partners.find((row) => row.id === setting.partnerId);
  if (!partner || !partner.name.trim()) return null;
  const recognisedBy = partner.recognisedBy.trim() || `Recognised by ${partner.name.trim()}`;
  return {
    creator: 'Poket School',
    partnerName: partner.name.trim(),
    logoUrl: partner.logoUrl.trim(),
    recognisedBy,
  };
}

export interface PartnerSale {
  partnerId: string;
  channel: 'enterprise_invoice' | 'individual';
  amount: number;
  currency: string;
  seats: number;
}

export function partnerRevenue(sales: readonly PartnerSale[]): { partnerId: string; currency: string; enterprise: number; individual: number; total: number; seats: number }[] {
  const map = new Map<string, { partnerId: string; currency: string; enterprise: number; individual: number; total: number; seats: number }>();
  for (const sale of sales) {
    if (!Number.isFinite(sale.amount) || sale.amount < 0) continue;
    const key = `${sale.partnerId}:${sale.currency}`;
    const row = map.get(key) ?? { partnerId: sale.partnerId, currency: sale.currency, enterprise: 0, individual: 0, total: 0, seats: 0 };
    if (sale.channel === 'enterprise_invoice') row.enterprise += sale.amount;
    else row.individual += sale.amount;
    row.total += sale.amount;
    row.seats += Math.max(0, sale.seats);
    map.set(key, row);
  }
  return [...map.values()];
}

export function certificateCarriesCobrand(setting: CobrandSetting | null | undefined, partners: readonly PartnerOrg[]): ResolvedCobrand | null {
  return resolveCobrand(setting, partners);
}

export const ONBOARDING_STEPS = [
  { id: 'profile', label: 'Academy name, country, and state' },
  { id: 'logo', label: 'Logo on the academy and on certificates' },
  { id: 'subdomain', label: 'Subdomain or custom domain' },
  { id: 'billing', label: 'Price tier, seats, and payment' },
  { id: 'admin', label: 'Institution admin signed in' },
  { id: 'classes', label: 'At least one class' },
  { id: 'people', label: 'Invite code, CSV, or self-join listing' },
  { id: 'sparks', label: 'Sparks pool checked for the plan' },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]['id'];

export function onboardingProgress(done: Partial<Record<OnboardingStepId, boolean>>): { id: OnboardingStepId; label: string; done: boolean; remaining: number; complete: boolean } {
  const steps = ONBOARDING_STEPS.map((step) => ({ ...step, done: done[step.id] === true }));
  const remaining = steps.filter((step) => !step.done).length;
  return { id: steps.find((step) => !step.done)?.id ?? 'sparks', label: steps.find((step) => !step.done)?.label ?? 'Ready', done: remaining === 0, remaining, complete: remaining === 0 };
}

export function onboardingChecklist(done: Partial<Record<OnboardingStepId, boolean>>): { id: OnboardingStepId; label: string; done: boolean }[] {
  return ONBOARDING_STEPS.map((step) => ({ id: step.id, label: step.label, done: done[step.id] === true }));
}

export interface MembershipAudit {
  actorId: string;
  actorName: string;
  action: string;
  target: string;
  detail?: string;
  at: string;
}

export function membershipAudit(input: Omit<MembershipAudit, 'at'> & { at?: string }): MembershipAudit {
  return {
    actorId: input.actorId,
    actorName: input.actorName,
    action: input.action,
    target: input.target,
    detail: input.detail,
    at: input.at ?? new Date().toISOString(),
  };
}

export interface MembershipNotice {
  kind: string;
  title: string;
  body: string;
  audience: 'institution_admin' | 'user';
}

export function noticeFor(kind: BillingNotice['kind'] | 'join_request' | 'join_approved' | 'join_rejected', institutionName: string): MembershipNotice {
  if (kind === 'join_request') {
    return { kind, audience: 'institution_admin', title: 'New join request', body: `Someone asked to join ${institutionName}. Approve them from the queue and assign a level, classes, and courses.` };
  }
  if (kind === 'join_approved') {
    return { kind, audience: 'user', title: `You are in ${institutionName}`, body: `${institutionName} approved your account. Your level and classes are on your dashboard. Poket School does not charge you for this seat.` };
  }
  if (kind === 'join_rejected') {
    return { kind, audience: 'user', title: `${institutionName} did not approve the request`, body: 'You can keep an independent Poket School account and pay online, or ask the institution to invite you.' };
  }
  if (kind === 'payment_link') return { kind, audience: 'institution_admin', title: 'Payment link', body: `Pay the ${institutionName} invoice to open the academy.` };
  if (kind === 'dunning') return { kind, audience: 'institution_admin', title: 'Payment reminder', body: `${institutionName} is in the 7-day grace period.` };
  if (kind === 'suspend') return { kind, audience: 'institution_admin', title: 'Academy suspended', body: `${institutionName} is suspended until the invoice is paid.` };
  if (kind === 'restore') return { kind, audience: 'institution_admin', title: 'Academy restored', body: `Payment received. ${institutionName} is active again.` };
  return { kind, audience: 'institution_admin', title: 'Invoice', body: `A Poket School invoice for ${institutionName} is ready.` };
}

export interface EmailDraft {
  subject: string;
  text: string;
}

export function institutionEmail(kind: 'payment_link' | 'dunning' | 'suspended' | 'restored' | 'invoice' | 'invite' | 'join_approved' | 'join_rejected' | 'join_received', vars: {
  institutionName: string;
  plan?: string;
  seats?: number;
  total?: string;
  link?: string;
  graceEnds?: string;
  code?: string;
  personName?: string;
}): EmailDraft {
  const name = vars.institutionName || 'your institution';
  const link = vars.link || 'https://poketschool.ai';
  if (kind === 'payment_link') {
    return {
      subject: `Pay for ${name} on Poket School`,
      text: [
        `Poket School has opened ${name}.`,
        vars.plan ? `Plan: ${vars.plan}.` : '',
        typeof vars.seats === 'number' ? `Seats: ${vars.seats}.` : '',
        vars.total ? `Total: ${vars.total}.` : '',
        `Pay online: ${link}`,
        'Students who join this institution are not charged by Poket School for the seat.',
      ].filter(Boolean).join('\n'),
    };
  }
  if (kind === 'dunning') {
    return {
      subject: `Payment reminder for ${name}`,
      text: `Payment for ${name} did not go through. The academy stays open until ${vars.graceEnds || 'the end of the 7-day grace period'}. Pay here: ${link}`,
    };
  }
  if (kind === 'suspended') {
    return {
      subject: `${name} is suspended`,
      text: `${name} is suspended after the grace period. Learning stays paused until the invoice is paid: ${link}`,
    };
  }
  if (kind === 'restored') {
    return {
      subject: `${name} is active again`,
      text: `Payment received. ${name} is restored on Poket School. ET AI and the academy dashboard are open.`,
    };
  }
  if (kind === 'invite') {
    return {
      subject: `Join ${name} on Poket School`,
      text: `${vars.personName || 'Hello'},\n${name} invited you to Poket School. Use invite code ${vars.code || ''} or open ${link}.`,
    };
  }
  if (kind === 'join_received') {
    return {
      subject: `Join request for ${name}`,
      text: `${vars.personName || 'A person'} asked to join ${name}. Open the approvals queue to assign a level, classes, and courses.`,
    };
  }
  if (kind === 'join_approved') {
    return {
      subject: `${name} approved your Poket School account`,
      text: `${vars.personName || 'Hello'}, ${name} approved you. Poket School does not charge you for this seat. Open ${link}`,
    };
  }
  if (kind === 'join_rejected') {
    return {
      subject: `${name} did not approve the request`,
      text: 'You can continue as an independent learner and pay online, or ask the institution for an invite code.',
    };
  }
  return {
    subject: `Poket School invoice for ${name}`,
    text: `Your invoice for ${name} is attached. Total ${vars.total || ''}. ${link}`,
  };
}
