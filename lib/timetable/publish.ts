import type { CalendarItem } from '@/lib/insights/calendar';
import type { PlannerEvent } from '@/lib/insights/planner';
import { type AttendanceRow, type DeskState, type LevelName } from '@/lib/school-desk/model';
import { levelLabel, resolveLevel } from '@/lib/levels';
import { addEnrolment, approveEnrolment, createClass } from '@/lib/school-desk/model';
import type { Lesson, TimetableDoc, TimetableVersion, Weekday } from './types';

export interface RegisterStub {
  id: string;
  classId: string;
  studentId: string;
  date: string;
  periodId: string;
  lessonId: string;
  status: 'unmarked';
}

export interface ClassDraft {
  id: string;
  name: string;
  subject: string;
  level: LevelName;
  levelName: string;
  room: string;
  timetable: string;
  teacherId: string;
  teacherName: string;
  studentIds: string[];
  campusId: string;
}

export interface TimetableFeed {
  calendar: CalendarItem[];
  planner: PlannerEvent[];
  registers: RegisterStub[];
  classrooms: ClassDraft[];
  assignmentLinks: { classId: string; href: string; title: string }[];
  examLinks: { classId: string; href: string; title: string }[];
  names: Record<string, string>;
  ical: string;
}

const OFFSET: Record<Weekday, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4 };

export function dateFor(anchorMonday: string, day: Weekday): string {
  const [year, month, date] = anchorMonday.split('-').map(Number);
  const stamp = new Date(Date.UTC(year || 2026, (month || 1) - 1, (date || 1) + OFFSET[day]));
  return stamp.toISOString().slice(0, 10);
}

export function deskLevel(level: string): LevelName {
  if (resolveLevel(level)) return levelLabel(level);
  if (level.toLowerCase().startsWith('primary')) return 'Primary';
  if (/lower secondary/i.test(level)) return 'Lower Secondary';
  if (/a-level|a level/i.test(level)) return 'A-Level';
  return 'IGCSE';
}

function holidaySet(doc: TimetableDoc): Set<string> {
  return new Set(doc.holidays.map(holiday => holiday.date));
}

function lessonTitle(doc: TimetableDoc, lesson: Lesson): string {
  const subject = doc.subjects.find(item => item.id === lesson.subjectId);
  return subject ? `${subject.name} — ${subject.level}` : lesson.subjectId;
}

export function buildFeed(doc: TimetableDoc): TimetableFeed {
  const holidays = holidaySet(doc);
  const calendar: CalendarItem[] = [];
  const planner: PlannerEvent[] = [];
  const registers: RegisterStub[] = [];
  const byClass = new Map<string, Lesson[]>();
  for (const lesson of doc.lessons) {
    const date = dateFor(doc.anchorMonday, lesson.day);
    if (holidays.has(date)) continue;
    const subject = doc.subjects.find(item => item.id === lesson.subjectId);
    const group = doc.groups.find(item => item.id === lesson.groupId);
    const period = doc.periods.find(item => item.id === lesson.periodId);
    const title = lessonTitle(doc, lesson);
    calendar.push({
      title,
      date,
      type: 'class',
      description: `${period?.label ?? lesson.periodId} ${period?.start ?? ''}`.trim(),
      campusId: lesson.campusId,
      classId: lesson.groupId,
      source: 'ai_draft',
    });
    planner.push({
      id: `tt-${lesson.id}`,
      title,
      date,
      kind: 'period',
      campusId: lesson.campusId,
      classId: lesson.groupId,
      yearGroup: subject?.level,
      period: period?.label,
      source: 'ai_draft',
      audience: 'all',
    });
    for (const studentId of group?.studentIds ?? []) {
      registers.push({
        id: `reg-${lesson.id}-${studentId}`,
        classId: lesson.groupId,
        studentId,
        date,
        periodId: lesson.periodId,
        lessonId: lesson.id,
        status: 'unmarked',
      });
    }
    const list = byClass.get(lesson.groupId) ?? [];
    list.push(lesson);
    byClass.set(lesson.groupId, list);
  }
  const classrooms: ClassDraft[] = [];
  for (const [groupId, lessons] of byClass) {
    const group = doc.groups.find(item => item.id === groupId);
    const subject = doc.subjects.find(item => item.id === lessons[0]?.subjectId);
    const teacher = doc.staff.find(item => item.id === lessons[0]?.teacherId);
    const room = doc.rooms.find(item => item.id === lessons[0]?.roomId);
    const slots = lessons.map(lesson => {
      const period = doc.periods.find(item => item.id === lesson.periodId);
      return `${lesson.day} ${period?.start ?? lesson.periodId}`;
    }).join(', ');
    classrooms.push({
      id: `tt-${groupId}`,
      name: subject ? `${subject.name} — ${subject.level}` : group?.name ?? groupId,
      subject: subject?.name ?? '',
      level: deskLevel(subject?.level ?? group?.level ?? 'IGCSE'),
      levelName: subject?.level ?? group?.level ?? 'IGCSE',
      room: room?.name ?? '',
      timetable: `tt:${slots}`,
      teacherId: teacher?.userId || teacher?.id || '',
      teacherName: teacher?.name ?? '',
      studentIds: group?.studentIds ?? [],
      campusId: lessons[0]?.campusId ?? '',
    });
  }
  return {
    calendar,
    planner,
    registers,
    classrooms,
    assignmentLinks: classrooms.map(room => ({ classId: room.id, href: `/dashboard/teacher/assignments?class=${room.id}`, title: room.name })),
    examLinks: classrooms.map(room => ({ classId: room.id, href: `/dashboard/teacher/exams?class=${room.id}`, title: room.name })),
    names: Object.fromEntries(doc.people.map(person => [person.id, person.name])),
    ical: toIcal(doc, calendar),
  };
}

function icsStamp(date: string, time: string): string {
  const [hour, minute] = time.split(':');
  return `${date.replace(/-/g, '')}T${(hour ?? '00').padStart(2, '0')}${(minute ?? '00').padStart(2, '0')}00`;
}

function escapeIcs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

export function toIcal(doc: TimetableDoc, items?: CalendarItem[]): string {
  const feed = items ?? buildFeed(doc).calendar;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Poket School//ET AI Timetabler//EN'];
  feed.forEach((item, index) => {
    const lesson = doc.lessons[index];
    const period = lesson && doc.periods.find(row => row.id === lesson.periodId);
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${lesson?.id ?? index}@poketschool.ai`);
    lines.push(`DTSTART:${icsStamp(item.date, period?.start ?? '08:30')}`);
    lines.push(`DTEND:${icsStamp(item.date, period?.end ?? '09:15')}`);
    lines.push(`SUMMARY:${escapeIcs(item.title)}`);
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function snapshot(doc: TimetableDoc, at: string, status: TimetableVersion['status'] = doc.status): TimetableVersion {
  return { version: doc.version, status, at, lessons: doc.lessons.map(lesson => ({ ...lesson })), quality: doc.quality, unmet: [...doc.unmet] };
}

export function publishTimetable(doc: TimetableDoc, at: string, actorId: string): { doc: TimetableDoc; feed: TimetableFeed } {
  const version = snapshot({ ...doc, status: 'published' }, at, 'published');
  const next: TimetableDoc = {
    ...doc,
    status: 'published',
    publishedVersion: doc.version,
    version: doc.version + 1,
    versions: [...doc.versions, version].slice(-12),
    audit: [{ id: `audit-${doc.audit.length + 1}`, at, actorId, action: 'publish', detail: `Published version ${doc.version}.` }, ...doc.audit],
  };
  return { doc: next, feed: buildFeed(next) };
}

export function rollbackTimetable(doc: TimetableDoc, version: number, at: string, actorId: string): TimetableDoc {
  const found = doc.versions.find(item => item.version === version);
  if (!found) return doc;
  return {
    ...doc,
    lessons: found.lessons.map(lesson => ({ ...lesson })),
    quality: found.quality,
    unmet: [...found.unmet],
    status: 'draft',
    version: doc.version + 1,
    audit: [{ id: `audit-${doc.audit.length + 1}`, at, actorId, action: 'rollback', detail: `Restored version ${version}.` }, ...doc.audit],
  };
}

export function visibleLessons(doc: TimetableDoc, filter: { teacherUserId?: string; studentId?: string; childIds?: string[]; roomId?: string; groupId?: string; campusId?: string }): Lesson[] {
  const child = new Set(filter.childIds ?? []);
  return doc.lessons.filter(lesson => {
    if (filter.campusId && lesson.campusId !== filter.campusId) return false;
    if (filter.roomId && lesson.roomId !== filter.roomId) return false;
    if (filter.groupId && lesson.groupId !== filter.groupId) return false;
    if (filter.teacherUserId) {
      const staff = doc.staff.find(item => item.id === lesson.teacherId);
      if (staff?.userId !== filter.teacherUserId && staff?.id !== filter.teacherUserId) return false;
    }
    if (filter.studentId) {
      const group = doc.groups.find(item => item.id === lesson.groupId);
      if (!group?.studentIds.includes(filter.studentId)) return false;
    }
    if (filter.childIds) {
      const group = doc.groups.find(item => item.id === lesson.groupId);
      if (!group?.studentIds.some(id => child.has(id))) return false;
    }
    return true;
  });
}

/** Adds published classes onto the school desk without removing the classes already there. */
export function applyTimetableToDesk(state: DeskState, feed: TimetableFeed): DeskState {
  let next = state;
  for (const draft of feed.classrooms) {
    if (next.classes.some(item => item.timetable.startsWith(`tt:`) && item.name === draft.name && item.room === draft.room)) continue;
    const created = createClass(next, {
      name: draft.name,
      subject: draft.subject,
      level: draft.level,
      programme: draft.levelName,
      term: 'Term 1',
      campus: draft.campusId,
      room: draft.room,
      timetable: draft.timetable,
      coTeachers: [],
      capacity: Math.max(draft.studentIds.length, 1),
      ownerTeacherId: draft.teacherId,
      ownerTeacherName: draft.teacherName,
      createdByRole: 'institution_admin',
    }, 'institution_admin');
    if (created.error) continue;
    next = created.state;
    const klass = next.classes[next.classes.length - 1];
    if (!klass) continue;
    for (const studentId of draft.studentIds) {
      next = addEnrolment(next, {
        classId: klass.id,
        studentId,
        studentName: feed.names[studentId] || studentId,
        under18: true,
        institutionMember: true,
        joinMethod: 'roster',
      }, 'ET AI Timetabler');
      const enrolment = next.enrolments[next.enrolments.length - 1];
      if (enrolment) next = approveEnrolment(next, enrolment.id, 'ET AI Timetabler');
    }
  }
  return next;
}

export function registersAsAttendance(feed: TimetableFeed): AttendanceRow[] {
  return feed.registers.map(row => ({
    id: row.id,
    classId: row.classId,
    studentId: row.studentId,
    date: row.date,
    session: row.periodId,
    status: 'excused',
    reason: 'Register opened. Not taken yet.',
    source: 'manual',
    activeMinutes: 0,
    parentNote: '',
  }));
}
