import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acknowledgementDue,
  accountabilityByLevel,
  accountabilityStats,
  advanceAccountability,
  draftSharedPlan,
  emptyAccountability,
  meetingProvider,
  recognitionFor,
  weeklyWinLine,
  type AlertAccountability,
} from './accountability';

const NOW = Date.parse('2026-10-17T12:00:00Z');
const HOUR = 60 * 60 * 1000;

function owned(overrides: Partial<AlertAccountability> = {}): AlertAccountability {
  return {
    ...emptyAccountability(),
    ownerId: 'teacher-1',
    ownerName: 'Ms Rahman',
    coOwnerId: 'parent-1',
    coOwnerName: 'Parent',
    dueAt: NOW - HOUR,
    ...overrides,
  };
}

test('medium, high, and critical due times follow the SLA', () => {
  assert.equal(acknowledgementDue('low', NOW), null);
  assert.equal(acknowledgementDue('medium', NOW), NOW + 48 * HOUR);
  assert.equal(acknowledgementDue('high', NOW), NOW + 24 * HOUR);
  assert.equal(acknowledgementDue('critical', NOW), NOW + 2 * HOUR);
});

test('a teacher miss goes to the academic lead and then the institution admin', () => {
  const first = advanceAccountability({
    accountability: owned(),
    severity: 'high',
    now: NOW,
    sla: { mediumHours: 48, highHours: 24, criticalHours: 2, criticalEscalationMinutes: 15 },
    teacherOnLeaveUntil: null,
    parentQuiet: false,
    studentName: 'Mina',
  });
  assert.equal(first.accountability.teacherStep, 1);
  assert.equal(first.notices.some((notice) => notice.to === 'lead'), true);
  const second = advanceAccountability({
    accountability: first.accountability,
    severity: 'high',
    now: NOW + 25 * HOUR,
    sla: { mediumHours: 48, highHours: 24, criticalHours: 2, criticalEscalationMinutes: 15 },
    teacherOnLeaveUntil: null,
    parentQuiet: false,
    studentName: 'Mina',
  });
  assert.equal(second.accountability.teacherStep, 2);
  assert.equal(second.notices.some((notice) => notice.to === 'institution'), true);
});

test('a parent miss reminds, then emails, then asks the teacher to call', () => {
  let current = owned({ acknowledgedAt: NOW, actedAt: NOW });
  const steps = ['parent_reminder', 'parent_email', 'teacher_call'] as const;
  let cursor = NOW;
  for (const expected of steps) {
    const moved = advanceAccountability({
      accountability: current,
      severity: 'medium',
      now: cursor,
      sla: { mediumHours: 48, highHours: 24, criticalHours: 2, criticalEscalationMinutes: 15 },
      teacherOnLeaveUntil: null,
      parentQuiet: false,
      studentName: 'Mina',
    });
    assert.equal(moved.notices.some((notice) => notice.to === expected), true);
    current = moved.accountability;
    cursor += 49 * HOUR;
  }
  assert.equal(current.parentStep, 3);
});

test('quiet hours and teacher leave pause non-critical clocks, and critical does not wait', () => {
  const quiet = advanceAccountability({
    accountability: owned({ acknowledgedAt: NOW, actedAt: NOW, parentSeenAt: null }),
    severity: 'medium',
    now: NOW,
    sla: { mediumHours: 48, highHours: 24, criticalHours: 2, criticalEscalationMinutes: 15 },
    teacherOnLeaveUntil: null,
    parentQuiet: true,
    studentName: 'Mina',
  });
  assert.equal(quiet.notices.some((notice) => notice.to === 'parent_reminder'), false);
  const leave = advanceAccountability({
    accountability: owned({ parentSeenAt: NOW, parentActedAt: NOW }),
    severity: 'high',
    now: NOW,
    sla: { mediumHours: 48, highHours: 24, criticalHours: 2, criticalEscalationMinutes: 15 },
    teacherOnLeaveUntil: NOW + 3 * 24 * HOUR,
    parentQuiet: false,
    studentName: 'Mina',
  });
  assert.equal(leave.accountability.teacherStep, 0);
  assert.equal(leave.notices.length, 0);
  const critical = advanceAccountability({
    accountability: owned(),
    severity: 'critical',
    now: NOW,
    sla: { mediumHours: 48, highHours: 24, criticalHours: 2, criticalEscalationMinutes: 15 },
    teacherOnLeaveUntil: NOW + 3 * 24 * HOUR,
    parentQuiet: true,
    studentName: 'Mina',
  });
  assert.equal(critical.accountability.teacherStep, 1);
  assert.equal(critical.notices.some((notice) => notice.to === 'lead'), true);
});

test('the shared plan and agenda use only supplied lessons', () => {
  const plan = draftSharedPlan({
    now: NOW,
    adult: false,
    courseTitle: 'Mathematics',
    level: 'Lower Secondary',
    lessons: [{ lessonId: 'lesson-fractions', title: 'Fractions' }],
    signals: [{ detail: '3 days since the last lesson in Mathematics.' }],
    projectedFinal: 64,
  });
  assert.equal(plan.tasks.some((task) => task.text.includes('Fractions')), true);
  assert.equal(plan.tasks.some((task) => task.who === 'parent' && task.text.includes('20 minutes')), true);
  assert.equal(plan.agenda.includes('Fractions'), true);
  assert.equal(plan.agenda.includes('64%'), true);
  assert.equal(plan.agenda.includes('Invented lesson'), false);
  const adult = draftSharedPlan({
    now: NOW,
    adult: true,
    courseTitle: 'Mathematics',
    level: 'A-Level',
    lessons: [{ lessonId: 'lesson-fractions', title: 'Fractions' }],
    signals: [],
    projectedFinal: null,
  });
  assert.equal(adult.tasks.some((task) => task.who === 'parent'), false);
});

test('meeting links are Zoom, Meet, or Teams', () => {
  assert.equal(meetingProvider('https://zoom.us/j/1'), 'zoom');
  assert.equal(meetingProvider('https://meet.google.com/abc-defg-hij'), 'meet');
  assert.equal(meetingProvider('https://teams.microsoft.com/l/meetup-join/1'), 'teams');
  assert.equal(meetingProvider('https://example.com/call'), null);
});

test('responsive teachers and engaged parents earn a private badge', () => {
  assert.equal(recognitionFor({ role: 'teacher', openedAt: NOW, actedAt: NOW + 10 * HOUR, dueAt: NOW + 48 * HOUR }), 'rapid_responder');
  assert.equal(recognitionFor({ role: 'teacher', openedAt: NOW, actedAt: NOW + 30 * HOUR, dueAt: NOW + 48 * HOUR }), null);
  assert.equal(recognitionFor({ role: 'parent', openedAt: NOW, actedAt: NOW + HOUR, dueAt: NOW + 48 * HOUR }), 'engaged_parent');
});

test('aggregate accountability hides groups under five', () => {
  const row = {
    polarity: 'concern' as const,
    status: 'open',
    severity: 'high' as const,
    adult: false,
    level: 'IGCSE',
    courseId: 'course',
    courseTitle: 'Biology',
    createdAt: NOW,
    acknowledgedAt: null,
    actedAt: null,
    parentActedAt: null,
    overdue: true,
    autoResolved: false,
  };
  assert.equal(accountabilityByLevel([row, row, row], 5).length, 0);
  const many = Array.from({ length: 5 }, () => row);
  assert.equal(accountabilityByLevel(many, 5).length, 1);
  const stats = accountabilityStats(many, 5);
  assert.equal(stats.overdue, 5);
  assert.equal(stats.parentEngagement, 0);
});

test('weekly summary names recoveries and stays quiet when there are none', () => {
  assert.equal(weeklyWinLine([]), null);
  const line = weeklyWinLine([{ studentName: 'Mina', courseTitle: 'Mathematics' }]);
  assert.equal(line?.includes('Mina'), true);
  assert.equal(line?.includes('Mathematics'), true);
});
