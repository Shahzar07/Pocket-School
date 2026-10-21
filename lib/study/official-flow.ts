import { BOARD_STYLES } from '@/lib/essay/board-styles';
import { resolveLevel } from '@/lib/levels';
import { gradeFor } from './grades';
import { isFreeTopic, packTopics, type ExamPack, type PackTopic } from './exam-packs';
import { subjectSlug } from './pack-catalog';
import type { GradeScaleId } from './types';

export const STUDENT_STEPS = [
  { id: 'level', label: 'Level' },
  { id: 'board', label: 'Board' },
  { id: 'subject', label: 'Subject' },
  { id: 'pack', label: 'Pack' },
  { id: 'topic', label: 'Topic' },
  { id: 'practice', label: 'Practice' },
  { id: 'results', label: 'Results' },
] as const;

export const ADMIN_STEPS = [
  { id: 'pack', label: 'Pack' },
  { id: 'units', label: 'Units & topics' },
  { id: 'questions', label: 'Questions' },
  { id: 'preview', label: 'Preview' },
  { id: 'publish', label: 'Publish' },
] as const;

export type StudentStepId = (typeof STUDENT_STEPS)[number]['id'];
export type AdminStepId = (typeof ADMIN_STEPS)[number]['id'];

export interface ExamChoice {
  level: string;
  board: string;
  subject: string;
  packId?: string;
  topicId?: string;
}

export { flowIndex, flowKeyTarget } from '@/lib/flow/steps';

export function levelHref(): string {
  return '/dashboard/studio/exams/packs';
}

export function boardHref(level: string): string {
  return `/dashboard/studio/exams/packs/board/${encodeURIComponent(level)}`;
}

export function subjectHref(level: string, board: string): string {
  return `/dashboard/studio/exams/packs/subject/${encodeURIComponent(level)}/${encodeURIComponent(board)}`;
}

export function browseHref(level: string, board: string, subject: string): string {
  const subjectPart = subjectSlug(subject) || 'all';
  return `/dashboard/studio/exams/packs/browse/${encodeURIComponent(level || 'all')}/${encodeURIComponent(board || 'all')}/${encodeURIComponent(subjectPart)}`;
}

export function packHref(packId: string): string {
  return `/dashboard/studio/exams/packs/${packId}`;
}

export function topicHref(packId: string, topicId: string): string {
  return `/dashboard/studio/exams/packs/${packId}/topics/${topicId}`;
}

export function practiceHref(packId: string, topicId: string, difficulty?: string): string {
  const base = `/dashboard/studio/exams/packs/${packId}/topics/${topicId}/practice`;
  return difficulty ? `${base}?difficulty=${encodeURIComponent(difficulty)}` : base;
}

export function markingHref(packId: string, topicId: string): string {
  return `/dashboard/studio/exams/packs/${packId}/topics/${topicId}/marking`;
}

export function resultsHref(packId: string, topicId: string): string {
  return `/dashboard/studio/exams/packs/${packId}/topics/${topicId}/results`;
}

export function mockHref(packId: string): string {
  return `/dashboard/studio/exams/packs/${packId}/mock`;
}

export function readinessHref(packId: string): string {
  return `/dashboard/studio/exams/packs/${packId}/readiness`;
}

export function adminHref(step: AdminStepId): string {
  if (step === 'pack') return '/dashboard/admin/exam-packs';
  return `/dashboard/admin/exam-packs/${step}`;
}

/** Href for a completed trail step. Future steps stay plain text. */
export function studentCrumbHref(step: StudentStepId, choice: ExamChoice): string | null {
  if (step === 'level') return levelHref();
  if (step === 'board' && choice.level) return boardHref(choice.level);
  if (step === 'subject' && choice.level && choice.board) return subjectHref(choice.level, choice.board);
  if (step === 'pack' && choice.packId) return packHref(choice.packId);
  if (step === 'pack' && choice.subject) return browseHref(choice.level || 'all', choice.board || 'all', choice.subject);
  if (step === 'topic' && choice.packId && choice.topicId) return topicHref(choice.packId, choice.topicId);
  if (step === 'practice' && choice.packId && choice.topicId) return practiceHref(choice.packId, choice.topicId);
  if (step === 'results' && choice.packId && choice.topicId) return resultsHref(choice.packId, choice.topicId);
  if (step === 'results' && choice.packId) return readinessHref(choice.packId);
  return null;
}

export function knownLevel(value: string): boolean {
  return value === 'all' || Boolean(resolveLevel(value));
}

export function knownBoard(value: string): boolean {
  return value === 'all' || BOARD_STYLES.some((item) => item.id === value);
}

export interface FlowQuestion {
  question: string;
  marks: number;
  answer: string;
  solution: string;
  markScheme: string;
  paper: string;
  image?: string;
  examinerTip?: string;
}

export function questionsFromTopic(topic: PackTopic | null | undefined): FlowQuestion[] {
  return (topic?.questions ?? []).filter((item) => item.question && (item.solution || item.markScheme)).map((item) => ({
    question: item.question,
    marks: item.marks,
    answer: item.answer ?? '',
    solution: item.solution,
    markScheme: item.markScheme,
    paper: item.paper ?? '',
    ...(item.image ? { image: item.image } : {}),
    ...(item.examinerTip ? { examinerTip: item.examinerTip } : {}),
  }));
}

/**
 * Step-by-step hints taken from the worked method.
 * Lines that contain the final answer are left out. The last remaining line
 * stays hidden so a hint never becomes the answer.
 */
export function hintSteps(question: Pick<FlowQuestion, 'solution' | 'answer'>): string[] {
  const answer = question.answer.trim();
  const lines = question.solution.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const hidden = lines.filter((line) => !answer || !line.includes(answer));
  const source = hidden.length ? hidden : lines;
  const steps = source.slice(0, Math.max(0, source.length - 1)).slice(0, 4);
  if (steps.length === 0) return ['Write down what the question asks you to find, then the first step of the method.'];
  return steps;
}

export type MarkPart = 'method' | 'accuracy' | 'communication';

/** Split marks only when this question's scheme already names those parts. */
export function markParts(scheme: string): MarkPart[] | null {
  const text = scheme.toLowerCase();
  const parts: MarkPart[] = [];
  if (/\bmethod\b|\bm\d\b/.test(text)) parts.push('method');
  if (/\baccuracy\b|\ba\d\b/.test(text)) parts.push('accuracy');
  if (/\bcommunication\b|\bc\d\b/.test(text)) parts.push('communication');
  return parts.length >= 2 ? parts : null;
}

export function definedPapers(questions: readonly { paper?: string }[]): string[] {
  const names: string[] = [];
  for (const question of questions) {
    const name = question.paper?.trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

/** Full or half paper using only paper names the pack stored. */
export function mockQuestions<T extends { paper?: string }>(questions: readonly T[], length: 'full' | 'half'): { defined: boolean; papers: string[]; questions: T[] } {
  const papers = definedPapers(questions);
  if (papers.length === 0) return { defined: false, papers: [], questions: [] };
  if (length === 'full') {
    return { defined: true, papers, questions: questions.filter((item) => papers.includes(item.paper?.trim() ?? '')) };
  }
  if (papers.length === 1) {
    const inPaper = questions.filter((item) => item.paper?.trim() === papers[0]);
    const take = Math.max(1, Math.ceil(inPaper.length / 2));
    return { defined: true, papers, questions: inPaper.slice(0, take) };
  }
  const halfPapers = papers.slice(0, Math.max(1, Math.ceil(papers.length / 2)));
  return {
    defined: true,
    papers: halfPapers,
    questions: questions.filter((item) => halfPapers.includes(item.paper?.trim() ?? '')),
  };
}

export function neighborTopic(pack: ExamPack, topicId: string, direction: -1 | 1): string | null {
  const topics = packTopics(pack);
  const index = topics.findIndex((topic) => topic.id === topicId) + direction;
  if (index < 0 || index >= topics.length) return null;
  return topics[index]?.id ?? null;
}

export function weakQuestions<T extends { marks: number }>(questions: readonly T[], scores: readonly number[]): T[] {
  return questions.filter((question, index) => (scores[index] ?? 0) < question.marks);
}

export function percentScore(questions: readonly { marks: number }[], scores: readonly number[]): number {
  const total = questions.reduce((sum, question) => sum + question.marks, 0);
  const got = scores.reduce((sum, score) => sum + score, 0);
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((got / total) * 100)));
}

export function estimateFor(scale: GradeScaleId, percent: number): { label: 'ET AI estimate'; grade: string } {
  return { label: 'ET AI estimate', grade: gradeFor(scale, percent) };
}

export function revisionPlan(
  topics: readonly { id: string; title: string }[],
  mastery: Record<string, number>,
  examDate: string,
  today: string,
): { day: string; title: string }[] {
  const start = Date.parse(`${today}T00:00:00Z`);
  const end = Date.parse(`${examDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || topics.length === 0) return [];
  const days = Math.min(14, Math.floor((end - start) / 86_400_000) + 1);
  const ordered = [...topics].sort((a, b) => (mastery[a.id] ?? 0) - (mastery[b.id] ?? 0));
  return Array.from({ length: days }, (_, index) => {
    const topic = ordered[index % ordered.length];
    const day = new Date(start + index * 86_400_000).toISOString().slice(0, 10);
    return { day, title: topic?.title ?? '' };
  }).filter((row) => row.title);
}

export function lessonHref(subject: string): string {
  return subjectSlug(subject) === 'mathematics' ? '/dashboard/studio/teachers/et-maths' : '/dashboard/studio/teachers';
}

export function topicLocked(pack: ExamPack, topicId: string): boolean {
  return !isFreeTopic(pack, topicId);
}

export function collectPackQuestions(pack: ExamPack): (FlowQuestion & { topicId: string; topicTitle: string })[] {
  return packTopics(pack).flatMap((topic) => questionsFromTopic(topic).map((question) => ({
    ...question,
    topicId: topic.id,
    topicTitle: topic.title,
  })));
}
