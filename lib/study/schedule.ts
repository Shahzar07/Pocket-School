import type { PlanDay, PlanItem, StudyTopic } from './types';

/* Local-date helpers. Plans are in the student's own calendar days, never UTC. */
export function isoDay(d: Date = new Date()): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function parseDay(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export function addDays(s: string, n: number): string {
  const d = parseDay(s);
  d.setDate(d.getDate() + n);
  return isoDay(d);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);
}

const MINUTES = { lesson: 15, quiz: 10, exercises: 15, flashcards: 8, truefalse: 6, podcast: 10, mock: 45 } as const;

function item(topic: StudyTopic | null, kind: PlanItem['kind'], asset: PlanItem['asset'], title: string, suffix = ''): PlanItem {
  return {
    id: (topic ? `${topic.id}:${asset}` : `final:${asset}`) + suffix,
    topicId: topic?.id ?? null,
    kind,
    asset,
    title,
    minutes: MINUTES[asset as keyof typeof MINUTES] ?? 10,
  };
}

/**
 * Build a day-by-day plan that ends the day before the exam.
 *
 * Every topic gets a lesson then a quiz; heavily-weighted topics also get
 * worked exercises. Flashcard review for a topic lands a couple of days after
 * it was learned — spaced, not crammed. The final study day is a full mock
 * exam, and with a week or more there's a consolidation day before it.
 *
 * Item ids are stable (`topic:asset`), so moving the exam date reshuffles the
 * calendar without losing anything the student has already completed.
 */
export function buildSchedule(topics: StudyTopic[], examDate: string, opts: { today?: string; minutesPerDay?: number } = {}): PlanDay[] {
  const today = opts.today ?? isoDay();
  const ordered = [...topics].sort((a, b) => a.order - b.order);
  const total = Math.max(1, daysBetween(today, examDate));
  const days: string[] = Array.from({ length: total }, (_, i) => addDays(today, i));

  const reserveMock = days.length >= 2;
  const reserveConsolidate = days.length >= 7;
  const learnDays = days.length - (reserveMock ? 1 : 0) - (reserveConsolidate ? 1 : 0);

  // With a day or two left there's no time for spacing — learn and test only.
  const cram = days.length <= 2;

  const core: PlanItem[] = [];
  for (const t of ordered) {
    core.push(item(t, 'learn', 'lesson', `Learn: ${t.title}`));
    core.push(item(t, 'practice', 'quiz', `Quiz: ${t.title}`));
    if (t.weight >= 4 && !cram) core.push(item(t, 'practice', 'exercises', `Exercises: ${t.title}`));
  }

  const plan: PlanDay[] = days.map(date => ({ date, items: [] }));
  const totalMinutes = core.reduce((s, i) => s + i.minutes, 0);
  // Spread the work evenly across the time available rather than front-loading
  // it and leaving empty weeks before the exam.
  const budget = Math.max(12, Math.ceil(totalMinutes / Math.max(1, learnDays)));

  const learnedOn: Record<string, number> = {};
  if (learnDays >= ordered.length) {
    // Room for at least a day per topic: space topics evenly across the
    // window, with worked exercises the day after the lesson.
    ordered.forEach((t, i) => {
      const d = Math.floor((i * learnDays) / ordered.length);
      learnedOn[t.id] = d;
      for (const it of core.filter(c => c.topicId === t.id)) {
        const next = it.asset === 'exercises' && d + 1 < learnDays ? d + 1 : d;
        plan[next].items.push(it);
      }
    });
  } else {
    // More topics than days: pack by time, never splitting a lesson from its quiz.
    let day = 0, used = 0;
    for (const it of core) {
      if (it.asset === 'lesson' && used > 0 && used + it.minutes > budget && day < learnDays - 1) { day++; used = 0; }
      plan[day].items.push(it);
      used += it.minutes;
      if (it.asset === 'lesson' && it.topicId) learnedOn[it.topicId] = day;
    }
  }

  // Spaced review two days after learning, inside the learning window when possible.
  const lastReviewDay = Math.max(0, (reserveConsolidate ? learnDays : learnDays - 1));
  if (!cram) {
    for (const t of ordered) {
      const at = Math.min((learnedOn[t.id] ?? 0) + 2, lastReviewDay);
      plan[at].items.push(item(t, 'review', 'flashcards', `Review: ${t.title}`));
      // A second, wider-spaced pass when there's room for it.
      const again = (learnedOn[t.id] ?? 0) + 7;
      if (learnDays >= 10 && again <= lastReviewDay) {
        plan[again].items.push(item(t, 'review', 'flashcards', `Review again: ${t.title}`, ':2'));
      }
    }
  }

  if (reserveConsolidate) {
    const ci = days.length - 2;
    const heavy = [...ordered].sort((a, b) => b.weight - a.weight).slice(0, 3);
    for (const t of heavy) plan[ci].items.push(item(t, 'review', 'truefalse', `True or false: ${t.title}`));
  }
  if (reserveMock) {
    plan[days.length - 1].items.push(item(null, 'mock', 'mock', 'Full mock exam'));
  } else {
    plan[0].items.push(item(null, 'mock', 'mock', 'Quick mock exam'));
  }
  return plan.filter(d => d.items.length);
}

/** Items due today: today's plan plus anything earlier still not done. */
export function dueToday(plan: PlanDay[], completed: Record<string, boolean>, today = isoDay()): { items: PlanItem[]; overdue: number } {
  const items: PlanItem[] = [];
  let overdue = 0;
  for (const d of plan) {
    if (d.date > today) break;
    for (const it of d.items) {
      if (completed[it.id]) continue;
      if (d.date < today) overdue++;
      items.push(it);
    }
  }
  return { items, overdue };
}

/** Next streak value after studying on `today`. */
export function nextStreak(streak: number, lastDay: string | undefined, today = isoDay()): number {
  if (lastDay === today) return Math.max(1, streak);
  if (lastDay && addDays(lastDay, 1) === today) return streak + 1;
  return 1;
}
