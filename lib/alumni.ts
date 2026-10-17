/**
 * Finished courses and alumni records.
 * A certificate is recorded only when a final assessment has already passed.
 * This module does not issue certificates.
 */

import { nextLevel } from './institution-join';

export const DEFAULT_ALUMNI_GRACE_DAYS = 30;
export const DEFAULT_ALUMNI_DISCOUNT = 0.15;
export const HOLDER_REVOCATION = "revoked at holder's request";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type CourseBilling = 'subscription' | 'a_la_carte' | 'both' | '';
export type InstitutionAccess = 'active' | 'grace' | 'ended' | '';
export type ReviewAccess = 'read_only' | 'lifetime' | 'ended';
export type LeaveReason = 'marked' | 'final_level' | 'end_date';

export interface FinishedCourse {
  courseId: string;
  title: string;
  level: string;
  programmeId: string;
  access: CourseBilling;
  progress: number;
  passedFinal: boolean;
  institutionPaid: boolean;
}

export interface ShelfCourse {
  courseId: string;
  title: string;
  review: ReviewAccess;
  certificate: 'recorded' | 'on_final_pass';
}

export interface CourseOption {
  id: string;
  title: string;
  level: string;
  programmeId: string;
  access: CourseBilling;
}

export interface Recommendation {
  id: string;
  title: string;
  level: string;
  action: 'enrol' | 'ask_school';
}

export interface AlumniPolicy {
  graceDays: number;
  /** Fraction, 0.15 means 15% off the individual plan. */
  discount: number;
  newsletter: boolean;
  endDate: string;
  /** Seed rate until an academy saves its own. */
  placeholder: boolean;
}

export interface AlumniPerson {
  id: string;
  studentId: string;
  schoolStudentId: string;
  name: string;
  studentNumber: string;
  email: string;
  institutionId: string;
  institutionName: string;
  level: string;
  leftOn: string;
  graceEndsOn: string;
  reason: LeaveReason;
  certificates: number;
  seatFreed: boolean;
  publicProfile: boolean;
}

export function defaultAlumniPolicy(): AlumniPolicy {
  return { graceDays: DEFAULT_ALUMNI_GRACE_DAYS, discount: DEFAULT_ALUMNI_DISCOUNT, newsletter: false, endDate: '', placeholder: true };
}

export function readAlumniPolicy(data: unknown): AlumniPolicy {
  const policy = defaultAlumniPolicy();
  if (!data || typeof data !== 'object') return policy;
  const raw = data as Partial<AlumniPolicy>;
  if (typeof raw.graceDays === 'number' && Number.isFinite(raw.graceDays)) {
    policy.graceDays = Math.max(0, Math.min(365, Math.floor(raw.graceDays)));
  }
  if (typeof raw.discount === 'number' && Number.isFinite(raw.discount)) {
    policy.discount = Math.max(0, Math.min(0.8, Math.round(raw.discount * 100) / 100));
  }
  policy.newsletter = raw.newsletter === true;
  policy.endDate = typeof raw.endDate === 'string' && DATE.test(raw.endDate) ? raw.endDate : '';
  policy.placeholder = raw.placeholder === false ? false : policy.placeholder;
  return policy;
}

function addDays(iso: string, days: number): string {
  const ms = Date.parse(`${iso}T00:00:00Z`);
  if (!DATE.test(iso) || Number.isNaN(ms)) return iso;
  return new Date(ms + days * 86_400_000).toISOString().slice(0, 10);
}

/** Subscription review lasts while that subscription is open. À la carte stays. */
export function reviewAccess(input: {
  access: CourseBilling;
  institutionPaid: boolean;
  subscriptionActive: boolean;
  institutionAccess: InstitutionAccess;
}): ReviewAccess {
  if (input.access === 'a_la_carte') return 'lifetime';
  if (input.access === 'both' && !input.institutionPaid) return 'lifetime';
  const academyOpen = input.institutionAccess === 'active' || input.institutionAccess === 'grace';
  if (input.institutionPaid) return academyOpen ? 'read_only' : 'ended';
  return input.subscriptionActive || academyOpen ? 'read_only' : 'ended';
}

export function completedShelf(courses: readonly FinishedCourse[], access: {
  subscriptionActive: boolean;
  institutionAccess: InstitutionAccess;
}): { learning: FinishedCourse[]; completed: ShelfCourse[] } {
  const learning: FinishedCourse[] = [];
  const completed: ShelfCourse[] = [];
  for (const course of courses) {
    if (course.progress < 100) {
      learning.push(course);
      continue;
    }
    completed.push({
      courseId: course.courseId,
      title: course.title,
      review: reviewAccess({
        access: course.access,
        institutionPaid: course.institutionPaid,
        subscriptionActive: access.subscriptionActive,
        institutionAccess: access.institutionAccess,
      }),
      certificate: course.passedFinal ? 'recorded' : 'on_final_pass',
    });
  }
  return { learning, completed };
}

/** Next level name, then a one-click enrol or a note for the academy. */
export function recommendNext(input: {
  level: string;
  finishedIds: readonly string[];
  atInstitution: boolean;
  options: readonly CourseOption[];
}): Recommendation[] {
  const moved = nextLevel(input.level);
  if (moved.graduated) return [];
  const done = new Set(input.finishedIds);
  return input.options
    .filter((option) => option.level === moved.next && !done.has(option.id))
    .slice(0, 3)
    .map((option) => ({
      id: option.id,
      title: option.title,
      level: option.level,
      action: input.atInstitution && option.access !== 'a_la_carte' ? 'ask_school' : 'enrol',
    }));
}

export function dueToLeave(input: {
  role: string;
  status: string;
  level: string;
  endDate: string;
  today: string;
  yearEnd: boolean;
}): { leave: boolean; reason: LeaveReason | '' } {
  if (input.role !== 'student' || input.status === 'leaver') return { leave: false, reason: '' };
  if (DATE.test(input.endDate) && DATE.test(input.today) && input.today >= input.endDate) {
    return { leave: true, reason: 'end_date' };
  }
  if (input.yearEnd && nextLevel(input.level).graduated) return { leave: true, reason: 'final_level' };
  return { leave: false, reason: '' };
}

export function openAlumni(input: {
  policy: AlumniPolicy;
  today: string;
  studentId: string;
  schoolStudentId: string;
  name: string;
  studentNumber: string;
  email: string;
  institutionId: string;
  institutionName: string;
  level: string;
  reason: LeaveReason;
  certificates: number;
}): AlumniPerson {
  return {
    id: input.studentId || input.email,
    studentId: input.studentId,
    schoolStudentId: input.schoolStudentId,
    name: input.name.trim() || input.email,
    studentNumber: input.studentNumber.trim().toUpperCase(),
    email: input.email.trim().toLowerCase(),
    institutionId: input.institutionId,
    institutionName: input.institutionName,
    level: input.level,
    leftOn: input.today,
    graceEndsOn: addDays(input.today, input.policy.graceDays),
    reason: input.reason,
    certificates: Math.max(0, Math.floor(input.certificates)),
    seatFreed: false,
    publicProfile: false,
  };
}

export function alumniPhase(person: Pick<AlumniPerson, 'graceEndsOn' | 'seatFreed'>, today: string): 'grace' | 'alumni' {
  if (person.seatFreed) return 'alumni';
  if (DATE.test(person.graceEndsOn) && DATE.test(today) && today < person.graceEndsOn) return 'grace';
  return 'alumni';
}

export function seatReadyToFree(person: Pick<AlumniPerson, 'graceEndsOn' | 'seatFreed'>, today: string): boolean {
  return !person.seatFreed && alumniPhase(person, today) === 'alumni';
}

/** First name and last initial. Email, phone, and date of birth stay off the public page. */
export function publicName(name: string): string {
  const parts = name.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!parts.length) return 'Alumnus';
  const first = parts[0] ?? 'Alumnus';
  if (parts.length === 1) return first.slice(0, 40);
  const last = parts[parts.length - 1] ?? '';
  return `${first} ${last.slice(0, 1).toUpperCase()}.`.slice(0, 80);
}

export interface PublicAlumniView {
  name: string;
  studentNumber: string;
  institutionName: string;
  level: string;
  certificates: string[];
  badges: number;
}

export function publicAlumniView(input: {
  optIn: boolean;
  name: string;
  studentNumber: string;
  institutionName: string;
  level: string;
  certificates: readonly string[];
  badges: number;
}): PublicAlumniView | null {
  if (!input.optIn) return null;
  const studentNumber = input.studentNumber.trim().toUpperCase();
  if (!studentNumber) return null;
  return {
    name: publicName(input.name),
    studentNumber,
    institutionName: input.institutionName.trim() || 'Poket School',
    level: input.level.trim(),
    certificates: input.certificates.map((title) => title.trim()).filter(Boolean).slice(0, 12),
    badges: Math.max(0, Math.floor(input.badges)),
  };
}

export function alumniPrice(listMonthly: number, discount: number): { monthly: number; discount: number } {
  const rate = Math.max(0, Math.min(0.8, discount));
  if (!Number.isFinite(listMonthly) || listMonthly < 0) return { monthly: 0, discount: rate };
  return { monthly: Math.round(listMonthly * (1 - rate) * 100) / 100, discount: rate };
}

export function alumniStats(people: readonly Pick<AlumniPerson, 'leftOn' | 'certificates'>[]): {
  alumni: number;
  certificates: number;
  byYear: { year: string; graduates: number; certificates: number }[];
} {
  const byYear = new Map<string, { year: string; graduates: number; certificates: number }>();
  let certificates = 0;
  for (const person of people) {
    const count = Math.max(0, person.certificates);
    certificates += count;
    const year = DATE.test(person.leftOn) ? person.leftOn.slice(0, 4) : 'Undated';
    const row = byYear.get(year) ?? { year, graduates: 0, certificates: 0 };
    row.graduates += 1;
    row.certificates += count;
    byYear.set(year, row);
  }
  return {
    alumni: people.length,
    certificates,
    byYear: [...byYear.values()].sort((a, b) => a.year.localeCompare(b.year)),
  };
}

export function alumniCsv(people: readonly AlumniPerson[]): string {
  const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = people.map((person) => [
    person.name,
    person.email,
    person.studentNumber,
    person.level,
    person.leftOn,
    person.graceEndsOn,
    String(person.certificates),
    person.seatFreed ? 'yes' : 'no',
  ].map(cell).join(','));
  return ['name,email,studentNumber,level,leftOn,graceEndsOn,certificates,seatFreed', ...lines].join('\n');
}

export function transcriptLines(input: {
  name: string;
  studentNumber: string;
  institutionName: string;
  rows: readonly { title: string; status: string }[];
  verifyUrl: string;
}): string[] {
  return [
    'Poket School record of achievement',
    input.name.trim() || 'Student',
    input.studentNumber.trim().toUpperCase(),
    input.institutionName.trim(),
    ...input.rows.slice(0, 24).map((row) => `${row.title} — ${row.status}`),
    'Certificates, badges, and this record stay with the account.',
    `Verify ${input.verifyUrl}`,
  ].filter(Boolean);
}

export function alumniNewsletter(input: { institutionName: string; note: string }): { subject: string; text: string } {
  const note = input.note.replace(/\s+/g, ' ').trim().slice(0, 600);
  return {
    subject: `${input.institutionName} alumni`,
    text: note || `${input.institutionName} is writing to alumni. Certificates, badges, the transcript, and the portfolio stay on the Poket School account.`,
  };
}

export function alumniWelcome(input: { institutionName: string; name: string; graceEndsOn: string; discount: number }): { subject: string; text: string } {
  const percent = Math.round(input.discount * 100);
  return {
    subject: `You are an alumnus of ${input.institutionName}`,
    text: [
      `${input.name || 'Hello'},`,
      `Your Poket School account, student number, certificates, badges, transcript, and portfolio stay.`,
      `Academy courses stay open until ${input.graceEndsOn}. The seat is then free for the next student.`,
      percent > 0 ? `An alumni discount of ${percent}% is on My academy for an individual plan.` : 'My academy can open an individual plan or another academy.',
    ].join('\n'),
  };
}

export function parentFinalSummary(input: {
  institutionName: string;
  childName: string;
  level: string;
  certificates: number;
}): { title: string; body: string } {
  const child = input.childName.trim() || 'Your child';
  const certificates = Math.max(0, Math.floor(input.certificates));
  return {
    title: `Final summary for ${child}`,
    body: `${child} has finished at ${input.institutionName}${input.level ? ` on ${input.level}` : ''}. You can still open their certificates, badges, transcript, and portfolio. Academy course access ends after the grace period. This is the final Parent Explainer for this child. ${certificates} certificate${certificates === 1 ? '' : 's'} stay on the record.`,
  };
}

export function holderDeletion(): { status: 'revoked'; reason: typeof HOLDER_REVOCATION; pageLive: true } {
  return { status: 'revoked', reason: HOLDER_REVOCATION, pageLive: true };
}

export function verifyStatusText(status: string | null | undefined, reason: string | null | undefined): string {
  if (status !== 'revoked') return 'Valid';
  return (reason ?? '').trim().toLowerCase() === HOLDER_REVOCATION ? HOLDER_REVOCATION : 'Revoked';
}
