export interface GradeBoundary {
  grade: string;
  minPercent: number;
}

/** IGCSE-style boundaries used until a board publishes its own. */
export const DEFAULT_BOUNDARIES: GradeBoundary[] = [
  { grade: 'A*', minPercent: 90 },
  { grade: 'A', minPercent: 80 },
  { grade: 'B', minPercent: 70 },
  { grade: 'C', minPercent: 60 },
  { grade: 'D', minPercent: 50 },
  { grade: 'E', minPercent: 40 },
  { grade: 'U', minPercent: 0 },
];

export function predictedGrade(score: number, maxScore: number, boundaries: GradeBoundary[] = DEFAULT_BOUNDARIES): string {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0 || score < 0) return 'U';
  const percent = Math.min(100, (score / maxScore) * 100);
  const ordered = [...boundaries].sort((a, b) => b.minPercent - a.minPercent);
  return ordered.find((b) => percent >= b.minPercent)?.grade ?? 'U';
}

export interface PaperQuestion {
  id: string;
  prompt: string;
  marks: number;
  answer: string;
}

export function scoreAttempt(
  questions: PaperQuestion[],
  answers: Record<string, string>,
): { score: number; maxScore: number } {
  let score = 0;
  let maxScore = 0;
  for (const question of questions) {
    const marks = Number.isFinite(question.marks) && question.marks > 0 ? question.marks : 0;
    maxScore += marks;
    const given = (answers[question.id] ?? '').trim().toLowerCase();
    if (given && given === question.answer.trim().toLowerCase()) score += marks;
  }
  return { score, maxScore };
}

export function mockStillOpen(nowMs: number, endsAtMs: number): boolean {
  return nowMs <= endsAtMs;
}
