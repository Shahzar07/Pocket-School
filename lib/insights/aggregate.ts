/**
 * The snapshot the scheduled job stores and the screens render.
 * Building it here keeps the dashboard, the export, and the cron on the same numbers.
 */

import {
  averageSession, bestStudySlot, bloomByTopic, cohortBenchmark, confidenceMastery, consistencyScore,
  dailyMinutes, daysSince, examReadiness, hourHeatmap, masteryRadar, masteryScore, misconceptions,
  paceVersusPlan, questionPace, quizAverage, quizTrend, retentionForecast, strengthsAndWeaknesses,
  dropOffPoints, studyMinutes, studySeries, trendDelta, understandingScore, weakestBloom, weeklyInsights, weeklySummary,
  weightedMastery, type BloomTopicBar, type QuizPoint, type StudyBar, type StudyEvent, type TopicMastery,
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
  sparksSpent?: number;
  courseProgress?: { label: string; progress: number }[];
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
    averageSession: number | null;
    bestDay: string | null;
    bestHour: number | null;
    attemptsPerQuestion: number | null;
    secondsPerQuestion: number | null;
    pace: number | null;
  };
  studySeries: StudyBar[];
  topics: TopicMastery[];
  bloomTopics: BloomTopicBar[];
  strengths: string[];
  weaknesses: string[];
  goalsMet: number;
  goalsMissed: number;
  lessonsCompleted: number;
  courseProgress: { label: string; progress: number }[];
  sparksSpent: number;
  summary: string;
  dropOffs: string[];
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
  const topics = confidenceMastery(quizzes);
  const topicSplit = strengthsAndWeaknesses(topics);
  const heatmap = hourHeatmap(input.studyEvents);
  const slot = bestStudySlot(heatmap);
  const paceStats = questionPace(quizzes);
  const planned = input.goals.reduce((sum, goal) => sum + (goal.estimateMinutes ?? 0), 0);
  const goalsMet = input.goals.filter(goal => goal.status === 'completed').length;
  const goalsMissed = input.goals.filter(goal => goal.status === 'overdue').length;
  const lessonsCompleted = input.goals.reduce((sum, goal) => sum + (goal.completedLessonIds?.length ?? 0), 0);
  const series = studySeries(input.studyEvents, input.rangeStart, input.rangeEnd);
  const progress = input.courseProgress ?? [];
  const summary = weeklySummary(weeklyInsights({
    retention,
    cramming,
    readiness: readiness.score,
    streak,
    weakBloom: weakestBloom(radar),
    goalCompletion: goalsPct,
  }), readiness.score);
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
      sparks_spent: input.sparksSpent ?? 0,
      confidence_mastery: weightedMastery(topics),
      lessons_completed: lessonsCompleted,
      pace: paceVersusPlan(minutes, planned),
      attempts_per_question: paceStats.attempts,
      seconds_per_question: paceStats.seconds,
    },
    heatmap,
    radar,
    quizTrend: trend,
    misconceptions: misconceptions(quizzes),
    insights: summary.actions,
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
      averageSession: averageSession(input.studyEvents),
      bestDay: slot?.day ?? null,
      bestHour: slot?.hour ?? null,
      attemptsPerQuestion: paceStats.attempts,
      secondsPerQuestion: paceStats.seconds,
      pace: paceVersusPlan(minutes, planned),
    },
    studySeries: series,
    topics,
    bloomTopics: bloomByTopic(quizzes),
    strengths: topicSplit.strengths,
    weaknesses: topicSplit.weaknesses,
    goalsMet,
    goalsMissed,
    lessonsCompleted,
    courseProgress: progress,
    sparksSpent: input.sparksSpent ?? 0,
    summary: summary.text,
    dropOffs: dropOffPoints(progress, series),
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
