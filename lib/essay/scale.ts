/** ET AI Essay Writer marks. 9–1 plus U, with the letter a school report would show. */

export interface EssayGrade {
  mark: number;
  level: number | 'U';
  letter: string;
}

const BANDS: { min: number; level: number | 'U'; letter: string }[] = [
  { min: 90, level: 9, letter: 'A*' },
  { min: 80, level: 8, letter: 'A*' },
  { min: 70, level: 7, letter: 'A' },
  { min: 60, level: 6, letter: 'B' },
  { min: 50, level: 5, letter: 'C' },
  { min: 40, level: 4, letter: 'C' },
  { min: 30, level: 3, letter: 'D' },
  { min: 20, level: 2, letter: 'E' },
  { min: 10, level: 1, letter: 'F' },
  { min: 0, level: 'U', letter: 'U' },
];

export function gradeFromMark(raw: number): EssayGrade {
  const mark = Number.isFinite(raw) ? Math.max(0, Math.min(100, Math.round(raw))) : 0;
  const band = BANDS.find((row) => mark >= row.min) ?? BANDS[BANDS.length - 1]!;
  return { mark, level: band.level, letter: band.letter };
}
