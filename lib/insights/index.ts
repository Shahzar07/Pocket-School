export { copyrightLine } from './copyright';
export { isoDateKey, parseDateKey, addDays } from './dates';
export { METRICS, metricById } from './metrics';
export {
  computeGoalStreak, autoProgress, sparksForGoal, spawnNextGoal, pomodoroPlan,
  focusSeconds, isOnTime, nextDateKey,
} from './goals';
export type { GoalDraft, GoalLike, GoalCategory, ChecklistItem } from './goals';
export {
  tagBloom, hourHeatmap, quizAverage, masteryScore, understandingScore, retentionForecast,
  examReadiness, cohortBenchmark, weeklyInsights, COHORT_MIN,
} from './analytics';
export { attendanceRate, automaticStatus, shouldAlertAbsence } from './attendance';
export { buildSnapshot } from './aggregate';
export type { AnalyticsSnapshot, SnapshotInput } from './aggregate';
export { toCsv, delta, nextScheduleDate } from './reports';
export { buildXlsx } from './xlsx';
export { buildPdf } from './pdf';
export { gradeOnScale, SCALES, REPORT_TEMPLATES, newVerificationToken, publicCard } from './report-cards';
export { buildIntegrityCase, tokenSimilarity, AUTOMATIC_PENALTY, vivaQuestions } from './integrity';
export {
  parseIcs, parseCsv, extractDatesFromText, CALENDAR_TEMPLATES, mapUnitsToWeeks,
  teachingMondays, dripDates,
} from './calendar';
export { isFeatureEnabled, FEATURE_FLAGS } from '../feature-flags';
