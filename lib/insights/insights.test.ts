import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function expect(actual: unknown) {
  const api = {
    toBe(expected: unknown) { assert.equal(actual, expected); },
    toEqual(expected: unknown) { assert.deepEqual(actual, expected); },
    toBeNull() { assert.equal(actual, null); },
    toBeGreaterThan(n: number) { assert.ok(typeof actual === 'number' && actual > n); },
    toBeLessThan(n: number) { assert.ok(typeof actual === 'number' && actual < n); },
    toMatch(pattern: RegExp) { assert.match(String(actual), pattern); },
    toContain(part: string) { assert.ok(String(actual).includes(part)); },
    toHaveLength(n: number) { assert.equal((actual as { length: number }).length, n); },
    toMatchObject(partial: Record<string, unknown>) {
      assert.equal(typeof actual, 'object');
      assert.ok(actual);
      for (const [key, value] of Object.entries(partial)) {
        assert.deepEqual((actual as Record<string, unknown>)[key], value);
      }
    },
    not: {
      toBeNull() { assert.notEqual(actual, null); },
    },
  };
  return api;
}
import { GOAL_ON_TIME_BONUS, GOAL_STREAK_BONUS } from '../sparks';
import { isFeatureEnabled, resolveFlags } from '../feature-flags';
import { copyrightLine } from './copyright';
import {
  autoProgress, computeGoalStreak, focusSeconds, formatProgressDigest, overdueNudge, pomodoroPlan,
  resolvePomodoro, sparksForGoal, spawnNextGoal, startedLate, suggestGoalsFromSignals,
} from './goals';
import {
  bloomByTopic, cohortBenchmark, confidenceMastery, digestHeadlines, dropOffPoints, examReadiness,
  hourHeatmap, masteryRadar, quizAverage, retentionForecast, strengthsAndWeaknesses, tagBloom,
  threeActions, understandingScore, weeklyInsights, weeklySummary, withBloomTags,
} from './analytics';
import { attendanceRate, automaticStatus } from './attendance';
import { buildSnapshot } from './aggregate';
import { toCsv } from './reports';
import { buildXlsx, readStoredZip } from './xlsx';
import { buildPdf } from './pdf';
import { gradeOnScale, scaleById } from './report-cards';
import { aiLikelihoodSignal, AUTOMATIC_PENALTY, buildIntegrityCase, tokenSimilarity } from './integrity';
import { dripDates, extractDatesFromText, mapUnitsToWeeks, parseCsv, parseIcs, teachingMondays } from './calendar';

describe('goals', () => {
  it('counts a streak and skips an empty today', () => {
    const today = new Date(2026, 9, 15);
    const goals = [
      { dateKey: '2026-10-14', status: 'completed' },
      { dateKey: '2026-10-13', status: 'excused' },
      { dateKey: '2026-10-12', status: 'overdue' },
    ];
    expect(computeGoalStreak(goals, today)).toBe(2);
  });

  it('does not count today when a goal is still open', () => {
    const today = new Date(2026, 9, 15);
    expect(computeGoalStreak([
      { dateKey: '2026-10-15', status: 'not_started' },
      { dateKey: '2026-10-14', status: 'completed' },
    ], today)).toBe(0);
  });

  it('fills lesson progress and completes the goal at 100%', () => {
    const result = autoProgress(
      { dateKey: '2026-10-15', title: 'Unit', status: 'not_started', targetKind: 'lessons', lessonIds: ['a', 'b'] },
      [{ kind: 'lesson', lessonId: 'a' }, { kind: 'lesson', lessonId: 'b' }],
    );
    expect(result).toMatchObject({ progress: 100, status: 'completed' });
  });

  it('uses the latest unit quiz as progress', () => {
    const result = autoProgress(
      { dateKey: '2026-10-15', title: 'Quiz', status: 'not_started', targetKind: 'unit', unitId: 'u1' },
      [{ kind: 'quiz', unitId: 'u1', scorePercent: 40 }, { kind: 'quiz', unitId: 'u1', scorePercent: 80 }],
    );
    expect(result.progress).toBe(80);
    expect(result.quizScore).toBe(80);
  });

  it('spawns the next weekday and stops after the end date', () => {
    const next = spawnNextGoal({
      dateKey: '2026-10-16', title: 'Read', status: 'completed', recurrence: 'weekdays', endDate: '2026-10-20',
      checklist: [{ id: '1', label: 'Page 1', done: true }],
    });
    expect(next?.dateKey).toBe('2026-10-19');
    expect(next?.checklist?.[0].done).toBe(false);
    expect(spawnNextGoal({ dateKey: '2026-10-20', title: 'Read', status: 'completed', recurrence: 'daily', endDate: '2026-10-20' })).toBeNull();
  });

  it('pays the Sparks bonus only when the goal is finished on time', () => {
    const goal = { status: 'completed', dateKey: '2026-10-15', deadline: '18:00' };
    expect(sparksForGoal(goal, new Date(2026, 9, 15, 17, 0), 1)).toBe(GOAL_ON_TIME_BONUS);
    expect(sparksForGoal(goal, new Date(2026, 9, 15, 17, 0), 3)).toBe(GOAL_ON_TIME_BONUS + GOAL_STREAK_BONUS);
    expect(sparksForGoal(goal, new Date(2026, 9, 15, 19, 0), 5)).toBe(0);
    expect(sparksForGoal({ ...goal, status: 'in_progress' }, new Date(2026, 9, 15, 17, 0), 5)).toBe(0);
  });

  it('plans a Pomodoro and sums focus segments', () => {
    expect(pomodoroPlan(50)).toEqual({ rounds: 2, work: 25, breakMinutes: 5 });
    expect(focusSeconds([{ start: 0, end: 1500 }, { start: 2000, end: 3000 }])).toBe(2.5);
  });

  it('completes a quiz-score goal once the target is met', () => {
    const short = autoProgress(
      { dateKey: '2026-10-15', title: 'Quiz', status: 'not_started', targetKind: 'quiz_score', quizTarget: 80, unitId: 'u1' },
      [{ kind: 'quiz', unitId: 'u1', scorePercent: 60 }],
    );
    expect(short.progress).toBe(75);
    expect(short.status).toBe('in_progress');
    const met = autoProgress(
      { dateKey: '2026-10-15', title: 'Quiz', status: 'in_progress', targetKind: 'quiz_score', quizTarget: 80, unitId: 'u1' },
      [{ kind: 'quiz', unitId: 'u1', scorePercent: 80 }],
    );
    expect(met).toMatchObject({ progress: 100, status: 'completed', quizScore: 80 });
  });

  it('suggests revision from a weak topic and an exam date', () => {
    const cards = suggestGoalsFromSignals({
      weakTopics: [{ topic: 'fractions', scorePercent: 40 }, { topic: 'decimals', scorePercent: 90 }],
      examDates: [{ title: 'Unit check', dateKey: '2026-10-22' }],
    });
    expect(cards.length).toBe(2);
    expect(cards[0]?.title).toBe('Revise fractions');
    expect(cards[1]?.reason).toContain('2026-10-22');
  });

  it('nudges only after the deadline and writes a digest line', () => {
    const open = { status: 'in_progress', dateKey: '2026-10-15', deadline: '09:00', title: 'Read' };
    expect(overdueNudge(open, new Date(2026, 9, 15, 8, 0))).toBeNull();
    expect(overdueNudge(open, new Date(2026, 9, 15, 10, 0))).toContain('Read');
    expect(overdueNudge({ ...open, status: 'completed' }, new Date(2026, 9, 15, 10, 0))).toBeNull();
    const line = formatProgressDigest({
      childName: 'Harry', minutes: 40, lessons: 1, quizScores: [80, 100], goalsMet: 1, goalsSet: 2,
    });
    expect(line).toContain('40 min studied');
    expect(line).toContain('quiz average 90%');
    expect(line).toContain('1 of 2 goals met');
  });

  it('honours a custom Pomodoro and a turned-off Sparks bonus', () => {
    expect(resolvePomodoro({ mode: 'custom', workMinutes: 50, breakMinutes: 10, estimateMinutes: 100 })).toEqual({
      rounds: 2, work: 50, breakMinutes: 10,
    });
    const goal = { status: 'completed', dateKey: '2026-10-15', deadline: '18:00', sparksBonus: 0 };
    expect(sparksForGoal(goal, new Date(2026, 9, 15, 17, 0), 4)).toBe(0);
    expect(sparksForGoal({ ...goal, sparksBonus: 20 }, new Date(2026, 9, 15, 17, 0), 1)).toBe(20);
  });

  it('flags a start in the last fifth of the window', () => {
    const created = new Date(2026, 9, 15, 8, 0).getTime();
    const late = new Date(2026, 9, 15, 17, 30).getTime();
    expect(startedLate({ dateKey: '2026-10-15', deadline: '18:00', createdAtMs: created, startedAtMs: late })).toBe(true);
  });
});

describe('analytics and behaviour', () => {
  it('tags Bloom verbs and weights understanding toward higher levels', () => {
    expect(tagBloom('Compare and contrast the two methods')).toBe('analyse');
    const radar = masteryRadar([
      { at: '2026-10-01', score: 10, max: 10, bloom: 'remember' },
      { at: '2026-10-02', score: 4, max: 10, bloom: 'create' },
    ]);
    const understanding = understandingScore(radar);
    expect(understanding).not.toBeNull();
    expect(understanding as number).toBeLessThan(100);
    expect(understanding as number).toBeGreaterThan(40);
  });

  it('builds a heatmap, a quiz average, and a retention forecast', () => {
    const grid = hourHeatmap([{ minutes: 30, weekday: 1, hour: 16 }]);
    expect(grid[1][16]).toBe(30);
    expect(quizAverage([{ at: '2026-10-01', score: 8, max: 10 }])).toBe(80);
    expect(retentionForecast(80, 21, 0)).toBe(29);
  });

  it('renormalises exam readiness when attendance is missing and hides a small cohort', () => {
    const ready = examReadiness({ mastery: 80, retention_forecast: 70, quiz_average: 75, attendance_rate: null, goal_completion: 100 });
    expect(ready.score).not.toBeNull();
    expect(ready.band === 'Ready' || ready.band === 'On track').toBe(true);
    expect(cohortBenchmark([50, 60, 70], 80)).toBeNull();
    expect(cohortBenchmark([10, 20, 30, 40, 50, 60, 70, 90], 80)?.percentile).toBe(88);
  });

  it('turns a weak retention forecast into a goal the student can add', () => {
    const cards = weeklyInsights({ retention: 40, cramming: 10, readiness: 80, streak: 2, weakBloom: null, goalCompletion: 100 });
    expect(cards[0]?.suggestedGoal.title).toMatch(/Revise/);
  });

  it('excludes holidays and excused marks from attendance', () => {
    expect(automaticStatus({ holiday: true, joinedLive: false, openedLesson: false, submittedWork: false })).toBe('skip');
    const rate = attendanceRate([
      { dateKey: '2026-10-01', status: 'present', studentId: 's', source: 'manual' },
      { dateKey: '2026-10-02', status: 'absent', studentId: 's', source: 'automatic' },
      { dateKey: '2026-10-03', status: 'absent', studentId: 's', source: 'manual' },
      { dateKey: '2026-10-04', status: 'excused', studentId: 's', source: 'manual' },
    ], ['2026-10-03']);
    expect(rate).toBe(50);
  });
});

describe('snapshot', () => {
  it('uses the same definitions for the stored aggregate', () => {
    const snap = buildSnapshot({
      scope: 'student',
      scopeId: 'student1',
      computedAt: '2026-10-15T00:00:00.000Z',
      rangeStart: '2026-10-12',
      rangeEnd: '2026-10-15',
      studyEvents: [
        { minutes: 40, weekday: 1, hour: 18, at: '2026-10-12T18:00:00.000Z' },
        { minutes: 20, weekday: 2, hour: 18, at: '2026-10-13T18:00:00.000Z' },
      ],
      quizzes: [
        { at: '2026-10-12', score: 8, max: 10, unitId: 'u1', bloom: 'apply', topic: 'fractions', correct: false },
        { at: '2026-10-14', score: 9, max: 10, unitId: 'u1', bloom: 'apply', topic: 'fractions', correct: true },
      ],
      goals: [
        { dateKey: '2026-10-14', title: 'Done', status: 'completed' },
        { dateKey: '2026-10-13', title: 'Missed', status: 'overdue' },
      ],
      attendance: [{ dateKey: '2026-10-12', status: 'present', studentId: 'student1', source: 'manual' }],
      holidays: [],
      focusSessions: [{ plannedMinutes: 25, actualMinutes: 25 }],
      hints: 1,
      questions: 4,
      aiTurns: 2,
      sparksEarned: 15,
      deadlinesMs: [],
      cohortScores: [40, 50, 55, 60, 65, 70, 75, 80],
      previousStudyMinutes: 200,
      integrityOpen: false,
      streakBroken: false,
      now: new Date(2026, 9, 15),
    });
    expect(snap.metrics.study_time).toBe(60);
    expect(snap.metrics.goal_completion).toBe(50);
    expect(snap.metrics.mastery).toBe(90);
    expect(snap.metrics.focus_adherence).toBe(100);
    expect(snap.heatmap[1][18]).toBe(40);
    expect(snap.misconceptions[0]?.topic).toBe('fractions');
    expect(snap.behaviour.anomalies.some(a => a.id === 'study-drop')).toBe(true);
    expect(snap.cohort?.size).toBe(8);
    expect(snap.insights).toHaveLength(3);
    expect(snap.summary).toMatch(/exam readiness/);
    expect(snap.metrics.confidence_mastery).not.toBeNull();
    expect(snap.topics[0]?.topic).toBe('fractions');
  });

  it('weights mastery by how often a topic was tried', () => {
    const rows = confidenceMastery([
      { at: '2026-10-01', score: 9, max: 10, topic: 'fractions', attempts: 3, seconds: 40 },
      { at: '2026-10-02', score: 4, max: 10, topic: 'decimals', attempts: 1, seconds: 90 },
    ]);
    expect(rows.find(row => row.topic === 'fractions')?.confidence).toBe(100);
    expect(rows.find(row => row.topic === 'decimals')?.confidence).toBe(33);
    expect(strengthsAndWeaknesses(rows).strengths).toContain('fractions');
    expect(strengthsAndWeaknesses(rows).weaknesses).toContain('decimals');
  });

  it('keeps three next actions and writes digest headlines', () => {
    const summary = weeklySummary([], 72);
    expect(summary.actions).toHaveLength(3);
    expect(threeActions([{ id: 'only', title: 'One', body: 'One', metricId: 'streak', suggestedGoal: { title: 'One', category: 'study', estimateMinutes: 10 } }])).toHaveLength(3);
    expect(digestHeadlines({ study_time: 60, quiz_average: 80, exam_readiness: 72, streak: 4 })).toMatch(/Headlines: 60 min/);
    expect(digestHeadlines({})).toBe('');
  });

  it('tags AI flashcards, quizzes, and stalled courses', () => {
    const tagged = withBloomTags({
      flashcards: [{ question: 'Define a fraction', answer: 'A part of a whole' }],
      quiz: [{ question: 'Design a new fraction model', explanation: 'Create a picture' }],
    });
    expect(tagged.flashcards?.[0]?.bloom).toBe('remember');
    expect(tagged.quiz?.[0]?.bloom).toBe('create');
    const bars = bloomByTopic([
      { at: '2026-10-01', score: 8, max: 10, topic: 'fractions', bloom: 'apply' },
      { at: '2026-10-02', score: 5, max: 10, topic: 'fractions', prompt: 'Compare two fractions' },
    ]);
    expect(bars[0]?.topic).toBe('fractions');
    expect(bars[0]?.apply).toBe(80);
    expect(dropOffPoints(
      [{ label: 'Fractions', progress: 40 }, { label: 'Done', progress: 100 }],
      [{ label: '2026-10-12', minutes: 40 }, { label: '2026-10-13', minutes: 10 }],
    ).join(' ')).toMatch(/Fractions stops at 40%/);
  });
});

describe('exports', () => {
  const year = 2026;
  const line = copyrightLine(year);

  it('puts the copyright line on CSV, XLSX, and PDF', () => {
    expect(toCsv(['Name'], [['Amina']], year)).toContain(line);
    const book = buildXlsx(['Name'], [['Amina']], year);
    expect(book[0]).toBe(0x50);
    expect(book[1]).toBe(0x4b);
    const sheet = readStoredZip(book).get('xl/worksheets/sheet1.xml');
    expect(new TextDecoder().decode(sheet)).toContain('PoketSchool.Ai');
    const pdf = new TextDecoder().decode(buildPdf('Report', ['Study time 60'], year));
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf).toContain('PoketSchool.Ai');
  });
});

describe('report cards and integrity', () => {
  it('maps a percent onto the IGCSE 9 to 1 scale', () => {
    expect(gradeOnScale(91, scaleById('igcse_9_1'))).toBe('9');
    expect(gradeOnScale(45, scaleById('igcse_9_1'))).toBe('4');
    expect(gradeOnScale(39, scaleById('alevel'))).toBe('U');
  });

  it('never sets an automatic penalty and shows the student the evidence', () => {
    const result = buildIntegrityCase({
      assignmentTitle: 'Essay',
      signals: { pasteEvents: 3, similarity: 80, aiLikelihood: 70 },
    });
    expect(result.automaticPenalty).toBe(AUTOMATIC_PENALTY);
    expect(result.level).toBe('concern');
    expect(result.studentSummary).toMatch(/automatically/);
    expect(result.recommendation).toMatch(/teacher/i);
    expect(tokenSimilarity('the cat sat on the mat today', 'the cat sat on the mat today')).toBe(100);
    expect(aiLikelihoodSignal('One. Two. Three.')).toBe(0);
  });
});

describe('calendar', () => {
  it('reads ICS and CSV, and keeps AI extracts as drafts', () => {
    const ics = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20260320\nSUMMARY:Hari Raya\nEND:VEVENT\nEND:VCALENDAR';
    expect(parseIcs(ics)[0]).toMatchObject({ date: '2026-03-20', title: 'Hari Raya' });
    const csv = 'title,date,type\nSports day,2026-05-02,event\n';
    expect(parseCsv(csv)[0]).toMatchObject({ title: 'Sports day', type: 'event' });
    expect(extractDatesFromText('Trip 2026-04-01')[0]?.source).toBe('ai_draft');
  });

  it('maps units onto teaching Mondays and skips a holiday when dripping lessons', () => {
    const weeks = teachingMondays('2026-10-12', '2026-10-26', ['2026-10-19']);
    expect(weeks).toEqual(['2026-10-12', '2026-10-26']);
    const paced = mapUnitsToWeeks([{ id: 'u1', title: 'Atoms' }, { id: 'u2', title: 'Bonds' }], weeks);
    expect(paced[0]?.weekStart).toBe('2026-10-12');
    expect(dripDates('2026-10-12', 2, ['2026-10-12'])).toEqual(['2026-10-13', '2026-10-14']);
  });
});

describe('feature flags', () => {
  it('stays on unless the school turns it off', () => {
    expect(isFeatureEnabled(resolveFlags(null), 'studentGoals')).toBe(true);
    expect(isFeatureEnabled(resolveFlags({ reportsHub: false }), 'reportsHub')).toBe(false);
  });
});
