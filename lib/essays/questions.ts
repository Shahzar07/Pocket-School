/**
 * ET AI sets an essay question. The student still writes the essay.
 * Levels are named. A school year is never part of the question.
 */

import { profileFor } from '@/lib/essay/board-styles';
import { essayLevelLabel, type EssayLevel } from '@/lib/essays/coaching';

export const ESSAY_TYPES = [
  { id: 'argumentative', label: 'Argumentative' },
  { id: 'descriptive', label: 'Descriptive' },
  { id: 'narrative', label: 'Narrative' },
  { id: 'analytical', label: 'Analytical' },
  { id: 'discursive', label: 'Discursive' },
  { id: 'comparative', label: 'Comparative' },
  { id: 'reflective', label: 'Reflective' },
] as const;

export type EssayType = (typeof ESSAY_TYPES)[number]['id'];

export const EXAM_BOARDS = [
  { id: 'none', label: 'No exam board' },
  { id: 'cambridge', label: 'Cambridge style' },
  { id: 'edexcel', label: 'Edexcel style' },
  { id: 'aqa', label: 'AQA style' },
  { id: 'ocr', label: 'OCR style' },
] as const;

export type ExamBoard = (typeof EXAM_BOARDS)[number]['id'];

export const ESSAY_SUBJECTS = [
  'English',
  'Literature',
  'History',
  'Geography',
  'Biology',
  'Chemistry',
  'Physics',
  'Mathematics',
  'Economics',
  'Computer science',
  'Law',
  'Medicine',
] as const;

export const RECENT_QUESTIONS_KEY = 'poket-et-essay-questions';

const STEMS: Record<EssayType, string[]> = {
  argumentative: [
    'How far do you agree that {topic} matters in {subject}?',
    'To what extent should {topic} change the way people understand {subject}?',
    '“{topic}” is the strongest idea in {subject}. How far do you agree?',
    'Should {topic} be treated as essential to {subject}?',
  ],
  descriptive: [
    'Describe {topic} as it would appear to someone new to {subject}.',
    'Write a description of {topic} that shows its place in {subject}.',
    'Describe a moment when {topic} becomes visible in {subject}.',
    'Paint a picture of {topic} for a reader who has not studied {subject}.',
  ],
  narrative: [
    'Write a narrative in which {topic} changes what someone understands about {subject}.',
    'Tell the story of a moment when {topic} becomes clear in {subject}.',
    'Write a story that turns on {topic} and what it means for {subject}.',
    'Narrate a day on which {topic} alters a decision in {subject}.',
  ],
  analytical: [
    'Analyse how {topic} shapes {subject}.',
    'Examine the role of {topic} in {subject}.',
    'How does {topic} work inside {subject}? Analyse the process.',
    'Break down the part {topic} plays in {subject}.',
  ],
  discursive: [
    'Discuss the advantages and disadvantages of {topic} in {subject}.',
    '{topic} divides people who study {subject}. Discuss both views.',
    'Discuss whether {topic} helps or limits {subject}.',
    'What are the arguments for and against {topic} in {subject}?',
  ],
  comparative: [
    'Compare {topic} with another idea you have studied in {subject}.',
    'Compare two ways of understanding {topic} in {subject}.',
    'How is {topic} different from a related idea in {subject}?',
    'Compare the effects of {topic} in two settings within {subject}.',
  ],
  reflective: [
    'Reflect on what {topic} has changed in a view of {subject}.',
    'What has studying {topic} shown you about {subject}?',
    'Reflect on a difficulty that {topic} creates in {subject}.',
    'Looking back, how has {topic} altered your understanding of {subject}?',
  ],
};

const ANGLES = [
  '',
  ' Keep everyday life in view.',
  ' Think about change over time.',
  ' People disagree about this.',
  ' A learner may be meeting the idea for the first time.',
  ' The evidence may be incomplete.',
];

export interface GeneratedEssayQuestion {
  question: string;
  subject: string;
  level: EssayLevel;
  topics: string[];
  type: EssayType;
  board: string;
  marks: number;
  wordMin: number;
  wordMax: number;
  guidance: string;
}

export function isEssayType(value: string): value is EssayType {
  return ESSAY_TYPES.some(item => item.id === value);
}

export function isExamBoard(value: string): value is ExamBoard {
  return EXAM_BOARDS.some(item => item.id === value);
}

export function topicsFromText(value: string): string[] {
  return value
    .split(/[,;/]|\band\b/i)
    .map(part => part.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function topicPhrase(topics: string[]): string {
  const clean = topics.map(topic => topic.trim()).filter(Boolean);
  if (clean.length === 0) return 'the main idea';
  if (clean.length === 1) return clean[0]!;
  return `${clean.slice(0, -1).join(', ')} and ${clean[clean.length - 1]}`;
}

function fill(stem: string, subject: string, topics: string[]): string {
  return stem
    .replaceAll('{subject}', subject.trim() || 'the subject')
    .replaceAll('{topic}', topicPhrase(topics));
}

export function questionGuidance(level: EssayLevel, board?: string): { marks: number; wordMin: number; wordMax: number; guidance: string } {
  const guide = profileFor(level, board);
  const name = essayLevelLabel(level);
  return {
    marks: guide.marks,
    wordMin: guide.wordMin,
    wordMax: guide.wordMax,
    guidance: `Aim for ${guide.wordMin}–${guide.wordMax} words at ${name}. The question is marked out of ${guide.marks}.`,
  };
}

export function generateEssayQuestion(input: {
  subject: string;
  level: EssayLevel;
  topics: string[];
  type: EssayType;
  board: string;
  recent?: string[];
  nonce?: number;
}): GeneratedEssayQuestion {
  const type = isEssayType(input.type) ? input.type : 'argumentative';
  const board = input.board || 'none';
  const profile = profileFor(input.level, board);
  const stems = STEMS[type];
  const seen = new Set((input.recent ?? []).map(normalise));
  const pool: string[] = [];
  for (let index = 0; index < stems.length * ANGLES.length; index += 1) {
    const stem = stems[index % stems.length] ?? stems[0]!;
    const angle = ANGLES[Math.floor(index / stems.length) % ANGLES.length] ?? '';
    const question = `${fill(stem, input.subject, input.topics)}${angle} ${profile.command}`.replace(/\s+/g, ' ').trim();
    if (seen.has(normalise(question))) continue;
    if (!pool.includes(question)) pool.push(question);
  }
  const nonce = input.nonce ?? 0;
  const question = pool.length
    ? pool[Math.abs(nonce) % pool.length]!
    : `${fill(stems[Math.abs(nonce) % stems.length] ?? stems[0]!, input.subject, input.topics)} Consider a fresh example. ${profile.command}`.replace(/\s+/g, ' ').trim();
  const guide = questionGuidance(input.level, board);
  return {
    question,
    subject: input.subject.trim() || 'the subject',
    level: input.level,
    topics: input.topics.map(topic => topic.trim()).filter(Boolean),
    type,
    board,
    marks: guide.marks,
    wordMin: guide.wordMin,
    wordMax: guide.wordMax,
    guidance: guide.guidance,
  };
}

/** Keep a model reply that is one question, and reject an essay or a repeat. */
export function acceptGeneratedQuestion(text: string, recent: string[], fallback: string): string {
  const cleaned = text.replace(/^["'`]+|["'`]+$/g, '').trim();
  const line = cleaned.split('\n').map(part => part.trim()).filter(Boolean)[0] ?? '';
  if (!line || line.split(/\s+/).length > 60) return fallback;
  if (/year\s+\d/i.test(line) || /lyra/i.test(line)) return fallback;
  if ((line.match(/[.!?]/g) ?? []).length > 4) return fallback;
  if (recent.some(item => normalise(item) === normalise(line))) return fallback;
  return line;
}

export function readRecentQuestions(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_QUESTIONS_KEY) || '[]') as unknown[];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string').slice(0, 12) : [];
  } catch {
    return [];
  }
}

export function writeRecentQuestions(questions: string[]) {
  localStorage.setItem(RECENT_QUESTIONS_KEY, JSON.stringify(questions.slice(0, 12)));
}
