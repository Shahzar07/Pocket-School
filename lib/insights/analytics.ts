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
  attempts?: number;
  seconds?: number;
  courseId?: string;
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

export interface TopicMastery {
  topic: string;
  score: number;
  confidence: number;
  attempts: number;
  weighted: number;
}

/** Latest scores count more when the student has tried the topic more than once. */
export function confidenceMastery(points: QuizPoint[]): TopicMastery[] {
  const groups = new Map<string, { scores: number[]; attempts: number }>();
  for (const point of points) {
    const topic = (point.topic || point.unitId || '').trim();
    const score = percentOf(point.score, point.max);
    if (!topic || score == null) continue;
    const row = groups.get(topic) ?? { scores: [], attempts: 0 };
    row.scores.push(score);
    row.attempts += point.attempts && point.attempts > 0 ? point.attempts : 1;
    groups.set(topic, row);
  }
  return [...groups.entries()].map(([topic, row]) => {
    const score = clampPercent(row.scores.reduce((sum, value) => sum + value, 0) / row.scores.length);
    const confidence = clampPercent((Math.min(row.attempts, 3) / 3) * 100);
    return {
      topic,
      score,
      confidence,
      attempts: row.attempts,
      weighted: clampPercent((score * confidence) / 100),
    };
  });
}

export function weightedMastery(rows: TopicMastery[]): number | null {
  const weight = rows.reduce((sum, row) => sum + row.confidence, 0);
  if (weight <= 0) return null;
  return clampPercent(rows.reduce((sum, row) => sum + row.score * row.confidence, 0) / weight);
}

export function strengthsAndWeaknesses(rows: TopicMastery[]): { strengths: string[]; weaknesses: string[] } {
  const ranked = [...rows].sort((a, b) => b.weighted - a.weighted);
  return {
    strengths: ranked.filter(row => row.score >= 70).slice(0, 3).map(row => row.topic),
    weaknesses: [...ranked].reverse().filter(row => row.score < 70).slice(0, 3).map(row => row.topic),
  };
}

export interface StudyBar {
  label: string;
  minutes: number;
}

export function studySeries(events: StudyEvent[], start: string, end: string): StudyBar[] {
  const keys = dateKeysBetween(start, end);
  const totals = new Map(keys.map(key => [key, 0]));
  for (const event of events) {
    const key = event.at?.slice(0, 10);
    if (key && totals.has(key)) totals.set(key, (totals.get(key) ?? 0) + Math.max(0, event.minutes));
  }
  return keys.map(label => ({ label, minutes: totals.get(label) ?? 0 }));
}

export function weeklyStudySeries(series: StudyBar[]): StudyBar[] {
  const buckets = new Map<string, number>();
  for (const row of series) {
    const week = row.label.slice(0, 8) + String(Math.ceil(Number(row.label.slice(8)) / 7)).padStart(2, '0');
    buckets.set(week, (buckets.get(week) ?? 0) + row.minutes);
  }
  return [...buckets.entries()].map(([label, minutes]) => ({ label, minutes }));
}

export function bestStudySlot(grid: number[][]): { day: string; hour: number; minutes: number } | null {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  let bestDay = '';
  let bestHour = 0;
  let bestMinutes = 0;
  grid.forEach((row, day) => {
    row.forEach((minutes, hour) => {
      if (minutes > bestMinutes) {
        bestDay = days[day] ?? 'Sunday';
        bestHour = hour;
        bestMinutes = minutes;
      }
    });
  });
  if (bestMinutes <= 0) return null;
  return { day: bestDay, hour: bestHour, minutes: bestMinutes };
}

export function averageSession(events: StudyEvent[]): number | null {
  const sessions = events.map(event => event.minutes).filter(minutes => minutes > 0);
  if (!sessions.length) return null;
  return Math.round(sessions.reduce((sum, minutes) => sum + minutes, 0) / sessions.length);
}

export function questionPace(points: QuizPoint[]): { attempts: number | null; seconds: number | null } {
  const attempts = points.map(point => point.attempts).filter((value): value is number => typeof value === 'number' && value > 0);
  const seconds = points.map(point => point.seconds).filter((value): value is number => typeof value === 'number' && value > 0);
  return {
    attempts: attempts.length ? Math.round((attempts.reduce((sum, value) => sum + value, 0) / attempts.length) * 10) / 10 : null,
    seconds: seconds.length ? Math.round(seconds.reduce((sum, value) => sum + value, 0) / seconds.length) : null,
  };
}

export function paceVersusPlan(studiedMinutes: number, plannedMinutes: number): number | null {
  if (plannedMinutes <= 0) return null;
  return clampPercent((studiedMinutes / plannedMinutes) * 100);
}

/** Courses that stall, and days where study time falls sharply. */
export function dropOffPoints(courses: { label: string; progress: number }[], series: StudyBar[]): string[] {
  const stalled = [...courses]
    .filter(course => course.progress > 0 && course.progress < 100)
    .sort((a, b) => a.progress - b.progress)
    .slice(0, 3)
    .map(course => `${course.label} stops at ${course.progress}%`);
  const dips: string[] = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1]?.minutes ?? 0;
    const cur = series[i]?.minutes ?? 0;
    if (prev >= 20 && cur <= prev * 0.4) dips.push(`${series[i]?.label ?? ''} fell to ${cur} min`);
  }
  return [...stalled, ...dips].slice(0, 4);
}

export interface BloomTopicBar {
  topic: string;
  remember: number;
  understand: number;
  apply: number;
  analyse: number;
  evaluate: number;
  create: number;
}

export function bloomByTopic(points: QuizPoint[]): BloomTopicBar[] {
  const groups = new Map<string, QuizPoint[]>();
  for (const point of points) {
    const topic = (point.topic || point.unitId || 'General').trim();
    const list = groups.get(topic) ?? [];
    list.push(point);
    groups.set(topic, list);
  }
  return [...groups.entries()].slice(0, 6).map(([topic, rows]) => {
    const bar = { topic, remember: 0, understand: 0, apply: 0, analyse: 0, evaluate: 0, create: 0 };
    for (const level of BLOOM_LEVELS) {
      const score = quizAverage(rows.filter(point => (point.bloom ?? (point.prompt ? tagBloom(point.prompt) : undefined)) === level));
      bar[level] = score ?? 0;
    }
    return bar;
  });
}

const ACTION_FILLERS: InsightCard[] = [
  {
    id: 'fill-lesson',
    title: 'Finish one lesson',
    body: 'A single finished lesson keeps the week moving.',
    metricId: 'study_time',
    suggestedGoal: { title: 'Finish one lesson', category: 'study', estimateMinutes: 20 },
  },
  {
    id: 'fill-notes',
    title: 'Review yesterday’s notes',
    body: 'A short look back is the spaced-repetition step.',
    metricId: 'retention_forecast',
    suggestedGoal: { title: 'Review yesterday’s notes for 15 minutes', category: 'revision', estimateMinutes: 15 },
  },
  {
    id: 'fill-quiz',
    title: 'Answer one quiz question',
    body: 'One question shows whether the topic is still there.',
    metricId: 'quiz_average',
    suggestedGoal: { title: 'Answer one quiz question', category: 'practice', estimateMinutes: 10 },
  },
];

export function threeActions(cards: InsightCard[]): InsightCard[] {
  const actions = [...cards];
  for (const filler of ACTION_FILLERS) {
    if (actions.length >= 3) break;
    if (!actions.some(card => card.id === filler.id)) actions.push(filler);
  }
  return actions.slice(0, 3);
}

export function weeklySummary(cards: InsightCard[], readiness: number | null): { text: string; actions: InsightCard[] } {
  const actions = threeActions(cards);
  const lead = readiness != null
    ? `This week’s picture: exam readiness is ${readiness}%.`
    : 'This week’s picture is still forming.';
  const next = actions.map((action, index) => `${index + 1}. ${action.title}`).join(' ');
  return { text: `${lead} ${next}`, actions };
}

export function digestHeadlines(metrics: Record<string, number | null | undefined>): string {
  const bits: string[] = [];
  if (typeof metrics.study_time === 'number') bits.push(`${metrics.study_time} min in the saved totals`);
  if (typeof metrics.quiz_average === 'number') bits.push(`quiz average ${metrics.quiz_average}%`);
  if (typeof metrics.mastery === 'number') bits.push(`mastery ${metrics.mastery}%`);
  if (typeof metrics.exam_readiness === 'number') bits.push(`exam readiness ${metrics.exam_readiness}%`);
  if (typeof metrics.streak === 'number') bits.push(`streak ${metrics.streak} days`);
  if (typeof metrics.goal_completion === 'number') bits.push(`goals met ${metrics.goal_completion}%`);
  if (typeof metrics.sparks_earned === 'number') bits.push(`${metrics.sparks_earned} Sparks earned`);
  if (!bits.length) return '';
  return ` Headlines: ${bits.join(', ')}.`;
}

export function withBloomTags<T extends {
  flashcards?: { question: string; answer: string; bloom?: string }[];
  quiz?: { question: string; bloom?: string; explanation?: string }[];
}>(outputs: T): Omit<T, 'flashcards' | 'quiz'> & {
  flashcards?: (NonNullable<T['flashcards']>[number] & { bloom: string })[];
  quiz?: (NonNullable<T['quiz']>[number] & { bloom: string })[];
} {
  return {
    ...outputs,
    flashcards: outputs.flashcards?.map(card => ({
      ...card,
      bloom: card.bloom || tagBloom(`${card.question} ${card.answer}`),
    })),
    quiz: outputs.quiz?.map(item => ({
      ...item,
      bloom: item.bloom || tagBloom(`${item.question} ${item.explanation ?? ''}`),
    })),
  };
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
