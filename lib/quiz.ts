import { correctIndex } from '@/lib/quiz-answer';

/** Stable id for an option. Scoring uses this, never the translated label. */
export function optionId(index: number): string {
  return `opt:${index}`;
}

export function optionIndex(id: string | undefined, length: number): number {
  const match = /^opt:(\d+)$/.exec((id ?? '').trim());
  if (!match) return -1;
  const index = Number(match[1]);
  return Number.isInteger(index) && index >= 0 && index < length ? index : -1;
}

export function correctOptionId(options: readonly string[], answer: string | undefined): string | null {
  const index = correctIndex([...options], answer ?? '');
  return index >= 0 ? optionId(index) : null;
}

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
  const selectedIndex = optionIndex(selected, options.length);
  if (selectedIndex >= 0) return optionId(selectedIndex) === correctOptionId(options, answer);
  const sel = (selected ?? '').trim().toLowerCase();
  let ans = (answer ?? '').trim();
  if (/^[A-D]$/i.test(ans)) {
    const mapped = options[ans.toUpperCase().charCodeAt(0) - 65];
    if (mapped != null) ans = mapped;
  }
  return sel !== '' && sel === ans.trim().toLowerCase();
}
