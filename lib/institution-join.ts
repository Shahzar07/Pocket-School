/**
 * Students and parents join an academy. Everyone else stays an individual.
 * Decisions here are pure. Pages and the join API call them.
 */

import { LEARNER_LEVELS } from './levels';

export const JOIN_LEVELS = [...LEARNER_LEVELS.map((level) => level.label), 'Law', 'RISE'] as const;

export type JoinLevel = (typeof JOIN_LEVELS)[number];

const NEXT_LEVEL: Record<string, string> = {
  Primary: 'Lower Secondary',
  'Lower Secondary': 'IGCSE',
  IGCSE: 'A-Level',
  'A-Level': 'Pre-University',
  'Pre-University': 'Foundation',
  Foundation: 'Degree',
  Degree: 'Professional',
  Professional: 'Graduated',
  Law: 'Graduated',
  RISE: 'RISE',
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const JOIN_VERIFICATIONS = ['open', 'invite', 'domain', 'code', 'roster', 'manual'] as const;

export type JoinVerification = (typeof JOIN_VERIFICATIONS)[number];

export interface JoinPolicy {
  /** Auto-approve when the email is on one of these domains, such as school.edu.my. */
  emailDomains: string[];
  acceptInviteCode: boolean;
  rosterMatch: boolean;
  /** When no automatic check matches, the admin queue decides. */
  manualFallback: boolean;
  /**
   * Set only when the academy stored `joinPolicy`. Absent keeps the combined
   * roster, code, and domain checks. `signupPolicy` is not this field.
   */
  verification?: JoinVerification;
}

export interface ClassCode {
  code: string;
  level: string;
  className: string;
  programmeId: string;
}

export interface RosterEntry {
  email: string;
  name: string;
  role: 'student' | 'parent' | 'teacher';
  studentId: string;
  dob: string;
  level: string;
  className: string;
  phone: string;
  childStudentId: string;
  programmeId: string;
  claimToken: string;
  status: 'unclaimed' | 'pending' | 'joined' | 'waiting' | 'leaver';
  /** While this date is still ahead, a leaver still holds a seat. */
  graceEndsOn?: string;
}

export interface SeatPool {
  programmeId: string;
  level: string;
  purchased: number;
  used: number;
  overage: 'prompt' | 'auto_add';
}

export interface JoinAttempt {
  role: 'student' | 'parent';
  email: string;
  name: string;
  dob: string;
  today: string;
  studentId: string;
  inviteCode: string;
  parentConsent: boolean;
  programmeId: string;
  level: string;
}

export interface JoinDecision {
  status: 'approved' | 'pending' | 'needs_consent' | 'waiting_for_seat' | 'rejected';
  method: 'domain' | 'code' | 'roster' | 'manual' | 'open' | '';
  level: string;
  className: string;
  programmeId: string;
  seat: 'seated' | 'waiting' | 'auto_add' | 'none';
  promptAdmin: boolean;
  enrolWelcome: boolean;
  message: string;
}

export interface ParentLink {
  studentNumber: string;
  institutionId: string;
  name: string;
}

export interface JoinConfig {
  policy: JoinPolicy;
  codes: ClassCode[];
  inviteCodes: string[];
  overage: 'prompt' | 'auto_add';
}

export function defaultJoinPolicy(): JoinPolicy {
  return {
    emailDomains: [],
    acceptInviteCode: true,
    rosterMatch: true,
    manualFallback: true,
  };
}

export function defaultJoinConfig(): JoinConfig {
  return { policy: defaultJoinPolicy(), codes: [], inviteCodes: [], overage: 'prompt' };
}

function readCodes(value: unknown): ClassCode[] {
  if (!Array.isArray(value)) return [];
  const codes: ClassCode[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const item = row as Partial<ClassCode>;
    const code = typeof item.code === 'string' ? item.code.trim().toUpperCase() : '';
    if (code.length < 4 || code.length > 16) continue;
    codes.push({
      code,
      level: typeof item.level === 'string' ? item.level.trim().slice(0, 40) : '',
      className: typeof item.className === 'string' ? item.className.trim().slice(0, 40) : '',
      programmeId: typeof item.programmeId === 'string' ? item.programmeId.trim().slice(0, 40) : '',
    });
  }
  return codes.slice(0, 40);
}

export function readJoinConfig(value: unknown): JoinConfig {
  const config = defaultJoinConfig();
  if (!value || typeof value !== 'object') return config;
  const raw = value as Record<string, unknown>;
  config.policy = readJoinPolicy(raw.policy && typeof raw.policy === 'object' ? raw.policy : raw);
  if (raw.overage === 'auto_add' || raw.overage === 'prompt') config.overage = raw.overage;
  config.codes = readCodes(raw.codes);
  if (Array.isArray(raw.inviteCodes)) {
    config.inviteCodes = raw.inviteCodes
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim().toUpperCase())
      .filter((item) => item.length >= 4 && item.length <= 16)
      .slice(0, 40);
  }
  return config;
}

/** Programmes the academy assigned to this level. Categories stay out of the student list. */
export function programmesForLevel(
  level: string,
  items: readonly { id: string; title: string; level: string; kind: string }[],
  paidIds: readonly string[],
): { id: string; title: string }[] {
  const wanted = level.trim().toLowerCase();
  if (!wanted) return [];
  const paid = new Set(paidIds);
  return items
    .filter((item) => item.kind === 'programme' && paid.has(item.id) && item.level.trim().toLowerCase() === wanted)
    .map((item) => ({ id: item.id, title: item.title }));
}

export function isJoinVerification(value: string): value is JoinVerification {
  return (JOIN_VERIFICATIONS as readonly string[]).includes(value);
}

function domainList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(normalDomain)
    .filter(Boolean);
}

export function readJoinPolicy(value: unknown): JoinPolicy {
  const policy = defaultJoinPolicy();
  if (!value || typeof value !== 'object') return policy;
  const raw = value as Partial<JoinPolicy> & { domains?: unknown; joinPolicy?: unknown; verification?: unknown };
  const listed = Array.isArray(raw.domains) ? domainList(raw.domains) : domainList(raw.emailDomains);
  if (Array.isArray(raw.domains) || Array.isArray(raw.emailDomains)) policy.emailDomains = listed;
  if (typeof raw.acceptInviteCode === 'boolean') policy.acceptInviteCode = raw.acceptInviteCode;
  if (typeof raw.rosterMatch === 'boolean') policy.rosterMatch = raw.rosterMatch;
  if (typeof raw.manualFallback === 'boolean') policy.manualFallback = raw.manualFallback;
  const mode = typeof raw.joinPolicy === 'string' ? raw.joinPolicy : typeof raw.verification === 'string' ? raw.verification : '';
  if (isJoinVerification(mode)) policy.verification = mode;
  return policy;
}

/**
 * `institution.domains` is the domain list when it has entries.
 * `institution.joinPolicy` selects one verification mode.
 * An older `signupPolicy` is ignored so a default of `invite` does not turn off roster and code.
 */
export function applyInstitutionJoin(
  policy: JoinPolicy,
  institution: {
    domains?: unknown;
    joinPolicy?: unknown;
    allowedEmailDomains?: unknown;
    signupPolicy?: unknown;
  } | null | undefined,
): JoinPolicy {
  if (!institution) return policy;
  const next: JoinPolicy = { ...policy, emailDomains: [...policy.emailDomains] };
  const domains = domainList(institution.domains);
  if (domains.length > 0) next.emailDomains = domains;
  else if (next.emailDomains.length === 0) next.emailDomains = domainList(institution.allowedEmailDomains);
  if (typeof institution.joinPolicy === 'string' && isJoinVerification(institution.joinPolicy)) {
    next.verification = institution.joinPolicy;
  }
  return next;
}

/** Alumni auto-verify follows the same domains and joinPolicy. Other modes wait for an admin. */
export function alumniSignals(
  policy: JoinPolicy,
  row: { role?: string; status?: string } | null | undefined,
  email: string,
): { rosterMatch: boolean; domainMatch: boolean } {
  const rosterHit = Boolean(row && row.role === 'student' && row.status !== 'leaver');
  const domain = domainHit(policy, email);
  const mode = policy.verification;
  if (mode === 'roster') return { rosterMatch: rosterHit, domainMatch: false };
  if (mode === 'domain') return { rosterMatch: false, domainMatch: domain };
  if (mode) return { rosterMatch: false, domainMatch: false };
  return { rosterMatch: policy.rosterMatch && rosterHit, domainMatch: domain };
}

function normalDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, '');
}

function sameName(left: string, right: string): boolean {
  return left.trim().toLowerCase().replace(/\s+/g, ' ') === right.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function ageOn(dob: string, today: string): number | null {
  if (!DATE.test(dob) || !DATE.test(today)) return null;
  const [year, month, day] = dob.split('-').map(Number);
  const [nowYear, nowMonth, nowDay] = today.split('-').map(Number);
  let age = nowYear - year;
  if (nowMonth < month || (nowMonth === month && nowDay < day)) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

export function claimTokenFor(institutionId: string, email: string): string {
  const raw = `${institutionId}:${email.trim().toLowerCase()}`;
  let hash = 2166136261;
  for (const char of raw) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function parseJoinRoster(text: string, institutionId: string): { rows: RosterEntry[]; errors: string[] } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rows: RosterEntry[] = [];
  const errors: string[] = [];
  lines.forEach((line, index) => {
    if (index === 0 && /^e-?mail\b/i.test(line)) return;
    const parts = line.split(',').map((part) => part.trim());
    const [emailRaw = '', nameRaw = '', roleRaw = '', fourth = '', dobRaw = '', levelRaw = '', classRaw = '', phoneRaw = '', childRaw = ''] = parts;
    const email = emailRaw.toLowerCase();
    if (!EMAIL.test(email)) {
      errors.push(`Line ${index + 1} needs an email address.`);
      return;
    }
    const roleText = roleRaw.toLowerCase();
    const role = roleText === 'teacher' ? 'teacher' : roleText === 'parent' ? 'parent' : roleText === 'student' || roleText === '' ? 'student' : null;
    if (!role) {
      errors.push(`Line ${index + 1}: role must be student, parent, or teacher.`);
      return;
    }
    const legacyChild = parts.length <= 4 && role === 'parent' ? fourth.toLowerCase() : '';
    const studentId = parts.length <= 4 ? '' : fourth;
    const dob = DATE.test(dobRaw) ? dobRaw : '';
    if (dobRaw && !dob) errors.push(`Line ${index + 1}: date of birth uses YYYY-MM-DD.`);
    rows.push({
      email,
      name: nameRaw || email,
      role,
      studentId,
      dob,
      level: levelRaw,
      className: classRaw,
      phone: phoneRaw,
      childStudentId: role === 'parent' ? (childRaw || legacyChild) : '',
      programmeId: '',
      claimToken: claimTokenFor(institutionId, email),
      status: 'unclaimed',
    });
  });
  return { rows, errors };
}

function rosterHit(rows: readonly RosterEntry[], attempt: JoinAttempt): RosterEntry | null {
  const email = attempt.email.trim().toLowerCase();
  const byId = attempt.studentId.trim();
  return rows.find((row) => {
    if (row.role !== attempt.role || row.status === 'leaver') return false;
    if (byId && row.studentId && row.studentId.toLowerCase() === byId.toLowerCase()) return true;
    if (row.email === email) return true;
    return Boolean(attempt.name && attempt.dob && row.dob === attempt.dob && sameName(row.name, attempt.name));
  }) ?? null;
}

function domainHit(policy: JoinPolicy, email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1] ?? '';
  return Boolean(domain) && policy.emailDomains.some((item) => item === domain);
}

export function decideJoin(input: {
  policy: JoinPolicy;
  attempt: JoinAttempt;
  roster?: readonly RosterEntry[];
  codes?: readonly ClassCode[];
  inviteCodes?: readonly string[];
  seats?: SeatPool | null;
  automationOn?: boolean;
}): JoinDecision {
  const email = input.attempt.email.trim().toLowerCase();
  const age = ageOn(input.attempt.dob, input.attempt.today);
  const under13 = input.attempt.role === 'student' && age != null && age < 13;
  if (under13 && !input.attempt.parentConsent) {
    return {
      status: 'needs_consent',
      method: '',
      level: '',
      className: '',
      programmeId: '',
      seat: 'none',
      promptAdmin: false,
      enrolWelcome: false,
      message: 'A parent or guardian confirms this account before it can join.',
    };
  }
  const roster = rosterHit(input.roster ?? [], input.attempt);
  const code = (input.codes ?? []).find((item) => item.code.trim().toUpperCase() === input.attempt.inviteCode.trim().toUpperCase());
  const genericCode = (input.inviteCodes ?? []).some((item) => item.trim().toUpperCase() === input.attempt.inviteCode.trim().toUpperCase() && item.trim().length >= 4);
  let method: JoinDecision['method'] = '';
  let level = input.attempt.level;
  let className = '';
  let programmeId = input.attempt.programmeId;
  const takeRoster = () => {
    if (!roster) return;
    method = 'roster';
    level = roster.level || level;
    className = roster.className;
    programmeId = roster.programmeId || programmeId;
  };
  const takeCode = (classOnly: boolean) => {
    if (classOnly ? !code : !(code || genericCode)) return;
    method = 'code';
    if (code) {
      level = code.level || level;
      className = code.className;
      programmeId = code.programmeId || programmeId;
    }
  };
  const mode = input.policy.verification;
  if (mode === 'open') {
    method = 'open';
  } else if (mode === 'roster') {
    takeRoster();
  } else if (mode === 'invite') {
    takeCode(false);
  } else if (mode === 'code') {
    takeCode(true);
  } else if (mode === 'domain') {
    if (domainHit(input.policy, email)) method = 'domain';
  } else if (!mode) {
    if (input.policy.rosterMatch && roster) takeRoster();
    else if (input.policy.acceptInviteCode && (code || genericCode)) takeCode(false);
    else if (input.policy.emailDomains.length > 0 && domainHit(input.policy, email)) method = 'domain';
  }
  const automatic = input.automationOn !== false && method !== '';
  if (!automatic) {
    if (mode === 'manual' || input.policy.manualFallback) {
      return {
        status: 'pending',
        method: 'manual',
        level,
        className,
        programmeId,
        seat: 'none',
        promptAdmin: true,
        enrolWelcome: false,
        message: 'The academy will confirm this account from the approval queue.',
      };
    }
    return {
      status: 'rejected',
      method: '',
      level: '',
      className: '',
      programmeId: '',
      seat: 'none',
      promptAdmin: false,
      enrolWelcome: false,
      message: 'This academy asks for a matching email domain, class code, or roster row.',
    };
  }
  if (input.attempt.role === 'parent') {
    return {
      status: 'approved',
      method,
      level,
      className,
      programmeId,
      seat: 'none',
      promptAdmin: false,
      enrolWelcome: true,
      message: 'The parent account is approved. Link each child with a student number, a QR, or a roster match.',
    };
  }
  const pool = input.seats;
  const full = pool && pool.purchased >= 0 && pool.used >= pool.purchased;
  if (full && pool && pool.overage === 'prompt') {
    return {
      status: 'waiting_for_seat',
      method,
      level,
      className,
      programmeId: pool.programmeId || programmeId,
      seat: 'waiting',
      promptAdmin: true,
      enrolWelcome: false,
      message: `Seats for ${level || 'this level'} are full. This student is waiting, and the admin is asked to add seats.`,
    };
  }
  const autoAdd = Boolean(full && pool && pool.overage === 'auto_add');
  return {
    status: 'approved',
    method,
    level,
    className,
    programmeId: pool?.programmeId || programmeId,
    seat: autoAdd ? 'auto_add' : 'seated',
    promptAdmin: autoAdd,
    enrolWelcome: true,
    message: autoAdd
      ? `${level || 'This level'} is full, so one seat is added and the difference is prorated.`
      : `${input.attempt.name || 'This student'} is in${level ? ` ${level}` : ''}${className ? `, ${className}` : ''}.`,
  };
}

export function nextLevel(level: string): { next: string; graduated: boolean } {
  const next = NEXT_LEVEL[level] ?? '';
  if (!next) return { next: level, graduated: false };
  return { next: next === 'Graduated' ? 'Graduated' : next, graduated: next === 'Graduated' };
}

export function rollRoster(rows: readonly RosterEntry[]): { rows: RosterEntry[]; leavers: RosterEntry[] } {
  const leavers: RosterEntry[] = [];
  const nextRows = rows.map((row) => {
    if (row.role !== 'student' || row.status === 'leaver') return row;
    const moved = nextLevel(row.level);
    if (moved.graduated) {
      const leaver = { ...row, status: 'leaver' as const, level: 'Graduated', className: '' };
      leavers.push(leaver);
      return leaver;
    }
    return { ...row, level: moved.next };
  });
  return { rows: nextRows, leavers };
}

export function bulkMove(rows: readonly RosterEntry[], studentIds: readonly string[], level: string, className: string): RosterEntry[] {
  const wanted = new Set(studentIds.map((id) => id.trim().toLowerCase()).filter(Boolean));
  return rows.map((row) => {
    if (row.role !== 'student') return row;
    if (!wanted.has(row.studentId.toLowerCase()) && !wanted.has(row.email)) return row;
    return { ...row, level, className };
  });
}

export function offboard(rows: readonly RosterEntry[], studentIds: readonly string[]): RosterEntry[] {
  const wanted = new Set(studentIds.map((id) => id.trim().toLowerCase()).filter(Boolean));
  return rows.map((row) => {
    if (!wanted.has(row.studentId.toLowerCase()) && !wanted.has(row.email)) return row;
    return { ...row, status: 'leaver', className: '' };
  });
}

export function joinReport(rows: readonly RosterEntry[]): { pending: number; joined: number; unclaimed: number; waiting: number; leavers: number } {
  return {
    pending: rows.filter((row) => row.status === 'pending').length,
    joined: rows.filter((row) => row.status === 'joined').length,
    unclaimed: rows.filter((row) => row.status === 'unclaimed').length,
    waiting: rows.filter((row) => row.status === 'waiting').length,
    leavers: rows.filter((row) => row.status === 'leaver').length,
  };
}

export function claimRosterRow(rows: readonly RosterEntry[], token: string): RosterEntry | { error: string } {
  const row = rows.find((item) => item.claimToken === token.trim().toLowerCase());
  if (!row) return { error: 'That claim link does not match this academy.' };
  if (row.status === 'joined') return { error: 'This account is already claimed.' };
  if (row.status === 'leaver') return { error: 'This person has left the academy.' };
  return { ...row, status: row.status === 'waiting' ? 'waiting' : 'pending' };
}

export function linkChild(existing: readonly ParentLink[], child: ParentLink): ParentLink[] | { error: string } {
  const studentNumber = child.studentNumber.trim().toUpperCase();
  const institutionId = child.institutionId.trim();
  if (!studentNumber || !institutionId) return { error: 'A child link needs a student number and an academy.' };
  if (existing.some((item) => item.studentNumber.toUpperCase() === studentNumber && item.institutionId === institutionId)) {
    return [...existing];
  }
  return [...existing, { ...child, studentNumber, institutionId }];
}

function isoDays(from: string, to: string): number | null {
  if (!DATE.test(from) || !DATE.test(to)) return null;
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Unused days on a personal plan, offered as a credit when someone joins an academy. */
export function overlapCredit(input: {
  personalTotal: number;
  periodStart: string;
  periodEnd: string;
  on: string;
}): { credit: number } | { error: string } {
  if (!Number.isFinite(input.personalTotal) || input.personalTotal < 0) return { error: 'The personal plan total is missing.' };
  const daysInPeriod = isoDays(input.periodStart, input.periodEnd);
  const daysRemaining = isoDays(input.on, input.periodEnd);
  if (daysInPeriod == null || daysRemaining == null || daysInPeriod <= 0) return { error: 'The personal plan needs a start and an end date.' };
  if (input.on < input.periodStart || input.on > input.periodEnd) return { error: 'The credit applies inside the current personal plan.' };
  const credit = Math.round(input.personalTotal * (daysRemaining / daysInPeriod) * 100) / 100;
  return { credit };
}

export function leaveAcademy(): { progressKept: true; institutionAccess: 'ended' } {
  return { progressKept: true, institutionAccess: 'ended' };
}

export function shareLinks(joinUrl: string, institutionName: string): { whatsapp: string; email: string } {
  const text = `Join ${institutionName} on Poket School: ${joinUrl}`;
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
    email: `mailto:?subject=${encodeURIComponent(`Join ${institutionName} on Poket School`)}&body=${encodeURIComponent(text)}`,
  };
}

export function posterLines(input: { institutionName: string; joinUrl: string; code: string }): string[] {
  return [
    input.institutionName,
    'Students and parents join here',
    input.joinUrl,
    input.code ? `Class code ${input.code}` : '',
    'Scan the QR or open the link. Students and parents of this academy join here. Everyone else signs up as an individual.',
  ].filter(Boolean);
}

export function claimMessage(input: { institutionName: string; name: string; claimUrl: string }): { subject: string; text: string; sms: string } {
  const text = `${input.name || 'Hello'}, ${input.institutionName} pre-registered you on Poket School. Claim your account: ${input.claimUrl}`;
  return {
    subject: `Claim your ${input.institutionName} account`,
    text,
    sms: text,
  };
}

export function welcomeJoinMessage(input: { institutionName: string; name: string; level: string }): { subject: string; text: string } {
  return {
    subject: `Welcome to ${input.institutionName}`,
    text: [
      `${input.name || 'Hello'},`,
      `Your ${input.institutionName} account is open${input.level ? ` on ${input.level}` : ''}.`,
      'The welcome course is on your dashboard.',
    ].join('\n'),
  };
}

export function parentExplainerCopy(institutionName: string): { title: string; body: string } {
  return {
    title: `${institutionName} Parent Explainer`,
    body: `Parent Explainer is a weekly summary in plain language for families at ${institutionName}. It describes what your child studied. It is not a new grade and it does not spend Sparks. One parent account can link children at ${institutionName} and at other academies.`,
  };
}
