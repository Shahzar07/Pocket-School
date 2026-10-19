/** ET AI Timetabler records. Level names stay words such as Primary 2 and IGCSE. */

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const ROOM_TYPES = ['classroom', 'lab', 'ict', 'hall', 'studio', 'sports'] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export type TimetableKind = 'school' | 'personal';
export type TimetableStatus = 'draft' | 'published';
export type StaffStatus = 'active' | 'absent' | 'leave' | 'new_hire';
export type DayPart = 'morning' | 'afternoon';

export interface Period {
  id: string;
  label: string;
  start: string;
  end: string;
}

export interface TermSpan {
  id: string;
  name: string;
  start: string;
  end: string;
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
}

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  capacity: number;
  campusId: string;
}

export interface StaffMember {
  id: string;
  name: string;
  userId: string;
  /** Subject names this person can teach, such as Maths. */
  subjects: string[];
  /** Level names, such as Primary 2 or IGCSE. */
  levels: string[];
  maxPerDay: number;
  maxPerWeek: number;
  /** Empty means every school day. */
  worksDays: Weekday[];
  /** Keys `${day}:${periodId}`. */
  unavailable: string[];
  prefer: '' | DayPart;
  status: StaffStatus;
  campusId: string;
}

export interface TeachingGroup {
  id: string;
  name: string;
  level: string;
  studentIds: string[];
  kind: 'class' | 'set' | 'option';
  campusId: string;
}

export interface SubjectDemand {
  id: string;
  name: string;
  level: string;
  periodsPerWeek: number;
  roomType: RoomType;
  groupId: string;
  /** Empty allows any qualified teacher. */
  teacherIds: string[];
  campusId: string;
}

export interface OptionBlock {
  id: string;
  name: string;
  level: string;
  subjectIds: string[];
  pick: number;
}

export interface OptionSubject {
  id: string;
  name: string;
  level: string;
  roomType: RoomType;
}

export interface StudentChoice {
  studentId: string;
  blockId: string;
  subjectIds: string[];
}

export interface Lesson {
  id: string;
  subjectId: string;
  groupId: string;
  teacherId: string;
  roomId: string;
  day: Weekday;
  periodId: string;
  campusId: string;
}

export interface CoverAssignment {
  id: string;
  lessonId: string;
  date: string;
  absentTeacherId: string;
  coverTeacherId: string;
  roomId: string;
  reason: 'absent' | 'leave' | 'new_hire';
  status: 'proposed' | 'approved';
}

/** A room booked from the school Google calendar for one period of the anchor week. */
export interface RoomHold {
  id: string;
  roomId: string;
  day: Weekday;
  periodId: string;
  date: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string;
  action: string;
  detail: string;
}

export interface TimetableVersion {
  version: number;
  status: TimetableStatus;
  at: string;
  lessons: Lesson[];
  quality: number;
  unmet: string[];
}

export interface PersonRef {
  id: string;
  name: string;
  role: 'student' | 'teacher' | 'parent';
  childIds: string[];
}

export interface TimetableDoc {
  id: string;
  institutionId: string;
  ownerId: string;
  kind: TimetableKind;
  campusIds: string[];
  status: TimetableStatus;
  version: number;
  publishedVersion: number | null;
  quality: number;
  unmet: string[];
  explanation: string;
  anchorMonday: string;
  days: Weekday[];
  periods: Period[];
  terms: TermSpan[];
  holidays: Holiday[];
  rooms: Room[];
  staff: StaffMember[];
  groups: TeachingGroup[];
  subjects: SubjectDemand[];
  optionSubjects: OptionSubject[];
  blocks: OptionBlock[];
  choices: StudentChoice[];
  lessons: Lesson[];
  covers: CoverAssignment[];
  /** Present after a school Google calendar import. Older drafts omit it. */
  roomHolds?: RoomHold[];
  versions: TimetableVersion[];
  audit: AuditEntry[];
  people: PersonRef[];
}

export interface Clash {
  code: 'teacher' | 'room' | 'student' | 'room_type' | 'capacity' | 'availability' | 'load' | 'qualification' | 'campus';
  lessonId: string;
  message: string;
}
