import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { auditMarkdown, AUDIT } from './catalog';
import { flowForPath } from './flows';
import {
  addEnrolment, addFlow, applyLatePenalty, approveEnrolment, bulkCreateClasses, canDeleteGoal, createClass, createDemoDesk,
  deleteGoal, earningNet, emptyDesk, goalRecord, goalSourceGroup, goalsForRoster, gradeOnScale, gradeSetLabel, refundEarning, returnSubmission, setMark, setTeachingMode, submitWork, termResult, upsertGoal,
} from './model';

test('scales cover IGCSE, A star to G, percent, points, and pass or fail', () => {
  const custom = createDemoDesk().institution.customBands;
  assert.equal(gradeOnScale(91, 'igcse_9_1'), '9');
  assert.equal(gradeOnScale(45, 'igcse_9_1'), '4');
  assert.equal(gradeOnScale(91, 'astar_g'), 'A*');
  assert.equal(gradeOnScale(74, 'astar_g'), 'B');
  assert.equal(gradeOnScale(35, 'astar_g'), 'F');
  assert.equal(gradeOnScale(15, 'astar_g'), 'U');
  assert.equal(gradeOnScale(81, 'percent'), '81%');
  assert.equal(gradeOnScale(39, 'pass_fail'), 'Fail');
  assert.equal(gradeOnScale(40, 'pass_fail'), 'Pass');
  assert.equal(gradeOnScale(86, 'custom', custom), 'Distinction');
  assert.equal(gradeSetLabel(91), '9 on 9–1 · A* on A*–G · 91%');
  assert.equal(gradeSetLabel(35), '3 on 9–1 · F on A*–G · 35%');
});

test('term grade skips excused and missing marks', () => {
  const state = createDemoDesk();
  const amina = termResult(state, 'class-maths', 'stu-amina');
  assert.ok(amina.percent > 0);
  assert.equal(amina.grade, gradeOnScale(amina.percent, 'igcse_9_1'));
  const sofia = termResult(state, 'class-maths', 'stu-sofia');
  assert.equal(sofia.weight, 0);
});

test('late work loses marks per day and a return publishes the gradebook', () => {
  assert.equal(applyLatePenalty(20, 20, { allow: true, penaltyPercentPerDay: 10, cutoffDays: 5 }, 2), 16);
  let state = createDemoDesk();
  state = approveSuggestionSafe(state);
  state = returnSubmission(state, 'sub-amina', 'teacher-aisha', 'Solid working.');
  const mark = state.marks.find((item) => item.studentId === 'stu-amina' && item.assessmentId === 'assess-hw');
  assert.equal(mark?.state, 'published');
  assert.ok(state.notices.some((item) => item.audience === 'parent'));
});

function approveSuggestionSafe(state: ReturnType<typeof createDemoDesk>) {
  return {
    ...state,
    submissions: state.submissions.map((item) => (
      item.suggestion ? { ...item, suggestion: { ...item.suggestion, approved: true } } : item
    )),
  };
}

test('students cannot delete a teacher goal and teachers can delete their own', () => {
  const state = createDemoDesk();
  const teacherGoal = state.goals.find((item) => item.source === 'teacher');
  assert.ok(teacherGoal);
  assert.equal(canDeleteGoal(teacherGoal, 'stu-amina', 'student'), false);
  assert.equal(canDeleteGoal(teacherGoal, 'teacher-aisha', 'teacher'), true);
  const blocked = deleteGoal(state, teacherGoal.id, 'stu-amina', 'student');
  assert.ok(blocked.error);
  assert.equal(blocked.state.goals.length, state.goals.length);
  const removed = deleteGoal(state, teacherGoal.id, 'teacher-aisha', 'teacher');
  assert.equal(removed.error, '');
  assert.equal(removed.state.goals.some((item) => item.id === teacherGoal.id), false);
});

test('a class roster shows every goal source and edit stays with the assigner', () => {
  const state = createDemoDesk();
  const listed = goalsForRoster(state, 'class-maths');
  const groups = new Set(listed.map((item) => goalSourceGroup(item.source)));
  assert.deepEqual([...groups].sort(), ['et_ai', 'institution', 'parent', 'self', 'teacher']);
  const personal = listed.find((item) => item.id === 'goal-6');
  assert.equal(personal?.classId, '');
  assert.equal(personal?.focusMinutes, 12);
  assert.equal(personal?.rescheduleCount, 2);
  const selfGoal = state.goals.find((item) => item.id === 'goal-4');
  const parentGoal = state.goals.find((item) => item.id === 'goal-5');
  const schoolGoal = state.goals.find((item) => item.id === 'goal-7');
  assert.ok(selfGoal && parentGoal && schoolGoal);
  assert.equal(canDeleteGoal(selfGoal, 'teacher-aisha', 'teacher'), false);
  assert.equal(canDeleteGoal(parentGoal, 'teacher-aisha', 'teacher'), false);
  assert.equal(canDeleteGoal(personal!, 'teacher-aisha', 'teacher'), false);
  assert.equal(canDeleteGoal(selfGoal, 'stu-amina', 'student'), true);
  assert.equal(canDeleteGoal({ ...selfGoal, source: 'student' }, 'stu-amina', 'student'), true);
  assert.equal(canDeleteGoal(schoolGoal, 'teacher-aisha', 'teacher'), false);
  assert.equal(canDeleteGoal(schoolGoal, 'admin-rochford', 'institution_admin'), true);
  const untouched = upsertGoal(state, { ...selfGoal, title: 'Changed by a teacher' }, 'Aisha Rahman', { actorId: 'teacher-aisha', role: 'teacher' });
  assert.equal(untouched.goals.find((item) => item.id === 'goal-4')?.title, selfGoal.title);
  const edited = upsertGoal(state, { ...schoolGoal, title: 'New school target' }, 'School', { actorId: 'admin-rochford', role: 'institution_admin' });
  assert.equal(edited.goals.find((item) => item.id === 'goal-7')?.title, 'New school target');
  assert.equal(goalSourceGroup('ai'), 'et_ai');
  assert.equal(goalSourceGroup('student'), 'self');
});

test('an under-18 without school membership cannot be approved', () => {
  let state = createDemoDesk();
  state = addEnrolment(state, {
    classId: 'class-maths',
    studentName: 'Outside child',
    under18: true,
    institutionMember: false,
    joinMethod: 'code',
  }, 'Aisha Rahman');
  const pending = state.enrolments.find((item) => item.studentName === 'Outside child');
  assert.equal(pending?.status, 'pending');
  state = approveEnrolment(state, pending!.id, 'Aisha Rahman');
  assert.equal(state.enrolments.find((item) => item.id === pending!.id)?.status, 'pending');
});

test('a school can stop teachers creating classes', () => {
  const state = createDemoDesk();
  state.institution = { ...state.institution, teachersCanCreateClasses: false };
  const blocked = createClass(state, {
    name: 'IGCSE Biology',
    subject: 'Biology',
    level: 'IGCSE',
    programme: 'Cambridge IGCSE',
    term: 'Term 1',
    campus: 'Falim',
    room: 'G-2',
    timetable: 'Tue 10:00',
    coTeachers: [],
    capacity: 20,
    ownerTeacherId: 'teacher-aisha',
    ownerTeacherName: 'Aisha Rahman',
    createdByRole: 'teacher',
  }, 'teacher');
  assert.ok(blocked.error);
  const allowed = createClass(state, {
    name: 'IGCSE Biology',
    subject: 'Biology',
    level: 'IGCSE',
    programme: 'Cambridge IGCSE',
    term: 'Term 1',
    campus: 'Falim',
    room: 'G-2',
    timetable: 'Tue 10:00',
    coTeachers: [],
    capacity: 20,
    ownerTeacherId: 'teacher-aisha',
    ownerTeacherName: 'Aisha Rahman',
    createdByRole: 'institution_admin',
  }, 'institution_admin');
  assert.equal(allowed.error, '');
});

test('a weak published mark opens a teacher goal', () => {
  const state = setMark(createDemoDesk(), {
    assessmentId: 'assess-test',
    studentId: 'stu-harun',
    points: 8,
    flag: 'none',
    comment: 'Needs another lesson.',
    state: 'published',
    actor: 'teacher-aisha',
  });
  assert.ok(state.goals.some((item) => item.studentId === 'stu-harun' && item.source === 'teacher' && item.topic === 'Algebra test'));
});

test('a student submission lands in the inbox', () => {
  const state = submitWork(createDemoDesk(), 'assess-hw', 'stu-leo', 'I showed each step and checked the last fraction.');
  assert.ok(state.submissions.some((item) => item.studentId === 'stu-leo' && item.suggestion));
});

test('institution bulk create assigns the teacher and an independent teacher can still create', () => {
  const csv = 'name,subject,level,programme,term,campus,room,timetable,teacher,capacity\nIGCSE Physics,Physics,IGCSE,Cambridge IGCSE,Term 1,Falim,F-8,Thu 11:00,Siti Aminah,22';
  const made = bulkCreateClasses(createDemoDesk(), csv);
  assert.equal(made.error, '');
  assert.equal(made.created, 1);
  const physics = made.state.classes.find((item) => item.name === 'IGCSE Physics');
  assert.equal(physics?.ownerTeacherName, 'Siti Aminah');
  assert.equal(physics?.ownerTeacherId, made.state.actorId);
  const assigned = bulkCreateClasses(createDemoDesk(), 'name,subject,level,programme,term,campus,room,timetable,teacher,capacity\nIGCSE Chemistry,Chemistry,IGCSE,Cambridge,Term 1,Falim,F-1,Mon 09:00,teacher-siti,18');
  const chemistry = assigned.state.classes.find((item) => item.name === 'IGCSE Chemistry');
  assert.equal(chemistry?.ownerTeacherId, 'teacher-siti');
  assert.equal(chemistry?.ownerTeacherName, 'teacher-siti');
  const blocked = createDemoDesk();
  blocked.institution = { ...blocked.institution, teachersCanCreateClasses: false };
  const alone = setTeachingMode(blocked, 'independent');
  const created = createClass(alone, {
    name: 'Saturday clinic',
    subject: 'Mathematics',
    level: 'IGCSE',
    programme: 'Independent',
    term: 'Term 1',
    campus: 'Online',
    room: 'Online',
    timetable: 'Sat 10:00',
    coTeachers: [],
    capacity: 8,
    ownerTeacherId: 'teacher-aisha',
    ownerTeacherName: 'Aisha Rahman',
    createdByRole: 'teacher',
  }, 'teacher');
  assert.equal(created.error, '');
});

test('a sale net is split minus fees and refunds, and an exam lands on the gradebook', () => {
  const state = createDemoDesk();
  const sale = state.earnings.find((item) => item.id === 'earn-4');
  assert.ok(sale);
  assert.equal(earningNet(sale), sale.split - sale.fee - sale.refund);
  const refunded = refundEarning(state, 'earn-5', 10, 'Aisha Rahman');
  const clinic = refunded.earnings.find((item) => item.id === 'earn-5');
  assert.equal(clinic?.refund, 10);
  const withExam = addFlow(state, {
    flow: 'exam',
    classId: 'class-maths',
    studentId: '',
    studentName: 'Whole class',
    title: 'Paper 4',
    detail: 'Non-calculator.',
    status: 'Scheduled',
    when: '2026-11-02',
  }, 'Aisha Rahman');
  assert.ok(withExam.assessments.some((item) => item.title === 'Paper 4' && item.kind === 'exam'));
  assert.ok(flowForPath('/dashboard/teacher/exams'));
  assert.equal(AUDIT.filter((row) => row.status !== 'Built').length, 0);
});

test('the audit document lists every catalogue route', () => {
  const markdown = auditMarkdown();
  for (const row of AUDIT) assert.ok(markdown.includes(row.route), row.route);
  const file = readFileSync(new URL('../../docs/FEATURE_AUDIT.md', import.meta.url), 'utf8');
  assert.equal(file.trim(), markdown.trim());
});
