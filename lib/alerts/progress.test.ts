import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateLevels, buildRecoveryPlan, evaluateProgress, isQuietMinutes, planDelivery, type LearnerFacts } from './progress';

const NOW = Date.parse('2026-10-17T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function facts(overrides: Partial<LearnerFacts> = {}): LearnerFacts {
  return {
    studentId: 'student-1',
    studentName: 'Mina',
    level: 'Lower Secondary',
    courseId: 'course-1',
    courseTitle: 'Mathematics',
    institutionId: 'school-1',
    teacherIds: ['teacher-1'],
    adult: false,
    independent: false,
    now: NOW,
    lastLessonAt: NOW - DAY,
    streakDays: 4,
    previousStreakDays: 3,
    lessonsExpected: 4,
    lessonsCompleted: 4,
    unitAttempts: [],
    priorScores: [80, 78],
    latestScore: 76,
    assignments: [],
    bloom: [],
    sessionMinutes: [20, 22, 18, 21],
    lessonFailures: [],
    projectedFinal: 82,
    safeguardingCaseId: null,
    reviewLessons: [{ lessonId: 'lesson-fractions', title: 'Fractions' }],
    visuals: [{ lessonId: 'lesson-fractions', title: 'Fractions', kind: 'revisionPoster', src: 'https://cdn.example/poster.png' }],
    openSeverity: null,
    ...overrides,
  };
}

test('a single Version A miss is a low alert', () => {
  const result = evaluateProgress(facts({
    unitAttempts: [{ lessonId: 'unit-1', unitTitle: 'Fractions', version: 'A', passed: false, percentage: 40 }],
  }));
  assert.equal(result.severity, 'low');
  assert.equal(result.signals.some((signal) => signal.id === 'failed_unit_test'), true);
  const delivery = planDelivery({
    severity: 'low', adult: false, independent: false, parentMinimum: 'low', quiet: false, digestDay: true,
  });
  assert.equal(delivery.parentDigest, true);
  assert.equal(delivery.parentPush, false);
  assert.equal(delivery.studentNudge, true);
  assert.match(result.plan.studentIntro, /Fractions/);
  assert.doesNotMatch(result.plan.studentIntro, /fail|behind|shame/i);
});

test('a Version B retake miss is medium and reaches parent and teacher the same day', () => {
  const result = evaluateProgress(facts({
    unitAttempts: [
      { lessonId: 'unit-1', unitTitle: 'Fractions', version: 'A', passed: false, percentage: 40 },
      { lessonId: 'unit-1', unitTitle: 'Fractions', version: 'B', passed: false, percentage: 45 },
    ],
  }));
  assert.equal(result.severity, 'medium');
  assert.equal(result.signals.some((signal) => signal.id === 'failed_retake'), true);
  const delivery = planDelivery({
    severity: 'medium', adult: false, independent: false, parentMinimum: 'low', quiet: false, digestDay: false,
  });
  assert.equal(delivery.parentPush, true);
  assert.equal(delivery.teacherPush, true);
  assert.equal(delivery.leadPush, false);
  assert.equal(result.plan.retake, 'Finish the review lessons, then the next paper is Version A.');
});

test('a 15 point drop against the student average is medium', () => {
  const result = evaluateProgress(facts({ priorScores: [80, 80], latestScore: 60 }));
  assert.equal(result.signals.find((signal) => signal.id === 'score_drop')?.severity, 'medium');
});

test('fourteen days without a lesson is high and includes the academic lead', () => {
  const result = evaluateProgress(facts({ lastLessonAt: NOW - 14 * DAY }));
  assert.equal(result.severity, 'high');
  const delivery = planDelivery({
    severity: 'high', adult: false, independent: false, parentMinimum: 'low', quiet: false, digestDay: false,
  });
  assert.equal(delivery.leadPush, true);
  assert.equal(delivery.parentEmail, false);
});

test('thirty days or a course final under 70 is critical and bypasses quiet hours', () => {
  const inactive = evaluateProgress(facts({ lastLessonAt: NOW - 30 * DAY }));
  assert.equal(inactive.severity, 'critical');
  const finalRisk = evaluateProgress(facts({ projectedFinal: 62 }));
  assert.equal(finalRisk.signals.some((signal) => signal.id === 'final_at_risk'), true);
  const delivery = planDelivery({
    severity: 'critical', adult: false, independent: false, parentMinimum: 'low', quiet: true, digestDay: false,
  });
  assert.equal(delivery.heldForQuietHours, false);
  assert.equal(delivery.leadEmail, true);
  assert.equal(delivery.parentEmail, true);
  assert.equal(delivery.teacherEmail, true);
});

test('quiet hours hold a medium push', () => {
  assert.equal(isQuietMinutes(22 * 60, '21:00', '07:00'), true);
  assert.equal(isQuietMinutes(12 * 60, '21:00', '07:00'), false);
  const delivery = planDelivery({
    severity: 'medium', adult: false, independent: false, parentMinimum: 'low', quiet: true, digestDay: false,
  });
  assert.equal(delivery.parentPush, false);
  assert.equal(delivery.heldForQuietHours, true);
});

test('independent adults only alert themselves, and parents never hear about adults', () => {
  const independent = planDelivery({
    severity: 'critical', adult: true, independent: true, parentMinimum: 'low', quiet: false, digestDay: true,
  });
  assert.equal(independent.studentNudge, true);
  assert.equal(independent.parentEmail, false);
  assert.equal(independent.teacherPush, false);
  assert.equal(independent.leadEmail, false);
  const schoolAdult = planDelivery({
    severity: 'high', adult: true, independent: false, parentMinimum: 'low', quiet: false, digestDay: false,
  });
  assert.equal(schoolAdult.parentPush, false);
  assert.equal(schoolAdult.teacherPush, true);
  assert.equal(schoolAdult.leadPush, true);
});

test('a parent minimum of high suppresses low and medium parent notices', () => {
  const low = planDelivery({
    severity: 'low', adult: false, independent: false, parentMinimum: 'high', quiet: false, digestDay: true,
  });
  assert.equal(low.parentDigest, false);
  const high = planDelivery({
    severity: 'high', adult: false, independent: false, parentMinimum: 'high', quiet: false, digestDay: false,
  });
  assert.equal(high.parentPush, true);
});

test('pace, mastery, overdue work, repeated lessons, and a safeguarding collapse', () => {
  const result = evaluateProgress(facts({
    lessonsExpected: 4,
    lessonsCompleted: 1,
    bloom: [
      { level: 'Remember', score: 40, attempts: 3 },
      { level: 'Apply', score: 30, attempts: 2 },
      { level: 'Analyse', score: 20, attempts: 2 },
    ],
    assignments: [
      { id: 'a1', title: 'Worksheet', dueAt: NOW - DAY, submitted: false },
    ],
    lessonFailures: [{ lessonId: 'lesson-fractions', title: 'Fractions', fails: 3 }],
    sessionMinutes: [40, 40, 40, 5],
    safeguardingCaseId: 'case-9',
  }));
  assert.equal(result.signals.some((signal) => signal.id === 'behind_pace' && signal.severity === 'high'), true);
  assert.equal(result.signals.some((signal) => signal.id === 'low_mastery'), true);
  assert.equal(result.signals.some((signal) => signal.id === 'overdue_assignment'), true);
  assert.equal(result.signals.some((signal) => signal.id === 'repeated_lesson_failure' && signal.detail.includes('lesson-fractions')), true);
  assert.equal(result.signals.some((signal) => signal.id === 'engagement_collapse'), true);
  assert.equal(result.severity, 'critical');
});

test('recovery uses only lessons and visuals that were supplied', () => {
  const plan = buildRecoveryPlan(facts({
    reviewLessons: [{ lessonId: 'lesson-fractions', title: 'Fractions' }],
    visuals: [
      { lessonId: 'lesson-fractions', title: 'Fractions', kind: 'mindmapImage', src: 'https://cdn.example/map.png' },
      { lessonId: 'made-up', title: 'Invented', kind: 'revisionPoster', src: 'https://cdn.example/nope.png' },
    ],
  }), 'low');
  assert.deepEqual(plan.review, [{ lessonId: 'lesson-fractions', title: 'Fractions' }]);
  assert.equal(plan.visuals.length, 1);
  assert.equal(plan.visuals[0]?.kind, 'mindmapImage');
  assert.equal(plan.parentGuide.includes('Invented'), false);
});

test('clear metrics auto-resolve and a comeback from critical earns the badge', () => {
  const clear = evaluateProgress(facts());
  assert.equal(clear.severity, null);
  const comeback = evaluateProgress(facts({ openSeverity: 'critical' }));
  assert.equal(comeback.positive, 'comeback');
  assert.equal(comeback.badge, 'comeback');
  const restored = evaluateProgress(facts({ streakDays: 3, previousStreakDays: 0 }));
  assert.equal(restored.positive, 'streak_restored');
});

test('aggregate insights hide levels with fewer than five learners', () => {
  const rows = [
    ...Array.from({ length: 5 }, () => ({ level: 'IGCSE', severity: 'high' as const })),
    { level: 'A-Level', severity: 'critical' as const },
    { level: 'A-Level', severity: 'low' as const },
  ];
  const groups = aggregateLevels(rows);
  assert.deepEqual(groups.map((group) => group.level), ['IGCSE']);
  assert.equal(groups[0]?.high, 5);
});
