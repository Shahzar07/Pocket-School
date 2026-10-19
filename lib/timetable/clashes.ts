import { isAfternoon, sizeOf, teaches, works } from './solver';
import type { Clash, Lesson, TimetableDoc, Weekday } from './types';

function students(doc: TimetableDoc, groupId: string): string[] {
  const group = doc.groups.find(item => item.id === groupId);
  if (!group || group.studentIds.length === 0) return [`group:${groupId}`];
  return group.studentIds;
}

function nameOf(doc: TimetableDoc, teacherId: string): string {
  return doc.staff.find(staff => staff.id === teacherId)?.name ?? teacherId;
}

function roomName(doc: TimetableDoc, roomId: string): string {
  return doc.rooms.find(room => room.id === roomId)?.name ?? roomId;
}

function periodLabel(doc: TimetableDoc, periodId: string): string {
  return doc.periods.find(period => period.id === periodId)?.label ?? periodId;
}

/** Hard-constraint failures. A solved seed week is expected to return none. */
export function hardViolations(doc: TimetableDoc, lessons: Lesson[]): Clash[] {
  const clashes: Clash[] = [];
  const seenTeacher = new Map<string, string>();
  const seenRoom = new Map<string, string>();
  const seenStudent = new Map<string, string>();
  const dayLoad = new Map<string, number>();
  const weekLoad = new Map<string, number>();

  for (const lesson of lessons) {
    const slot = `${lesson.day}:${lesson.periodId}`;
    const when = `${lesson.day} ${periodLabel(doc, lesson.periodId)}`;
    const teacherKey = `${lesson.teacherId}|${slot}`;
    const previousTeacher = seenTeacher.get(teacherKey);
    if (previousTeacher) {
      clashes.push({ code: 'teacher', lessonId: lesson.id, message: `${nameOf(doc, lesson.teacherId)} is already teaching at ${when}.` });
    } else seenTeacher.set(teacherKey, lesson.id);

    const roomKey = `${lesson.roomId}|${slot}`;
    if (seenRoom.has(roomKey)) {
      clashes.push({ code: 'room', lessonId: lesson.id, message: `${roomName(doc, lesson.roomId)} is already in use at ${when}.` });
    } else seenRoom.set(roomKey, lesson.id);

    for (const studentId of students(doc, lesson.groupId)) {
      const key = `${studentId}|${slot}`;
      if (seenStudent.has(key)) {
        const person = doc.people.find(item => item.id === studentId)?.name ?? studentId;
        clashes.push({ code: 'student', lessonId: lesson.id, message: `${person} is already in a lesson at ${when}.` });
      } else seenStudent.set(key, lesson.id);
    }

    const subject = doc.subjects.find(item => item.id === lesson.subjectId);
    const room = doc.rooms.find(item => item.id === lesson.roomId);
    const staff = doc.staff.find(item => item.id === lesson.teacherId);
    if (room && subject && room.type !== subject.roomType) {
      clashes.push({ code: 'room_type', lessonId: lesson.id, message: `${room.name} is a ${room.type}, and this lesson needs a ${subject.roomType}.` });
    }
    if (room && subject && room.capacity < sizeOf(doc, lesson.groupId)) {
      clashes.push({ code: 'capacity', lessonId: lesson.id, message: `${room.name} holds ${room.capacity} and this class has ${sizeOf(doc, lesson.groupId)}.` });
    }
    if (room && subject && room.campusId !== subject.campusId) {
      clashes.push({ code: 'campus', lessonId: lesson.id, message: `${room.name} is on another campus.` });
    }
    if (staff && subject) {
      if (staff.status === 'absent' || staff.status === 'leave') {
        clashes.push({ code: 'availability', lessonId: lesson.id, message: `${staff.name} is marked ${staff.status}.` });
      }
      if (!works(staff, lesson.day, lesson.periodId)) {
        clashes.push({ code: 'availability', lessonId: lesson.id, message: `${staff.name} is unavailable at ${when}.` });
      }
      if (staff.campusId && subject.campusId !== staff.campusId) {
        clashes.push({ code: 'campus', lessonId: lesson.id, message: `${staff.name} is based on another campus.` });
      }
      if (!teaches(staff, subject)) {
        clashes.push({ code: 'qualification', lessonId: lesson.id, message: `${staff.name} does not teach ${subject.name} at ${subject.level}.` });
      }
      const dayKey = `${staff.id}|${lesson.day}`;
      const nextDay = (dayLoad.get(dayKey) ?? 0) + 1;
      dayLoad.set(dayKey, nextDay);
      const nextWeek = (weekLoad.get(staff.id) ?? 0) + 1;
      weekLoad.set(staff.id, nextWeek);
      if (nextDay > staff.maxPerDay) {
        clashes.push({ code: 'load', lessonId: lesson.id, message: `${staff.name} would teach ${nextDay} lessons on ${lesson.day}, above the daily maximum of ${staff.maxPerDay}.` });
      }
      if (nextWeek > staff.maxPerWeek) {
        clashes.push({ code: 'load', lessonId: lesson.id, message: `${staff.name} would teach ${nextWeek} lessons this week, above the weekly maximum of ${staff.maxPerWeek}.` });
      }
    }
  }
  return clashes;
}

export function canMove(doc: TimetableDoc, lessons: Lesson[], lessonId: string, day: Weekday, periodId: string, roomId?: string, teacherId?: string): { ok: boolean; reasons: string[] } {
  const next = lessons.map(lesson => lesson.id === lessonId
    ? { ...lesson, day, periodId, roomId: roomId ?? lesson.roomId, teacherId: teacherId ?? lesson.teacherId }
    : lesson);
  const reasons = hardViolations(doc, next).filter(clash => clash.lessonId === lessonId).map(clash => clash.message);
  return { ok: reasons.length === 0, reasons };
}

export function suggestFix(doc: TimetableDoc, lessons: Lesson[], lessonId: string): Lesson | null {
  const lesson = lessons.find(item => item.id === lessonId);
  const subject = lesson && doc.subjects.find(item => item.id === lesson.subjectId);
  if (!lesson || !subject) return null;
  const rest = lessons.filter(item => item.id !== lessonId);
  const trial: Lesson[] = [];
  const rooms = doc.rooms.filter(room => room.campusId === subject.campusId && room.type === subject.roomType && room.capacity >= sizeOf(doc, subject.groupId));
  const staff = doc.staff.filter(person => teaches(person, subject) && person.status !== 'absent' && person.status !== 'leave' && (!person.campusId || person.campusId === subject.campusId));
  for (const day of doc.days) {
    for (const period of doc.periods) {
      for (const teacher of staff) {
        for (const room of rooms) {
          const moved: Lesson = { ...lesson, day, periodId: period.id, teacherId: teacher.id, roomId: room.id };
          const clashes = hardViolations(doc, [...rest, moved]).filter(clash => clash.lessonId === lesson.id);
          if (clashes.length === 0) trial.push(moved);
        }
      }
    }
  }
  const currentOk = hardViolations(doc, lessons).every(clash => clash.lessonId !== lessonId);
  const ranked = trial.sort((a, b) => {
    const preferCurrent = currentOk && a.day === lesson.day && a.periodId === lesson.periodId ? -1 : 0;
    const preferCurrentB = currentOk && b.day === lesson.day && b.periodId === lesson.periodId ? -1 : 0;
    return preferCurrent - preferCurrentB || a.day.localeCompare(b.day) || a.periodId.localeCompare(b.periodId) || a.teacherId.localeCompare(b.teacherId);
  });
  if (currentOk) {
    const other = ranked.find(item => item.day !== lesson.day || item.periodId !== lesson.periodId || item.roomId !== lesson.roomId);
    return other ?? lesson;
  }
  return ranked[0] ?? null;
}

export function slotPart(doc: TimetableDoc, periodId: string): 'morning' | 'afternoon' {
  const period = doc.periods.find(item => item.id === periodId);
  return period && isAfternoon(period) ? 'afternoon' : 'morning';
}
