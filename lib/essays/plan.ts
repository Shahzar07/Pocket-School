/**
 * ET AI plans an essay. It does not write the student's paragraphs.
 * A model answer, when one is shown, answers a different question.
 */

import { PLAN_SHAPE } from '@/lib/essays/config';
import { essayLevelLabel, type EssayLevel } from '@/lib/essays/coaching';

export const PLAN_SYSTEM_PROMPT = [
  'You are ET AI in ET Essays.',
  'You may brainstorm, outline, and offer one thesis sentence.',
  'You must never write the student\'s essay, and you must never return full paragraphs of that essay.',
  'Each brainstorm item and each outline item is a single short line, not a paragraph.',
  'The thesis is one sentence.',
  'Do not write a second sentence after the thesis.',
  'Call yourself ET AI. Do not use another name.',
].join('\n');

export const EXEMPLAR_SYSTEM_PROMPT = [
  'You are ET AI in ET Essays.',
  'Write one short exemplar paragraph, at most 70 words, answering only the different question you are given.',
  'Do not answer the student\'s question. Do not write their essay.',
  'Call yourself ET AI. Do not use another name.',
].join('\n');

const OTHER_QUESTIONS = [
  'How does a library change a town?',
  'Should a school day start later?',
  'What makes a bridge safe?',
  'How does a market feed a city?',
];

export interface EssayPlan {
  brainstorm: string[];
  outline: string[];
  thesis: string;
  exemplarQuestion: string;
  exemplar: string;
}

function words(value: string): string[] {
  return value.toLowerCase().match(/[a-z']+/g) ?? [];
}

function longSentences(value: string): string[] {
  return value
    .split(/[.!?]+/)
    .map(part => part.trim())
    .filter(part => words(part).length >= PLAN_SHAPE.longSentenceWords);
}

/** True when the text is shaped like essay paragraphs rather than a plan. */
export function isEssayShaped(value: string): boolean {
  const paragraphs = value
    .split(/\n\s*\n/)
    .map(part => part.trim())
    .filter(part => words(part).length >= PLAN_SHAPE.paragraphWords);
  return longSentences(value).length > PLAN_SHAPE.maxLongSentences || paragraphs.length >= 2;
}

export function differentQuestion(prompt: string): string {
  const used = new Set(words(prompt).filter(word => word.length > 4));
  const found = OTHER_QUESTIONS.find(question => words(question).filter(word => word.length > 4).every(word => !used.has(word)));
  return found ?? 'How does a market feed a city?';
}

function clipWords(value: string, max: number): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, max).join(' ');
}

/** Null when the school has turned planning off for an assessment. */
export function planForPolicy(
  policy: { planningEnabled: boolean },
  input: { idea: string; prompt: string; level: EssayLevel },
): EssayPlan | null {
  if (!policy.planningEnabled) return null;
  return planEssay(input);
}

export function planEssay(input: { idea: string; prompt: string; level: EssayLevel }): EssayPlan {
  const topic = input.idea.trim() || 'the subject of the question';
  const level = essayLevelLabel(input.level);
  const exemplarQuestion = differentQuestion(input.prompt);
  return {
    brainstorm: [
      `One example a reader at ${level} can check.`,
      `Where ${topic} stops being true.`,
      'The judgement, chosen before writing.',
    ],
    outline: [
      'Opening line that answers the question.',
      'One example, then what it shows.',
      'The other side, and where the claim stops.',
      'A closing judgement, with no new topic.',
    ],
    thesis: `${topic.charAt(0).toUpperCase()}${topic.slice(1)} holds only when the example is specific.`,
    exemplarQuestion,
    exemplar: clipWords(
      `${exemplarQuestion} A short example is enough: name one place, say what changed, and stop.`,
      PLAN_SHAPE.exemplarWords,
    ),
  };
}

/** Drop a model reply that turned into the student's essay. */
export function sharesTopic(left: string, right: string): boolean {
  const used = new Set(words(left).filter(word => word.length > 4));
  const shared = words(right).filter(word => word.length > 4 && used.has(word));
  return shared.length >= 2;
}

export function guardPlan(candidate: EssayPlan, fallback: EssayPlan, studentPrompt = ''): EssayPlan {
  const joined = [...candidate.brainstorm, ...candidate.outline, candidate.thesis].join('\n');
  if (
    candidate.brainstorm.length === 0
    || candidate.outline.length === 0
    || isEssayShaped(joined)
    || longSentences(candidate.thesis).length > 1
  ) return fallback;
  const thesis = candidate.thesis.split(/(?<=[.!?])\s+/)[0]?.trim() || fallback.thesis;
  const exemplar = guardExemplar(candidate.exemplar, studentPrompt, fallback.exemplar);
  const exemplarQuestion = candidate.exemplarQuestion.trim() || fallback.exemplarQuestion;
  return {
    brainstorm: candidate.brainstorm.map(item => clipWords(item, 24)).filter(Boolean).slice(0, 5),
    outline: candidate.outline.map(item => clipWords(item, 24)).filter(Boolean).slice(0, 6),
    thesis: clipWords(thesis, 40),
    exemplarQuestion: exemplar === fallback.exemplar || sharesTopic(studentPrompt, exemplarQuestion)
      ? fallback.exemplarQuestion
      : exemplarQuestion,
    exemplar,
  };
}

export function guardExemplar(text: string, studentPrompt: string, fallback: string): string {
  if (isEssayShaped(text) || text.split(/\n\s*\n/).filter(part => part.trim()).length > 1) return fallback;
  const clipped = clipWords(text, PLAN_SHAPE.exemplarWords);
  if (!clipped || isEssayShaped(clipped)) return fallback;
  if (studentPrompt && sharesTopic(studentPrompt, clipped)) return fallback;
  return clipped;
}
