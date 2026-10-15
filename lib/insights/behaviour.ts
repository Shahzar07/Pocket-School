import { clampPercent } from './metrics';
import { startedLate, type GoalLike } from './goals';
import { consistencyScore, studyMinutes, type StudyEvent } from './analytics';

export interface FocusSessionLike {
  plannedMinutes: number;
  actualMinutes: number;
}

export interface DeadlineLike {
  atMs: number;
}

export function focusAdherence(sessions: FocusSessionLike[]): number | null {
  const planned = sessions.reduce((sum, s) => sum + Math.max(0, s.plannedMinutes), 0);
  if (planned <= 0) return null;
  const actual = sessions.reduce((sum, s) => sum + Math.max(0, s.actualMinutes), 0);
  return clampPercent((actual / planned) * 100);
}

/** Minutes of study that fall in the 24 hours before any deadline. */
export function crammingShare(events: StudyEvent[], deadlines: DeadlineLike[]): number | null {
  const total = studyMinutes(events);
  if (total <= 0 || deadlines.length === 0) return null;
  let near = 0;
  for (const event of events) {
    if (!event.at) continue;
    const t = new Date(event.at).getTime();
    if (Number.isNaN(t)) continue;
    const close = deadlines.some(d => t <= d.atMs && d.atMs - t <= 86_400_000 && d.atMs - t >= 0);
    if (close) near += Math.max(0, event.minutes);
  }
  return clampPercent((near / total) * 100);
}

export function procrastinationShare(goals: GoalLike[]): number | null {
  const started = goals.filter(g => g.startedAtMs);
  if (!started.length) return null;
  const late = started.filter(g => startedLate(g)).length;
  return clampPercent((late / started.length) * 100);
}

export type Quadrant = 'engaged-strong' | 'engaged-developing' | 'quiet-strong' | 'needs-attention';

export function engagementQuadrant(study: number | null, performance: number | null): Quadrant | null {
  if (study == null || performance == null) return null;
  const engaged = study >= 60;
  const strong = performance >= 70;
  if (engaged && strong) return 'engaged-strong';
  if (engaged && !strong) return 'engaged-developing';
  if (!engaged && strong) return 'quiet-strong';
  return 'needs-attention';
}

export const QUADRANT_LABELS: Record<Quadrant, string> = {
  'engaged-strong': 'Engaged and strong',
  'engaged-developing': 'Engaged, still developing',
  'quiet-strong': 'Strong, studying quietly',
  'needs-attention': 'Needs a closer look',
};

export interface Anomaly {
  id: string;
  title: string;
  detail: string;
  severity: 'info' | 'watch' | 'alert';
  /** Which parent/teacher push preference this maps to. */
  pref: 'behaviour' | 'streaks' | 'attendance' | 'integrity';
}

export function behaviourAnomalies(input: {
  studyNow: number | null;
  studyPrevious: number | null;
  streakBroken: boolean;
  absenceRun: number;
  cramming: number | null;
  integrityOpen: boolean;
}): Anomaly[] {
  const out: Anomaly[] = [];
  if (input.studyPrevious != null && input.studyPrevious >= 30 && input.studyNow != null) {
    if (input.studyNow < input.studyPrevious * 0.5) {
      out.push({
        id: 'study-drop',
        title: 'Study time dropped',
        detail: `Study time is ${input.studyNow} minutes, under half of the previous ${input.studyPrevious} minutes.`,
        severity: 'watch',
        pref: 'behaviour',
      });
    }
  }
  if (input.streakBroken) {
    out.push({
      id: 'streak-break',
      title: 'Goal streak broke',
      detail: 'A day with unfinished goals ended the streak.',
      severity: 'info',
      pref: 'streaks',
    });
  }
  if (input.absenceRun >= 2) {
    out.push({
      id: 'absence-run',
      title: 'Repeated absence',
      detail: `${input.absenceRun} absences in a row, not counting holidays or excused days.`,
      severity: 'alert',
      pref: 'attendance',
    });
  }
  if (input.cramming != null && input.cramming >= 60) {
    out.push({
      id: 'cramming',
      title: 'Cramming pattern',
      detail: `${input.cramming}% of study time sits in the day before a deadline.`,
      severity: 'watch',
      pref: 'behaviour',
    });
  }
  if (input.integrityOpen) {
    out.push({
      id: 'integrity',
      title: 'Integrity case open',
      detail: 'A teacher is reviewing an integrity case. No mark changes until they decide.',
      severity: 'alert',
      pref: 'integrity',
    });
  }
  return out;
}

export function consistencyFromDaily(daily: number[]): number | null {
  return consistencyScore(daily);
}

export type Mood = 1 | 2 | 3 | 4 | 5;

export const MOOD_LABELS: Record<Mood, string> = {
  1: 'Heavy',
  2: 'Low',
  3: 'Okay',
  4: 'Good',
  5: 'Bright',
};

export const MOOD_EMOJI: Record<Mood, string> = {
  1: '😔',
  2: '😕',
  3: '😐',
  4: '🙂',
  5: '😄',
};
