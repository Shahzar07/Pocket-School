import { BOARD_STYLES } from '@/lib/essay/board-styles';
import { resolveLevel } from '@/lib/levels';
import { PROGRAMMES } from '@/lib/programmes';
import type { ExamPack } from './exam-packs';

/** Subjects an admin can assign. Empty ones stay on the filter as coming soon. */
const NAMED_SUBJECTS = ['Mathematics', 'Science', 'English', 'Business'] as const;

export function subjectSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function officialSubjectOptions(): { slug: string; label: string }[] {
  const labels = new Set<string>(NAMED_SUBJECTS);
  for (const programme of PROGRAMMES) {
    for (const subject of programme.subjects) labels.add(subject);
  }
  return [...labels]
    .sort((a, b) => a.localeCompare(b))
    .map((label) => ({ slug: subjectSlug(label), label }));
}

export function packSubject(pack: ExamPack): string {
  return pack.subject?.trim() || 'Mathematics';
}

export function packLearnerLevel(pack: ExamPack): string {
  const stored = resolveLevel(pack.learnerLevel);
  if (stored) return stored;
  const level = pack.level.toLowerCase();
  if (level.includes('a level') || level.includes('as')) return 'a-level';
  if (level.includes('sl') || pack.board.toLowerCase().startsWith('diploma')) return 'pre-university';
  return 'igcse';
}

export function packBoardStyle(pack: ExamPack): string {
  if (pack.boardStyle && BOARD_STYLES.some((item) => item.id === pack.boardStyle)) return pack.boardStyle;
  const board = pack.board.toLowerCase();
  const level = packLearnerLevel(pack);
  if (board.startsWith('diploma') || pack.id.startsWith('ib-')) return 'ib';
  if (board.startsWith('national') || pack.id.startsWith('spm-')) return 'spm';
  if (level === 'a-level') return 'cambridge-alevel';
  return 'cambridge-igcse';
}

export function filterPacks(packs: readonly ExamPack[], filter: { subject?: string; level?: string; board?: string }): ExamPack[] {
  const subject = filter.subject?.trim() ? subjectSlug(filter.subject) : '';
  const level = filter.level?.trim() ? resolveLevel(filter.level) : null;
  const board = filter.board?.trim() ?? '';
  return packs.filter((pack) => {
    if (subject && subjectSlug(packSubject(pack)) !== subject) return false;
    if (level && packLearnerLevel(pack) !== level) return false;
    if (board && packBoardStyle(pack) !== board) return false;
    return true;
  });
}
