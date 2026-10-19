import { dateFor } from '@/lib/timetable/publish';
import type { CoverAssignment, Lesson, TimetableDoc } from '@/lib/timetable/types';

export type SyncKind = 'timetable' | 'cover' | 'exam' | 'assignment' | 'planner';

export interface SyncEvent {
  sourceId: string;
  kind: SyncKind;
  title: string;
  date: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  description?: string;
}

export interface SyncToggles {
  timetable: boolean;
  cover: boolean;
  exams: boolean;
  assignments: boolean;
  planner: boolean;
}

export const DEFAULT_TOGGLES: SyncToggles = {
  timetable: true,
  cover: true,
  exams: true,
  assignments: true,
  planner: true,
};

export interface GoogleWorkspaceStatus {
  connected: boolean;
  roomCalendarId: string;
  eventsCalendarId: string;
  lastSyncAt: string | null;
  lastError: string | null;
}

export interface GoogleCalendarStatus {
  configured: boolean;
  signedIn: boolean;
  connected: boolean;
  clientId: string;
  calendarName: string;
  toggles: SyncToggles;
  freeBusyOptIn: boolean;
  absenceKeyword: string;
  absenceCalendarId: string;
  lastSyncAt: string | null;
  lastError: string | null;
  feedUrl: string | null;
  workspace: GoogleWorkspaceStatus | null;
}

export function blankStatus(configured: boolean, clientId = ''): GoogleCalendarStatus {
  return {
    configured,
    signedIn: false,
    connected: false,
    clientId: configured ? clientId : '',
    calendarName: 'Poket School',
    toggles: { ...DEFAULT_TOGGLES },
    freeBusyOptIn: false,
    absenceKeyword: 'leave',
    absenceCalendarId: '',
    lastSyncAt: null,
    lastError: null,
    feedUrl: null,
    workspace: null,
  };
}

export function filterByToggles(events: SyncEvent[], toggles: SyncToggles): SyncEvent[] {
  return events.filter(event => {
    if (event.kind === 'timetable') return toggles.timetable;
    if (event.kind === 'cover') return toggles.cover;
    if (event.kind === 'exam') return toggles.exams;
    if (event.kind === 'assignment') return toggles.assignments;
    return toggles.planner;
  });
}

export function eventsFromTimetable(
  doc: TimetableDoc,
  lessons: Lesson[],
  extras?: {
    covers?: CoverAssignment[];
    exams?: { id: string; title: string; date: string; start?: string; end?: string }[];
    assignments?: { id: string; title: string; due: string }[];
    planner?: { id: string; title: string; date: string; endDate?: string; kind: string }[];
  },
): SyncEvent[] {
  const events: SyncEvent[] = [];
  const lessonIds = new Set(lessons.map(lesson => lesson.id));
  for (const lesson of lessons) {
    const period = doc.periods.find(item => item.id === lesson.periodId);
    const subject = doc.subjects.find(item => item.id === lesson.subjectId);
    const room = doc.rooms.find(item => item.id === lesson.roomId);
    const group = doc.groups.find(item => item.id === lesson.groupId);
    events.push({
      sourceId: `lesson:${lesson.id}`,
      kind: 'timetable',
      title: subject ? `${subject.name} — ${subject.level}` : lesson.subjectId,
      date: dateFor(doc.anchorMonday, lesson.day),
      startTime: period?.start ?? '08:30',
      endTime: period?.end ?? '09:15',
      description: [group?.name, room?.name, period?.label].filter(Boolean).join(' · '),
    });
  }
  for (const cover of extras?.covers ?? []) {
    if (cover.status !== 'approved' || !lessonIds.has(cover.lessonId)) continue;
    const lesson = lessons.find(item => item.id === cover.lessonId);
    if (!lesson) continue;
    const period = doc.periods.find(item => item.id === lesson.periodId);
    const coverTeacher = doc.staff.find(item => item.id === cover.coverTeacherId);
    events.push({
      sourceId: `cover:${cover.id}`,
      kind: 'cover',
      title: `Cover ${coverTeacher?.name ?? cover.coverTeacherId}`,
      date: cover.date,
      startTime: period?.start ?? '08:30',
      endTime: period?.end ?? '09:15',
      description: cover.reason,
    });
  }
  for (const exam of extras?.exams ?? []) {
    events.push({
      sourceId: `exam:${exam.id}`,
      kind: 'exam',
      title: exam.title,
      date: exam.date,
      startTime: exam.start,
      endTime: exam.end,
    });
  }
  for (const assignment of extras?.assignments ?? []) {
    events.push({
      sourceId: `assignment:${assignment.id}`,
      kind: 'assignment',
      title: assignment.title,
      date: assignment.due,
    });
  }
  for (const planner of extras?.planner ?? []) {
    if (planner.id.startsWith('tt-')) continue;
    events.push({
      sourceId: `planner:${planner.id}`,
      kind: planner.kind === 'exam' ? 'exam' : 'planner',
      title: planner.title,
      date: planner.date,
      endDate: planner.endDate,
    });
  }
  return events;
}

export function eventsFromDated(items: {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  kind: SyncKind;
  description?: string;
  startTime?: string;
  endTime?: string;
}[]): SyncEvent[] {
  return items.filter(item => item.date).map(item => ({
    sourceId: `${item.kind}:${item.id}`,
    kind: item.kind,
    title: item.title,
    date: item.date,
    endDate: item.endDate,
    startTime: item.startTime,
    endTime: item.endTime,
    description: item.description,
  }));
}

function icsStamp(date: string, time: string): string {
  const [hour, minute] = time.split(':');
  return `${date.replace(/-/g, '')}T${(hour ?? '00').padStart(2, '0')}${(minute ?? '00').padStart(2, '0')}00`;
}

function nextIso(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const stamp = new Date(Date.UTC(year || 2026, (month || 1) - 1, (day || 1) + 1));
  return stamp.toISOString().slice(0, 10);
}

/** A subscription file for Google, Apple, and Outlook. OAuth is not required. */
export function subscriptionIcs(events: SyncEvent[]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Poket School//Calendar//EN', 'CALSCALE:GREGORIAN'];
  for (const event of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.sourceId.replace(/[^a-zA-Z0-9-]/g, '-')}@poketschool.ai`);
    if (event.startTime && event.endTime) {
      lines.push(`DTSTART:${icsStamp(event.date, event.startTime)}`);
      lines.push(`DTEND:${icsStamp(event.date, event.endTime)}`);
    } else {
      const end = nextIso(event.endDate && event.endDate >= event.date ? event.endDate : event.date);
      lines.push(`DTSTART;VALUE=DATE:${event.date.replace(/-/g, '')}`);
      lines.push(`DTEND;VALUE=DATE:${end.replace(/-/g, '')}`);
    }
    lines.push(`SUMMARY:${event.title.replace(/[\\,;]/g, ' ')}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
