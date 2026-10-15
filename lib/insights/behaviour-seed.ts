/**
 * Fixed behaviour records for the preview and the number checks.
 */

import { buildBehaviourBoard, type BehaviourBoardModel, type BehaviourRole } from './behaviour-board';
import type { Mood } from './behaviour';

const NOW = new Date(2026, 9, 15, 18, 0, 0);

function at(day: number, hour: number): number {
  return new Date(2026, 9, day, hour, 0, 0).getTime();
}

export function seedBehaviour(role: BehaviourRole = 'student'): BehaviourBoardModel {
  const staff = role === 'teacher' || role === 'institution_admin';
  return buildBehaviourBoard({
    role,
    scopeLabel: role === 'parent' ? 'Mina' : staff && role === 'institution_admin' ? 'School A' : 'Mina',
    computedAt: '2026-10-15T18:00:00.000Z',
    precomputed: true,
    now: NOW,
    courseProgress: [{ label: 'Fractions', progress: 40 }],
    moods: [
      { dateKey: '2026-10-13', mood: 3 as Mood, effort: 3, at: '2026-10-13T18:05:00.000Z' },
      { dateKey: '2026-10-14', mood: 4 as Mood, effort: 4, at: '2026-10-14T20:10:00.000Z' },
      { dateKey: '2026-10-15', mood: 5 as Mood, effort: 4, at: '2026-10-15T07:20:00.000Z' },
    ],
    notes: [
      { id: 'n1', studentId: 'mina', studentLabel: 'Mina', type: 'warning', points: -3, description: 'Late to the starter', at: '2026-10-12T09:00:00.000Z' },
      { id: 'n2', studentId: 'mina', studentLabel: 'Mina', type: 'merit', points: 5, description: 'Helped a classmate with fractions', at: '2026-10-14T15:00:00.000Z' },
    ],
    classmates: staff ? [{ studentId: 'leo', label: 'Leo', studyMinutes: 20, performance: 40 }] : [],
    focusSessions: [
      { plannedMinutes: 25, actualMinutes: 25, at: '2026-10-13T18:00:00.000Z', goalId: 'g2' },
      { plannedMinutes: 25, actualMinutes: 15, at: '2026-10-14T20:00:00.000Z', goalId: 'g1' },
    ],
    snapshotInput: {
      scope: role === 'parent' ? 'parent_child' : role === 'institution_admin' ? 'teacher' : role === 'teacher' ? 'teacher' : 'student',
      scopeId: 'mina',
      computedAt: '2026-10-15T18:00:00.000Z',
      rangeStart: '2026-10-12',
      rangeEnd: '2026-10-15',
      studyEvents: [
        { minutes: 30, at: '2026-10-12T16:00:00.000Z', weekday: 1, hour: 16, courseId: 'fractions' },
        { minutes: 30, at: '2026-10-13T18:00:00.000Z', weekday: 2, hour: 18, courseId: 'fractions' },
        { minutes: 30, at: '2026-10-14T10:00:00.000Z', weekday: 3, hour: 10, courseId: 'fractions' },
        { minutes: 30, at: '2026-10-14T20:00:00.000Z', weekday: 3, hour: 20, courseId: 'fractions' },
        { minutes: 30, at: '2026-10-15T07:00:00.000Z', weekday: 4, hour: 7, courseId: 'fractions' },
      ],
      quizzes: [
        { at: '2026-10-13T18:30:00.000Z', score: 8, max: 10, topic: 'Fractions', unitId: 'u1', attempts: 2, seconds: 40, lessonId: 'lesson-2' },
        { at: '2026-10-15T07:30:00.000Z', score: 6, max: 10, topic: 'Fractions', unitId: 'u1', attempts: 4, seconds: 80, lessonId: 'lesson-4' },
      ],
      goals: [
        { id: 'g4', dateKey: '2026-10-11', title: 'Warm up', status: 'not_started' },
        { id: 'g3', dateKey: '2026-10-12', title: 'Late revision', status: 'in_progress', deadline: '18:00', createdAtMs: at(12, 0), startedAtMs: at(12, 17) },
        { id: 'g2', dateKey: '2026-10-13', title: 'Lesson 2', status: 'completed', deadline: '18:00', createdAtMs: at(13, 0), startedAtMs: at(13, 9) },
        { id: 'g1', dateKey: '2026-10-14', title: 'Lesson 4', status: 'completed', deadline: '21:00', createdAtMs: at(14, 0), startedAtMs: at(14, 10) },
        { id: 'g5', dateKey: '2026-10-15', title: 'Morning practice', status: 'completed', deadline: '18:00', createdAtMs: at(15, 0), startedAtMs: at(15, 7) },
      ],
      attendance: [],
      holidays: [],
      focusSessions: [
        { plannedMinutes: 25, actualMinutes: 25 },
        { plannedMinutes: 25, actualMinutes: 15 },
      ],
      hints: 1,
      questions: 4,
      aiTurns: 2,
      sparksEarned: 0,
      deadlinesMs: [new Date('2026-10-15T08:00:00.000Z').getTime()],
      cohortScores: [],
      previousStudyMinutes: 400,
      integrityOpen: false,
      streakBroken: false,
      now: NOW,
    },
  });
}

export interface BehaviourCheck {
  label: string;
  actual: number | string | null;
  expected: number | string;
}

export function behaviourChecks(board: BehaviourBoardModel): BehaviourCheck[] {
  const metrics = board.snapshot.metrics;
  const atRisk = board.classPoints.filter(point => point.quadrant === 'needs-attention').length;
  const checks: BehaviourCheck[] = [
    { label: 'Study minutes', actual: metrics.study_time, expected: 150 },
    { label: 'Monday 16:00', actual: board.heatmap[1]?.[16] ?? 0, expected: 30 },
    { label: 'Consistency', actual: metrics.consistency, expected: 65 },
    { label: 'Streak', actual: metrics.streak, expected: 3 },
    { label: 'Focus', actual: metrics.focus_adherence, expected: 80 },
    { label: 'Cramming', actual: metrics.cramming, expected: 60 },
    { label: 'Procrastination', actual: metrics.procrastination, expected: 25 },
    { label: 'AI help', actual: metrics.ai_usage, expected: 0.8 },
    { label: 'Sessions 26–45', actual: board.sessions.find(bucket => bucket.id === 'study')?.count ?? 0, expected: 5 },
    { label: 'Funnel start', actual: board.funnel.start, expected: 4 },
    { label: 'Funnel progress', actual: board.funnel.progress, expected: 1 },
    { label: 'Funnel complete', actual: board.funnel.complete, expected: 3 },
    { label: 'Hint rate', actual: metrics.hint_rate, expected: 25 },
    { label: 'Attempts', actual: metrics.attempts_per_question, expected: 3 },
    { label: 'Seconds', actual: metrics.seconds_per_question, expected: 60 },
    { label: 'Quiz average', actual: metrics.quiz_average, expected: 70 },
    { label: 'Mood', actual: board.moods.at(-1)?.mood ?? null, expected: 5 },
    { label: 'Badges', actual: board.badges.length, expected: 4 },
    { label: 'Notes', actual: board.notes.length, expected: 2 },
    { label: 'Study drop', actual: board.snapshot.behaviour.anomalies.some(item => item.id === 'study-drop') ? 'yes' : 'no', expected: 'yes' },
  ];
  if (board.role === 'teacher' || board.role === 'institution_admin') {
    checks.push({ label: 'At risk', actual: atRisk, expected: 1 });
  }
  return checks;
}
