/** Fisher–Yates shuffle. Returns a new array; the input is left unchanged. */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const current = copy[i];
    copy[i] = copy[j] as T;
    copy[j] = current as T;
  }
  return copy;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer?: string;
  explanation?: string;
  objectiveCode?: string;
  sourceLessonId?: string;
}

/** Shuffle each question's options. Grading compares option text, so order does not matter. */
export function shuffleQuizOptions<Q extends { options: readonly string[] }>(
  questions: readonly Q[],
  rng: () => number = Math.random,
): Q[] {
  return questions.map((q) => ({ ...q, options: shuffle(q.options, rng) }));
}

/**
 * Compare a selected option to the stored answer.
 * Legacy quizzes stored a letter ("B"); map that to the option at that index.
 */
export function answersMatch(
  selected: string | undefined,
  answer: string | undefined,
  options: readonly string[] = [],
): boolean {
  const sel = (selected ?? '').trim().toLowerCase();
  let ans = (answer ?? '').trim();
  if (/^[A-D]$/i.test(ans)) {
    const mapped = options[ans.toUpperCase().charCodeAt(0) - 65];
    if (mapped != null) ans = mapped;
  }
  return sel !== '' && sel === ans.trim().toLowerCase();
}
