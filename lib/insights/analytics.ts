import { clampPercent } from './metrics';
import { dateKeysBetween, parseDateKey } from './dates';

export const BLOOM_LEVELS = ['remember', 'understand', 'apply', 'analyse', 'evaluate', 'create'] as const;
export type BloomLevel = (typeof BLOOM_LEVELS)[number];

export const BLOOM_LABELS: Record<BloomLevel, string> = {
  remember: 'Remember',
  understand: 'Understand',
  apply: 'Apply',
  analyse: 'Analyse',
  evaluate: 'Evaluate',
  create: 'Create',
};

const BLOOM_WEIGHT: Record<BloomLevel, number> = {
  remember: 1,
  understand: 2,
  apply: 3,
  analyse: 4,
  evaluate: 5,
  create: 6,
};

const BLOOM_WORDS: Record<BloomLevel, string[]> = {
  remember: ['define', 'list', 'name', 'recall', 'identify', 'label', 'state', 'memorise', 'memorize'],
  understand: ['explain', 'summarise', 'summarize', 'describe', 'interpret', 'classify', 'paraphrase'],
  apply: ['use', 'solve', 'calculate', 'demonstrate', 'implement', 'compute', 'apply'],
  analyse: ['compare', 'contrast', 'distinguish', 'examine', 'differentiate', 'analyse', 'analyze'],
  evaluate: ['judge', 'critique', 'justify', 'assess', 'argue', 'evaluate', 'defend'],
  create: ['design', 'compose', 'construct', 'invent', 'plan', 'produce', 'create'],
};

export interface StudyEvent {
  minutes: number;
  /** Set both to keep tests independent of the machine timezone. */
  weekday?: number;
  hour?: number;
  at?: string;
  studentId?: string;
  courseId?: string;
  lessonId?: string;
  unitId?: string;
  source?: 'lesson' | 'focus' | 'quiz';
}

export interface QuizPoint {
  at: string;
  score: number;
  max: number;
  unitId?: string;
  lessonId?: string;
  bloom?: BloomLevel;
  prompt?: string;
  topic?: string;
  correct?: boolean;
}

export function tagBloom(text: string): BloomLevel {
  const hay = text.toLowerCase();
  let best: BloomLevel = 'understand';
  let bestHits = 0;
  for (const level of BLOOM_LEVELS) {
    const hits = BLOOM_WORDS[level].reduce((n, word) => n + (hay.includes(word) ? 1 : 0), 0);
    if (hits > bestHits) {
      best = level;
      bestHits = hits;
    }
  }
  return best;
}

export function percentOf(score: number, max: number): number | null {
  if (!Number.isFinite(score) || !Number.isFinite(max) || max <= 0) return null;
  return clampPercent((score / max) * 100);
}

function placement(event: StudyEvent): { weekday: number; hour: number } | null {
  if (event.weekday != null && event.hour != null) return { weekday: event.weekday, hour: event.hour };
  if (!event.at) return null;
  const d = new Date(event.at);
  if (Number.isNaN(d.getTime())) return null;
  return { weekday: d.getDay(), hour: d.getHours() };
}

export function studyMinutes(events: StudyEvent[]): number {
  return events.reduce((sum, e) => sum + (Number.isFinite(e.minutes) ? Math.max(0, e.minutes) : 0), 0);
}

/** Rows are Sunday → Saturday. Columns are hours 0–23. Values are minutes. */
export function hourHeatmap(events: StudyEvent[]): number[][] {
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const event of events) {
    const place = placement(event);
    if (!place || place.weekday < 0 || place.weekday > 6 || place.hour < 0 || place.hour > 23) continue;
    grid[place.weekday][place.hour] += Math.max(0, event.minutes);
  }
  return grid;
}

export function quizAverage(points: QuizPoint[]): number | null {
  const values = points.map(p => percentOf(p.score, p.max)).filter((n): n is number => n != null);
  if (!values.length) return null;
  return clampPercent(values.reduce((a, b) => a + b, 0) / values.length);
}

export function masteryByUnit(points: QuizPoint[]): { unitId: string; score: number }[] {
  const latest = new Map<string, { at: string; score: number }>();
  for (const point of points) {
    if (!point.unitId) continue;
    const score = percentOf(point.score, point.max);
    if (score == null) continue;
    const prev = latest.get(point.unitId);
    if (!prev || point.at >= prev.at) latest.set(point.unitId, { at: point.at, score });
  }
  return [...latest.entries()].map(([unitId, row]) => ({ unitId, score: row.score }));
}

export function masteryScore(points: QuizPoint[]): number | null {
  const rows = masteryByUnit(points);
  if (!rows.length) return null;
  return clampPercent(rows.reduce((sum, row) => sum + row.score, 0) / rows.length);
}

export function masteryRadar(points: QuizPoint[]): { level: BloomLevel; score: number | null }[] {
  return BLOOM_LEVELS.map(level => {
    const tagged = points.filter(p => (p.bloom ?? (p.prompt ? tagBloom(p.prompt) : undefined)) === level);
    return { level, score: quizAverage(tagged) };
  });
}

export function understandingScore(radar: { level: BloomLevel; score: number | null }[]): number | null {
  let weight = 0;
  let total = 0;
  for (const row of radar) {
    if (row.score == null) continue;
    const w = BLOOM_WEIGHT[row.level];
    weight += w;
    total += row.score * w;
  }
  if (weight === 0) return null;
  return clampPercent(total / weight);
}

export interface Misconception {
  topic: string;
  misses: number;
  note: string;
}

export function misconceptions(points: QuizPoint[]): Misconception[] {
  const counts = new Map<string, number>();
  for (const point of points) {
    if (point.correct !== false || !point.topic) continue;
    counts.set(point.topic, (counts.get(point.topic) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic, misses]) => ({
      topic,
      misses,
      note: misses === 1 ? `Missed once on ${topic}.` : `Missed ${misses} times on ${topic}.`,
    }));
}

export function quizTrend(points: QuizPoint[]): { label: string; average: number }[] {
  const buckets = new Map<string, number[]>();
  for (const point of points) {
    const score = percentOf(point.score, point.max);
    if (score == null || !point.at) continue;
    const day = point.at.slice(0, 10);
    const label = day.length >= 10 ? day : 'undated';
    const list = buckets.get(label);
    if (list) list.push(score);
    else buckets.set(label, [score]);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, scores]) => ({
      label,
      average: clampPercent(scores.reduce((a, b) => a + b, 0) / scores.length),
    }));
}

/** Recent change: last bucket minus the one before it. */
export function trendDelta(trend: { average: number }[]): number {
  if (trend.length < 2) return 0;
  return trend[trend.length - 1].average - trend[trend.length - 2].average;
}

export function retentionForecast(lastScore: number | null, daysSince: number | null, trendDeltaPoints: number): number | null {
  if (lastScore == null) return null;
  const days = daysSince ?? 0;
  const decayed = lastScore * Math.exp(-Math.max(0, days) / 21);
  return clampPercent(decayed + trendDeltaPoints * 0.25);
}

export function daysSince(iso: string | undefined, now: Date): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return Math.max(0, Math.round((now.getTime() - then.getTime()) / 86_400_000));
}

export interface ReadinessPart {
  metricId: string;
  value: number | null;
  weight: number;
}

const READINESS_WEIGHTS: { metricId: string; weight: number }[] = [
  { metricId: 'mastery', weight: 0.35 },
  { metricId: 'retention_forecast', weight: 0.2 },
  { metricId: 'quiz_average', weight: 0.2 },
  { metricId: 'attendance_rate', weight: 0.15 },
  { metricId: 'goal_completion', weight: 0.1 },
];

export function examReadiness(values: Record<string, number | null>): {
  score: number | null;
  band: string;
  parts: ReadinessPart[];
} {
  const parts: ReadinessPart[] = READINESS_WEIGHTS.map(row => ({
    metricId: row.metricId,
    weight: row.weight,
    value: values[row.metricId] ?? null,
  }));
  const used = parts.filter(p => p.value != null);
  const weight = used.reduce((sum, p) => sum + p.weight, 0);
  if (weight === 0) return { score: null, band: 'Not enough evidence yet', parts };
  const score = clampPercent(used.reduce((sum, p) => sum + (p.value as number) * p.weight, 0) / weight);
  const band = score >= 85 ? 'Ready' : score >= 70 ? 'On track' : score >= 50 ? 'Building' : 'Not yet';
  return { score, band, parts };
}

/** Anonymous percentile. Hidden until the cohort is large enough that one student is not identifiable. */
export const COHORT_MIN = 8;

export function cohortBenchmark(scores: number[], mine: number | null): { percentile: number; size: number } | null {
  const clean = scores.filter(n => Number.isFinite(n));
  if (mine == null || clean.length < COHORT_MIN) return null;
  const below = clean.filter(n => n < mine).length;
  return { percentile: clampPercent((below / clean.length) * 100), size: clean.length };
}

export function dailyMinutes(events: StudyEvent[], start: string, end: string): number[] {
  const keys = dateKeysBetween(start, end);
  const totals = new Map(keys.map(k => [k, 0]));
  for (const event of events) {
    const key = event.at?.slice(0, 10);
    if (key && totals.has(key)) totals.set(key, (totals.get(key) ?? 0) + Math.max(0, event.minutes));
  }
  return keys.map(k => totals.get(k) ?? 0);
}

export function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function consistencyScore(daily: number[]): number | null {
  if (daily.length < 2) return null;
  const avg = mean(daily);
  if (avg == null || avg === 0) return daily.every(n => n === 0) ? null : 0;
  const variance = daily.reduce((sum, n) => sum + (n - avg) ** 2, 0) / daily.length;
  const cv = Math.sqrt(variance) / avg;
  return clampPercent(100 * (1 - cv));
}

export interface InsightCard {
  id: string;
  title: string;
  body: string;
  metricId: string;
  suggestedGoal: {
    title: string;
    category: 'study' | 'revision' | 'practice' | 'reading' | 'other';
    estimateMinutes: number;
  };
}

export function weeklyInsights(input: {
  retention: number | null;
  cramming: number | null;
  readiness: number | null;
  streak: number;
  weakBloom: BloomLevel | null;
  goalCompletion: number | null;
}): InsightCard[] {
  const cards: InsightCard[] = [];
  if (input.retention != null && input.retention < 60) {
    cards.push({
      id: 'retention',
      title: 'A short revision would stick',
      body: `The retention forecast is ${input.retention}%. A short session on last week’s work is worth more than a new topic today.`,
      metricId: 'retention_forecast',
      suggestedGoal: { title: 'Revise last week’s weakest topic for 25 minutes', category: 'revision', estimateMinutes: 25 },
    });
  }
  if (input.cramming != null && input.cramming >= 40) {
    cards.push({
      id: 'cramming',
      title: 'Study is bunching up before deadlines',
      body: `${input.cramming}% of study time landed in the day before a deadline. Splitting that into shorter sessions usually holds better.`,
      metricId: 'cramming',
      suggestedGoal: { title: 'Two 20-minute sessions on separate days', category: 'study', estimateMinutes: 20 },
    });
  }
  if (input.weakBloom) {
    const label = BLOOM_LABELS[input.weakBloom];
    cards.push({
      id: `bloom-${input.weakBloom}`,
      title: `${label} is the thin slice`,
      body: `Quiz results are weakest at “${label}” on Bloom’s taxonomy. One practice set aimed at that level will move the understanding score.`,
      metricId: 'understanding',
      suggestedGoal: { title: `Practice one ${label.toLowerCase()} question set`, category: 'practice', estimateMinutes: 30 },
    });
  }
  if (input.streak === 0 && input.goalCompletion != null && input.goalCompletion < 100) {
    cards.push({
      id: 'streak',
      title: 'Start a small streak',
      body: 'There is no current streak. A single finished goal today starts one. The server adds a Sparks bonus from the third day.',
      metricId: 'streak',
      suggestedGoal: { title: 'Finish one short goal today', category: 'study', estimateMinutes: 15 },
    });
  }
  if (input.readiness != null && input.readiness < 70) {
    cards.push({
      id: 'readiness',
      title: 'Exam readiness is still building',
      body: `Readiness is ${input.readiness}%. A mixed practice session — one recall question and one applied question — is the fastest lift.`,
      metricId: 'exam_readiness',
      suggestedGoal: { title: 'Mixed practice: recall plus one applied question', category: 'practice', estimateMinutes: 30 },
    });
  }
  return cards.slice(0, 4);
}

export function weakestBloom(radar: { level: BloomLevel; score: number | null }[]): BloomLevel | null {
  const scored = radar.filter(r => r.score != null) as { level: BloomLevel; score: number }[];
  if (!scored.length) return null;
  return scored.reduce((low, row) => (row.score < low.score ? row : low)).level;
}

export function inDateRange(iso: string | undefined, start: string, end: string): boolean {
  if (!iso) return false;
  const day = iso.slice(0, 10);
  if (day.length < 10) return false;
  const t = parseDateKey(day).getTime();
  return t >= parseDateKey(start).getTime() && t <= parseDateKey(end).getTime();
}
