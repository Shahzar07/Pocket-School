import type { RoomHold, TermSpan, TimetableDoc, Weekday } from '@/lib/timetable/types';

export interface WorkspaceSourceEvent {
  id: string;
  summary: string;
  date: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  calendar: 'rooms' | 'school';
  roomName?: string;
}

export interface WorkspaceImport {
  holidays: { id: string; name: string; date: string }[];
  terms: TermSpan[];
  roomHolds: RoomHold[];
}

function nextDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const stamp = new Date(Date.UTC(year || 2026, (month || 1) - 1, (day || 1) + 1));
  return stamp.toISOString().slice(0, 10);
}

function eachDate(start: string, end: string, cap = 40): string[] {
  const out: string[] = [];
  let cursor = start;
  const last = end >= start ? end : start;
  while (cursor <= last && out.length < cap) {
    out.push(cursor);
    cursor = nextDate(cursor);
  }
  return out;
}

function weekdayOf(iso: string): Weekday | null {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return null;
  const name = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  if (name === 'mon' || name === 'tue' || name === 'wed' || name === 'thu' || name === 'fri') return name;
  return null;
}

function minutes(hhmm: string): number {
  const [hour, minute] = hhmm.split(':').map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

function overlaps(start: string, end: string, period: { start: string; end: string }): boolean {
  return minutes(start) < minutes(period.end) && minutes(period.start) < minutes(end);
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const map = new Map(current.map(item => [item.id, item]));
  for (const item of incoming) map.set(item.id, item);
  return [...map.values()];
}

function roomIdFor(event: WorkspaceSourceEvent, rooms: { id: string; name: string }[]): string {
  const hint = (event.roomName || event.summary).toLowerCase();
  const ranked = rooms
    .filter(room => hint.includes(room.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length);
  return ranked[0]?.id ?? '';
}

/** Holidays and terms become timetable blocks. Room events become dated holds. A second import updates the same ids. */
export function importWorkspaceEvents(
  events: WorkspaceSourceEvent[],
  periods: { id: string; start: string; end: string }[],
  rooms: { id: string; name: string }[],
): WorkspaceImport {
  const holidays: WorkspaceImport['holidays'] = [];
  const terms: TermSpan[] = [];
  const roomHolds: RoomHold[] = [];
  for (const event of events) {
    if (event.calendar === 'school') {
      if (/term|semester/i.test(event.summary)) {
        terms.push({
          id: `gcal-term:${event.id}`,
          name: event.summary,
          start: event.date,
          end: event.endDate && event.endDate >= event.date ? event.endDate : event.date,
        });
        continue;
      }
      for (const date of eachDate(event.date, event.endDate ?? event.date)) {
        holidays.push({ id: `gcal:${event.id}:${date}`, name: event.summary, date });
      }
      continue;
    }
    const roomId = roomIdFor(event, rooms);
    const day = weekdayOf(event.date);
    if (!roomId || !day) continue;
    const matching = event.startTime && event.endTime
      ? periods.filter(period => overlaps(event.startTime ?? '', event.endTime ?? '', period))
      : periods;
    for (const period of matching) {
      roomHolds.push({
        id: `gcal-room:${event.id}:${period.id}`,
        roomId,
        day,
        periodId: period.id,
        date: event.date,
      });
    }
  }
  return { holidays, terms, roomHolds };
}

export function applyWorkspace(doc: TimetableDoc, imported: WorkspaceImport): TimetableDoc {
  return {
    ...doc,
    holidays: mergeById(doc.holidays, imported.holidays),
    terms: mergeById(doc.terms, imported.terms),
    roomHolds: mergeById(doc.roomHolds ?? [], imported.roomHolds),
  };
}
