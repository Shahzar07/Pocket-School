/**
 * Parent-to-school hotline. Priority maps onto the shared alert severity
 * in lib/alerts/model.ts. Do not add a second severity enum.
 */

import { type AlertSeverity } from '../alerts/model';

export const HOTLINE_CATEGORIES = [
  'academic',
  'attendance',
  'fees',
  'transport',
  'wellbeing',
  'bullying',
  'safeguarding',
  'technical',
  'feedback',
  'other',
] as const;
export type HotlineCategory = (typeof HOTLINE_CATEGORIES)[number];

export const ADDRESSED_TO = ['teacher', 'academic_lead', 'principal', 'safeguarding_lead'] as const;
export type AddressedTo = (typeof ADDRESSED_TO)[number];

export const HOTLINE_PRIORITIES = ['low', 'medium', 'high'] as const;
export type HotlinePriority = (typeof HOTLINE_PRIORITIES)[number];

export const HOTLINE_STATUSES = ['pending', 'in_progress', 'kiv', 'solved', 'closed'] as const;
export type HotlineStatus = (typeof HOTLINE_STATUSES)[number];

export const SENSITIVE_CATEGORIES = ['bullying', 'safeguarding'] as const;

export const REOPEN_MS = 7 * 24 * 60 * 60 * 1000;

export interface WorkCalendar {
  timezone: string;
  /** 0 is Sunday. Default is Monday to Friday. */
  workingDays: number[];
  startMinutes: number;
  endMinutes: number;
  /** YYYY-MM-DD in the institution timezone. */
  holidays: string[];
}

export const DEFAULT_WORK: WorkCalendar = {
  timezone: 'Asia/Kuala_Lumpur',
  workingDays: [1, 2, 3, 4, 5],
  startMinutes: 8 * 60,
  endMinutes: 17 * 60,
  holidays: [],
};

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function isHotlineCategory(value: string): value is HotlineCategory {
  return (HOTLINE_CATEGORIES as readonly string[]).includes(value);
}

export function isAddressedTo(value: string): value is AddressedTo {
  return (ADDRESSED_TO as readonly string[]).includes(value);
}

export function isHotlinePriority(value: string): value is HotlinePriority {
  return (HOTLINE_PRIORITIES as readonly string[]).includes(value);
}

export function isHotlineStatus(value: string): value is HotlineStatus {
  return (HOTLINE_STATUSES as readonly string[]).includes(value);
}

export function isSensitiveCategory(category: string): boolean {
  return (SENSITIVE_CATEGORIES as readonly string[]).includes(category);
}

/** Shared severity. Hotline has no critical priority. */
export function prioritySeverity(priority: HotlinePriority): AlertSeverity {
  if (priority === 'high') return 'high';
  if (priority === 'medium') return 'medium';
  return 'low';
}

export function routeAddress(requested: string, category: string): AddressedTo {
  if (isSensitiveCategory(category)) {
    return requested === 'principal' ? 'principal' : 'safeguarding_lead';
  }
  return isAddressedTo(requested) ? requested : 'teacher';
}

export function staffCanSee(role: string, staffPost: string, category: string): boolean {
  if (role === 'admin') return true;
  if (isSensitiveCategory(category)) {
    return staffPost === 'principal' || staffPost === 'safeguarding_lead';
  }
  return role === 'teacher' || role === 'institution_admin' || isAddressedTo(staffPost);
}

export interface ZonedClock {
  date: string;
  weekday: number;
  minutes: number;
}

export function zonedClock(ms: number, timeZone: string): ZonedClock {
  let zone = timeZone || 'UTC';
  try {
    Intl.DateTimeFormat('en-US', { timeZone: zone }).format(0);
  } catch {
    zone = 'UTC';
  }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(ms)).map(part => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: WEEKDAY[parts.weekday ?? ''] ?? 0,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function isWorkingInstant(ms: number, calendar: WorkCalendar): boolean {
  const clock = zonedClock(ms, calendar.timezone);
  if (!calendar.workingDays.includes(clock.weekday)) return false;
  if (calendar.holidays.includes(clock.date)) return false;
  return clock.minutes >= calendar.startMinutes && clock.minutes < calendar.endMinutes;
}

const MINUTE_MS = 60_000;
const SEARCH_CAP = 60 * 24 * 60;

/** Move forward through open minutes. The returned instant is when the SLA ends. */
export function addWorkingMinutes(startMs: number, minutes: number, calendar: WorkCalendar): number {
  if (minutes <= 0) return startMs;
  let cursor = startMs;
  let left = minutes;
  for (let step = 0; step < SEARCH_CAP && left > 0; step += 1) {
    if (isWorkingInstant(cursor, calendar)) left -= 1;
    cursor += MINUTE_MS;
  }
  return cursor;
}

export function workingMinutesFor(priority: HotlinePriority, calendar: WorkCalendar): number {
  const day = Math.max(1, calendar.endMinutes - calendar.startMinutes);
  if (priority === 'high') return 4 * 60;
  if (priority === 'medium') return day;
  return day * 3;
}

export function slaDueAt(createdAt: number, priority: HotlinePriority, calendar: WorkCalendar = DEFAULT_WORK): number {
  return addWorkingMinutes(createdAt, workingMinutesFor(priority, calendar), calendar);
}

/** 0 is not escalated. Sensitive tickets never leave the principal and safeguarding lead. */
export function escalationTarget(level: number, sensitive: boolean): AddressedTo | null {
  if (sensitive) {
    if (level <= 0) return 'safeguarding_lead';
    if (level === 1) return 'principal';
    return null;
  }
  if (level === 0) return 'teacher';
  if (level === 1) return 'academic_lead';
  if (level === 2) return 'principal';
  return null;
}

export function canReopen(status: string, solvedAt: number | null, now: number): boolean {
  if (status !== 'solved' || solvedAt == null) return false;
  return now - solvedAt <= REOPEN_MS;
}

export function reopenUntil(solvedAt: number): number {
  return solvedAt + REOPEN_MS;
}

export function kivReady(reason: string, followUpAt: number, now: number): string | null {
  if (reason.trim().length < 3) return 'Keep-in-view needs a reason.';
  if (!Number.isFinite(followUpAt) || followUpAt <= now) return 'Keep-in-view needs a follow-up date.';
  return null;
}

export interface TicketStat {
  category: string;
  status: string;
  createdAt: number;
  solvedAt: number | null;
  slaDueAt: number;
  rating: number | null;
}

export interface HotlineAnalytics {
  byCategory: { category: string; n: number }[];
  slaCompliance: number | null;
  averageResolutionMs: number | null;
  satisfaction: number | null;
  overdue: number | null;
}

export function summariseHotline(tickets: TicketStat[], now: number): HotlineAnalytics {
  const counts = new Map<string, number>();
  for (const ticket of tickets) counts.set(ticket.category, (counts.get(ticket.category) ?? 0) + 1);
  const byCategory = [...counts.entries()]
    .map(([category, n]) => ({ category, n }))
    .filter(row => row.n >= 5);
  const solved = tickets.filter(ticket => ticket.solvedAt != null);
  const onTime = solved.filter(ticket => (ticket.solvedAt ?? 0) <= ticket.slaDueAt);
  const ratings = tickets.map(ticket => ticket.rating).filter((rating): rating is number => rating != null);
  const openOverdue = tickets.filter(ticket => ticket.status !== 'solved' && ticket.status !== 'closed' && ticket.slaDueAt < now);
  return {
    byCategory,
    slaCompliance: solved.length >= 5 ? onTime.length / solved.length : null,
    averageResolutionMs: solved.length >= 5
      ? Math.round(solved.reduce((sum, ticket) => sum + ((ticket.solvedAt ?? 0) - ticket.createdAt), 0) / solved.length)
      : null,
    satisfaction: ratings.length >= 5
      ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10
      : null,
    overdue: openOverdue.length >= 5 ? openOverdue.length : null,
  };
}
