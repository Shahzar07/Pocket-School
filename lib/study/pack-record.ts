import type { GradeScaleId } from './types';
import { EXAM_PACKS, type AuthoredQuestion, type ExamPack, type PackStatus, type PackTopic, type PackUnit } from './exam-packs';
import type { PackStore } from './pack-admin';

const SCALES: readonly GradeScaleId[] = ['spm', 'igcse', 'alevel', 'ib', 'percent'];
const STATUSES: readonly PackStatus[] = ['draft', 'published', 'hidden'];

export interface RemotePack extends ExamPack {
  status: PackStatus;
  freeFirstTopic: boolean;
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export function slugPackId(name: string, id?: string): string {
  const source = id?.trim() ? id : name;
  return slug(source);
}

function cleanQuestion(raw: unknown): AuthoredQuestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const question = text(row.question, 4000);
  const solution = text(row.solution, 8000);
  const markScheme = text(row.markScheme, 4000);
  if (!question || (!solution && !markScheme)) return null;
  const marks = Math.max(1, Math.min(12, Math.round(Number(row.marks) || 1)));
  const answer = text(row.answer, 500);
  const paper = text(row.paper, 40);
  return {
    question,
    marks,
    solution,
    markScheme,
    ...(answer ? { answer } : {}),
    ...(paper ? { paper } : {}),
  };
}

function cleanTopic(raw: unknown, index: number): PackTopic | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const title = text(row.title, 160);
  if (!title) return null;
  const id = slug(text(row.id, 80)) || `topic-${index + 1}`;
  const weight = Math.max(1, Math.min(5, Math.round(Number(row.weight) || 3)));
  const questions = Array.isArray(row.questions)
    ? row.questions.map(cleanQuestion).filter((item): item is AuthoredQuestion => item !== null).slice(0, 20)
    : [];
  return { id, title, weight, ...(questions.length ? { questions } : {}) };
}

function cleanUnit(raw: unknown, index: number): PackUnit | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const title = text(row.title, 120);
  const topics = Array.isArray(row.topics)
    ? row.topics.map(cleanTopic).filter((item): item is PackTopic => item !== null).slice(0, 40)
    : [];
  if (!title || topics.length === 0) return null;
  return { id: slug(text(row.id, 80)) || `unit-${index + 1}`, title, topics };
}

/** Turn a client payload into a pack document, or null when it is not usable. */
export function normaliseRemotePack(input: unknown): RemotePack | null {
  if (!input || typeof input !== 'object') return null;
  const row = input as Record<string, unknown>;
  const name = text(row.name, 160);
  const id = slugPackId(name, text(row.id, 80));
  if (!id || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)) return null;
  const status: PackStatus = STATUSES.includes(row.status as PackStatus) ? row.status as PackStatus : 'draft';
  if (status !== 'hidden' && !name) return null;
  const scale = SCALES.includes(row.scale as GradeScaleId) ? row.scale as GradeScaleId : 'igcse';
  const units = Array.isArray(row.units)
    ? row.units.map(cleanUnit).filter((item): item is PackUnit => item !== null).slice(0, 30)
    : [];
  if (status !== 'hidden' && units.length === 0) return null;
  return {
    id,
    name: name || id,
    board: text(row.board, 80) || 'School syllabus',
    level: text(row.level, 40) || 'IGCSE',
    scale,
    blurb: text(row.blurb, 2000),
    accent: '#1E6A83',
    units,
    status,
    freeFirstTopic: row.freeFirstTopic !== false,
  };
}

export function hiddenTombstone(id: string): RemotePack {
  return {
    id,
    name: id,
    board: '',
    level: '',
    scale: 'igcse',
    blurb: '',
    accent: '#1E6A83',
    units: [],
    status: 'hidden',
    freeFirstTopic: false,
  };
}

/**
 * Built-in packs stay as the seed. A published remote pack replaces the same
 * id. A hidden doc drops a built-in. Drafts are admin-only.
 */
export function mergeCatalog(remote: readonly RemotePack[], options: { includeDrafts: boolean }): ExamPack[] {
  const hidden = new Set(remote.filter(pack => pack.status === 'hidden').map(pack => pack.id));
  const byId = new Map<string, ExamPack>();
  for (const pack of EXAM_PACKS) {
    if (hidden.has(pack.id)) continue;
    byId.set(pack.id, { ...pack, status: 'published', freeFirstTopic: pack.freeFirstTopic !== false });
  }
  for (const pack of remote) {
    if (pack.status === 'hidden') {
      byId.delete(pack.id);
      continue;
    }
    if (pack.status === 'draft' && !options.includeDrafts) continue;
    byId.set(pack.id, pack);
  }
  return [...byId.values()];
}

/** Packs to write the first time an admin browser still has a local copy. */
export function planImport(existingIds: ReadonlySet<string>, store: PackStore): RemotePack[] {
  const writes: RemotePack[] = [];
  const seen = new Set(existingIds);
  for (const pack of store.packs) {
    const normalised = normaliseRemotePack({ ...pack, status: pack.status ?? 'published', freeFirstTopic: pack.freeFirstTopic !== false });
    if (!normalised || seen.has(normalised.id)) continue;
    writes.push({ ...normalised, status: 'published' });
    seen.add(normalised.id);
  }
  for (const id of store.removed) {
    if (!EXAM_PACKS.some(pack => pack.id === id) || seen.has(id)) continue;
    writes.push(hiddenTombstone(id));
    seen.add(id);
  }
  return writes;
}

export function presentAuthored(topic: PackTopic) {
  return (topic.questions ?? []).filter(item => item.question && (item.solution || item.markScheme)).map(item => ({
    question: item.question,
    marks: item.marks,
    answer: item.answer ?? '',
    paper: item.paper ?? '',
    solution: [item.solution.trim(), item.markScheme.trim() ? `Mark scheme\n${item.markScheme.trim()}` : ''].filter(Boolean).join('\n\n'),
  }));
}
