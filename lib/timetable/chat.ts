import { hardViolations, suggestFix } from './clashes';
import { DAY_LABEL } from './copy';
import { approveCover, coverNotices, proposeCover, setStaffStatus, type CoverNotice, type CoverProposal } from './cover';
import { parsePaperTimetable, type PaperRow } from './paper';
import { dateFor } from './publish';
import { explainSolve, solveTimetable } from './solver';
import type { Lesson, RoomType, StaffMember, SubjectDemand, TimetableDoc, Weekday } from './types';

const DAYS: Record<string, Weekday> = {
  monday: 'mon', tuesday: 'tue', wednesday: 'wed', thursday: 'thu', friday: 'fri',
};

export type TimetableIntent =
  | { type: 'build'; level: string }
  | { type: 'cover'; name: string; when: 'tomorrow' | Weekday }
  | { type: 'fix-rooms'; day: Weekday }
  | { type: 'add-periods'; subject: string; level: string; count: number }
  | { type: 'import'; rows: PaperRow[] };

export interface TimetableChange {
  kind: 'added' | 'removed' | 'moved' | 'cover';
  label: string;
}

export interface TimetablePreview {
  doc: TimetableDoc;
  summary: string;
  changes: TimetableChange[];
  confirmable: boolean;
  notices: CoverNotice[];
}

function cleanLevel(value: string): string {
  return value.replace(/[.?!]+$/g, '').replace(/\s+/g, ' ').trim();
}

function titleSubject(value: string): string {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.toLowerCase() === 'maths') return 'Maths';
  return cleaned.replace(/\b[a-z]/g, letter => letter.toUpperCase());
}

export function parseTimetableChat(text: string): TimetableIntent | null {
  const source = text.replace(/\s+/g, ' ').trim();
  if (!source) return null;

  const added = source.match(/\badd\s+(\d+)\s+more\s+([a-z][a-z &'-]*?)\s+periods?\s+for\s+([a-z0-9][a-z0-9 &'-]*)/i);
  if (added) {
    return {
      type: 'add-periods',
      count: Number(added[1]),
      subject: titleSubject(added[2] ?? ''),
      level: cleanLevel(added[3] ?? ''),
    };
  }

  const rooms = source.match(/\bfix\b.*\broom clashes?\b.*\b(monday|tuesday|wednesday|thursday|friday)\b/i);
  if (rooms) {
    const day = DAYS[rooms[1]!.toLowerCase()];
    if (day) return { type: 'fix-rooms', day };
  }

  const cover = source.match(/\b(?:mr|mrs|ms|dr)\.?\s+([a-z][a-z' -]*?)\s+is\s+off\b(?:\s+(?:on\s+)?(tomorrow|monday|tuesday|wednesday|thursday|friday))?/i);
  if (cover) {
    const whenWord = (cover[2] ?? 'tomorrow').toLowerCase();
    const when = whenWord === 'tomorrow' ? 'tomorrow' : DAYS[whenWord];
    if (when && cover[1]) return { type: 'cover', name: cover[1].trim(), when };
  }

  const forLevel = source.match(/\bbuild\b.*\btimetable\b.*\bfor\s+([a-z0-9][a-z0-9 &'-]*)/i);
  if (forLevel) return { type: 'build', level: cleanLevel(forLevel[1] ?? '') };

  const named = source.match(/\bbuild\b.*\b([a-z0-9][a-z0-9 &'-]*?)\s+timetable\b/i);
  if (named) {
    const level = cleanLevel(named[1] ?? '').replace(/^(the|next|term's|terms)\s+/i, '').trim();
    if (level && !/^(a|an|the|next|my)$/i.test(level)) return { type: 'build', level: titleSubject(level) };
  }

  const rows = parsePaperTimetable(source);
  if (rows.length > 0) return { type: 'import', rows };
  return null;
}

function addIsoDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year || 2026, (month || 1) - 1, day || 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function sameLevel(level: string, wanted: string): boolean {
  return level.toLowerCase() === wanted.toLowerCase();
}

function lessonLabel(doc: TimetableDoc, lesson: Lesson): string {
  const subject = doc.subjects.find(item => item.id === lesson.subjectId);
  const name = subject ? `${subject.name} — ${subject.level}` : lesson.subjectId;
  return `${name} ${lesson.day} ${lesson.periodId}`;
}

export function diffLessons(before: TimetableDoc, after: TimetableDoc): TimetableChange[] {
  const previous = new Map(before.lessons.map(lesson => [lesson.id, lesson]));
  const next = new Map(after.lessons.map(lesson => [lesson.id, lesson]));
  const changes: TimetableChange[] = [];
  for (const lesson of after.lessons) {
    const prior = previous.get(lesson.id);
    if (!prior) changes.push({ kind: 'added', label: lessonLabel(after, lesson) });
    else if (prior.day !== lesson.day || prior.periodId !== lesson.periodId || prior.roomId !== lesson.roomId || prior.teacherId !== lesson.teacherId) {
      changes.push({ kind: 'moved', label: `${lessonLabel(before, prior)} → ${lesson.day} ${lesson.periodId} ${lesson.roomId}` });
    }
  }
  for (const lesson of before.lessons) {
    if (!next.has(lesson.id)) changes.push({ kind: 'removed', label: lessonLabel(before, lesson) });
  }
  return changes;
}

function mergeLessons(doc: TimetableDoc, kept: Lesson[], placed: Lesson[]): Lesson[] {
  const lessons = [...placed];
  for (const lesson of kept) {
    const trial = [...lessons, lesson];
    const blocked = hardViolations(doc, trial).some(clash => clash.lessonId === lesson.id);
    if (!blocked) lessons.push(lesson);
  }
  return lessons;
}

function buildLevel(doc: TimetableDoc, level: string): TimetablePreview {
  const wanted = doc.subjects.filter(subject => sameLevel(subject.level, level));
  if (wanted.length === 0) {
    return { doc, summary: `No ${level} subjects are set up yet.`, changes: [], confirmable: false, notices: [] };
  }
  const result = solveTimetable({ ...doc, subjects: wanted, lessons: [] });
  const kept = doc.lessons.filter(lesson => {
    const subject = doc.subjects.find(item => item.id === lesson.subjectId);
    return subject ? !sameLevel(subject.level, level) : false;
  });
  const next: TimetableDoc = {
    ...doc,
    lessons: mergeLessons(doc, kept, result.lessons),
    quality: result.quality,
    unmet: result.unmet,
    explanation: explainSolve(result, wanted.reduce((sum, subject) => sum + subject.periodsPerWeek, 0)),
    status: 'draft',
  };
  return {
    doc: next,
    summary: `Draft ${level} timetable for the next term. ${result.lessons.length} lessons placed. Quality ${result.quality}. ${TIMETABLE_CONFIRM}`,
    changes: diffLessons(doc, next),
    confirmable: result.lessons.length > 0,
    notices: [],
  };
}

const TIMETABLE_CONFIRM = 'Confirm before ET AI changes the week.';

function staffByName(doc: TimetableDoc, name: string): StaffMember | undefined {
  const needle = name.toLowerCase();
  return doc.staff
    .map(person => ({ person, score: person.name.toLowerCase().includes(needle) ? needle.length : 0 }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.person.id.localeCompare(b.person.id))[0]?.person;
}

function coverDate(doc: TimetableDoc, when: 'tomorrow' | Weekday, today: string): string {
  if (when === 'tomorrow') return addIsoDays(today, 1);
  return dateFor(doc.anchorMonday, when);
}

function coverPreview(doc: TimetableDoc, name: string, when: 'tomorrow' | Weekday, today: string): TimetablePreview {
  const staff = staffByName(doc, name);
  if (!staff) {
    return { doc, summary: `ET AI could not match ${name} to a member of staff.`, changes: [], confirmable: false, notices: [] };
  }
  const date = coverDate(doc, when, today);
  const proposals = proposeCover(doc, staff.id, date, 'absent');
  if (proposals.length === 0) {
    return { doc, summary: `${staff.name} has no lesson that needs cover on ${date}.`, changes: [], confirmable: false, notices: [] };
  }
  const next = approveCover(setStaffStatus(doc, staff.id, 'absent'), proposals, new Date(0).toISOString(), 'et-ai');
  return {
    doc: next,
    summary: `${staff.name} is off on ${date}. ${proposals.length} cover lessons are ready. ${TIMETABLE_CONFIRM}`,
    changes: proposals.map(proposal => coverChange(doc, proposal)),
    confirmable: true,
    notices: coverNotices(doc, proposals),
  };
}

function coverChange(doc: TimetableDoc, proposal: CoverProposal): TimetableChange {
  const lesson = doc.lessons.find(item => item.id === proposal.lessonId);
  const subject = lesson && doc.subjects.find(item => item.id === lesson.subjectId);
  const cover = doc.staff.find(item => item.id === proposal.coverTeacherId);
  const label = subject ? `${subject.name} — ${subject.level}` : proposal.lessonId;
  return { kind: 'cover', label: `${cover?.name ?? 'Cover'} takes ${label} on ${proposal.day} ${lesson?.periodId ?? ''}`.trim() };
}

function fixRooms(doc: TimetableDoc, day: Weekday): TimetablePreview {
  let lessons = doc.lessons.map(lesson => ({ ...lesson }));
  const targets = hardViolations(doc, lessons)
    .filter(clash => clash.code === 'room' && lessons.find(lesson => lesson.id === clash.lessonId)?.day === day)
    .map(clash => clash.lessonId);
  for (const lessonId of targets) {
    const current = lessons.find(lesson => lesson.id === lessonId);
    const fixed = current && suggestFix(doc, lessons, lessonId);
    if (!current || !fixed) continue;
    if (fixed.roomId === current.roomId && fixed.day === current.day && fixed.periodId === current.periodId) continue;
    const trial = lessons.map(lesson => lesson.id === lessonId ? fixed : lesson);
    const still = hardViolations(doc, trial).some(clash => clash.lessonId === lessonId && clash.code === 'room');
    if (!still) lessons = trial;
  }
  const next: TimetableDoc = { ...doc, lessons, status: 'draft' };
  const changes = diffLessons(doc, next);
  const dayName = DAY_LABEL[day] ?? day;
  if (changes.length === 0) {
    return { doc, summary: `No room clash on ${dayName}.`, changes: [], confirmable: false, notices: [] };
  }
  return {
    doc: next,
    summary: `Room clashes on ${dayName}: ${changes.length} move${changes.length === 1 ? '' : 's'} ready. ${TIMETABLE_CONFIRM}`,
    changes,
    confirmable: true,
    notices: [],
  };
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function ensureDemand(doc: TimetableDoc, subjectName: string, level: string, count: number): { doc: TimetableDoc; subjectId: string } | { error: string } {
  const existing = doc.subjects.find(subject => subject.name.toLowerCase() === subjectName.toLowerCase() && sameLevel(subject.level, level));
  if (existing) {
    return {
      subjectId: existing.id,
      doc: {
        ...doc,
        subjects: doc.subjects.map(subject => subject.id === existing.id
          ? { ...subject, periodsPerWeek: subject.periodsPerWeek + count }
          : subject),
      },
    };
  }
  const teacher = doc.staff.find(person => person.subjects.some(item => item.toLowerCase() === subjectName.toLowerCase()) && person.status === 'active');
  if (!teacher) return { error: `No teacher is set up for ${subjectName}.` };
  const campusId = teacher.campusId || doc.campusIds[0] || 'main';
  const room = doc.rooms.find(item => item.campusId === campusId && item.type === 'classroom') ?? doc.rooms.find(item => item.campusId === campusId);
  if (!room) return { error: 'Add a room before ET AI can place the new periods.' };
  const groupId = `g-${slug(level)}`;
  const subjectId = `${slug(subjectName)}-${slug(level)}`;
  const subject: SubjectDemand = {
    id: subjectId,
    name: subjectName,
    level,
    periodsPerWeek: count,
    roomType: room.type as RoomType,
    groupId,
    teacherIds: [teacher.id],
    campusId,
  };
  return {
    subjectId,
    doc: {
      ...doc,
      staff: doc.staff.map(person => person.id === teacher.id && !person.levels.some(item => sameLevel(item, level))
        ? { ...person, levels: [...person.levels, level] }
        : person),
      groups: doc.groups.some(group => group.id === groupId)
        ? doc.groups
        : [...doc.groups, { id: groupId, name: level, level, studentIds: [], kind: 'class', campusId }],
      subjects: [...doc.subjects, subject],
    },
  };
}

function addPeriods(doc: TimetableDoc, subjectName: string, level: string, count: number): TimetablePreview {
  if (!Number.isFinite(count) || count < 1) {
    return { doc, summary: 'Say how many periods to add.', changes: [], confirmable: false, notices: [] };
  }
  const ensured = ensureDemand(doc, subjectName, level, count);
  if ('error' in ensured) return { doc, summary: ensured.error, changes: [], confirmable: false, notices: [] };
  const subject = ensured.doc.subjects.find(item => item.id === ensured.subjectId);
  if (!subject) return { doc, summary: 'ET AI could not add that subject.', changes: [], confirmable: false, notices: [] };
  const result = solveTimetable({ ...ensured.doc, subjects: [subject], lessons: [] });
  const kept = ensured.doc.lessons.filter(lesson => lesson.subjectId !== subject.id);
  const next: TimetableDoc = {
    ...ensured.doc,
    lessons: mergeLessons(ensured.doc, kept, result.lessons),
    quality: result.quality,
    unmet: result.unmet,
    explanation: `${subject.name} — ${subject.level} now asks for ${subject.periodsPerWeek} periods a week. ${explainSolve(result, subject.periodsPerWeek)}`,
    status: 'draft',
  };
  return {
    doc: next,
    summary: `${subject.name} — ${level} gains ${count} periods. ${result.lessons.length} of those lessons are placed. ${TIMETABLE_CONFIRM}`,
    changes: diffLessons(doc, next),
    confirmable: true,
    notices: [],
  };
}

function importRows(doc: TimetableDoc, rows: PaperRow[]): TimetablePreview {
  let next = doc;
  const placed: Lesson[] = [];
  const skipped: string[] = [];
  rows.forEach((row, index) => {
    const period = next.periods.find(item => item.label.toLowerCase() === row.period.toLowerCase() || item.id.toLowerCase() === row.period.toLowerCase());
    const teacher = staffByName(next, row.teacher.replace(/^(mr|mrs|ms|dr)\.?\s+/i, ''));
    const room = next.rooms.find(item => item.name.toLowerCase() === row.room.toLowerCase());
    const subject = next.subjects.find(item => item.name.toLowerCase() === row.subject.toLowerCase() && sameLevel(item.level, row.level));
    if (!period || !teacher || !room || !subject) {
      skipped.push(`${row.subject} — ${row.level}`);
      return;
    }
    const lesson: Lesson = {
      id: `paper-${subject.id}-${row.day}-${period.id}`,
      subjectId: subject.id,
      groupId: subject.groupId,
      teacherId: teacher.id,
      roomId: room.id,
      day: row.day,
      periodId: period.id,
      campusId: subject.campusId,
    };
    const blocked = hardViolations(next, [...next.lessons, lesson]).some(clash => clash.lessonId === lesson.id);
    if (blocked) {
      skipped.push(`${row.subject} — ${row.level} ${row.day} ${row.period}`);
      return;
    }
    next = { ...next, lessons: [...next.lessons.filter(item => !(item.subjectId === subject.id && item.day === lesson.day && item.periodId === lesson.periodId)), lesson] };
    placed.push(lesson);
  });
  const previewDoc: TimetableDoc = { ...next, status: 'draft' };
  const changes = diffLessons(doc, previewDoc);
  if (placed.length === 0) {
    return { doc, summary: skipped.length ? `ET AI could not place ${skipped.join(', ')}.` : 'ET AI could not read a timetable in that photo.', changes: [], confirmable: false, notices: [] };
  }
  return {
    doc: previewDoc,
    summary: `Read ${placed.length} lessons from the paper timetable.${skipped.length ? ` Left out ${skipped.join(', ')}.` : ''} ${TIMETABLE_CONFIRM}`,
    changes,
    confirmable: true,
    notices: [],
  };
}

export function previewTimetableChat(doc: TimetableDoc, text: string, today = doc.anchorMonday): TimetablePreview | null {
  const intent = parseTimetableChat(text);
  if (!intent) return null;
  return previewIntent(doc, intent, today);
}

export function previewIntent(doc: TimetableDoc, intent: TimetableIntent, today = doc.anchorMonday): TimetablePreview {
  if (intent.type === 'build') return buildLevel(doc, intent.level);
  if (intent.type === 'cover') return coverPreview(doc, intent.name, intent.when, today);
  if (intent.type === 'fix-rooms') return fixRooms(doc, intent.day);
  if (intent.type === 'add-periods') return addPeriods(doc, intent.subject, intent.level, intent.count);
  return importRows(doc, intent.rows);
}
