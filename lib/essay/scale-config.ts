/**
 * Marking scales for ET AI Essay Writer.
 *
 * These are ET AI working bands for an estimate. They are not Pearson,
 * Cambridge, a university, or any other board's published grade boundaries.
 */
import { LEARNER_LEVELS, resolveLevel, levelLabel as sharedLevelLabel, type LevelId } from '@/lib/levels';
import { gradeFromMark } from './scale';

export const ESTIMATE_LABEL = 'ET AI estimate, not an official grade' as const;

export const ESSAY_LEVELS = LEARNER_LEVELS;

export type EssayLevelId = LevelId;

/** Older writer rows stored `degree`. Marking treats that as undergraduate. */
export function toEssayLevelId(value: string | null | undefined): EssayLevelId {
  return resolveLevel(value) ?? 'igcse';
}

export const WRITING_TYPES = [
  { id: 'narrative', label: 'Narrative' },
  { id: 'descriptive', label: 'Descriptive' },
  { id: 'persuasive', label: 'Persuasive' },
  { id: 'argumentative', label: 'Argumentative' },
  { id: 'discursive', label: 'Discursive' },
  { id: 'letter-article', label: 'Letter or article' },
  { id: 'report', label: 'Report' },
  { id: 'literature-analysis', label: 'Literature analysis' },
  { id: 'extended-response', label: 'Extended response' },
  { id: 'lab-report', label: 'Lab report' },
  { id: 'case-study', label: 'Case study' },
  { id: 'research-essay', label: 'Research essay' },
  { id: 'literature-review', label: 'Literature review' },
  { id: 'reflective', label: 'Reflective essay' },
  { id: 'dissertation', label: 'Dissertation chapter or abstract' },
  { id: 'proposal', label: 'Research proposal' },
] as const;

export type WritingTypeId = (typeof WRITING_TYPES)[number]['id'];

const TYPES_BY_LEVEL: Record<EssayLevelId, readonly WritingTypeId[]> = {
  primary: ['narrative', 'descriptive', 'persuasive', 'letter-article', 'report'],
  'lower-secondary': ['narrative', 'descriptive', 'persuasive', 'letter-article', 'report'],
  'upper-secondary': ['narrative', 'descriptive', 'persuasive', 'letter-article', 'report', 'argumentative', 'discursive'],
  igcse: ['narrative', 'descriptive', 'persuasive', 'letter-article', 'report', 'argumentative', 'discursive', 'literature-analysis', 'extended-response'],
  'a-level': ['argumentative', 'discursive', 'literature-analysis', 'extended-response', 'report', 'lab-report', 'reflective'],
  'pre-university': ['argumentative', 'discursive', 'literature-analysis', 'extended-response', 'report', 'lab-report', 'reflective'],
  undergraduate: ['argumentative', 'report', 'literature-analysis', 'lab-report', 'case-study', 'research-essay', 'literature-review', 'reflective'],
  masters: ['research-essay', 'literature-review', 'case-study', 'lab-report', 'reflective', 'dissertation', 'proposal'],
  phd: ['dissertation', 'proposal', 'literature-review', 'research-essay'],
  professional: ['report', 'case-study', 'reflective', 'letter-article', 'research-essay'],
  independent: ['narrative', 'descriptive', 'persuasive', 'argumentative', 'report', 'reflective', 'letter-article'],
};

export const REFERENCING_STYLES = [
  { id: 'apa', label: 'APA' },
  { id: 'harvard', label: 'Harvard' },
  { id: 'mla', label: 'MLA' },
  { id: 'oscola', label: 'OSCOLA for Law' },
  { id: 'chicago', label: 'Chicago' },
] as const;

export type ReferencingStyleId = (typeof REFERENCING_STYLES)[number]['id'];
export type DegreeStyle = 'uk' | 'cgpa';

export const LOWER_CRITERIA = [
  { id: 'content', label: 'Content' },
  { id: 'structure', label: 'Structure' },
  { id: 'language', label: 'Language' },
  { id: 'spag', label: 'SPaG' },
] as const;

export const HIGHER_CRITERIA = [
  { id: 'argument', label: 'Argument and thesis' },
  { id: 'analysis', label: 'Critical analysis' },
  { id: 'evidence', label: 'Use of evidence and sources' },
  { id: 'structure', label: 'Structure' },
  { id: 'style', label: 'Academic style' },
  { id: 'referencing', label: 'Referencing accuracy' },
  { id: 'originality', label: 'Originality' },
] as const;

export const RESEARCH_CRITERIA = [
  { id: 'question', label: 'Research question clarity' },
  { id: 'literature', label: 'Literature engagement' },
  { id: 'methodology', label: 'Methodology' },
  { id: 'contribution', label: 'Contribution' },
] as const;

/** Primary and lower secondary. Working bands, plus a percentage. */
export const SCHOOL_BANDS = [
  { min: 75, id: 'greater-depth', label: 'Greater depth' },
  { min: 45, id: 'expected', label: 'Expected' },
  { min: 0, id: 'working-towards', label: 'Working towards' },
] as const;

/** A-Level and pre-university. Even working bands, not a board's boundaries. */
export const ALEVEL_BANDS = [
  { min: 90, id: 'a-star', label: 'A*' },
  { min: 80, id: 'a', label: 'A' },
  { min: 70, id: 'b', label: 'B' },
  { min: 60, id: 'c', label: 'C' },
  { min: 50, id: 'd', label: 'D' },
  { min: 40, id: 'e', label: 'E' },
  { min: 0, id: 'below-e', label: 'Below E' },
] as const;

/** Usual UK percentage bands. Universities differ, so this stays an estimate. */
export const UK_DEGREE_BANDS = [
  { min: 70, id: 'first', label: 'First', range: '70–100' },
  { min: 60, id: 'two-one', label: '2:1', range: '60–69' },
  { min: 50, id: 'two-two', label: '2:2', range: '50–59' },
  { min: 40, id: 'third', label: 'Third', range: '40–49' },
  { min: 0, id: 'fail', label: 'Fail', range: 'below 40' },
] as const;

/**
 * A common Malaysian undergraduate CGPA-style table.
 * It is not one university's transcript scale.
 */
export const CGPA_BANDS = [
  { min: 80, id: '4.00', point: '4.00', label: 'A' },
  { min: 75, id: '3.67', point: '3.67', label: 'A-' },
  { min: 70, id: '3.33', point: '3.33', label: 'B+' },
  { min: 65, id: '3.00', point: '3.00', label: 'B' },
  { min: 60, id: '2.67', point: '2.67', label: 'B-' },
  { min: 55, id: '2.33', point: '2.33', label: 'C+' },
  { min: 50, id: '2.00', point: '2.00', label: 'C' },
  { min: 45, id: '1.67', point: '1.67', label: 'C-' },
  { min: 40, id: '1.33', point: '1.33', label: 'D+' },
  { min: 35, id: '1.00', point: '1.00', label: 'D' },
  { min: 0, id: '0.00', point: '0.00', label: 'F' },
] as const;

export const MASTERS_BANDS = [
  { min: 70, id: 'distinction', label: 'Distinction', range: '70–100' },
  { min: 60, id: 'merit', label: 'Merit', range: '60–69' },
  { min: 50, id: 'pass', label: 'Pass', range: '50–59' },
  { min: 0, id: 'fail', label: 'Fail', range: 'below 50' },
] as const;

/** Readiness only. The percentage is not shown as a grade. */
export const PHD_BANDS = [
  { min: 75, id: 'ready', label: 'Ready' },
  { min: 50, id: 'minor', label: 'Minor revisions' },
  { min: 0, id: 'major', label: 'Major revisions' },
] as const;

export const PROFESSIONAL_BANDS = [
  { min: 75, id: 'accomplished', label: 'Accomplished' },
  { min: 50, id: 'competent', label: 'Competent' },
  { min: 0, id: 'developing', label: 'Developing' },
] as const;

const WORD_TARGETS: Record<EssayLevelId, number> = {
  primary: 150,
  'lower-secondary': 250,
  'upper-secondary': 350,
  igcse: 400,
  'a-level': 700,
  'pre-university': 800,
  undergraduate: 1500,
  masters: 3000,
  phd: 2000,
  professional: 800,
  independent: 400,
};

export type ScaleFamily = 'school' | 'igcse' | 'alevel' | 'degree' | 'masters' | 'phd' | 'professional';

export interface EssayScaleResult {
  estimateLabel: typeof ESTIMATE_LABEL;
  levelId: EssayLevelId;
  scaleId: ScaleFamily;
  bandId: string;
  headline: string;
  detail: string;
  percentage: number | null;
  showsPercentage: boolean;
  mark: number;
  level: number | string;
  letter: string;
}

export function isEssayLevel(value: string | null | undefined): boolean {
  return resolveLevel(value) !== null;
}

export function levelLabel(id: string | null | undefined): string {
  return sharedLevelLabel(id);
}

export function writingTypeLabel(id: string | null | undefined): string {
  return WRITING_TYPES.find((type) => type.id === id)?.label ?? '';
}

export function referencingLabel(id: string | null | undefined): string {
  return REFERENCING_STYLES.find((style) => style.id === id)?.label ?? '';
}

export function scaleFamily(levelId: EssayLevelId): ScaleFamily {
  if (levelId === 'primary' || levelId === 'lower-secondary' || levelId === 'upper-secondary') return 'school';
  if (levelId === 'igcse') return 'igcse';
  if (levelId === 'a-level' || levelId === 'pre-university') return 'alevel';
  if (levelId === 'undergraduate') return 'degree';
  if (levelId === 'masters') return 'masters';
  if (levelId === 'phd') return 'phd';
  if (levelId === 'independent') return 'professional';
  return 'professional';
}

export function referencingApplies(levelId: string | null | undefined): boolean {
  const id = toEssayLevelId(levelId);
  return id === 'undergraduate' || id === 'masters' || id === 'phd';
}

export function defaultWordTarget(levelId: string | null | undefined): number {
  return WORD_TARGETS[toEssayLevelId(levelId)];
}

export function writingTypesFor(levelId: string | null | undefined): { id: WritingTypeId; label: string }[] {
  const id = toEssayLevelId(levelId);
  return TYPES_BY_LEVEL[id].map((typeId) => {
    const type = WRITING_TYPES.find((item) => item.id === typeId);
    return { id: typeId, label: type?.label ?? typeId };
  });
}

export function coerceWritingType(levelId: EssayLevelId, typeId: string | null | undefined): WritingTypeId {
  const allowed = writingTypesFor(levelId);
  const match = allowed.find((type) => type.id === typeId);
  return match?.id ?? allowed[0]!.id;
}

export function rubricCriteria(text: string | null | undefined): { id: string; label: string }[] | null {
  const lines = String(text ?? '')
    .split(/\n/)
    .map((line) => line.replace(/^[\s\-*•\d.)]+/, '').trim())
    .filter((line) => line.length > 1)
    .slice(0, 12);
  if (!lines.length) return null;
  return lines.map((label, index) => ({ id: `rubric-${index + 1}`, label: label.slice(0, 80) }));
}

export function criteriaFor(levelId: string | null | undefined, rubric?: string | null): { id: string; label: string }[] {
  const custom = rubricCriteria(rubric);
  if (custom) return custom;
  const id = toEssayLevelId(levelId);
  const family = scaleFamily(id);
  if (family === 'school' || family === 'igcse') return [...LOWER_CRITERIA];
  if (family === 'masters' || family === 'phd') return [...HIGHER_CRITERIA, ...RESEARCH_CRITERIA];
  return [...HIGHER_CRITERIA];
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function scaleBlurb(levelId: string | null | undefined, degreeStyle: DegreeStyle = 'uk'): string {
  const family = scaleFamily(toEssayLevelId(levelId));
  if (family === 'school') return 'Working towards, expected, or greater depth, plus a percentage.';
  if (family === 'igcse') return '9 to 1, a percentage, and A* to U.';
  if (family === 'alevel') return 'A* to E, plus a percentage.';
  if (family === 'degree' && degreeStyle === 'cgpa') return 'A CGPA-style estimate, not a university transcript, plus a percentage.';
  if (family === 'degree') return 'UK classification (First, 2:1, 2:2, Third, or Fail) with the percentage band.';
  if (family === 'masters') return 'Distinction, merit, pass, or fail, plus a percentage.';
  if (family === 'phd') return 'Ready, minor revisions, or major revisions. No grade.';
  return 'Accomplished, competent, or developing, plus a percentage.';
}

function clampPercent(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function pickBand<T extends { min: number }>(bands: readonly T[], percent: number): T {
  return bands.find((band) => percent >= band.min) ?? bands[bands.length - 1]!;
}

export function mapEssayScale(
  levelId: string | null | undefined,
  raw: number,
  options?: { degreeStyle?: DegreeStyle },
): EssayScaleResult {
  const id: EssayLevelId = toEssayLevelId(levelId);
  const family = scaleFamily(id);
  const percent = clampPercent(raw);
  const base = {
    estimateLabel: ESTIMATE_LABEL,
    levelId: id,
    scaleId: family,
  };

  if (family === 'igcse') {
    const grade = gradeFromMark(percent);
    return {
      ...base,
      bandId: String(grade.level),
      headline: `Level ${grade.level} · ${grade.letter}`,
      detail: '9 to 1, a percentage, and A* to U.',
      percentage: grade.mark,
      showsPercentage: true,
      mark: grade.mark,
      level: grade.level,
      letter: grade.letter,
    };
  }

  if (family === 'phd') {
    const band = pickBand(PHD_BANDS, percent);
    return {
      ...base,
      bandId: band.id,
      headline: band.label,
      detail: 'Readiness only. No grade is given.',
      percentage: null,
      showsPercentage: false,
      mark: 0,
      level: band.label,
      letter: '',
    };
  }

  if (family === 'school') {
    const band = pickBand(SCHOOL_BANDS, percent);
    return {
      ...base,
      bandId: band.id,
      headline: band.label,
      detail: 'Working towards, expected, or greater depth.',
      percentage: percent,
      showsPercentage: true,
      mark: percent,
      level: band.label,
      letter: '',
    };
  }

  if (family === 'alevel') {
    const band = pickBand(ALEVEL_BANDS, percent);
    return {
      ...base,
      bandId: band.id,
      headline: band.label,
      detail: 'A* to E, plus a percentage.',
      percentage: percent,
      showsPercentage: true,
      mark: percent,
      level: band.label,
      letter: band.label,
    };
  }

  if (family === 'degree' && options?.degreeStyle === 'cgpa') {
    const band = pickBand(CGPA_BANDS, percent);
    return {
      ...base,
      scaleId: 'degree',
      bandId: band.id,
      headline: band.point,
      detail: `CGPA-style estimate, not a university transcript · ${band.label}`,
      percentage: percent,
      showsPercentage: true,
      mark: percent,
      level: band.point,
      letter: band.label,
    };
  }

  if (family === 'degree') {
    const band = pickBand(UK_DEGREE_BANDS, percent);
    return {
      ...base,
      bandId: band.id,
      headline: band.label,
      detail: `Percentage band ${band.range}`,
      percentage: percent,
      showsPercentage: true,
      mark: percent,
      level: band.label,
      letter: '',
    };
  }

  if (family === 'masters') {
    const band = pickBand(MASTERS_BANDS, percent);
    return {
      ...base,
      bandId: band.id,
      headline: band.label,
      detail: `Percentage band ${band.range}`,
      percentage: percent,
      showsPercentage: true,
      mark: percent,
      level: band.label,
      letter: '',
    };
  }

  const band = pickBand(PROFESSIONAL_BANDS, percent);
  return {
    ...base,
    bandId: band.id,
    headline: band.label,
    detail: 'Accomplished, competent, or developing.',
    percentage: percent,
    showsPercentage: true,
    mark: percent,
    level: band.label,
    letter: '',
  };
}

export function essayWriterHref(task: {
  essayLevel?: string;
  essayType?: string;
  essayRubric?: string;
  essaySubject?: string;
  essayBoard?: string;
  essayWordTarget?: number;
  essayReferencing?: string;
  essayDegreeStyle?: string;
}, base = '/dashboard/student/essay'): string {
  const params = new URLSearchParams();
  if (task.essayLevel) params.set('level', task.essayLevel);
  if (task.essayType) params.set('type', task.essayType);
  if (task.essayRubric) params.set('rubric', task.essayRubric.slice(0, 2000));
  if (task.essaySubject) params.set('subject', task.essaySubject.slice(0, 120));
  if (task.essayBoard) params.set('board', task.essayBoard.slice(0, 120));
  if (task.essayWordTarget && task.essayWordTarget > 0) params.set('words', String(Math.round(task.essayWordTarget)));
  if (task.essayReferencing) params.set('referencing', task.essayReferencing);
  if (task.essayDegreeStyle === 'uk' || task.essayDegreeStyle === 'cgpa') params.set('degreeStyle', task.essayDegreeStyle);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}
