import { dateFor } from './publish';
import { teaches, works } from './solver';
import type { CoverAssignment, Lesson, StaffMember, TimetableDoc, Weekday } from './types';

export interface CoverProposal {
  lessonId: string;
  date: string;
  day: Weekday;
  absentTeacherId: string;
  coverTeacherId: string;
  roomId: string;
  reason: CoverAssignment['reason'];
  note: string;
}

export interface CoverNotice {
  userId: string;
  title: string;
  message: string;
  type: 'announcement';
  link: string;
  read: false;
}

const WEEK = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function weekdayOf(iso: string): Weekday | null {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return null;
  const name = WEEK[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  if (name === 'mon' || name === 'tue' || name === 'wed' || name === 'thu' || name === 'fri') return name;
  return null;
}

function approvedLoad(doc: TimetableDoc, teacherId: string): number {
  return doc.covers.filter(cover => cover.coverTeacherId === teacherId && cover.status === 'approved').length;
}

function busy(doc: TimetableDoc, lessons: Lesson[], teacherId: string, day: Weekday, periodId: string): boolean {
  return lessons.some(lesson => lesson.teacherId === teacherId && lesson.day === day && lesson.periodId === periodId);
}

function roomBusy(lessons: Lesson[], roomId: string, day: Weekday, periodId: string, except: string): boolean {
  return lessons.some(lesson => lesson.id !== except && lesson.roomId === roomId && lesson.day === day && lesson.periodId === periodId);
}

function spare(staff: StaffMember, lessons: Lesson[]): number {
  return staff.maxPerWeek - lessons.filter(lesson => lesson.teacherId === staff.id).length;
}

function dayCount(staffId: string, day: Weekday, lessons: Lesson[]): number {
  return lessons.filter(lesson => lesson.teacherId === staffId && lesson.day === day).length;
}

/**
 * Qualified, free, and inside load. Fairness prefers the teacher who has covered least.
 * A room swap is used when the original room is taken.
 */
export function proposeCover(doc: TimetableDoc, teacherId: string, date: string, reason: CoverAssignment['reason']): CoverProposal[] {
  const day = weekdayOf(date);
  if (!day) return [];
  const days: Weekday[] = reason === 'leave' ? doc.days : [day];
  const lessons = doc.lessons.filter(lesson => lesson.teacherId === teacherId && days.includes(lesson.day));
  const proposals: CoverProposal[] = [];
  for (const lesson of lessons) {
    const subject = doc.subjects.find(item => item.id === lesson.subjectId);
    if (!subject) continue;
    const lessonDate = reason === 'leave' ? dateFor(doc.anchorMonday, lesson.day) : date;
    const candidates = doc.staff.filter(staff => {
      if (staff.id === teacherId || staff.status === 'absent' || staff.status === 'leave') return false;
      if (!teaches(staff, subject)) return false;
      if (staff.campusId && staff.campusId !== lesson.campusId) return false;
      if (!works(staff, lesson.day, lesson.periodId)) return false;
      if (busy(doc, doc.lessons, staff.id, lesson.day, lesson.periodId)) return false;
      if (dayCount(staff.id, lesson.day, doc.lessons) + 1 > staff.maxPerDay) return false;
      if (spare(staff, doc.lessons) < 1) return false;
      return true;
    }).sort((a, b) => approvedLoad(doc, a.id) - approvedLoad(doc, b.id)
      || spare(b, doc.lessons) - spare(a, doc.lessons)
      || a.id.localeCompare(b.id));
    const cover = candidates[0];
    if (!cover) continue;
    let roomId = lesson.roomId;
    let note = `${cover.name} is free and qualified.`;
    if (roomBusy(doc.lessons, roomId, lesson.day, lesson.periodId, lesson.id)) {
      const swap = doc.rooms.find(room => room.campusId === lesson.campusId && room.type === subject.roomType && room.capacity >= Math.max(1, (doc.groups.find(group => group.id === lesson.groupId)?.studentIds.length ?? 1)) && !roomBusy(doc.lessons, room.id, lesson.day, lesson.periodId, lesson.id));
      if (!swap) continue;
      roomId = swap.id;
      note = `${cover.name} can teach it in ${swap.name}.`;
    }
    proposals.push({
      lessonId: lesson.id,
      date: lessonDate,
      day: lesson.day,
      absentTeacherId: teacherId,
      coverTeacherId: cover.id,
      roomId,
      reason,
      note,
    });
  }
  return proposals;
}

export function approveCover(doc: TimetableDoc, proposals: CoverProposal[], at: string, actorId: string): TimetableDoc {
  const covers: CoverAssignment[] = proposals.map((proposal, index) => ({
    id: `cover-${doc.covers.length + index + 1}`,
    lessonId: proposal.lessonId,
    date: proposal.date,
    absentTeacherId: proposal.absentTeacherId,
    coverTeacherId: proposal.coverTeacherId,
    roomId: proposal.roomId,
    reason: proposal.reason,
    status: 'approved',
  }));
  return {
    ...doc,
    covers: [...doc.covers, ...covers],
    audit: [{ id: `audit-${doc.audit.length + 1}`, at, actorId, action: 'cover-approve', detail: `Approved ${covers.length} cover lessons.` }, ...doc.audit],
  };
}

export function coverNotices(doc: TimetableDoc, proposals: CoverProposal[]): CoverNotice[] {
  const notices: CoverNotice[] = [];
  for (const proposal of proposals) {
    const lesson = doc.lessons.find(item => item.id === proposal.lessonId);
    const subject = lesson && doc.subjects.find(item => item.id === lesson.subjectId);
    const group = lesson && doc.groups.find(item => item.id === lesson.groupId);
    const cover = doc.staff.find(item => item.id === proposal.coverTeacherId);
    const absent = doc.staff.find(item => item.id === proposal.absentTeacherId);
    const label = `${subject?.name ?? 'Lesson'} — ${subject?.level ?? ''}`.trim();
    const link = '/dashboard/teacher/timetable';
    if (cover) {
      notices.push({ userId: cover.userId || cover.id, title: 'Cover lesson', message: `${cover.name}, you are covering ${label} on ${proposal.date}.`, type: 'announcement', link, read: false });
    }
    if (absent) {
      notices.push({ userId: absent.userId || absent.id, title: 'Cover arranged', message: `${cover?.name ?? 'A colleague'} is covering your ${label} on ${proposal.date}.`, type: 'announcement', link, read: false });
    }
    for (const studentId of group?.studentIds ?? []) {
      const student = doc.people.find(person => person.id === studentId);
      notices.push({ userId: studentId, title: 'Lesson cover', message: `${label} on ${proposal.date} is taught by ${cover?.name ?? 'a cover teacher'}.`, type: 'announcement', link: '/dashboard/student/timetable', read: false });
      const parents = doc.people.filter(person => person.role === 'parent' && person.childIds.includes(studentId));
      for (const parent of parents) {
        notices.push({ userId: parent.id, title: 'Lesson cover', message: `${student?.name ?? 'Your child'} has ${label} covered by ${cover?.name ?? 'a cover teacher'} on ${proposal.date}.`, type: 'announcement', link: '/dashboard/parent/timetable', read: false });
      }
    }
  }
  return notices;
}

export function coverLoad(doc: TimetableDoc): { teacherId: string; name: string; count: number }[] {
  return doc.staff.map(staff => ({
    teacherId: staff.id,
    name: staff.name,
    count: approvedLoad(doc, staff.id),
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function setStaffStatus(doc: TimetableDoc, teacherId: string, status: TimetableDoc['staff'][number]['status']): TimetableDoc {
  return {
    ...doc,
    staff: doc.staff.map(staff => staff.id === teacherId ? { ...staff, status } : staff),
  };
}
