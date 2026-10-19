import { SCHOOL_TIME_ZONE } from './config';
import type { TimetableDoc } from '@/lib/timetable/types';

export interface BusyInterval {
  start: string;
  end: string;
}

export interface PeriodWindow {
  id: string;
  start: string;
  end: string;
}

function minutes(hhmm: string): number {
  const [hour, minute] = hhmm.split(':').map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

function overlaps(start: number, end: number, periodStart: number, periodEnd: number): boolean {
  return start < periodEnd && periodStart < end;
}

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const stamp = new Date(Date.UTC(year || 2026, (month || 1) - 1, (day || 1) + days));
  return stamp.toISOString().slice(0, 10);
}

const WEEK = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function zonedParts(iso: string, timeZone: string): { date: string; minutes: number; weekday: string } | null {
  const floating = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(iso);
  const hasZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso);
  if (floating && !hasZone) {
    const date = floating[1] ?? '';
    const [year, month, day] = date.split('-').map(Number);
    const weekday = WEEK[new Date(Date.UTC(year || 2026, (month || 1) - 1, day || 1)).getUTCDay()] ?? '';
    return { date, minutes: Number(floating[2]) * 60 + Number(floating[3]), weekday };
  }
  const stamp = new Date(iso);
  if (Number.isNaN(stamp.getTime())) return null;
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(fmt.formatToParts(stamp).map(part => [part.type, part.value]));
  const weekday = (parts.weekday ?? '').slice(0, 3).toLowerCase();
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    weekday,
  };
}

/**
 * Busy intervals become `${day}:${periodId}` keys for the anchor week only.
 * The caller writes them onto a teacher only after that teacher opts in.
 */
export function busyToUnavailable(
  intervals: BusyInterval[],
  periods: PeriodWindow[],
  anchorMonday: string,
  timeZone = SCHOOL_TIME_ZONE,
): string[] {
  const weekEnd = addDays(anchorMonday, 4);
  const keys = new Set<string>();
  for (const interval of intervals) {
    const start = zonedParts(interval.start, timeZone);
    const end = zonedParts(interval.end, timeZone);
    if (!start || !end) continue;
    if (start.date < anchorMonday || start.date > weekEnd) continue;
    if (start.weekday !== 'mon' && start.weekday !== 'tue' && start.weekday !== 'wed' && start.weekday !== 'thu' && start.weekday !== 'fri') continue;
    const endMinutes = end.date === start.date ? end.minutes : 24 * 60;
    for (const period of periods) {
      if (overlaps(start.minutes, endMinutes, minutes(period.start), minutes(period.end))) {
        keys.add(`${start.weekday}:${period.id}`);
      }
    }
  }
  return [...keys].sort();
}

/** Opt-in only. Calling this twice with the same slots does not duplicate them. */
export function applyAvailability(doc: TimetableDoc, teacherId: string, slots: string[]): TimetableDoc {
  return {
    ...doc,
    staff: doc.staff.map(person => person.id === teacherId
      ? { ...person, unavailable: [...new Set([...person.unavailable, ...slots])].sort() }
      : person),
  };
}
