/**
 * Essay coaching shared by ET English and ET Essays.
 * The teacher session and the essay desk both use this text, so the method
 * is not written twice. Levels are named. School years are not.
 */

export const ESSAY_LEVELS = [
  { id: 'primary', label: 'Primary' },
  { id: 'lower-secondary', label: 'Lower secondary' },
  { id: 'upper-secondary', label: 'Upper secondary' },
  { id: 'igcse', label: 'IGCSE' },
  { id: 'a-level', label: 'A-Level' },
  { id: 'undergraduate', label: 'Undergraduate' },
  { id: 'independent', label: 'Independent' },
] as const;

export type EssayLevel = (typeof ESSAY_LEVELS)[number]['id'];

export const RUBRIC_CRITERIA = ['content', 'structure', 'language', 'accuracy'] as const;
export type RubricCriterion = (typeof RUBRIC_CRITERIA)[number];

const ENGLISH_TEACHERS = new Set(['et-english', 'et-english-sl']);

/**
 * The method ET English already teaches: directed writing, a real opening,
 * one topic sentence to a paragraph, and a judgement at the end.
 */
export const ENGLISH_ESSAY_COACHING = [
  'You are ET AI, coaching in ET Essays and as ET English.',
  'Call yourself ET AI. The product is ET Essays. Do not use another name, and do not shorten ET AI to ET.',
  'Speak in levels only: Primary, Lower secondary, Upper secondary, IGCSE, A-Level, Undergraduate, Independent. Never mention a school year or a numbered grade year.',
  'Directed writing, reading, summary, and essay technique:',
  '- Open by answering the question. A comparative essay names both sides in the first lines.',
  '- Each paragraph has one topic sentence, then evidence, then what the evidence means.',
  '- If the question says compare, how far, or to what extent, weigh both sides before the judgement.',
  '- Close with a judgement that follows the paragraphs. Do not start a new topic.',
  '- Mark on four criteria only: content, structure, language, and accuracy.',
  '- Point at the sentence to change, then say what to fix next.',
].join('\n');

export function isEssayLevel(value: string): value is EssayLevel {
  return ESSAY_LEVELS.some(level => level.id === value);
}

export function essayLevelLabel(level: EssayLevel): string {
  return ESSAY_LEVELS.find(item => item.id === level)?.label ?? 'IGCSE';
}

/** ET English and ET English SL share this coaching. Other teachers do not. */
export function coachingForTeacher(teacherId: string): string | null {
  return ENGLISH_TEACHERS.has(teacherId) ? ENGLISH_ESSAY_COACHING : null;
}
