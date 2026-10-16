/**
 * Essays stay on this device, including the assist log a teacher reads.
 * Older records had a mark and no status. Those stay marked.
 */

import { isEssayLevel, type EssayLevel } from '@/lib/essays/coaching';
import { ESSAY_FLAG_STATUS } from '@/lib/essays/config';
import type { EssayMark } from '@/lib/essays/mark';
import type { EssayPlan } from '@/lib/essays/plan';
import type { GeneratedEssayQuestion } from '@/lib/essays/questions';
import type { EssayPolicy } from '@/lib/essays/submit';

export const ESSAY_STORAGE_KEY = 'poket-et-essays';
export const ESSAY_POLICY_KEY = 'poket-et-essays-policy';

export type EssayStatus = 'draft' | 'marked' | 'flagged' | 'released';
export type AssistKind = 'question' | 'plan' | 'exemplar' | 'submit' | 'flag' | 'override' | 'resubmit';

export interface AssistEntry {
  at: number;
  kind: AssistKind;
  note: string;
}

export interface EssayEvidence {
  label: string;
  detail: string;
}

export interface StoredEssay {
  id: string;
  title: string;
  prompt: string;
  idea: string;
  level: EssayLevel;
  body: string;
  mark: EssayMark | null;
  status: EssayStatus;
  message: string;
  plan: EssayPlan | null;
  question: GeneratedEssayQuestion | null;
  assist: AssistEntry[];
  evidence: EssayEvidence[];
  caseId?: string;
  updatedAt: number;
}

const STATUSES: EssayStatus[] = ['draft', 'marked', 'flagged', 'released'];

export function defaultPolicy(): EssayPolicy {
  return { planningEnabled: true };
}

export function statusText(essay: Pick<StoredEssay, 'status' | 'mark'>): string {
  if (essay.status === 'flagged') return ESSAY_FLAG_STATUS;
  if ((essay.status === 'marked' || essay.status === 'released') && essay.mark) {
    return `${essay.mark.percent}% · ${essay.mark.grade91} · ${essay.mark.gradeAU}`;
  }
  return 'In progress';
}

export function normalizeEssay(raw: unknown): StoredEssay | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Partial<StoredEssay>;
  if (typeof record.id !== 'string' || !record.id) return null;
  const mark = record.mark && typeof record.mark === 'object' ? record.mark : null;
  const status = STATUSES.includes(record.status as EssayStatus)
    ? record.status as EssayStatus
    : mark ? 'marked' : 'draft';
  return {
    id: record.id,
    title: typeof record.title === 'string' && record.title.trim() ? record.title : 'Untitled essay',
    prompt: typeof record.prompt === 'string' ? record.prompt : '',
    idea: typeof record.idea === 'string' ? record.idea : '',
    level: typeof record.level === 'string' && isEssayLevel(record.level) ? record.level : 'igcse',
    body: typeof record.body === 'string' ? record.body : '',
    mark: status === 'flagged' ? null : mark,
    status,
    message: typeof record.message === 'string' ? record.message : '',
    plan: record.plan && typeof record.plan === 'object' ? record.plan : null,
    question: record.question && typeof record.question === 'object' && typeof record.question.question === 'string' ? record.question : null,
    assist: Array.isArray(record.assist) ? record.assist.filter(entry => entry && typeof entry.note === 'string') : [],
    evidence: Array.isArray(record.evidence) ? record.evidence.filter(item => item && typeof item.label === 'string') : [],
    caseId: typeof record.caseId === 'string' ? record.caseId : undefined,
    updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : 0,
  };
}

export function readEssays(): StoredEssay[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(ESSAY_STORAGE_KEY) || '[]') as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeEssay).filter((item): item is StoredEssay => item !== null);
  } catch {
    return [];
  }
}

export function writeEssays(essays: StoredEssay[]) {
  localStorage.setItem(ESSAY_STORAGE_KEY, JSON.stringify(essays.slice(0, 40)));
}

export function readPolicy(): EssayPolicy {
  if (typeof window === 'undefined') return defaultPolicy();
  try {
    const parsed = JSON.parse(localStorage.getItem(ESSAY_POLICY_KEY) || '') as Partial<EssayPolicy>;
    if (typeof parsed.planningEnabled === 'boolean') return { planningEnabled: parsed.planningEnabled };
  } catch {
    /* a missing policy means planning stays available */
  }
  return defaultPolicy();
}

export function writePolicy(policy: EssayPolicy) {
  localStorage.setItem(ESSAY_POLICY_KEY, JSON.stringify({ planningEnabled: policy.planningEnabled }));
}
