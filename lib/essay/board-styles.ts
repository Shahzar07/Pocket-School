/**
 * Exam-board style profiles for ET Essays.
 * Marks, word ranges, and scales are ET AI working bands.
 * They are not a board's published grade boundaries.
 */

import { resolveLevel, type LevelId } from '@/lib/levels';

export type BoardFamily = 'school-early' | 'igcse' | 'pre-university' | 'degree' | 'masters' | 'phd' | 'professional' | 'independent';
export type BoardScale = 'level' | 'ib' | 'ap' | 'spm' | 'stpm';

export interface BoardStyle {
  id: string;
  label: string;
  family: BoardFamily;
  command: string;
  marks: number;
  wordMin: number;
  wordMax: number;
  scale: BoardScale;
}

function style(
  id: string,
  label: string,
  family: BoardFamily,
  command: string,
  marks: number,
  wordMin: number,
  wordMax: number,
  scale: BoardScale = 'level',
): BoardStyle {
  return { id, label, family, command, marks, wordMin, wordMax, scale };
}

export const BOARD_STYLES: readonly BoardStyle[] = [
  style('cambridge-school', 'Cambridge Primary or Lower Secondary', 'school-early', 'Give reasons for your view.', 20, 150, 250),
  style('pearson-school', 'Pearson Edexcel iPrimary or iLowerSecondary', 'school-early', 'Explain your answer.', 20, 150, 250),
  style('kssr-kssm', 'Malaysian KSSR or KSSM', 'school-early', 'Use a clear example.', 20, 150, 280),
  style('uk-school', 'UK National Curriculum', 'school-early', 'Write in full sentences.', 20, 150, 280),
  style('general-school', 'General', 'school-early', 'Answer in your own words.', 20, 150, 250),
  style('general-upper', 'General', 'school-early', 'Answer in your own words.', 25, 300, 450),

  style('cambridge-igcse', 'Cambridge IGCSE (CAIE)', 'igcse', 'Give reasons for your view.', 30, 350, 450),
  style('pearson-igcse', 'Pearson Edexcel International GCSE', 'igcse', 'Evaluate this view.', 30, 350, 450),
  style('oxfordaqa-igcse', 'OxfordAQA International GCSE', 'igcse', 'Consider more than one view.', 30, 350, 450),
  style('aqa-gcse', 'AQA GCSE', 'igcse', 'Consider more than one view.', 30, 350, 450),
  style('ocr-gcse', 'OCR GCSE', 'igcse', 'Use examples to support your answer.', 30, 350, 450),
  style('wjec', 'WJEC/Eduqas', 'igcse', 'Use examples to support your answer.', 30, 350, 450),
  style('cambridge-olevel', 'Cambridge O Level', 'igcse', 'Give reasons for your view.', 30, 350, 450),
  style('spm', 'SPM (Malaysia)', 'igcse', 'Explain with reasons.', 30, 350, 500, 'spm'),
  style('uec-junior', 'UEC Junior (Malaysia)', 'igcse', 'Explain with reasons.', 30, 300, 450),
  style('cbse-icse', 'CBSE / ICSE (India)', 'igcse', 'Write a structured answer.', 30, 300, 500),
  style('general-igcse', 'General', 'igcse', 'Answer the question directly.', 30, 350, 450),

  style('cambridge-alevel', 'Cambridge International AS & A Level', 'pre-university', 'Give reasons for your view.', 40, 500, 800),
  style('pearson-alevel', 'Pearson Edexcel International A Level', 'pre-university', 'Evaluate this view.', 40, 500, 800),
  style('oxfordaqa-alevel', 'OxfordAQA International A Level', 'pre-university', 'Consider more than one view.', 40, 500, 800),
  style('aqa-alevel', 'AQA A Level', 'pre-university', 'Consider more than one view.', 40, 500, 800),
  style('ocr-alevel', 'OCR A Level', 'pre-university', 'Use examples to support your answer.', 40, 500, 800),
  style('ib', 'IB Diploma (Extended Essay, TOK, IA)', 'pre-university', 'Develop a line of argument.', 40, 700, 1200, 'ib'),
  style('ap', 'AP (College Board)', 'pre-university', 'Develop a line of argument.', 40, 500, 900, 'ap'),
  style('stpm', 'STPM (Malaysia)', 'pre-university', 'Evaluate the view.', 40, 500, 800, 'stpm'),
  style('uec-senior', 'UEC Senior', 'pre-university', 'Evaluate the view.', 40, 500, 800),
  style('matriculation', 'Malaysian Matriculation or Foundation', 'pre-university', 'Explain with evidence.', 40, 500, 800),
  style('vce-hsc', 'Australian VCE or HSC', 'pre-university', 'Use examples to support your answer.', 40, 500, 900),
  style('general-pre', 'General', 'pre-university', 'Answer the question directly.', 40, 500, 800),

  style('uk-degree', 'UK university (QAA framework)', 'degree', 'Sustain an argument with sources.', 100, 1200, 2000),
  style('my-degree', 'Malaysian university (MQA framework)', 'degree', 'Sustain an argument with sources.', 100, 1200, 2000),
  style('us-college', 'US college', 'degree', 'Sustain an argument with sources.', 100, 1000, 1800),
  style('au-degree', 'Australian university', 'degree', 'Sustain an argument with sources.', 100, 1200, 2000),
  style('general-degree', 'General academic', 'degree', 'Sustain an argument with sources.', 100, 1000, 1800),

  style('uk-masters', 'UK Masters (QAA Level 7)', 'masters', 'Engage with the literature and take a position.', 100, 2500, 4000),
  style('my-masters', 'Malaysian Masters (MQA)', 'masters', 'Engage with the literature and take a position.', 100, 2500, 4000),
  style('us-graduate', 'US graduate', 'masters', 'Engage with the literature and take a position.', 100, 2000, 4000),
  style('general-masters', 'General', 'masters', 'Engage with the literature and take a position.', 100, 2000, 3500),

  style('uk-phd', 'UK doctoral (QAA Level 8)', 'phd', 'State the contribution and its limits.', 100, 1500, 4000),
  style('my-phd', 'Malaysian PhD (MQA)', 'phd', 'State the contribution and its limits.', 100, 1500, 4000),
  style('general-phd', 'General', 'phd', 'State the contribution and its limits.', 100, 1500, 3500),

  style('acca', 'ACCA', 'professional', 'Apply the rule to the facts.', 100, 600, 1200),
  style('cima', 'CIMA', 'professional', 'Apply the rule to the facts.', 100, 600, 1200),
  style('clp', 'CLP / Bar (law)', 'professional', 'Apply the rule to the facts.', 100, 800, 1500),
  style('general-professional', 'General professional', 'professional', 'Apply the method to the case.', 100, 600, 1200),

  style('general-independent', 'General', 'independent', 'Answer in your own words.', 25, 300, 500),
];

const EARLY: Record<string, string> = {
  primary: 'general-school',
  'lower-secondary': 'general-school',
  'upper-secondary': 'general-upper',
};

export function boardFamilyFor(level: string | null | undefined): BoardFamily {
  switch (resolveLevel(level)) {
    case 'primary':
    case 'lower-secondary':
    case 'upper-secondary':
      return 'school-early';
    case 'igcse':
      return 'igcse';
    case 'a-level':
    case 'pre-university':
      return 'pre-university';
    case 'undergraduate':
      return 'degree';
    case 'masters':
      return 'masters';
    case 'phd':
      return 'phd';
    case 'professional':
      return 'professional';
    default:
      return 'independent';
  }
}

export function boardsForLevel(level: string | null | undefined): BoardStyle[] {
  const family = boardFamilyFor(level);
  const id = resolveLevel(level);
  return BOARD_STYLES.filter((item) => {
    if (item.family !== family) return false;
    if (family !== 'school-early') return true;
    if (id === 'upper-secondary') return item.id === 'general-upper';
    return item.id !== 'general-upper';
  });
}

const LEGACY: Record<string, Partial<Record<BoardFamily, string>>> = {
  none: {
    'school-early': 'general-school',
    igcse: 'general-igcse',
    'pre-university': 'general-pre',
    degree: 'general-degree',
    masters: 'general-masters',
    phd: 'general-phd',
    professional: 'general-professional',
    independent: 'general-independent',
  },
  cambridge: {
    'school-early': 'cambridge-school',
    igcse: 'cambridge-igcse',
    'pre-university': 'cambridge-alevel',
  },
  edexcel: {
    'school-early': 'pearson-school',
    igcse: 'pearson-igcse',
    'pre-university': 'pearson-alevel',
  },
  aqa: { igcse: 'aqa-gcse', 'pre-university': 'aqa-alevel' },
  ocr: { igcse: 'ocr-gcse', 'pre-university': 'ocr-alevel' },
};

export function resolveBoard(level: string | null | undefined, boardId: string | null | undefined): BoardStyle {
  const options = boardsForLevel(level);
  const fallback = options[options.length - 1] ?? BOARD_STYLES[BOARD_STYLES.length - 1]!;
  const raw = (boardId ?? '').trim();
  const direct = options.find((item) => item.id === raw);
  if (direct) return direct;
  const family = boardFamilyFor(level);
  const legacy = LEGACY[raw]?.[family];
  if (raw === 'none' && resolveLevel(level) === 'upper-secondary') {
    return options.find((item) => item.id === 'general-upper') ?? fallback;
  }
  if (legacy) return options.find((item) => item.id === legacy) ?? fallback;
  return fallback;
}

export function estimateInStyle(label: string): string {
  return `ET AI estimate in the style of ${label}`;
}

export function boardScaleHeadline(board: BoardStyle, percent: number): { headline: string; detail: string; showsPercentage: boolean } | null {
  const mark = Math.max(0, Math.min(100, Math.round(percent)));
  if (board.scale === 'ib') {
    const band = mark >= 85 ? '7' : mark >= 70 ? '6' : mark >= 55 ? '5' : mark >= 40 ? '4' : mark >= 25 ? '3' : mark >= 15 ? '2' : '1';
    return { headline: band, detail: 'ET AI working band from 1 to 7. Not an official boundary.', showsPercentage: true };
  }
  if (board.scale === 'ap') {
    const band = mark >= 85 ? '5' : mark >= 70 ? '4' : mark >= 55 ? '3' : mark >= 40 ? '2' : '1';
    return { headline: band, detail: 'ET AI working band from 1 to 5. Not an official boundary.', showsPercentage: true };
  }
  if (board.scale === 'spm') {
    const band = mark >= 90 ? 'A+' : mark >= 80 ? 'A' : mark >= 70 ? 'A-' : mark >= 65 ? 'B+' : mark >= 60 ? 'B' : mark >= 55 ? 'C+' : mark >= 50 ? 'C' : mark >= 45 ? 'D' : mark >= 40 ? 'E' : 'G';
    return { headline: band, detail: 'ET AI working band from A+ to G. Not an official boundary.', showsPercentage: true };
  }
  if (board.scale === 'stpm') {
    const band = mark >= 80 ? 'A' : mark >= 70 ? 'A-' : mark >= 60 ? 'B+' : mark >= 50 ? 'B' : mark >= 45 ? 'C+' : mark >= 40 ? 'C' : 'F';
    return { headline: band, detail: 'ET AI working band from A to F. Not an official boundary.', showsPercentage: true };
  }
  return null;
}

/** Same board list, with the word range and marks for that level. */
export function profileFor(level: string | null | undefined, boardId: string | null | undefined): BoardStyle {
  const base = resolveBoard(level, boardId);
  const id = resolveLevel(level);
  if (id === 'primary') return { ...base, marks: 10, wordMin: 60, wordMax: 120 };
  if (id === 'lower-secondary') return { ...base, marks: 20, wordMin: 150, wordMax: 250 };
  if (id === 'upper-secondary') return { ...base, marks: 25, wordMin: 300, wordMax: 450 };
  return base;
}

export function defaultBoardId(level: string | null | undefined): string {
  const id = resolveLevel(level);
  if (id && EARLY[id] && id !== 'upper-secondary') return EARLY[id]!;
  return boardsForLevel(level).at(-1)?.id ?? 'general-independent';
}

export function boardMemoryKey(level: LevelId | string): string {
  return `poket-essay-board:${resolveLevel(level) ?? 'igcse'}`;
}
