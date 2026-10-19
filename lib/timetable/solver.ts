import type {
  Lesson,
  Period,
  Room,
  StaffMember,
  SubjectDemand,
  TeachingGroup,
  TimetableDoc,
  Weekday,
} from './types';
import { roomHeld } from './holds';

export interface SolveResult {
  lessons: Lesson[];
  unplaced: string[];
  quality: number;
  unmet: string[];
  penalty: number;
}

interface Request {
  id: string;
  subject: SubjectDemand;
}

interface Candidate {
  teacherId: string;
  roomId: string;
  day: Weekday;
  periodId: string;
  cost: number;
}

function groupOf(doc: TimetableDoc, id: string): TeachingGroup | undefined {
  return doc.groups.find(group => group.id === id);
}

function students(doc: TimetableDoc, groupId: string): string[] {
  const group = groupOf(doc, groupId);
  if (!group || group.studentIds.length === 0) return [`group:${groupId}`];
  return group.studentIds;
}

function sizeOf(doc: TimetableDoc, groupId: string): number {
  const group = groupOf(doc, groupId);
  return Math.max(1, group?.studentIds.length ?? 1);
}

export function isAfternoon(period: Period): boolean {
  return period.start >= '12:00';
}

function teaches(staff: StaffMember, subject: SubjectDemand): boolean {
  const names = staff.subjects.map(item => item.toLowerCase());
  const levels = staff.levels.map(item => item.toLowerCase());
  const level = subject.level.toLowerCase();
  const subjectOk = names.includes(subject.name.toLowerCase());
  const levelOk = levels.some(item => item === level || level.startsWith(`${item} `) || level === item);
  return subjectOk && levelOk;
}

function eligibleStaff(doc: TimetableDoc, subject: SubjectDemand): StaffMember[] {
  return doc.staff.filter(staff => {
    if (staff.status === 'absent' || staff.status === 'leave') return false;
    if (subject.teacherIds.length > 0 && !subject.teacherIds.includes(staff.id)) return false;
    if (staff.campusId && staff.campusId !== subject.campusId) return false;
    return teaches(staff, subject);
  });
}

function freeStaff(doc: TimetableDoc, subject: SubjectDemand): StaffMember[] {
  return doc.staff.filter(staff => {
    if (staff.status === 'absent' || staff.status === 'leave') return false;
    if (staff.campusId && staff.campusId !== subject.campusId) return false;
    return teaches(staff, subject);
  });
}

function works(staff: StaffMember, day: Weekday, periodId: string): boolean {
  if (staff.worksDays.length > 0 && !staff.worksDays.includes(day)) return false;
  if (staff.unavailable.includes(`${day}:${periodId}`)) return false;
  return true;
}

function requestsOf(doc: TimetableDoc): Request[] {
  const requests: Request[] = [];
  for (const subject of doc.subjects) {
    const count = Math.max(0, Math.floor(subject.periodsPerWeek));
    for (let index = 0; index < count; index += 1) {
      requests.push({ id: `${subject.id}#${index}`, subject });
    }
  }
  return requests;
}

function load(lessons: Lesson[], teacherId: string, day?: Weekday): number {
  return lessons.filter(lesson => lesson.teacherId === teacherId && (!day || lesson.day === day)).length;
}

function occupied(lessons: Lesson[], doc: TimetableDoc, request: Request, day: Weekday, periodId: string, teacherId: string, roomId: string): boolean {
  if (roomHeld(doc, roomId, day, periodId)) return true;
  const mine = new Set(students(doc, request.subject.groupId));
  for (const lesson of lessons) {
    if (lesson.day !== day || lesson.periodId !== periodId) continue;
    if (lesson.teacherId === teacherId || lesson.roomId === roomId) return true;
    if (lesson.groupId === request.subject.groupId) return true;
    const theirs = students(doc, lesson.groupId);
    if (theirs.some(id => mine.has(id))) return true;
  }
  return false;
}

function candidateCost(doc: TimetableDoc, lessons: Lesson[], request: Request, candidate: Omit<Candidate, 'cost'>): number {
  const subjectLessons = lessons.filter(lesson => lesson.subjectId === request.subject.id);
  const sameDay = subjectLessons.filter(lesson => lesson.day === candidate.day).length;
  const staff = doc.staff.find(item => item.id === candidate.teacherId);
  const period = doc.periods.find(item => item.id === candidate.periodId);
  let cost = sameDay * 8;
  if (staff?.prefer && period) {
    const afternoon = isAfternoon(period);
    if (staff.prefer === 'morning' && afternoon) cost += 4;
    if (staff.prefer === 'afternoon' && !afternoon) cost += 4;
  }
  const index = doc.periods.findIndex(item => item.id === candidate.periodId);
  const neighbours = subjectLessons.filter(lesson => lesson.day === candidate.day && Math.abs(doc.periods.findIndex(item => item.id === lesson.periodId) - index) === 1);
  cost += neighbours.length * 6;
  cost += load(lessons, candidate.teacherId, candidate.day);
  return cost;
}

function optionsFor(doc: TimetableDoc, lessons: Lesson[], request: Request, staffList: StaffMember[]): Candidate[] {
  const options: Candidate[] = [];
  const rooms = doc.rooms.filter(room => room.type === request.subject.roomType && room.campusId === request.subject.campusId && room.capacity >= sizeOf(doc, request.subject.groupId));
  for (const staff of staffList) {
    for (const day of doc.days) {
      if (load(lessons, staff.id) >= staff.maxPerWeek) continue;
      if (load(lessons, staff.id, day) >= staff.maxPerDay) continue;
      for (const period of doc.periods) {
        if (!works(staff, day, period.id)) continue;
        for (const room of rooms) {
          if (occupied(lessons, doc, request, day, period.id, staff.id, room.id)) continue;
          const base = { teacherId: staff.id, roomId: room.id, day, periodId: period.id };
          options.push({ ...base, cost: candidateCost(doc, lessons, request, base) });
        }
      }
    }
  }
  return options;
}

function lessonFrom(request: Request, candidate: Candidate): Lesson {
  return {
    id: request.id,
    subjectId: request.subject.id,
    groupId: request.subject.groupId,
    teacherId: candidate.teacherId,
    roomId: candidate.roomId,
    day: candidate.day,
    periodId: candidate.periodId,
    campusId: request.subject.campusId,
  };
}

function pick(options: Candidate[]): Candidate {
  return options.slice().sort((a, b) => a.cost - b.cost
    || a.teacherId.localeCompare(b.teacherId)
    || a.roomId.localeCompare(b.roomId)
    || a.day.localeCompare(b.day)
    || a.periodId.localeCompare(b.periodId))[0]!;
}

export function unmetSoft(doc: TimetableDoc, lessons: Lesson[]): string[] {
  const lines: string[] = [];
  for (const subject of doc.subjects) {
    const mine = lessons.filter(lesson => lesson.subjectId === subject.id);
    if (mine.length < 2) continue;
    const days = new Set(mine.map(lesson => lesson.day));
    if (days.size === 1) lines.push(`${subject.name} for ${subject.level} is bunched on one day.`);
    for (const day of days) {
      const indexes = mine.filter(lesson => lesson.day === day).map(lesson => doc.periods.findIndex(period => period.id === lesson.periodId)).sort((a, b) => a - b);
      for (let index = 1; index < indexes.length; index += 1) {
        if (indexes[index]! - indexes[index - 1]! === 1) {
          lines.push(`${subject.name} for ${subject.level} is back to back.`);
          break;
        }
      }
    }
  }
  for (const lesson of lessons) {
    const staff = doc.staff.find(item => item.id === lesson.teacherId);
    const period = doc.periods.find(item => item.id === lesson.periodId);
    if (!staff?.prefer || !period) continue;
    const afternoon = isAfternoon(period);
    if (staff.prefer === 'morning' && afternoon) lines.push(`${staff.name} prefers mornings and has an afternoon lesson.`);
    if (staff.prefer === 'afternoon' && !afternoon) lines.push(`${staff.name} prefers afternoons and has a morning lesson.`);
  }
  for (const group of doc.groups) {
    for (const day of doc.days) {
      const mine = lessons.filter(lesson => lesson.groupId === group.id && lesson.day === day)
        .sort((a, b) => doc.periods.findIndex(period => period.id === a.periodId) - doc.periods.findIndex(period => period.id === b.periodId));
      for (let index = 1; index < mine.length; index += 1) {
        const previous = doc.periods.findIndex(period => period.id === mine[index - 1]!.periodId);
        const current = doc.periods.findIndex(period => period.id === mine[index]!.periodId);
        if (current - previous > 1) lines.push(`${group.name} has a gap.`);
        if (mine[index]!.roomId !== mine[index - 1]!.roomId) lines.push(`${group.name} changes room.`);
      }
    }
  }
  return [...new Set(lines)].sort();
}

export function qualityFrom(unmet: string[], unplaced: number): number {
  return Math.max(0, Math.min(100, 100 - unmet.length * 4 - unplaced * 15));
}

function penaltyOf(unmet: string[]): number {
  return unmet.length;
}

function improve(doc: TimetableDoc, lessons: Lesson[]): Lesson[] {
  let current = lessons;
  for (let pass = 0; pass < 2; pass += 1) {
    for (const lesson of [...current].sort((a, b) => a.id.localeCompare(b.id))) {
      const subject = doc.subjects.find(item => item.id === lesson.subjectId);
      if (!subject) continue;
      const request: Request = { id: lesson.id, subject };
      const rest = current.filter(item => item.id !== lesson.id);
      const options = optionsFor(doc, rest, request, eligibleStaff(doc, subject))
        .sort((a, b) => a.day.localeCompare(b.day) || a.periodId.localeCompare(b.periodId) || a.teacherId.localeCompare(b.teacherId));
      const now = penaltyOf(unmetSoft(doc, current));
      let best = now;
      let chosen: Candidate | null = null;
      for (const option of options) {
        const score = penaltyOf(unmetSoft(doc, [...rest, lessonFrom(request, option)]));
        if (score < best) {
          best = score;
          chosen = option;
        }
      }
      if (chosen) current = [...rest, lessonFrom(request, chosen)];
    }
  }
  return current.sort((a, b) => a.day.localeCompare(b.day) || a.periodId.localeCompare(b.periodId) || a.id.localeCompare(b.id));
}

/** Deterministic greedy placement, then a short local search. Hard constraints are never written. */
export function solveTimetable(doc: TimetableDoc): SolveResult {
  const pending = requestsOf(doc);
  const placed: Lesson[] = [];
  const unplaced: string[] = [];
  let guard = pending.length + 2;
  while (pending.length > 0 && guard > 0) {
    guard -= 1;
    const ranked = pending.map(request => ({
      request,
      options: optionsFor(doc, placed, request, eligibleStaff(doc, request.subject)),
    })).sort((a, b) => a.options.length - b.options.length || a.request.id.localeCompare(b.request.id));
    const next = ranked[0];
    if (!next) break;
    const index = pending.findIndex(request => request.id === next.request.id);
    pending.splice(index, 1);
    if (next.options.length === 0) {
      unplaced.push(`${next.request.subject.name} for ${next.request.subject.level}`);
      continue;
    }
    placed.push(lessonFrom(next.request, pick(next.options)));
  }
  const lessons = improve(doc, placed);
  const unmet = unmetSoft(doc, lessons);
  return {
    lessons,
    unplaced,
    unmet,
    penalty: unmet.length,
    quality: qualityFrom(unmet, unplaced.length),
  };
}

export function explainSolve(result: SolveResult, requested: number): string {
  const placed = result.lessons.length;
  const soft = result.unmet.length
    ? `Soft constraints still open: ${result.unmet.join(' ')}`
    : 'Every soft constraint is met.';
  const missed = result.unplaced.length ? ` Could not place ${result.unplaced.join(', ')}.` : '';
  return `Placed ${placed} of ${requested} lessons. Quality ${result.quality}. ${soft}${missed} ET AI kept every placed lesson free of teacher, room, and student double bookings.`;
}

export function proposeSoftFixes(unmet: string[]): string[] {
  return unmet.map(line => {
    if (line.includes('bunched')) return `Move one lesson so ${line.replace(' is bunched on one day.', '')} meets on another day.`;
    if (line.includes('back to back')) return `Separate the back-to-back lessons in ${line.replace(' is back to back.', '')}.`;
    if (line.includes('prefers')) return `Move that lesson into the part of the day the teacher asked for.`;
    if (line.includes('gap')) return `Pull the lessons together so ${line.replace(' has a gap.', '')} has no hole.`;
    if (line.includes('changes room')) return `Keep ${line.replace(' changes room.', '')} in the same room that day.`;
    return `Review “${line}”.`;
  });
}

export function requestedCount(doc: TimetableDoc): number {
  return doc.subjects.reduce((sum, subject) => sum + Math.max(0, Math.floor(subject.periodsPerWeek)), 0);
}

export { freeStaff, teaches, works, sizeOf };
export type { Room };
