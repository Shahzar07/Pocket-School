/**
 * Draft and mark an essay with the same method ET English teaches.
 * Grades reuse the school scales: 9–1 and A*–U, each with a percentage.
 */

import { gradeOnScale, scaleById } from '@/lib/insights/report-cards';
import {
  ENGLISH_ESSAY_COACHING,
  essayLevelLabel,
  isEssayLevel,
  type EssayLevel,
  type RubricCriterion,
} from '@/lib/essays/coaching';

export interface RubricScore {
  criterion: RubricCriterion;
  label: string;
  score: number;
  note: string;
}

export interface InlineNote {
  quote: string;
  suggestion: string;
}

export interface EssayMark {
  percent: number;
  grade91: string;
  gradeAU: string;
  rubric: RubricScore[];
  inline: InlineNote[];
  fixNext: string[];
  summary: string;
}

export interface EssayDraft {
  title: string;
  body: string;
}

const CRITERION_LABEL: Record<RubricCriterion, string> = {
  content: 'Content',
  structure: 'Structure',
  language: 'Language',
  accuracy: 'Accuracy',
};

const FIX: Record<RubricCriterion, string> = {
  content: 'Answer the question in the opening, and keep its key words in view.',
  structure: 'Give each point its own paragraph, with a topic sentence, and end on a judgement.',
  language: 'Vary how sentences open, and split any sentence that carries two ideas.',
  accuracy: 'Support the claim. If the question weighs both sides, write both sides.',
};

const LEVEL_WORDS: Record<EssayLevel, number> = {
  primary: 80,
  'lower-secondary': 200,
  'upper-secondary': 350,
  igcse: 400,
  'a-level': 600,
  undergraduate: 800,
  independent: 350,
};

const TYPOS: Record<string, string> = {
  definately: 'definitely',
  seperate: 'separate',
  occured: 'occurred',
  recieve: 'receive',
  alot: 'a lot',
  thier: 'their',
  wich: 'which',
};

function clamp(value: number): number {
  return Math.max(0, Math.min(25, Math.round(value)));
}

function wordsOf(value: string): string[] {
  return value.toLowerCase().match(/[a-z']+/g) ?? [];
}

function paragraphsOf(value: string): string[] {
  return value.split(/\n\s*\n/).map(part => part.trim()).filter(Boolean);
}

function sentencesOf(value: string): string[] {
  return value.split(/(?<=[.!?])\s+/).map(part => part.trim()).filter(Boolean);
}

export function gradesForPercent(percent: number): { percent: number; grade91: string; gradeAU: string } {
  const safe = Math.max(0, Math.min(100, Math.round(percent)));
  return {
    percent: safe,
    grade91: gradeOnScale(safe, scaleById('igcse_9_1')),
    gradeAU: gradeOnScale(safe, scaleById('alevel')),
  };
}

function inlineNotes(body: string, prompt: string): InlineNote[] {
  const notes: InlineNote[] = [];
  const typo = body.match(/\b(definately|seperate|occured|recieve|alot|thier|wich)\b/i);
  if (typo?.[0]) {
    const fix = TYPOS[typo[0].toLowerCase()];
    if (fix) notes.push({ quote: typo[0], suggestion: `Change this to “${fix}”.` });
  }
  const long = sentencesOf(body).find(sentence => wordsOf(sentence).length > 32);
  if (long) {
    notes.push({
      quote: long.slice(0, 160),
      suggestion: 'Split this. ET AI keeps one idea in each sentence.',
    });
  }
  const comparative = /compare|contrast|how far|to what extent/i.test(prompt);
  if (comparative && !/however|although|whereas|on the other hand/i.test(body)) {
    const first = sentencesOf(body)[0];
    if (first) {
      notes.push({
        quote: first.slice(0, 140),
        suggestion: 'The question asks for both sides. Add a sentence that starts with “However”.',
      });
    }
  }
  for (const paragraph of paragraphsOf(body)) {
    const counts = new Map<string, number>();
    for (const word of wordsOf(paragraph)) {
      if (word.length < 5) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    const repeated = [...counts.entries()].find(([, count]) => count >= 4);
    if (repeated && !notes.some(note => note.quote.toLowerCase() === repeated[0])) {
      notes.push({
        quote: repeated[0],
        suggestion: `“${repeated[0]}” is doing too much work in this paragraph. Swap one use for a more exact word.`,
      });
      break;
    }
  }
  return notes.slice(0, 4);
}

export function markEssay(input: { body: string; prompt: string; level: EssayLevel }): EssayMark {
  const body = input.body.trim();
  const prompt = input.prompt.trim();
  const paragraphs = paragraphsOf(body);
  const sentences = sentencesOf(body);
  const tokens = wordsOf(body);
  const target = LEVEL_WORDS[input.level];

  const promptWords = [...new Set(wordsOf(prompt).filter(word => word.length >= 5))];
  const covered = promptWords.filter(word => tokens.includes(word)).length;
  const coverage = promptWords.length ? covered / promptWords.length : (body ? 0.4 : 0);
  const lengthRatio = Math.min(1, tokens.length / target);
  const content = clamp(coverage * 15 + lengthRatio * 10);

  const wanted = input.level === 'primary' ? 3 : 4;
  const paragraphScore = paragraphs.length === 0 ? 0 : Math.min(15, (paragraphs.length / wanted) * 15);
  const closer = /overall|therefore|in conclusion|this shows/i.test(paragraphs[paragraphs.length - 1] ?? '');
  const structure = clamp(paragraphScore + (closer ? 10 : 2));

  const lengths = sentences.map(sentence => wordsOf(sentence).length);
  const average = lengths.length ? lengths.reduce((sum, length) => sum + length, 0) / lengths.length : 0;
  const averageScore = average >= 8 && average <= 28 ? 12 : average > 0 ? 6 : 0;
  const variety = tokens.length ? Math.min(8, (new Set(tokens).size / tokens.length) * 16) : 0;
  const openings = sentences.map(sentence => wordsOf(sentence)[0] ?? '');
  const openingCounts = new Map<string, number>();
  for (const opening of openings) openingCounts.set(opening, (openingCounts.get(opening) ?? 0) + 1);
  const language = clamp(averageScore + variety + ([...openingCounts.values()].some(count => count >= 3) ? 0 : 5));

  const comparative = /compare|contrast|how far|to what extent/i.test(prompt);
  const bothSides = /however|although|whereas|on the other hand/i.test(body);
  const supported = /because|since|for example|for instance|this means/i.test(body);
  const typos = (body.match(/\b(definately|seperate|occured|recieve|alot|thier|wich)\b/gi) ?? []).length;
  let accuracy = body ? 8 : 0;
  if (supported) accuracy += 8;
  if (!comparative || bothSides) accuracy += 7;
  accuracy -= Math.min(10, typos * 4);
  accuracy = clamp(accuracy);

  const rubric: RubricScore[] = [
    { criterion: 'content', label: CRITERION_LABEL.content, score: content, note: content >= 18 ? 'The question is in view.' : 'The opening needs to answer the question more directly.' },
    { criterion: 'structure', label: CRITERION_LABEL.structure, score: structure, note: structure >= 18 ? 'The paragraphs lead to a judgement.' : 'Each point needs its own paragraph, and the last lines need a judgement.' },
    { criterion: 'language', label: CRITERION_LABEL.language, score: language, note: language >= 18 ? 'The sentences are controlled.' : 'Vary the openings, and shorten a sentence that runs on.' },
    { criterion: 'accuracy', label: CRITERION_LABEL.accuracy, score: accuracy, note: accuracy >= 18 ? 'Claims are supported.' : 'Add the reason, and correct any word that is not spelled as itself.' },
  ];
  const percent = rubric.reduce((sum, item) => sum + item.score, 0);
  const grades = gradesForPercent(percent);
  const weakest = [...rubric].sort((a, b) => a.score - b.score).slice(0, 3);
  const fixNext = weakest.map(item => FIX[item.criterion]);
  const level = essayLevelLabel(input.level);

  return {
    ...grades,
    rubric,
    inline: inlineNotes(body, prompt),
    fixNext,
    summary: `ET AI marked this at ${level}: ${grades.percent}%, grade ${grades.grade91} on 9–1 and ${grades.gradeAU} on A*–U.`,
  };
}

export function draftEssay(input: { idea: string; prompt: string; level: EssayLevel }): EssayDraft {
  const idea = input.idea.trim() || 'the subject of the question';
  const question = input.prompt.trim() || `Explain ${idea}.`;
  const level = essayLevelLabel(input.level);
  const title = question.replace(/\s+/g, ' ').slice(0, 90);
  const body = [
    `${question.replace(/[?.!]+$/, '')}. At ${level}, the direct answer is that ${idea} changes the conclusion, and the essay should say so in the first lines.`,
    `The first point is the one a reader can check. ${idea} is clearest in one concrete example, and the topic sentence should name that example before the comment on it.`,
    `There is another side. Although ${idea} holds in that example, it fails when the example is too narrow, so the paragraph has to say where the claim stops.`,
    `Overall, ${idea} stands when the example is specific and the reason is stated. The judgement stays with that limit.`,
  ].join('\n\n');
  return { title, body };
}

export function placeNotes(body: string, notes: InlineNote[]): Array<{ text: string; suggestion?: string }> {
  const placed: Array<{ text: string; suggestion?: string }> = [];
  let cursor = 0;
  const hits = notes
    .map(note => ({ note, at: note.quote ? body.toLowerCase().indexOf(note.quote.toLowerCase()) : -1 }))
    .filter(item => item.at >= cursor)
    .sort((a, b) => a.at - b.at);
  for (const hit of hits) {
    if (hit.at < cursor) continue;
    if (hit.at > cursor) placed.push({ text: body.slice(cursor, hit.at) });
    const end = hit.at + hit.note.quote.length;
    placed.push({ text: body.slice(hit.at, end), suggestion: hit.note.suggestion });
    cursor = end;
  }
  if (cursor < body.length) placed.push({ text: body.slice(cursor) });
  return placed.length ? placed : [{ text: body }];
}

export function essayPdfLines(input: { title: string; level: EssayLevel; body: string; mark: EssayMark | null }): string[] {
  const lines = [
    'ET Essays',
    `Level: ${essayLevelLabel(input.level)}`,
    input.title,
    '',
    input.body,
  ];
  if (!input.mark) return lines;
  lines.push(
    '',
    `Percentage: ${input.mark.percent}%`,
    `9–1: ${input.mark.grade91}`,
    `A*–U: ${input.mark.gradeAU}`,
    '',
    'Rubric',
    ...input.mark.rubric.map(item => `${item.label}: ${item.score}/25. ${item.note}`),
    '',
    'What to fix next',
    ...input.mark.fixNext.map((item, index) => `${index + 1}. ${item}`),
    '',
    input.mark.summary,
  );
  return lines;
}

export function parseEssayMark(value: unknown, fallback: EssayMark): EssayMark {
  if (!value || typeof value !== 'object') return fallback;
  const record = value as Partial<EssayMark>;
  const percent = typeof record.percent === 'number' ? record.percent : fallback.percent;
  const grades = gradesForPercent(percent);
  const rubric = Array.isArray(record.rubric) && record.rubric.length === 4 ? record.rubric as RubricScore[] : fallback.rubric;
  return {
    ...grades,
    rubric,
    inline: Array.isArray(record.inline) ? record.inline as InlineNote[] : fallback.inline,
    fixNext: Array.isArray(record.fixNext) && record.fixNext.every(item => typeof item === 'string') ? record.fixNext : fallback.fixNext,
    summary: typeof record.summary === 'string' && record.summary.includes('ET AI') ? record.summary : fallback.summary,
  };
}

export function coachingPrompt(): string {
  return ENGLISH_ESSAY_COACHING;
}

export function levelFromUnknown(value: unknown): EssayLevel {
  return typeof value === 'string' && isEssayLevel(value) ? value : 'igcse';
}
