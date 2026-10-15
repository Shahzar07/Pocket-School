/**
 * Integrity signals become a case with evidence. Nothing here changes a mark.
 * automaticPenalty is a constant false so a caller cannot flip it by accident.
 */

export const AUTOMATIC_PENALTY = false as const;

export interface IntegritySignals {
  pasteEvents?: number;
  /** Coefficient of variation of keystroke gaps. Very low means unnaturally even typing. */
  typingCadenceCv?: number;
  focusLosses?: number;
  /** 0–100 change versus the student's earlier writing. */
  styleShift?: number;
  /** 0–100 likelihood signal. Not a determination that the work was machine-written. */
  aiLikelihood?: number;
  /** 0–100 overlap with another text. */
  similarity?: number;
}

export interface IntegrityEvidence {
  label: string;
  detail: string;
  value?: number;
}

export type ReviewLevel = 'clear' | 'review' | 'concern';

export interface IntegrityCaseDraft {
  level: ReviewLevel;
  score: number;
  evidence: IntegrityEvidence[];
  recommendation: string;
  automaticPenalty: false;
  studentSummary: string;
}

export const INTEGRITY_DECISIONS = [
  { id: 'pending', label: 'Awaiting the teacher' },
  { id: 'no_action', label: 'No action' },
  { id: 'resit_ai_variant', label: 'Re-examination: new AI variant' },
  { id: 'locked_mode', label: 'Re-examination: locked mode' },
  { id: 'viva', label: 'Re-examination: viva questions' },
  { id: 'dismissed', label: 'Appeal dismissed' },
  { id: 'upheld_appeal', label: 'Appeal upheld' },
] as const;

export type IntegrityDecision = (typeof INTEGRITY_DECISIONS)[number]['id'];

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function tokenSimilarity(a: string, b: string): number {
  const shingles = (text: string) => {
    const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    const set = new Set<string>();
    for (let i = 0; i < words.length - 2; i++) set.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    return set;
  };
  const left = shingles(a);
  const right = shingles(b);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const item of left) if (right.has(item)) shared += 1;
  const union = left.size + right.size - shared;
  return union ? Math.round((100 * shared) / union) : 0;
}

/** A writing signal only. Low sentence-length variation raises the number. It is not proof. */
export function aiLikelihoodSignal(text: string): number {
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
  if (sentences.length < 4) return 0;
  const lengths = sentences.map(s => s.split(/\s+/).length);
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, n) => sum + (n - avg) ** 2, 0) / lengths.length;
  const cv = Math.sqrt(variance) / (avg || 1);
  if (cv < 0.12) return 70;
  if (cv < 0.25) return 40;
  return 15;
}

export function buildIntegrityCase(input: {
  signals: IntegritySignals;
  assignmentTitle?: string;
}): IntegrityCaseDraft {
  const evidence: IntegrityEvidence[] = [];
  const parts: { score: number; weight: number }[] = [];
  const s = input.signals;

  if (s.pasteEvents != null) {
    const value = clamp(s.pasteEvents * 25);
    parts.push({ score: value, weight: 0.2 });
    if (s.pasteEvents > 0) {
      evidence.push({
        label: 'Paste',
        detail: `${s.pasteEvents} paste ${s.pasteEvents === 1 ? 'event' : 'events'} while the response was open.`,
        value,
      });
    }
  }
  if (s.typingCadenceCv != null) {
    const value = s.typingCadenceCv < 0.08 ? 80 : s.typingCadenceCv < 0.15 ? 40 : 10;
    parts.push({ score: value, weight: 0.1 });
    if (value >= 40) {
      evidence.push({
        label: 'Typing',
        detail: 'Keystroke gaps were unusually even.',
        value,
      });
    }
  }
  if (s.focusLosses != null) {
    const value = clamp(s.focusLosses * 15);
    parts.push({ score: value, weight: 0.1 });
    if (s.focusLosses > 0) {
      evidence.push({
        label: 'Focus',
        detail: `The window lost focus ${s.focusLosses} ${s.focusLosses === 1 ? 'time' : 'times'}.`,
        value,
      });
    }
  }
  if (s.styleShift != null) {
    const value = clamp(s.styleShift);
    parts.push({ score: value, weight: 0.15 });
    if (value >= 40) evidence.push({ label: 'Style shift', detail: 'The writing style moved away from earlier work.', value });
  }
  if (s.aiLikelihood != null) {
    const value = clamp(s.aiLikelihood);
    parts.push({ score: value, weight: 0.25 });
    evidence.push({
      label: 'AI-likelihood signal',
      detail: 'A writing signal only. It does not decide that the work was machine-written.',
      value,
    });
  }
  if (s.similarity != null) {
    const value = clamp(s.similarity);
    parts.push({ score: value, weight: 0.2 });
    if (value >= 30) evidence.push({ label: 'Similarity', detail: 'Overlap with another text supplied for comparison.', value });
  }

  const weight = parts.reduce((sum, p) => sum + p.weight, 0);
  const score = weight ? Math.round(parts.reduce((sum, p) => sum + p.score * p.weight, 0) / weight) : 0;
  const level: ReviewLevel = score >= 70 ? 'concern' : score >= 40 ? 'review' : 'clear';
  const title = input.assignmentTitle ? ` “${input.assignmentTitle}”` : '';
  const recommendation = level === 'clear'
    ? `Nothing here needs a new sitting${title}. The teacher can still look. No mark is changed automatically.`
    : `A teacher should review${title}. Possible next steps are a fresh question, a locked sitting, or a short viva. No mark is changed automatically.`;
  const studentSummary = level === 'clear'
    ? 'We checked typing, focus, and similarity signals. Nothing was flagged, and your mark is unchanged.'
    : 'Some signals were unusual. Your teacher will decide. Nothing is marked down automatically, and you can see the evidence and appeal.';

  return {
    level,
    score,
    evidence,
    recommendation,
    automaticPenalty: AUTOMATIC_PENALTY,
    studentSummary,
  };
}

export function vivaQuestions(title: string): string[] {
  return [
    `Explain, in your own words, the main idea of “${title}”.`,
    'Which step did you find hardest, and what did you try?',
    'How would you teach one idea from this work to a classmate?',
  ];
}

export function aiVariantPrompt(title: string): string {
  return `New sitting for “${title}”. Use a fresh example that was not in the first submission. The teacher compares the reasoning, not the wording.`;
}

export interface AuditEntry {
  at: string;
  actorId: string;
  actorName: string;
  action: string;
  note?: string;
}

export function auditLine(entry: Omit<AuditEntry, 'at'>, at: string): AuditEntry {
  return { ...entry, at };
}
