import type { GradeScaleId } from './types';

/**
 * Grade boundaries, highest first. These are typical published boundaries;
 * real ones move a little each sitting, so the estimate is labelled as one.
 */
export const GRADE_SCALES: Record<GradeScaleId, { label: string; grades: { grade: string; min: number }[] }> = {
  spm: {
    label: 'SPM',
    grades: [
      { grade: 'A+', min: 90 }, { grade: 'A', min: 80 }, { grade: 'A-', min: 70 },
      { grade: 'B+', min: 65 }, { grade: 'B', min: 60 }, { grade: 'C+', min: 55 },
      { grade: 'C', min: 50 }, { grade: 'D', min: 45 }, { grade: 'E', min: 40 }, { grade: 'G', min: 0 },
    ],
  },
  igcse: {
    label: 'IGCSE',
    grades: [
      { grade: 'A*', min: 85 }, { grade: 'A', min: 75 }, { grade: 'B', min: 65 }, { grade: 'C', min: 55 },
      { grade: 'D', min: 45 }, { grade: 'E', min: 35 }, { grade: 'F', min: 25 }, { grade: 'G', min: 15 }, { grade: 'U', min: 0 },
    ],
  },
  alevel: {
    label: 'A Level',
    grades: [
      { grade: 'A*', min: 85 }, { grade: 'A', min: 75 }, { grade: 'B', min: 65 },
      { grade: 'C', min: 55 }, { grade: 'D', min: 45 }, { grade: 'E', min: 35 }, { grade: 'U', min: 0 },
    ],
  },
  ib: {
    label: 'IB',
    grades: [
      { grade: '7', min: 80 }, { grade: '6', min: 67 }, { grade: '5', min: 54 }, { grade: '4', min: 41 },
      { grade: '3', min: 28 }, { grade: '2', min: 15 }, { grade: '1', min: 0 },
    ],
  },
  percent: {
    label: 'Percentage',
    grades: [
      { grade: 'A', min: 80 }, { grade: 'B', min: 70 }, { grade: 'C', min: 60 },
      { grade: 'D', min: 50 }, { grade: 'E', min: 40 }, { grade: 'F', min: 0 },
    ],
  },
};

export function gradeFor(scale: GradeScaleId, percent: number): string {
  const s = GRADE_SCALES[scale] ?? GRADE_SCALES.percent;
  return (s.grades.find(g => percent >= g.min) ?? s.grades[s.grades.length - 1]).grade;
}

/** The percentage needed for a grade on a scale. */
export function scoreForGrade(scale: GradeScaleId, grade: string): number {
  const s = GRADE_SCALES[scale] ?? GRADE_SCALES.percent;
  return s.grades.find(g => g.grade === grade)?.min ?? 70;
}

/** Topic-weighted average mastery — the basis of the estimated grade. */
export function weightedMastery(
  topics: { id: string; weight: number }[],
  mastery: Record<string, number>,
): number {
  let num = 0, den = 0;
  for (const t of topics) {
    const w = Math.max(1, t.weight || 1);
    num += w * (mastery[t.id] ?? 0);
    den += w;
  }
  return den ? Math.round(num / den) : 0;
}
