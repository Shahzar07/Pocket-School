/**
 * Learner helpers shared by the catalogue, the course page, and My Courses.
 * Dates are YYYY-MM-DD so a streak does not depend on the clock inside a query.
 */

export interface CatalogItem {
  id: string;
  title: string;
  description?: string | null;
  subject?: string | null;
  level?: string | null;
  price?: number | null;
  tags?: string[] | null;
}

export interface CatalogQuery {
  q?: string;
  subject?: string;
  level?: string;
  maxPrice?: number | null;
}

export function filterCatalog<T extends CatalogItem>(items: readonly T[], query: CatalogQuery): T[] {
  const q = (query.q ?? '').trim().toLowerCase();
  const subject = (query.subject ?? '').trim().toLowerCase();
  const level = (query.level ?? '').trim().toLowerCase();
  return items.filter(item => {
    if (subject && subject !== 'all' && (item.subject ?? '').toLowerCase() !== subject) return false;
    if (level && level !== 'all' && !(item.level ?? '').toLowerCase().includes(level)) return false;
    if (typeof query.maxPrice === 'number' && (item.price ?? 0) > query.maxPrice) return false;
    if (!q) return true;
    const hay = `${item.title} ${item.description ?? ''} ${item.subject ?? ''} ${(item.tags ?? []).join(' ')}`.toLowerCase();
    return hay.includes(q);
  });
}

/** Same subject first, then the same level. The current course is left out. */
export function recommend<T extends CatalogItem>(items: readonly T[], current: T, limit = 3): T[] {
  return items
    .filter(item => item.id !== current.id)
    .map(item => ({
      item,
      score: (item.subject && item.subject === current.subject ? 2 : 0) + (item.level && item.level === current.level ? 1 : 0),
    }))
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
    .slice(0, limit)
    .map(row => row.item);
}

export function averageRating(ratings: readonly number[]): number | null {
  const valid = ratings.filter(rating => rating >= 1 && rating <= 5);
  if (valid.length === 0) return null;
  const mean = valid.reduce((sum, rating) => sum + rating, 0) / valid.length;
  return Math.round(mean * 10) / 10;
}

function dayBefore(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/**
 * A streak counts back from today. Activity yesterday still counts, so the
 * streak survives until the end of a day the learner has not opened a lesson.
 */
export function streakFromDates(dates: readonly string[], today: string): { current: number; longest: number } {
  const unique = [...new Set(dates.filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort();
  const set = new Set(unique);
  let longest = 0;
  let run = 0;
  let previous = '';
  for (const date of unique) {
    run = previous && dayBefore(date) === previous ? run + 1 : 1;
    previous = date;
    if (run > longest) longest = run;
  }
  let current = 0;
  let cursor = set.has(today) ? today : dayBefore(today);
  if (!set.has(cursor)) return { current: 0, longest };
  while (set.has(cursor)) {
    current += 1;
    cursor = dayBefore(cursor);
  }
  return { current, longest };
}

export function recordStudyDay(dates: readonly string[], today: string, cap = 400): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return [...dates];
  return [...new Set([...dates, today])].sort().slice(-cap);
}

export interface ResumeLesson {
  id: string;
  title: string;
}

/**
 * The lesson to open next. The last one they opened wins when it is still
 * in the course. Otherwise the first lesson they have not completed.
 */
export function resumeTarget(
  lessons: readonly ResumeLesson[],
  completed: readonly string[],
  lastLessonId?: string | null,
): ResumeLesson | null {
  if (lessons.length === 0) return null;
  if (lastLessonId) {
    const last = lessons.find(lesson => lesson.id === lastLessonId);
    if (last) return last;
  }
  const done = new Set(completed);
  return lessons.find(lesson => !done.has(lesson.id)) ?? lessons[lessons.length - 1];
}

export function toggleBookmark(ids: readonly string[], lessonId: string): string[] {
  return ids.includes(lessonId) ? ids.filter(id => id !== lessonId) : [...ids, lessonId];
}
