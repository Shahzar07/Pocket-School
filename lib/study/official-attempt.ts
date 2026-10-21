import type { FlowQuestion } from './official-flow';

export interface FlowAttempt {
  packId: string;
  topicId: string;
  difficulty: string;
  questions: FlowQuestion[];
  answers: string[];
  scores: number[] | null;
  index: number;
}

const memory = new Map<string, FlowAttempt>();

function key(packId: string, topicId: string): string {
  return `poket-pack-attempt:${packId}:${topicId}`;
}

export function readAttempt(packId: string, topicId: string): FlowAttempt | null {
  const cached = memory.get(key(packId, topicId));
  if (cached) return cached;
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key(packId, topicId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FlowAttempt;
    if (!parsed || !Array.isArray(parsed.questions)) return null;
    memory.set(key(packId, topicId), parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function writeAttempt(attempt: FlowAttempt): void {
  memory.set(key(attempt.packId, attempt.topicId), attempt);
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(key(attempt.packId, attempt.topicId), JSON.stringify(attempt));
}

export interface MockAttempt {
  packId: string;
  length: 'full' | 'half';
  papers: string[];
  questions: FlowQuestion[];
  answers: string[];
  scores: number[] | null;
  index: number;
}

function mockKey(packId: string): string {
  return `poket-pack-mock:${packId}`;
}

export function readMock(packId: string): MockAttempt | null {
  const cached = memory.get(mockKey(packId)) as MockAttempt | undefined;
  if (cached) return cached;
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(mockKey(packId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MockAttempt;
    memory.set(mockKey(packId), parsed as unknown as FlowAttempt);
    return parsed;
  } catch {
    return null;
  }
}

export function writeMock(attempt: MockAttempt): void {
  memory.set(mockKey(attempt.packId), attempt as unknown as FlowAttempt);
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(mockKey(attempt.packId), JSON.stringify(attempt));
}
