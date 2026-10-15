/** Reading time on a parent report. Minutes already exclude quiet hours. */
export interface ParentReadingReport {
  studentId: string;
  period: string;
  readingMinutes: number;
  booksFinished: number;
}

export function parentReadingReport(input: {
  studentId: string;
  period: string;
  readingMinutes: number;
  booksFinished: number;
}): ParentReadingReport {
  return {
    studentId: input.studentId,
    period: input.period,
    readingMinutes: Math.max(0, Math.round(input.readingMinutes)),
    booksFinished: Math.max(0, Math.round(input.booksFinished)),
  };
}

export function booksFinishedFromProgress(progress: Record<string, { percent?: number }>): number {
  return Object.values(progress).filter(item => (item.percent ?? 0) >= 100).length;
}
