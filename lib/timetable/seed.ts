import type { TimetableDoc } from './types';

const monday = '2026-10-19';

function shell(partial: Pick<TimetableDoc, 'id' | 'kind' | 'ownerId' | 'institutionId' | 'campusIds'>): TimetableDoc {
  return {
    ...partial,
    status: 'draft',
    version: 1,
    publishedVersion: null,
    quality: 0,
    unmet: [],
    explanation: '',
    anchorMonday: monday,
    days: ['mon', 'tue', 'wed', 'thu', 'fri'],
    periods: [
      { id: 'p1', label: 'P1', start: '08:30', end: '09:15' },
      { id: 'p2', label: 'P2', start: '09:20', end: '10:05' },
      { id: 'p3', label: 'P3', start: '10:25', end: '11:10' },
      { id: 'p4', label: 'P4', start: '11:15', end: '12:00' },
      { id: 'p5', label: 'P5', start: '13:00', end: '13:45' },
      { id: 'p6', label: 'P6', start: '13:50', end: '14:35' },
    ],
    terms: [{ id: 'term-1', name: 'Term 1', start: '2026-09-01', end: '2026-12-18' }],
    holidays: [{ id: 'deepavali', name: 'Deepavali', date: '2026-11-08' }],
    rooms: [],
    staff: [],
    groups: [],
    subjects: [],
    optionSubjects: [],
    blocks: [],
    choices: [],
    lessons: [],
    covers: [],
    versions: [],
    audit: [],
    people: [],
  };
}

/** A solvable Primary 2 and IGCSE week, plus a second campus for Enterprise. */
export function schoolTimetable(): TimetableDoc {
  const doc = shell({
    id: 'school-a',
    kind: 'school',
    ownerId: 'inst-1',
    institutionId: 'school-a',
    campusIds: ['main', 'north'],
  });
  doc.rooms = [
    { id: 'r-a', name: 'Room A', type: 'classroom', capacity: 30, campusId: 'main' },
    { id: 'r-b', name: 'Room B', type: 'classroom', capacity: 30, campusId: 'main' },
    { id: 'r-lab', name: 'Lab 1', type: 'lab', capacity: 24, campusId: 'main' },
    { id: 'r-ict', name: 'ICT 1', type: 'ict', capacity: 20, campusId: 'main' },
    { id: 'r-hall', name: 'Hall', type: 'hall', capacity: 80, campusId: 'main' },
    { id: 'r-north', name: 'North room', type: 'classroom', capacity: 24, campusId: 'north' },
  ];
  doc.staff = [
    { id: 'rahman', name: 'Ms Rahman', userId: 't-rahman', subjects: ['Maths', 'English'], levels: ['Primary 2'], maxPerDay: 5, maxPerWeek: 18, worksDays: [], unavailable: [], prefer: 'morning', status: 'active', campusId: 'main' },
    { id: 'adeyemi', name: 'Ms Adeyemi', userId: 't-adeyemi', subjects: ['Maths', 'Physics'], levels: ['IGCSE', 'Primary 2'], maxPerDay: 5, maxPerWeek: 20, worksDays: [], unavailable: [], prefer: 'morning', status: 'active', campusId: 'main' },
    { id: 'yusuf', name: 'Mr Yusuf', userId: 't-yusuf', subjects: ['Maths'], levels: ['Primary 2', 'IGCSE'], maxPerDay: 5, maxPerWeek: 20, worksDays: [], unavailable: [], prefer: '', status: 'active', campusId: 'main' },
    { id: 'okonkwo', name: 'Ms Okonkwo', userId: 't-okonkwo', subjects: ['Biology'], levels: ['IGCSE'], maxPerDay: 4, maxPerWeek: 16, worksDays: [], unavailable: [], prefer: '', status: 'active', campusId: 'main' },
    { id: 'patel', name: 'Mr Patel', userId: 't-patel', subjects: ['Computing'], levels: ['IGCSE'], maxPerDay: 3, maxPerWeek: 12, worksDays: ['tue', 'wed', 'thu', 'fri'], unavailable: [], prefer: '', status: 'active', campusId: 'main' },
    { id: 'chen', name: 'Mr Chen', userId: 't-chen', subjects: ['History'], levels: ['IGCSE'], maxPerDay: 4, maxPerWeek: 16, worksDays: [], unavailable: ['fri:p5', 'fri:p6'], prefer: 'morning', status: 'active', campusId: 'main' },
    { id: 'lim', name: 'Ms Lim', userId: 't-lim', subjects: ['English'], levels: ['IGCSE'], maxPerDay: 4, maxPerWeek: 16, worksDays: [], unavailable: [], prefer: '', status: 'active', campusId: 'north' },
  ];
  doc.groups = [
    { id: 'g-oak', name: 'Primary 2 Oak', level: 'Primary 2', studentIds: ['s-amina', 's-leo'], kind: 'class', campusId: 'main' },
    { id: 'g-ig', name: 'IGCSE Set 1', level: 'IGCSE', studentIds: ['s-noor', 's-harun'], kind: 'set', campusId: 'main' },
    { id: 'g-north', name: 'IGCSE North', level: 'IGCSE', studentIds: ['s-mei'], kind: 'class', campusId: 'north' },
  ];
  doc.subjects = [
    { id: 'maths-p2', name: 'Maths', level: 'Primary 2', periodsPerWeek: 3, roomType: 'classroom', groupId: 'g-oak', teacherIds: ['rahman'], campusId: 'main' },
    { id: 'eng-p2', name: 'English', level: 'Primary 2', periodsPerWeek: 3, roomType: 'classroom', groupId: 'g-oak', teacherIds: ['rahman'], campusId: 'main' },
    { id: 'maths-ig', name: 'Maths', level: 'IGCSE', periodsPerWeek: 3, roomType: 'classroom', groupId: 'g-ig', teacherIds: ['adeyemi'], campusId: 'main' },
    { id: 'phys-ig', name: 'Physics', level: 'IGCSE', periodsPerWeek: 2, roomType: 'lab', groupId: 'g-ig', teacherIds: ['adeyemi'], campusId: 'main' },
    { id: 'bio-ig', name: 'Biology', level: 'IGCSE', periodsPerWeek: 2, roomType: 'lab', groupId: 'g-ig', teacherIds: ['okonkwo'], campusId: 'main' },
    { id: 'comp-ig', name: 'Computing', level: 'IGCSE', periodsPerWeek: 2, roomType: 'ict', groupId: 'g-ig', teacherIds: ['patel'], campusId: 'main' },
    { id: 'hist-ig', name: 'History', level: 'IGCSE', periodsPerWeek: 2, roomType: 'classroom', groupId: 'g-ig', teacherIds: ['chen'], campusId: 'main' },
    { id: 'eng-north', name: 'English', level: 'IGCSE', periodsPerWeek: 2, roomType: 'classroom', groupId: 'g-north', teacherIds: ['lim'], campusId: 'north' },
  ];
  doc.optionSubjects = [
    { id: 'opt-physics', name: 'Physics', level: 'IGCSE', roomType: 'lab' },
    { id: 'opt-chemistry', name: 'Chemistry', level: 'IGCSE', roomType: 'lab' },
    { id: 'opt-history', name: 'History', level: 'IGCSE', roomType: 'classroom' },
    { id: 'opt-computing', name: 'Computing', level: 'IGCSE', roomType: 'ict' },
    { id: 'opt-art', name: 'Art', level: 'IGCSE', roomType: 'studio' },
  ];
  doc.blocks = [
    { id: 'block-a', name: 'Block A', level: 'IGCSE', subjectIds: ['opt-physics', 'opt-chemistry'], pick: 1 },
    { id: 'block-b', name: 'Block B', level: 'IGCSE', subjectIds: ['opt-history', 'opt-computing'], pick: 1 },
    { id: 'block-c', name: 'Block C', level: 'IGCSE', subjectIds: ['opt-art'], pick: 1 },
  ];
  doc.people = [
    { id: 's-amina', name: 'Amina Yusuf', role: 'student', childIds: [] },
    { id: 's-leo', name: 'Leo Chen', role: 'student', childIds: [] },
    { id: 's-noor', name: 'Noor Adeyemi', role: 'student', childIds: [] },
    { id: 's-harun', name: 'Harun Okonkwo', role: 'student', childIds: [] },
    { id: 's-mei', name: 'Mei Lim', role: 'student', childIds: [] },
    { id: 'parent-amina', name: 'Parent of Amina', role: 'parent', childIds: ['s-amina'] },
    { id: 'parent-noor', name: 'Parent of Noor', role: 'parent', childIds: ['s-noor'] },
    { id: 'parent-mei', name: 'Parent of Mei', role: 'parent', childIds: ['s-mei'] },
  ];
  return doc;
}

/** An independent teacher’s private classrooms. */
export function personalTimetable(ownerId = 't-adeyemi'): TimetableDoc {
  const doc = shell({
    id: `personal-${ownerId}`,
    kind: 'personal',
    ownerId,
    institutionId: '',
    campusIds: ['studio'],
  });
  doc.rooms = [
    { id: 'study', name: 'Study', type: 'classroom', capacity: 8, campusId: 'studio' },
    { id: 'corner', name: 'Lab corner', type: 'lab', capacity: 8, campusId: 'studio' },
  ];
  doc.staff = [
    { id: 'me', name: 'Ms Adeyemi', userId: ownerId, subjects: ['Maths', 'Physics'], levels: ['Primary 2', 'IGCSE'], maxPerDay: 5, maxPerWeek: 16, worksDays: [], unavailable: [], prefer: 'morning', status: 'active', campusId: 'studio' },
  ];
  doc.groups = [
    { id: 'p-oak', name: 'Primary 2 tutoring', level: 'Primary 2', studentIds: ['p-s1'], kind: 'class', campusId: 'studio' },
    { id: 'p-phys', name: 'IGCSE Physics clinic', level: 'IGCSE', studentIds: ['p-s2'], kind: 'class', campusId: 'studio' },
  ];
  doc.subjects = [
    { id: 'p-maths', name: 'Maths', level: 'Primary 2', periodsPerWeek: 2, roomType: 'classroom', groupId: 'p-oak', teacherIds: ['me'], campusId: 'studio' },
    { id: 'p-physics', name: 'Physics', level: 'IGCSE', periodsPerWeek: 2, roomType: 'lab', groupId: 'p-phys', teacherIds: ['me'], campusId: 'studio' },
  ];
  doc.people = [
    { id: 'p-s1', name: 'Hana Ibrahim', role: 'student', childIds: [] },
    { id: 'p-s2', name: 'Omar Rahman', role: 'student', childIds: [] },
    { id: 'p-parent', name: 'Parent of Hana', role: 'parent', childIds: ['p-s1'] },
  ];
  return doc;
}
