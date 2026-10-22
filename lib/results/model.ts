import type { FlowStep } from '@/lib/flow/steps';
import { SCHOOL_BOARDS } from '@/lib/pathways/catalog';
import { isSuperAdminEmail } from '@/lib/roles';
import { LEVELS } from '@/lib/year-groups';
import { resultsPageAllowed } from './access';
import { RESULT_COPY } from './copy';

export { resultsPageAllowed };

/** Qualification bands a learner can record. IGCSE and A-Level use the shared programme values. */
export const RESULT_LEVELS = [
  { value: 'IGCSE', label: 'IGCSE / O-Level' },
  { value: 'A-Level', label: 'A-Level' },
  { value: 'Degree', label: 'Degree' },
  { value: 'Masters', label: 'Masters' },
  { value: 'PhD', label: 'PhD' },
] as const;

export type ResultLevel = (typeof RESULT_LEVELS)[number]['value'];

export const RESULT_STEPS: readonly FlowStep[] = [
  { id: 'level', label: RESULT_COPY.stepLevel },
  { id: 'subject', label: RESULT_COPY.stepSubject },
  { id: 'grade', label: RESULT_COPY.stepGrade },
  { id: 'certificate', label: RESULT_COPY.stepCertificate },
];

export const RESULT_STEP_IDS = ['level', 'subject', 'grade', 'certificate'] as const;
export type ResultStepId = (typeof RESULT_STEP_IDS)[number];

export type ResultStatus = 'self-reported' | 'verified';

export const FILE_MIMES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'] as const;
export type ResultFileMime = (typeof FILE_MIMES)[number];
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

export interface ClientResult {
  id: string;
  studentId: string;
  level: string;
  levelLabel: string;
  subject: string;
  board: string;
  grade: string;
  session: string;
  status: ResultStatus;
  statusLabel: string;
  fileName: string | null;
  hasFile: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PublicResult {
  levelLabel: string;
  subject: string;
  board: string;
  grade: string;
  session: string;
  statusLabel: string;
}

export interface SessionEntry {
  subject: string;
  grade: string;
  levelLabel: string;
}

export interface SessionProgress {
  session: string;
  entries: SessionEntry[];
}

export interface DeskChild {
  id: string;
  name: string;
}

export interface DeskView {
  role: 'student' | 'parent' | 'admin' | 'institution';
  studentId: string;
  rows: ClientResult[];
  progress: SessionProgress[];
  canEdit: boolean;
  canVerify: boolean;
  share: { enabled: boolean; path: string } | null;
  children: DeskChild[];
  needsStudent: boolean;
}

export function isResultLevel(value: string): value is ResultLevel {
  return RESULT_LEVELS.some((level) => level.value === value);
}

export function usesSchoolBoards(level: string): boolean {
  return level === 'IGCSE' || level === 'A-Level';
}

export function levelLabel(value: string): string {
  return RESULT_LEVELS.find((level) => level.value === value)?.label ?? value;
}

export function statusLabel(status: ResultStatus): string {
  return status === 'verified' ? RESULT_COPY.verified : RESULT_COPY.selfReported;
}

/** IGCSE and A-Level are the shared programme values. Degree bands are not new pathways. */
export function schoolBandsUseSharedLevels(): boolean {
  const values = new Set(LEVELS.map((level) => level.value));
  return values.has('IGCSE') && values.has('A-Level');
}

export function degreeBandsAreNotProgrammes(): boolean {
  const values = new Set(LEVELS.map((level) => level.value));
  return !values.has('Degree') && !values.has('Masters') && !values.has('PhD') && !values.has('O-Level');
}

export function boardsMatchSharedList(): boolean {
  return SCHOOL_BOARDS.length === 3
    && SCHOOL_BOARDS[0] === 'Cambridge International'
    && SCHOOL_BOARDS[1] === 'Pearson Edexcel'
    && SCHOOL_BOARDS[2] === 'OxfordAQA';
}

export function validBoard(level: string, board: string): boolean {
  const text = board.trim();
  if (text.length < 1 || text.length > 80) return false;
  if (usesSchoolBoards(level)) return (SCHOOL_BOARDS as readonly string[]).includes(text);
  return true;
}

export function isFileMime(value: string): value is ResultFileMime {
  return (FILE_MIMES as readonly string[]).includes(value);
}

/** A learner cannot mark their own entry verified. */
export function studentSaveStatus(requested: unknown): ResultStatus {
  void requested;
  return 'self-reported';
}

export function canVerifyResult(
  actor: { role?: string | null; email?: string | null; institutionId?: string | null },
  student: { institutionId?: string | null },
): boolean {
  if (actor.role === 'admin' || isSuperAdminEmail(actor.email)) return true;
  if (actor.role !== 'institution_admin') return false;
  return !!actor.institutionId && actor.institutionId === (student.institutionId ?? '');
}

export function progressBySession(rows: {
  session: string;
  subject: string;
  grade: string;
  level: string;
  createdAt: number;
}[]): SessionProgress[] {
  const ordered = [...rows].sort((a, b) => a.createdAt - b.createdAt || a.subject.localeCompare(b.subject));
  const groups: SessionProgress[] = [];
  for (const row of ordered) {
    const session = row.session.trim() || RESULT_COPY.sessionUnset;
    let group = groups.find((item) => item.session === session);
    if (!group) {
      group = { session, entries: [] };
      groups.push(group);
    }
    group.entries.push({
      subject: row.subject,
      grade: row.grade,
      levelLabel: levelLabel(row.level),
    });
  }
  return groups;
}

function asText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function asRole(value: unknown): DeskView['role'] {
  if (value === 'parent' || value === 'admin' || value === 'institution' || value === 'student') return value;
  return 'student';
}

export function parseClientResult(value: unknown): ClientResult | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const id = asText(row.id, 128);
  if (!id) return null;
  const status: ResultStatus = row.status === 'verified' ? 'verified' : 'self-reported';
  return {
    id,
    studentId: asText(row.studentId, 128),
    level: asText(row.level, 40),
    levelLabel: asText(row.levelLabel, 80),
    subject: asText(row.subject, 80),
    board: asText(row.board, 80),
    grade: asText(row.grade, 20),
    session: asText(row.session, 40),
    status,
    statusLabel: asText(row.statusLabel, 80) || statusLabel(status),
    fileName: asText(row.fileName, 80) || null,
    hasFile: row.hasFile === true,
    createdAt: typeof row.createdAt === 'number' ? row.createdAt : 0,
    updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : 0,
  };
}

export function parseDesk(value: unknown): DeskView {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const shareData = data.share && typeof data.share === 'object' ? data.share as Record<string, unknown> : null;
  const children = Array.isArray(data.children)
    ? data.children.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const child = item as Record<string, unknown>;
      const id = asText(child.id, 128);
      if (!id) return [];
      return [{ id, name: asText(child.name, 80) || RESULT_COPY.linkedLearner }];
    })
    : [];
  const progress = Array.isArray(data.progress)
    ? data.progress.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const group = item as Record<string, unknown>;
      const session = asText(group.session, 40);
      if (!session) return [];
      const entries = Array.isArray(group.entries)
        ? group.entries.flatMap((entry) => {
          if (!entry || typeof entry !== 'object') return [];
          const row = entry as Record<string, unknown>;
          return [{
            subject: asText(row.subject, 80),
            grade: asText(row.grade, 20),
            levelLabel: asText(row.levelLabel, 80),
          }];
        })
        : [];
      return [{ session, entries }];
    })
    : [];
  return {
    role: asRole(data.role),
    studentId: asText(data.studentId, 128),
    rows: Array.isArray(data.rows) ? data.rows.flatMap((row) => {
      const parsed = parseClientResult(row);
      return parsed ? [parsed] : [];
    }) : [],
    progress,
    canEdit: data.canEdit === true,
    canVerify: data.canVerify === true,
    share: shareData ? { enabled: shareData.enabled === true, path: asText(shareData.path, 160) } : null,
    children,
    needsStudent: data.needsStudent === true,
  };
}
