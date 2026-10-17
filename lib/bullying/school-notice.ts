/**
 * Off-platform school notices. A school that is not on Poket School can still
 * be told, but only after a person reviews the notice. Emails are never guessed.
 */

import { DEFAULT_WORK, zonedClock, type WorkCalendar } from '../hotline/policy';
import { SAMPLE_BULLYING_CODE, bullyingJoinPath } from './policy';

export const SAFETY_FROM = 'Poket School <safety@poketschool.ai>';
export const DESK_CONTACT = 'safety@poketschool.ai';
export const FIND_CONTACT = 'Find contact';
export const SCHOOL_INFORMED = 'Your school has been informed';
export const NOTICE_TOKEN_MS = 30 * 24 * 60 * 60 * 1000;

export const NOTICE_STATUSES = ['draft', 'find_contact', 'sent', 'reminded', 'escalated', 'acknowledged'] as const;
export type NoticeStatus = (typeof NOTICE_STATUSES)[number];

const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

export function cleanSchoolName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 120);
}

export function needsOffPlatformNotice(school: { name: string; onPoket: boolean }): boolean {
  return cleanSchoolName(school.name).length >= 2 && school.onPoket !== true;
}

export type NoticeConsent =
  | { ok: true; consentBy: 'student' | 'guardian' | 'desk_override' }
  | { ok: false; error: string };

/**
 * A student who is 13 or older can agree. Under 13, a guardian who is not
 * excluded agrees. A serious-risk override still needs a written reason.
 */
export function noticeConsent(input: {
  ageTier: string;
  studentConsent: boolean;
  guardianConsent: boolean;
  guardianExcluded: boolean;
  seriousRisk: boolean;
  overrideReason: string;
}): NoticeConsent {
  const reason = input.overrideReason.replace(/\s+/g, ' ').trim();
  if (input.seriousRisk) {
    if (reason.length < 8) {
      return { ok: false, error: 'Write why this child is at serious risk before telling a school without consent.' };
    }
    return { ok: true, consentBy: 'desk_override' };
  }
  if (input.ageTier === 'under13') {
    if (input.guardianExcluded || !input.guardianConsent) {
      return { ok: false, error: 'A guardian who is allowed to be told has to agree before this school is told.' };
    }
    return { ok: true, consentBy: 'guardian' };
  }
  if (!input.studentConsent) return { ok: false, error: 'The student has to agree before this school is told.' };
  return { ok: true, consentBy: 'student' };
}

export function publicHttpsUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return '';
  }
  if (url.protocol !== 'https:') return '';
  if (url.username || url.password) return '';
  const host = url.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return '';
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) return '';
  return url.toString();
}

/** The address is accepted only when that exact address is on the official page. */
export function verifiedSchoolEmail(input: { email: string; sourceUrl: string; pageText: string }):
  | { ok: true; email: string; sourceUrl: string }
  | { ok: false; task: 'find_contact'; error: string } {
  const email = input.email.trim().toLowerCase();
  const sourceUrl = publicHttpsUrl(input.sourceUrl);
  if (!EMAIL.test(email) || !sourceUrl) {
    return { ok: false, task: 'find_contact', error: FIND_CONTACT };
  }
  const page = input.pageText.toLowerCase();
  if (!page.includes(email)) {
    return { ok: false, task: 'find_contact', error: 'That email is not on the official page. Find contact.' };
  }
  return { ok: true, email, sourceUrl };
}

export function noticeSummary(summary: string, reporterName: string): { ok: true; summary: string } | { ok: false; error: string } {
  const text = summary.replace(/\s+/g, ' ').trim().slice(0, 500);
  if (text.length < 3) return { ok: false, error: 'Write a short account with no names.' };
  const name = reporterName.trim().toLowerCase();
  if (name.length >= 2 && text.toLowerCase().includes(name)) {
    return { ok: false, error: 'Take the reporter’s name out of the summary.' };
  }
  return { ok: true, summary: text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function schoolNoticeJoinUrl(origin: string): string {
  return `${origin.replace(/\/$/, '')}${bullyingJoinPath(SAMPLE_BULLYING_CODE)}`;
}

export function schoolNoticeMessage(input: {
  schoolName: string;
  incidentType: string;
  dates: string;
  summary: string;
  ackUrl: string;
  joinUrl: string;
  reminder?: boolean;
  evidenceAttached?: boolean;
}): { subject: string; text: string; html: string } {
  const schoolName = cleanSchoolName(input.schoolName) || 'the school';
  const incidentType = input.incidentType.replace(/\s+/g, ' ').trim().slice(0, 80) || 'safeguarding';
  const dates = input.dates.replace(/\s+/g, ' ').trim().slice(0, 120) || 'Not stated';
  const summary = input.summary.replace(/\s+/g, ' ').trim().slice(0, 500);
  const lines = [
    input.reminder ? 'This is a reminder. The notice below has not been acknowledged.' : 'Confidential safeguarding notice',
    `School: ${schoolName}`,
    `Incident type: ${incidentType}`,
    `Dates: ${dates}`,
    `Summary: ${summary}`,
    input.evidenceAttached ? 'An evidence PDF is attached. It does not name the reporter.' : '',
    `Safety Desk: ${DESK_CONTACT}`,
    `Confirm receipt and the action you took: ${input.ackUrl}`,
    `Poket School safeguarding tools are free for schools: ${input.joinUrl}`,
    'The reporter is not named in this notice.',
  ].filter(Boolean);
  const text = lines.join('\n');
  const html = lines.map(line => `<p>${escapeHtml(line)}</p>`).join('');
  return {
    subject: input.reminder ? `Reminder: confidential notice for ${schoolName}` : `Confidential notice for ${schoolName}`,
    text,
    html,
  };
}

export function addWorkingDays(startMs: number, days: number, calendar: WorkCalendar = DEFAULT_WORK): number {
  if (days <= 0) return startMs;
  let cursor = startMs;
  let left = days;
  const seen = new Set<string>();
  for (let step = 0; step < 400 && left > 0; step += 1) {
    cursor += 24 * 60 * 60 * 1000;
    const clock = zonedClock(cursor, calendar.timezone);
    if (seen.has(clock.date)) continue;
    seen.add(clock.date);
    if (!calendar.workingDays.includes(clock.weekday)) continue;
    if (calendar.holidays.includes(clock.date)) continue;
    left -= 1;
  }
  return cursor;
}

export function noticeReminderDue(sentAt: number, remindedAt: number, ackAt: number, now: number, calendar: WorkCalendar = DEFAULT_WORK): boolean {
  if (sentAt <= 0 || remindedAt > 0 || ackAt > 0) return false;
  return now >= addWorkingDays(sentAt, 3, calendar);
}

export function noticeEscalationDue(sentAt: number, ackAt: number, escalatedAt: number, now: number, calendar: WorkCalendar = DEFAULT_WORK): boolean {
  if (sentAt <= 0 || ackAt > 0 || escalatedAt > 0) return false;
  return now >= addWorkingDays(sentAt, 7, calendar);
}

export function tokenOpen(expiresAt: number, now: number): boolean {
  return expiresAt > now;
}

export function informedForTracker(sentAt: number): boolean {
  return sentAt > 0;
}
