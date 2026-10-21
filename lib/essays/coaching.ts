/**
 * Essay coaching shared by ET English and ET Essays.
 * The teacher session and the essay desk both use this text, so the method
 * is not written twice. Levels are named. School years are not.
 */

import { LEARNER_LEVELS, levelLabel, resolveLevel, type LevelId } from '@/lib/levels';

export const ESSAY_LEVELS = LEARNER_LEVELS;

export type EssayLevel = LevelId;

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
  'Speak in levels only: Primary, Lower Secondary, Upper Secondary, IGCSE / O Level, A-Level, Pre-University / Foundation, Undergraduate (Degree), Postgraduate: Masters, Postgraduate: PhD / Doctoral, Professional, Independent learner. Never mention a school year or a numbered grade year.',
  'Directed writing, reading, summary, and essay technique:',
  '- Open by answering the question. A comparative essay names both sides in the first lines.',
  '- Each paragraph has one topic sentence, then evidence, then what the evidence means.',
  '- If the question says compare, how far, or to what extent, weigh both sides before the judgement.',
  '- Close with a judgement that follows the paragraphs. Do not start a new topic.',
  '- Mark on four criteria only: content, structure, language, and accuracy.',
  '- Point at the sentence to change, then say what to fix next.',
  '- Never write the student\'s essay. Planning is a brainstorm, an outline, and one thesis sentence.',
  '- A model paragraph must answer a different question, and it stays one short paragraph.',
].join('\n');

export function isEssayLevel(value: string): value is EssayLevel {
  return LEARNER_LEVELS.some((level) => level.id === value);
}

export function essayLevelLabel(level: string): string {
  return levelLabel(level) || 'IGCSE / O Level';
}

/** ET English and ET English SL share this coaching. Other teachers do not. */
export function coachingForTeacher(teacherId: string): string | null {
  return ENGLISH_TEACHERS.has(teacherId) ? ENGLISH_ESSAY_COACHING : null;
}
