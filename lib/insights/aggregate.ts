/**
 * The snapshot the scheduled job stores and the screens render.
 * Building it here keeps the dashboard, the export, and the cron on the same numbers.
 */

import {
  cohortBenchmark, consistencyScore, dailyMinutes, daysSince, examReadiness, hourHeatmap, masteryRadar,
  masteryScore, misconceptions, quizAverage, quizTrend, retentionForecast, studyMinutes,
  trendDelta, understandingScore, weakestBloom, weeklyInsights, type QuizPoint, type StudyEvent,
} from './analytics';
import { attendanceRate, type AttendanceMark } from './attendance';
import { behaviourAnomalies, crammingShare, engagementQuadrant, focusAdherence, procrastinationShare, type FocusSessionLike } from './behaviour';
import { computeGoalStreak, type GoalLike } from './goals';
import type { InsightCard } from './analytics';
import type { Anomaly, Quadrant } from './behaviour';
import type { BloomLevel } from './analytics';

export interface SnapshotInput {
  scope: 'student' | 'parent_child' | 'teacher' | 'institution';
  scopeId: string;
  computedAt: string;
  rangeStart: string;
  rangeEnd: string;
  studyEvents: StudyEvent[];
  quizzes: QuizPoint[];
  goals: GoalLike[];
  attendance: AttendanceMark[];
  holidays: string[];
  focusSessions: FocusSessionLike[];
  hints: number;
  questions: number;
  aiTurns: number;
  sparksEarned: number;
  deadlinesMs: number[];
  cohortScores: number[];
  previousStudyMinutes: number | null;
  integrityOpen: boolean;
  streakBroken: boolean;
  now: Date;
}

export interface AnalyticsSnapshot {
  scope: SnapshotInput['scope'];
  scopeId: string;
  computedAt: string;
  rangeStart: string;
  rangeEnd: string;
  metrics: Record<string, number | null>;
  heatmap: number[][];
  radar: { level: BloomLevel; score: number | null }[];
  quizTrend: { label: string; average: number }[];
  misconceptions: { topic: string; misses: number; note: string }[];
  insights: InsightCard[];
  examReadiness: { score: number | null; band: string };
  cohort: { percentile: number; size: number } | null;
  behaviour: {
    consistency: number | null;
    focusAdherence: number | null;
    cramming: number | null;
    procrastination: number | null;
    quadrant: Quadrant | null;
    anomalies: Anomaly[];
  };
}

/** Completed ÷ (completed + overdue). Excused and still-open goals stay out of the rate. */
function goalCompletion(goals: GoalLike[]): number | null {
  const finished = goals.filter(g => g.status === 'completed').length;
  const missed = goals.filter(g => g.status === 'overdue').length;
  if (finished + missed === 0) return null;
  return Math.round((100 * finished) / (finished + missed));
}

export function buildSnapshot(input: SnapshotInput): AnalyticsSnapshot {
  const minutes = studyMinutes(input.studyEvents);
  const quizzes = input.quizzes;
  const average = quizAverage(quizzes);
  const mastery = masteryScore(quizzes);
  const radar = masteryRadar(quizzes);
  const understanding = understandingScore(radar);
  const trend = quizTrend(quizzes);
  const last = [...quizzes].filter(q => q.at).sort((a, b) => a.at.localeCompare(b.at)).at(-1);
  const lastScore = last ? (last.max > 0 ? Math.round((last.score / last.max) * 100) : null) : null;
  const retention = retentionForecast(lastScore, daysSince(last?.at, input.now), trendDelta(trend));
  const attendance = attendanceRate(input.attendance, input.holidays);
  const goalsPct = goalCompletion(input.goals);
  const readiness = examReadiness({
    mastery,
    retention_forecast: retention,
    quiz_average: average,
    attendance_rate: attendance,
    goal_completion: goalsPct,
  });
  const daily = dailyMinutes(input.studyEvents, input.rangeStart, input.rangeEnd);
  const consistency = daily.some(n => n > 0) ? consistencyScore(daily) : null;
  const cramming = crammingShare(input.studyEvents, input.deadlinesMs.map(atMs => ({ atMs })));
  const procrastination = procrastinationShare(input.goals);
  const adherence = focusAdherence(input.focusSessions);
  const streak = computeGoalStreak(input.goals, input.now);
  const hintRate = input.questions > 0 ? Math.round((100 * input.hints) / input.questions) : null;
  const aiUsage = minutes > 0 ? Math.round((input.aiTurns / (minutes / 60)) * 10) / 10 : null;
  const absenceRun = trailingAbsences(input.attendance, input.holidays);
  const anomalies = behaviourAnomalies({
    studyNow: minutes,
    studyPrevious: input.previousStudyMinutes,
    streakBroken: input.streakBroken,
    absenceRun,
    cramming,
    integrityOpen: input.integrityOpen,
  });

  return {
    scope: input.scope,
    scopeId: input.scopeId,
    computedAt: input.computedAt,
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
    metrics: {
      study_time: minutes,
      goal_completion: goalsPct,
      streak,
      quiz_average: average,
      mastery,
      understanding,
      retention_forecast: retention,
      exam_readiness: readiness.score,
      consistency,
      focus_adherence: adherence,
      cramming,
      procrastination,
      hint_rate: hintRate,
      ai_usage: aiUsage,
      attendance_rate: attendance,
      sparks_earned: input.sparksEarned,
    },
    heatmap: hourHeatmap(input.studyEvents),
    radar,
    quizTrend: trend,
    misconceptions: misconceptions(quizzes),
    insights: weeklyInsights({
      retention,
      cramming,
      readiness: readiness.score,
      streak,
      weakBloom: weakestBloom(radar),
      goalCompletion: goalsPct,
    }),
    examReadiness: { score: readiness.score, band: readiness.band },
    cohort: input.scope === 'institution'
      ? null
      : cohortBenchmark(input.cohortScores, mastery ?? average),
    behaviour: {
      consistency,
      focusAdherence: adherence,
      cramming,
      procrastination,
      quadrant: engagementQuadrant(minutes, average),
      anomalies,
    },
  };
}

function trailingAbsences(marks: AttendanceMark[], holidays: string[]): number {
  const holiday = new Set(holidays);
  const ordered = [...marks]
    .filter(m => !holiday.has(m.dateKey) && m.status !== 'excused')
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  let run = 0;
  for (let i = ordered.length - 1; i >= 0; i--) {
    if (ordered[i].status !== 'absent') break;
    run += 1;
  }
  return run;
}
