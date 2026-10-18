import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { auditMarkdown, AUDIT } from './catalog';
import {
  addEnrolment, applyLatePenalty, approveEnrolment, canDeleteGoal, createClass, createDemoDesk,
  deleteGoal, gradeOnScale, returnSubmission, setMark, submitWork, termResult,
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

test('the audit document lists every catalogue route', () => {
  const markdown = auditMarkdown();
  for (const row of AUDIT) assert.ok(markdown.includes(row.route), row.route);
  const file = readFileSync(new URL('../../docs/FEATURE_AUDIT.md', import.meta.url), 'utf8');
  assert.equal(file.trim(), markdown.trim());
});
