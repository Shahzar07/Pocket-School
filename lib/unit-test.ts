/**
 * Unit Test gating for Poket School.
 * A unit test sits on a module. Version A is the first paper. A fail lists the
 * lessons behind the missed questions and keeps the paper locked until those
 * lessons are completed again. The next attempt uses Version B, then A, then B.
 */

export const DEFAULT_UNIT_TEST_PASS_MARK = 70;

export const BLOOM_LEVELS = ['Remember', 'Understand', 'Apply', 'Analyse', 'Evaluate', 'Create'] as const;

export type UnitTestVersion = 'A' | 'B';

export interface UnitTestOption {
  id: string;
  text: string;
}

export interface UnitTestQuestion {
  id: string;
  prompt: string;
  options: UnitTestOption[];
  /** Option id, stored as `opt:0` so grading survives a translated label. */
  answerId: string;
  marks: number;
  bloom: string;
  lessonId: string;
  explanation?: string;
}

export interface UnitTestContent {
  intelligence?: string;
  versionA: UnitTestQuestion[];
  versionB: UnitTestQuestion[];
}

export function emptyUnitTest(): UnitTestContent {
  return { versionA: [], versionB: [] };
}

export function isUnitTestLesson(lesson: { lessonType?: string; isUnitQuiz?: boolean } | null | undefined): boolean {
  return lesson?.lessonType === 'unit_test' || lesson?.isUnitQuiz === true;
}

export function clampPassMark(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_UNIT_TEST_PASS_MARK;
  return Math.min(100, Math.max(1, Math.round(value)));
}

function isSet(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Course pass mark wins over a unit that is still on the default 70.
 * An explicit unit override (`unitTestPassMark`) always wins.
 * A legacy `masteryThreshold` other than 70 still wins when the course mark is set.
 */
export function resolvePassMark(
  course?: { unitTestPassMark?: number } | null,
  unit?: { unitTestPassMark?: number; masteryThreshold?: number } | null,
): number {
  if (isSet(unit?.unitTestPassMark)) return clampPassMark(unit.unitTestPassMark);
  const courseMark = isSet(course?.unitTestPassMark) ? clampPassMark(course.unitTestPassMark) : null;
  const legacy = isSet(unit?.masteryThreshold) ? clampPassMark(unit.masteryThreshold) : null;
  if (courseMark != null && (legacy == null || legacy === DEFAULT_UNIT_TEST_PASS_MARK)) return courseMark;
  if (legacy != null) return legacy;
  return courseMark ?? DEFAULT_UNIT_TEST_PASS_MARK;
}

export function versionForAttempt(attemptNumber: number): UnitTestVersion {
  const n = Math.max(1, Math.floor(attemptNumber) || 1);
  return n % 2 === 1 ? 'A' : 'B';
}

export function questionsForVersion(content: UnitTestContent | undefined, version: UnitTestVersion): UnitTestQuestion[] {
  if (!content) return [];
  const rows = version === 'B' ? content.versionB : content.versionA;
  return Array.isArray(rows) ? rows : [];
}

export interface GradedResponse {
  questionIndex: number;
  question: string;
  selected: string;
  correct: boolean;
  marks: number;
  marksAwarded: number;
  bloom?: string;
  lessonId?: string;
  sourceLessonId?: string;
  objectiveCode?: string;
}

export interface GradeResult {
  responses: GradedResponse[];
  marksAwarded: number;
  marksMax: number;
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  recommendedLessonIds: string[];
  weakestObjective?: string;
}

function questionMarks(marks: number | undefined): number {
  if (typeof marks !== 'number' || !Number.isFinite(marks) || marks <= 0) return 1;
  return marks;
}

export function gradeUnitTest(
  questions: UnitTestQuestion[],
  selectedById: Record<string, string>,
  passMark: number,
): GradeResult {
  const wrongByBloom: Record<string, number> = {};
  const review = new Set<string>();
  const responses: GradedResponse[] = questions.map((q, index) => {
    const marks = questionMarks(q.marks);
    const selected = (selectedById[q.id] ?? '').trim();
    const correct = selected.length > 0 && selected === q.answerId;
    if (!correct) {
      if (q.bloom) wrongByBloom[q.bloom] = (wrongByBloom[q.bloom] ?? 0) + 1;
      if (q.lessonId.trim()) review.add(q.lessonId.trim());
    }
    return {
      questionIndex: index,
      question: q.prompt,
      selected,
      correct,
      marks,
      marksAwarded: correct ? marks : 0,
      ...(q.bloom ? { bloom: q.bloom, objectiveCode: q.bloom } : {}),
      ...(q.lessonId.trim() ? { lessonId: q.lessonId.trim(), sourceLessonId: q.lessonId.trim() } : {}),
    };
  });
  const marksAwarded = responses.reduce((sum, row) => sum + row.marksAwarded, 0);
  const marksMax = responses.reduce((sum, row) => sum + row.marks, 0);
  const percentage = marksMax > 0 ? Math.round((marksAwarded / marksMax) * 100) : 0;
  let weakestObjective: string | undefined;
  let maxWrong = 0;
  for (const [code, wrong] of Object.entries(wrongByBloom)) {
    if (wrong > maxWrong) {
      maxWrong = wrong;
      weakestObjective = code;
    }
  }
  return {
    responses,
    marksAwarded,
    marksMax,
    score: marksAwarded,
    total: marksMax,
    percentage,
    passed: percentage >= clampPassMark(passMark),
    recommendedLessonIds: [...review],
    weakestObjective,
  };
}

export interface AttemptSnapshot {
  passed: boolean;
  attemptNumber: number;
  completedAtMs: number;
  recommendedLessonIds?: string[];
  lessonId?: string;
}

export function completedAtMs(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object' && 'toMillis' in value) {
    const fn = (value as { toMillis?: unknown }).toMillis;
    if (typeof fn === 'function') {
      const n = fn.call(value);
      return typeof n === 'number' && Number.isFinite(n) ? n : 0;
    }
  }
  return 0;
}

export function toAttemptSnapshot(attempt: {
  passed?: boolean;
  attemptNumber?: number;
  completedAt?: unknown;
  recommendedLessonIds?: string[];
  lessonId?: string;
}): AttemptSnapshot {
  return {
    passed: attempt.passed === true,
    attemptNumber: attempt.attemptNumber ?? 0,
    completedAtMs: completedAtMs(attempt.completedAt),
    recommendedLessonIds: attempt.recommendedLessonIds,
    lessonId: attempt.lessonId,
  };
}

export interface ReviewGate {
  locked: boolean;
  pendingLessonIds: string[];
  nextVersion: UnitTestVersion;
  nextAttemptNumber: number;
}

/** A failed unit test stays locked until every flagged lesson is completed after that attempt. */
export function reviewGate(
  attempts: AttemptSnapshot[],
  lessonCompletedAt: Record<string, number> | undefined,
  lessonId?: string,
): ReviewGate {
  const mine = lessonId ? attempts.filter((a) => !a.lessonId || a.lessonId === lessonId) : attempts;
  const ordered = [...mine].sort((a, b) => a.attemptNumber - b.attemptNumber || a.completedAtMs - b.completedAtMs);
  const nextAttemptNumber = Math.max(ordered.length, ordered[ordered.length - 1]?.attemptNumber ?? 0) + 1;
  const nextVersion = versionForAttempt(nextAttemptNumber);
  const latest = ordered[ordered.length - 1];
  if (!latest || latest.passed) {
    return { locked: false, pendingLessonIds: [], nextVersion, nextAttemptNumber };
  }
  const needed = [...new Set((latest.recommendedLessonIds ?? []).map((id) => id.trim()).filter(Boolean))];
  const done = lessonCompletedAt ?? {};
  const pendingLessonIds = needed.filter((id) => (done[id] ?? 0) <= latest.completedAtMs);
  return {
    locked: pendingLessonIds.length > 0,
    pendingLessonIds,
    nextVersion,
    nextAttemptNumber,
  };
}

export function applyReviewLock<T extends string>(
  status: T,
  lesson: { id: string; lessonType?: string },
  attempts: Parameters<typeof toAttemptSnapshot>[0][],
  lessonCompletedAt?: Record<string, number>,
): T | 'locked' {
  if (status === 'completed') return status;
  if (lesson.lessonType !== 'unit_test') return status;
  const gate = reviewGate(attempts.map(toAttemptSnapshot), lessonCompletedAt, lesson.id);
  return gate.locked ? 'locked' : status;
}

export function previousUnitUnlocked(
  units: { module: { id: string }; lessons: { lessonType?: string; isUnitQuiz?: boolean }[] }[],
  index: number,
  attempts: { unitId?: string; passed?: boolean }[],
): boolean {
  if (index <= 0) return true;
  const prev = units[index - 1];
  if (!prev) return true;
  if (!prev.lessons.some(isUnitTestLesson)) return true;
  return attempts.some((a) => a.unitId === prev.module.id && a.passed === true);
}

export interface ItemStat {
  key: string;
  version: string;
  prompt: string;
  bloom?: string;
  lessonId?: string;
  marks: number;
  attempts: number;
  correct: number;
  marksAwarded: number;
  marksMax: number;
}

export function itemAnalysis(attempts: {
  version?: string;
  responses?: {
    questionIndex?: number;
    question?: string;
    correct?: boolean;
    marks?: number;
    marksAwarded?: number;
    bloom?: string;
    lessonId?: string;
    sourceLessonId?: string;
  }[];
}[]): ItemStat[] {
  const groups = new Map<string, ItemStat>();
  for (const attempt of attempts) {
    const version = attempt.version === 'B' ? 'B' : attempt.version === 'A' ? 'A' : '—';
    for (const row of attempt.responses ?? []) {
      const prompt = (row.question ?? '').trim() || `Question ${(row.questionIndex ?? 0) + 1}`;
      const key = `${version}:${row.questionIndex ?? prompt}`;
      const marks = questionMarks(row.marks);
      const current = groups.get(key) ?? {
        key,
        version,
        prompt,
        bloom: row.bloom,
        lessonId: row.lessonId || row.sourceLessonId,
        marks,
        attempts: 0,
        correct: 0,
        marksAwarded: 0,
        marksMax: 0,
      };
      current.attempts += 1;
      if (row.correct) current.correct += 1;
      current.marksAwarded += row.correct ? (row.marksAwarded ?? marks) : 0;
      current.marksMax += marks;
      groups.set(key, current);
    }
  }
  return [...groups.values()];
}

export function parentExplainer(input: {
  unitTitle: string;
  percentage: number;
  passed: boolean;
  passMark: number;
  version?: string;
  reviewTitles: string[];
  timeTakenSeconds?: number;
}): string[] {
  const version = input.version === 'A' || input.version === 'B' ? ` Version ${input.version}` : '';
  const lines = [
    `${input.unitTitle}: ${input.percentage}% on the Unit Test${version}. The pass mark is ${input.passMark}%.`,
  ];
  if (input.passed) {
    lines.push('This pass unlocks the next module. Lesson order inside a module is unchanged: each lesson still needs the one before it.');
  } else {
    lines.push('The unit test stays locked until the flagged lessons are completed again. The retake then uses the other version.');
    if (input.reviewTitles.length) lines.push(`Review these lessons: ${input.reviewTitles.join(', ')}.`);
  }
  if (typeof input.timeTakenSeconds === 'number' && input.timeTakenSeconds >= 0) {
    const minutes = Math.floor(input.timeTakenSeconds / 60);
    const seconds = input.timeTakenSeconds % 60;
    lines.push(`Time on the latest attempt: ${minutes}m ${seconds.toString().padStart(2, '0')}s.`);
  }
  return lines;
}

export type AnalyticsBloom = 'remember' | 'understand' | 'apply' | 'analyse' | 'evaluate' | 'create';

const BLOOM_KEY: Record<string, AnalyticsBloom> = {
  remember: 'remember',
  understand: 'understand',
  apply: 'apply',
  analyse: 'analyse',
  analyze: 'analyse',
  evaluate: 'evaluate',
  create: 'create',
};

export function bloomKey(value: string | undefined): AnalyticsBloom | undefined {
  if (!value) return undefined;
  return BLOOM_KEY[value.trim().toLowerCase()];
}

export interface UnitTestQuizPoint {
  at: string;
  score: number;
  max: number;
  unitId?: string;
  lessonId?: string;
  courseId?: string;
  bloom?: AnalyticsBloom;
  prompt?: string;
  topic?: string;
  correct?: boolean;
  seconds?: number;
  attempts?: number;
}

/** One summary point (keeps module mastery) plus one point per question (feeds item and Bloom charts). */
export function quizPointsFromAttempt(attempt: {
  completedAt?: unknown;
  score?: number;
  total?: number;
  marksAwarded?: number;
  marksMax?: number;
  percentage?: number;
  unitId?: string;
  lessonId?: string;
  courseId?: string;
  passed?: boolean;
  timeTakenSeconds?: number;
  attemptNumber?: number;
  version?: string;
  responses?: {
    question: string;
    correct: boolean;
    marks?: number;
    marksAwarded?: number;
    bloom?: string;
    lessonId?: string;
  }[];
}, fallbackAt = ''): UnitTestQuizPoint[] {
  const ms = completedAtMs(attempt.completedAt);
  const at = ms > 0 ? new Date(ms).toISOString() : fallbackAt;
  const score = attempt.marksAwarded ?? attempt.score ?? 0;
  const max = attempt.marksMax ?? attempt.total ?? 0;
  const summary: UnitTestQuizPoint = {
    at,
    score,
    max: max > 0 ? max : 1,
    unitId: attempt.unitId,
    lessonId: attempt.lessonId,
    courseId: attempt.courseId,
    topic: 'Unit Test',
    correct: attempt.passed === true,
    seconds: attempt.timeTakenSeconds,
    attempts: attempt.attemptNumber,
    prompt: attempt.version ? `Version ${attempt.version}` : 'Unit Test',
  };
  const questions: UnitTestQuizPoint[] = (attempt.responses ?? []).map((row) => ({
    at,
    score: row.marksAwarded ?? (row.correct ? questionMarks(row.marks) : 0),
    max: questionMarks(row.marks),
    lessonId: row.lessonId || attempt.lessonId,
    courseId: attempt.courseId,
    bloom: bloomKey(row.bloom),
    prompt: row.question,
    topic: row.bloom || 'Unit Test',
    correct: row.correct,
    seconds: attempt.timeTakenSeconds,
    attempts: attempt.attemptNumber,
  }));
  return [summary, ...questions];
}

function optionIdAt(index: number): string {
  return `opt:${index}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normaliseOptions(value: unknown): UnitTestOption[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).map((item, index) => {
    if (typeof item === 'string') return { id: optionIdAt(index), text: item.trim() };
    const row = asRecord(item);
    const text = typeof row?.text === 'string' ? row.text.trim() : '';
    return { id: optionIdAt(index), text };
  }).filter((opt) => opt.text.length > 0);
}

function resolveAnswerId(answer: unknown, options: UnitTestOption[]): string {
  const raw = typeof answer === 'string' ? answer.trim() : '';
  if (!raw) return options[0]?.id ?? optionIdAt(0);
  if (/^opt:\d+$/.test(raw)) return raw;
  const letter = /^[A-H]$/i.exec(raw);
  if (letter) {
    const index = letter[0].toUpperCase().charCodeAt(0) - 65;
    return options[index]?.id ?? optionIdAt(index);
  }
  const byText = options.find((opt) => opt.text.toLowerCase() === raw.toLowerCase());
  return byText?.id ?? options[0]?.id ?? optionIdAt(0);
}

function normaliseQuestion(value: unknown, index: number): UnitTestQuestion | null {
  const row = asRecord(value);
  if (!row) return null;
  const prompt = typeof row.prompt === 'string' ? row.prompt.trim()
    : typeof row.question === 'string' ? row.question.trim() : '';
  if (!prompt) return null;
  const options = normaliseOptions(row.options ?? [row.optionA, row.optionB, row.optionC, row.optionD].filter((v) => typeof v === 'string'));
  if (options.length < 2) return null;
  const bloom = typeof row.bloom === 'string' && row.bloom.trim() ? row.bloom.trim() : 'Understand';
  const lessonId = typeof row.lessonId === 'string' ? row.lessonId.trim()
    : typeof row.sourceLessonId === 'string' ? row.sourceLessonId.trim() : '';
  const marks = typeof row.marks === 'number' ? row.marks : Number(row.marks);
  const id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : `q-${index + 1}`;
  return {
    id,
    prompt,
    options,
    answerId: resolveAnswerId(row.answerId ?? row.answer, options),
    marks: questionMarks(Number.isFinite(marks) ? marks : undefined),
    bloom,
    lessonId,
    ...(typeof row.explanation === 'string' && row.explanation.trim() ? { explanation: row.explanation.trim() } : {}),
  };
}

function splitVersions(rows: unknown[]): { versionA: UnitTestQuestion[]; versionB: UnitTestQuestion[] } {
  const versionA: UnitTestQuestion[] = [];
  const versionB: UnitTestQuestion[] = [];
  rows.forEach((row, index) => {
    const record = asRecord(row);
    const version = typeof record?.version === 'string' ? record.version.trim().toUpperCase() : 'A';
    const question = normaliseQuestion(row, index);
    if (!question) return;
    if (version === 'B') versionB.push(question);
    else versionA.push(question);
  });
  return { versionA, versionB };
}

function parseCsv(text: string): unknown[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? '';
    });
    const options = ['optionA', 'optionB', 'optionC', 'optionD', 'optionE', 'optionF']
      .map((key) => row[key])
      .filter((value) => value && value.trim());
    return {
      version: row.version || row.Version || 'A',
      prompt: row.prompt || row.question || row.Prompt || '',
      options,
      answer: row.answer || row.answerId || row.Answer || '',
      marks: row.marks || row.Marks || '',
      bloom: row.bloom || row.Bloom || '',
      lessonId: row.lessonId || row.lesson || row.LessonId || '',
      explanation: row.explanation || '',
    };
  });
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

export interface UnitTestImport {
  title?: string;
  passMark?: number;
  content: UnitTestContent;
  errors: string[];
}

export function parseUnitTestImport(raw: string): UnitTestImport {
  const text = raw.replace(/^\uFEFF/, '').trim();
  const errors: string[] = [];
  if (!text) return { content: emptyUnitTest(), errors: ['The file is empty.'] };

  const jsonStart = text.indexOf('{');
  const jsonArray = text.indexOf('[');
  const looksJson = jsonStart >= 0 && (jsonArray < 0 || jsonStart < jsonArray);
  const looksArray = jsonArray >= 0 && (jsonStart < 0 || jsonArray < jsonStart);
  if (looksJson || looksArray) {
    const slice = text.slice(looksArray ? jsonArray : jsonStart);
    try {
      const parsed = JSON.parse(slice) as unknown;
      if (Array.isArray(parsed)) {
        const split = splitVersions(parsed);
        if (!split.versionA.length && !split.versionB.length) errors.push('No questions could be read.');
        return { content: split, errors };
      }
      const record = asRecord(parsed);
      if (!record) return { content: emptyUnitTest(), errors: ['JSON must be an object or a list of questions.'] };
      const versionA = Array.isArray(record.versionA) ? splitVersions(record.versionA.map((row) => ({ ...(asRecord(row) ?? {}), version: 'A' }))).versionA : [];
      const versionB = Array.isArray(record.versionB) ? splitVersions(record.versionB.map((row) => ({ ...(asRecord(row) ?? {}), version: 'A' }))).versionA : [];
      const flat = Array.isArray(record.questions) ? splitVersions(record.questions) : { versionA: [], versionB: [] };
      const content: UnitTestContent = {
        versionA: versionA.length ? versionA : flat.versionA,
        versionB: versionB.length ? versionB : flat.versionB,
        ...(typeof record.intelligence === 'string' && record.intelligence.trim()
          ? { intelligence: record.intelligence.trim() }
          : {}),
      };
      if (!content.versionA.length && !content.versionB.length) errors.push('Add at least one question to version A or version B.');
      const passRaw = typeof record.passMark === 'number' ? record.passMark : Number(record.passMark);
      return {
        title: typeof record.title === 'string' ? record.title.trim() : undefined,
        ...(Number.isFinite(passRaw) ? { passMark: clampPassMark(passRaw) } : {}),
        content,
        errors,
      };
    } catch {
      errors.push('That JSON could not be read. See docs/unit-test-schema.md.');
      return { content: emptyUnitTest(), errors };
    }
  }

  const header = text.split(/\r?\n/, 1)[0]?.toLowerCase() ?? '';
  if (header.includes('prompt') || header.includes('question')) {
    const split = splitVersions(parseCsv(text));
    if (!split.versionA.length && !split.versionB.length) errors.push('No CSV rows could be read. Check the header row.');
    return { content: split, errors };
  }
  return { content: emptyUnitTest(), errors: ['Use the JSON or CSV schema in docs/unit-test-schema.md.'] };
}
