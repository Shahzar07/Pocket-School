/**
 * A submission is marked, or it is held. The hold uses the shared integrity
 * signals. Thresholds live in config. The wording stays "appears AI-generated".
 */

import { aiLikelihoodSignal, buildIntegrityCase, type IntegrityEvidence, type IntegritySignals } from '@/lib/insights/integrity';
import { ESSAY_FLAG_MESSAGE, ESSAY_FLAG_STATUS, ESSAY_INTEGRITY } from '@/lib/essays/config';

export interface SubmissionReview {
  flagged: boolean;
  status: typeof ESSAY_FLAG_STATUS | 'clear';
  message: string;
  score: number;
  evidence: IntegrityEvidence[];
  aiLikelihood: number;
}

export function reviewSubmission(input: {
  body: string;
  signals: IntegritySignals;
  title?: string;
}): SubmissionReview {
  const aiLikelihood = Math.max(input.signals.aiLikelihood ?? 0, aiLikelihoodSignal(input.body));
  const signals: IntegritySignals = { ...input.signals, aiLikelihood };
  const drafted = buildIntegrityCase({ signals, assignmentTitle: input.title });
  const burst = (signals.pasteEvents ?? 0) >= ESSAY_INTEGRITY.pasteEvents
    && (signals.largeInsertChars ?? 0) >= ESSAY_INTEGRITY.largeInsertChars;
  const model = aiLikelihood >= ESSAY_INTEGRITY.aiLikelihood;
  const concern = drafted.score >= ESSAY_INTEGRITY.caseScore;
  const flagged = burst || model || concern;
  return {
    flagged,
    status: flagged ? ESSAY_FLAG_STATUS : 'clear',
    message: flagged ? ESSAY_FLAG_MESSAGE : 'ET AI can mark this submission.',
    score: drafted.score,
    evidence: drafted.evidence,
    aiLikelihood,
  };
}

export interface EssayPolicy {
  planningEnabled: boolean;
}

export function planningAllowed(policy: EssayPolicy): boolean {
  return policy.planningEnabled;
}

/** A flagged submission has no grade. A clear one keeps the mark the caller already made. */
export function gradeIfClear<T>(review: SubmissionReview, mark: T): T | null {
  return review.flagged ? null : mark;
}
