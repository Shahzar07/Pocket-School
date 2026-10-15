export interface LessonStatusLike {
  id?: string;
  status?: string | null;
}

/** A lesson counts toward progress when it is published (or has no status, the older default). */
export function isPublishedLesson(lesson: LessonStatusLike): boolean {
  return !lesson.status || lesson.status === 'published';
}

/**
 * One list for the catalogue, the course page and the progress percentage.
 * Curriculum drafts stay visible as "coming soon" but are not part of the percentage.
 */
export function splitLessons<T extends LessonStatusLike>(lessons: readonly T[], kind?: string | null): {
  published: T[];
  upcoming: T[];
} {
  const published = lessons.filter(isPublishedLesson);
  const upcoming = kind === 'curriculum' ? lessons.filter((l) => !isPublishedLesson(l)) : [];
  return { published, upcoming };
}

/** Whole-number percentage. Empty courses are 0, never NaN. */
export function progressPercent(completedCount: number, totalLessons: number): number {
  if (totalLessons <= 0 || completedCount <= 0) return 0;
  return Math.min(100, Math.round((completedCount / totalLessons) * 100));
}

/** How many of `completedIds` sit in the published list. */
export function countCompleted(completedIds: ReadonlySet<string> | readonly string[], published: readonly { id?: string }[]): number {
  const ids = completedIds instanceof Set ? completedIds : new Set(completedIds);
  return published.filter((l) => l.id && ids.has(l.id)).length;
}
