/**
 * One definition for every number on the insights, behaviour, and reports
 * screens. Tooltips, exports, and the snapshot all read this list.
 */

export interface MetricDefinition {
  id: string;
  label: string;
  unit: string;
  summary: string;
  formula: string;
}

export const METRICS: readonly MetricDefinition[] = [
  {
    id: 'study_time',
    label: 'Study time',
    unit: 'minutes',
    summary: 'Minutes spent in focus sessions and recorded lesson study inside the chosen dates.',
    formula: 'Sum of study-event minutes in the range.',
  },
  {
    id: 'goal_completion',
    label: 'Goal completion',
    unit: 'percent',
    summary: 'Share of goals that were finished. Excused goals are left out so a parent waiver does not look like a miss.',
    formula: 'Completed ÷ (completed + missed). Excused goals are excluded.',
  },
  {
    id: 'streak',
    label: 'Goal streak',
    unit: 'days',
    summary: 'Consecutive days on which every goal set that day was completed or excused. A day with no goals does not break the streak.',
    formula: 'Count backwards from today. Today counts only when its goals are already done.',
  },
  {
    id: 'quiz_average',
    label: 'Quiz average',
    unit: 'percent',
    summary: 'Mean score across quizzes in the range.',
    formula: 'Mean of score ÷ maximum × 100.',
  },
  {
    id: 'mastery',
    label: 'Mastery',
    unit: 'percent',
    summary: 'Latest quiz result for each unit, averaged. An older attempt does not dilute a later one.',
    formula: 'Mean of the most recent percent per unit.',
  },
  {
    id: 'understanding',
    label: 'Understanding',
    unit: 'percent',
    summary: 'Mastery weighted towards higher Bloom levels. Remembering counts less than creating.',
    formula: 'Weighted mean of Bloom-level scores. Weights 1 (Remember) through 6 (Create).',
  },
  {
    id: 'retention_forecast',
    label: 'Retention forecast',
    unit: 'percent',
    summary: 'Estimated score if the student sat the work today, from the last result, days since practice, and the recent trend.',
    formula: 'Last score × e^(−days ÷ 21), shifted by a quarter of the recent trend. Missing data stays blank.',
  },
  {
    id: 'exam_readiness',
    label: 'Exam readiness',
    unit: 'percent',
    summary: 'A single readiness score. Any input that has no data yet is left out and the remaining weights are scaled to 100%.',
    formula: '0.35 mastery + 0.20 retention + 0.20 quiz trend + 0.15 attendance + 0.10 goal completion, renormalised.',
  },
  {
    id: 'consistency',
    label: 'Consistency',
    unit: 'percent',
    summary: 'How even daily study is across the range. A single long day scores lower than the same minutes spread through the week.',
    formula: '100 × (1 − standard deviation ÷ mean) of daily minutes, floored at 0. Days outside the range are ignored.',
  },
  {
    id: 'focus_adherence',
    label: 'Focus adherence',
    unit: 'percent',
    summary: 'Actual focus minutes compared with the minutes the student planned.',
    formula: 'Actual focus minutes ÷ planned minutes, capped at 100%.',
  },
  {
    id: 'cramming',
    label: 'Cramming',
    unit: 'percent',
    summary: 'Share of study minutes that fell in the 24 hours before a goal or assessment deadline.',
    formula: 'Minutes within 24 hours before a deadline ÷ all study minutes.',
  },
  {
    id: 'procrastination',
    label: 'Late starts',
    unit: 'percent',
    summary: 'Share of goals that were started in the last fifth of the time between creation and the deadline.',
    formula: 'Goals started after 80% of their window ÷ goals that have a start time.',
  },
  {
    id: 'hint_rate',
    label: 'Hint rate',
    unit: 'percent',
    summary: 'Hints requested per question attempted.',
    formula: 'Hints ÷ questions × 100.',
  },
  {
    id: 'ai_usage',
    label: 'AI help',
    unit: 'turns per hour',
    summary: 'AI tutor turns per hour of study. A high number beside a low score is a signal for the teacher, not a penalty.',
    formula: 'AI turns ÷ (study minutes ÷ 60).',
  },
  {
    id: 'attendance_rate',
    label: 'Attendance',
    unit: 'percent',
    summary: 'Present and late marks over marks that count. Holidays and excused absences are excluded.',
    formula: '(Present + late) ÷ (present + late + absent). Holiday dates and excused marks are excluded.',
  },
  {
    id: 'sparks_earned',
    label: 'Sparks from goals',
    unit: 'Sparks',
    summary: 'Sparks the server granted for finishing goals. This is the same Sparks balance as the header, not a second currency.',
    formula: 'Sum of goal bonuses granted in the range. See lib/sparks.ts.',
  },
  {
    id: 'sparks_spent',
    label: 'Sparks spent',
    unit: 'Sparks',
    summary: 'Sparks used on hints, illustrations, and other charges in the saved totals.',
    formula: 'Sum of spend transactions, or the absolute value of negative amounts.',
  },
  {
    id: 'confidence_mastery',
    label: 'Confidence-weighted mastery',
    unit: 'percent',
    summary: 'Topic scores weighted by how many times the student has tried them. One lucky attempt counts less than three.',
    formula: 'Mean of topic scores, weighted by min(attempts, 3) ÷ 3.',
  },
  {
    id: 'lessons_completed',
    label: 'Lessons completed',
    unit: 'lessons',
    summary: 'Lessons marked done inside goals in the range.',
    formula: 'Count of completedLessonIds on goals in the range.',
  },
  {
    id: 'pace',
    label: 'Pace versus plan',
    unit: 'percent',
    summary: 'Study minutes compared with the minutes the goals planned.',
    formula: 'Study minutes ÷ planned goal minutes, capped at 100%.',
  },
  {
    id: 'attempts_per_question',
    label: 'Attempts per question',
    unit: 'attempts',
    summary: 'How many tries a question took, averaged across quizzes that recorded attempts.',
    formula: 'Mean of recorded attempts.',
  },
  {
    id: 'seconds_per_question',
    label: 'Time per question',
    unit: 'seconds',
    summary: 'Average seconds spent on a question when the quiz recorded time.',
    formula: 'Mean of recorded seconds.',
  },
  {
    id: 'certificate_count',
    label: 'Certificates',
    unit: 'certificates',
    summary: 'Course certificates issued to the student.',
    formula: 'Count of certificate records in the range.',
  },
  {
    id: 'enrolment_count',
    label: 'Enrolments',
    unit: 'enrolments',
    summary: 'Students enrolled on the courses in this view.',
    formula: 'Count of enrolment records. Student names stay off institution charts.',
  },
  {
    id: 'revenue',
    label: 'Revenue',
    unit: 'USD',
    summary: 'Course fees for enrolments in this view. Students and parents do not see this figure.',
    formula: 'Sum of enrolment amounts in the range.',
  },
];

const BY_ID = new Map(METRICS.map(m => [m.id, m]));

export function metricById(id: string): MetricDefinition | undefined {
  return BY_ID.get(id);
}

export function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
