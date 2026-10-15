/**
 * Pure helpers for the admin Content Builder.
 * Kept out of the page so the save, quiz, currency and title rules can be tested
 * without mounting the studio.
 */

export const DEFAULT_LESSON_MARKS = 10;
export const MOCK_EXAM_QUESTIONS = 4;
export const MOCK_EXAM_MARKS = 12;

const CURRENCY_PREFIX = '(?:US|NZ|NT|HK|AU|CA|SG|RM)';

/** Turn a Firestore client error into a sentence an admin can act on. */
export function describeFirestoreError(error: unknown): string {
  const code = String((error as { code?: string })?.code ?? '');
  const message = error instanceof Error ? error.message : String(error ?? '');
  const exhausted = code.includes('resource-exhausted')
    || /quota exceeded|resource.exhausted|write units|daily write/i.test(message);
  if (exhausted) {
    return 'Saving stopped: Firestore has used today’s free write quota (project ringed-sentinel-436615-c2). Turn on the Blaze plan and a budget alert in the Firebase console, then press Save. Don’t reload this tab — the lesson on screen is newer than the server.';
  }
  if (code.includes('permission-denied')) {
    return 'You don’t have permission to save this lesson.';
  }
  if (code.includes('unavailable') || /network|failed to fetch/i.test(message)) {
    return 'The save didn’t reach Firestore. Check the connection and press Save.';
  }
  return message || 'Save failed.';
}

/**
 * Keep real maths ($E = mc^2$, $$\frac{a}{b}$$) and stop currency
 * (US$50, NZ$20, NT$8) from being parsed as a maths span.
 */
export function escapeCurrencyDollars(input: string): string {
  if (!input) return '';
  const held: string[] = [];
  const hold = (chunk: string) => {
    held.push(chunk);
    return `\u0000M${held.length - 1}\u0000`;
  };
  let text = input.replace(/\$\$[\s\S]+?\$\$/g, hold);
  text = text.replace(/\$[^$\n]{0,120}\$/g, (chunk) => {
    const inner = chunk.slice(1, -1);
    if (/[\\^_=]/.test(inner)) return hold(chunk);
    return chunk;
  });
  const currency = new RegExp(`(?<!\\\\)${CURRENCY_PREFIX}?\\$(?=\\s?\\d)`, 'g');
  text = text.replace(currency, (chunk) => chunk.replace('$', '\\$'));
  return text.replace(/\u0000M(\d+)\u0000/g, (_m, index: string) => held[Number(index)] ?? '');
}

/**
 * Models sometimes return one line with literal "\n" / "\t" escapes.
 * Only convert an escape when it is not the start of a LaTeX command
 * (\theta, \times, \nu, \nabla).
 */
export function repairLiteralEscapes(input: string): string {
  if (!input) return '';
  return input
    .replace(/\\n(?![a-z])/g, '\n')
    .replace(/\\t(?![a-z])/g, '\t');
}

/** UTF-8 bytes that were misread as Latin-1 ("cafÃ©" → "café"). */
export function repairMojibake(input: string): string {
  if (!input || !/Ã[\u0080-\u00ff]|Â[\u0080-\u00ff]/.test(input)) return input;
  try {
    const bytes = Uint8Array.from([...input].map((ch) => ch.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (!decoded || decoded.includes('\uFFFD')) return input;
    return decoded;
  } catch {
    return input;
  }
}

/** "Unit 1: Unit 1: Business" → "Unit 1: Business". */
export function displayUnitTitle(unitNumber: number | undefined, title: string): string {
  const stripped = title.replace(/^\s*unit\s+\d+\s*[:.\-–—]?\s*/i, '').trim();
  const name = stripped || title.trim();
  if (!unitNumber) return name;
  return `Unit ${unitNumber}: ${name}`;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
}

/** Keep a question only when exactly one option is the correct answer. */
export function questionsWithSingleAnswer(items: QuizQuestion[]): QuizQuestion[] {
  return items.filter((q) => {
    if (!q || typeof q.question !== 'string' || !q.question.trim()) return false;
    if (!Array.isArray(q.options) || q.options.length < 2) return false;
    const options = q.options.map((o) => String(o).trim()).filter(Boolean);
    const answer = String(q.answer ?? '').trim().toLowerCase();
    const hits = options.filter((o) => o.toLowerCase() === answer);
    return hits.length === 1;
  });
}

export function countQuizQuestions(items: unknown): number {
  if (!Array.isArray(items)) return 0;
  return items.filter((q) => q && typeof q === 'object' && String((q as QuizQuestion).question ?? '').trim()).length;
}

export function appendQuiz(existing: QuizQuestion[] | undefined, incoming: QuizQuestion[]): QuizQuestion[] {
  const base = Array.isArray(existing) ? existing : [];
  const seen = new Set(base.map((q) => q.question.trim().toLowerCase()));
  const extra = incoming.filter((q) => q.question.trim() && !seen.has(q.question.trim().toLowerCase()));
  return [...base, ...extra];
}

export interface GlossaryTerm { term: string; definition: string }

/**
 * Glossary generation must not replace the Vocabulary list.
 * The previous glossary (what the Vocabulary block was showing) is copied
 * onto `vocabulary` the first time, then left alone.
 */
export function applyGlossaryResult(
  previous: { vocabulary?: GlossaryTerm[]; glossary?: GlossaryTerm[] } | undefined,
  glossary: GlossaryTerm[],
): { vocabulary: GlossaryTerm[]; glossary: GlossaryTerm[] } {
  const vocabulary = Array.isArray(previous?.vocabulary)
    ? previous.vocabulary
    : Array.isArray(previous?.glossary) ? previous.glossary : [];
  return { vocabulary, glossary };
}

export type LessonTextPart =
  | { type: 'text'; text: string }
  | { type: 'image'; n: number; caption: string };

const IMAGE_SLOT = /\[Image\s+(\d+)\s*:\s*([^\]]*)\]/gi;

export function splitImageSlots(input: string): LessonTextPart[] {
  if (!input) return [];
  const parts: LessonTextPart[] = [];
  let last = 0;
  for (const match of input.matchAll(IMAGE_SLOT)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ type: 'text', text: input.slice(last, index) });
    parts.push({ type: 'image', n: Number(match[1]), caption: (match[2] ?? '').trim() });
    last = index + match[0].length;
  }
  if (last < input.length) parts.push({ type: 'text', text: input.slice(last) });
  return parts;
}

/** How many scenes a brief already planned. Null when there isn't a plan. */
const CJK = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/g;

export function lessonUsesCjk(text: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/.test(text);
}

/** Drop stray CJK glyphs models insert into English distractors (for example 休). */
export function stripStrayCjk(value: string): string {
  return value.replace(CJK, '').replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
}

export function stripStrayCjkFromQuiz(questions: QuizQuestion[], source: string): QuizQuestion[] {
  if (lessonUsesCjk(source)) return questions;
  const cleaned = questions.map((q) => ({
    ...q,
    question: stripStrayCjk(q.question),
    explanation: q.explanation ? stripStrayCjk(q.explanation) : q.explanation,
    options: q.options.map((o) => stripStrayCjk(String(o))).filter(Boolean),
    answer: stripStrayCjk(String(q.answer ?? '')),
  }));
  return questionsWithSingleAnswer(cleaned);
}

/** Percentages and large figures in the output that the lesson never stated. */
export function inventedNumbers(source: string, output: string): string[] {
  const allowed = new Set((source.match(/\d[\d,]*(?:\.\d+)?%?/g) ?? []).map((n) => n.replace(/,/g, '').replace(/%$/, '')));
  const found = output.match(/\d[\d,]*(?:\.\d+)?%?/g) ?? [];
  const bad: string[] = [];
  for (const raw of found) {
    const bare = raw.replace(/,/g, '');
    const numeric = bare.replace(/%$/, '');
    if (allowed.has(bare) || allowed.has(numeric)) continue;
    const value = Number(numeric);
    if (bare.includes('%') || value >= 20) bad.push(raw);
  }
  return [...new Set(bad)];
}

/** Which aiOutputs field a builder block owns. Removing the block clears this field. */
export const BLOCK_OUTPUT_KEY: Record<string, string> = {
  video: 'videoScript',
  text: 'text',
  vocabulary: 'vocabulary',
  glossary: 'glossary',
  quiz: 'quiz',
  audio: 'audioScript',
  flashcards: 'flashcards',
  mindmap: 'mindmap',
  infographic: 'infographic',
  slides: 'slides',
  notes: 'notes',
  summary: 'summary',
  problems: 'problems',
  image: 'image',
  illustration: 'illustration',
};

export function plannedSceneCount(brief: string | undefined): number | null {
  if (!brief) return null;
  const labelled = brief.match(/(?:^|\n)\s*(?:###\s*)?scene\s+\d+\b/gi);
  if (labelled && labelled.length >= 2) return labelled.length;
  return null;
}

function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Fields that actually changed, with each AI format as its own dotted key
 * so a quiz save cannot wipe the lesson text.
 * `null` means the caller should delete that field.
 * Data-URL images are dropped so a scene picture cannot bloat the lesson.
 */
export function lessonFieldPatch(
  previous: Record<string, unknown> | null,
  next: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(previous ?? {}), ...Object.keys(next)]);
  for (const key of keys) {
    if (key === 'id') continue;
    if (key === 'aiOutputs') {
      const prevOut = (previous?.aiOutputs ?? {}) as Record<string, unknown>;
      const nextOut = (next.aiOutputs ?? {}) as Record<string, unknown>;
      const formats = new Set([...Object.keys(prevOut), ...Object.keys(nextOut)]);
      for (const format of formats) {
        if (sameJson(prevOut[format], nextOut[format])) continue;
        const value = nextOut[format];
        if (typeof value === 'string' && value.startsWith('data:image')) continue;
        patch[`aiOutputs.${format}`] = value === undefined ? null : value;
      }
      continue;
    }
    if (sameJson(previous?.[key], next[key])) continue;
    if (next[key] !== undefined) patch[key] = sanitizeValue(next[key]);
  }
  return patch;
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string' && value.startsWith('data:image')) return undefined;
  if (Array.isArray(value)) return value.map(sanitizeValue).filter((item) => item !== undefined);
  if (value && typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const next = sanitizeValue(v);
      if (next !== undefined) out[k] = next;
    }
    return out;
  }
  return value;
}
