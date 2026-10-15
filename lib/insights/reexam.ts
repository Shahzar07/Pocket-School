/**
 * Re-examination is a fresh sitting for a teacher to compare. It never changes a mark.
 */

import { AUTOMATIC_PENALTY } from './integrity';
import { BLOOM_LEVELS, type BloomLevel } from './analytics';
import { tokenSimilarity } from './integrity';

export interface VariantQuestion {
  id: string;
  prompt: string;
  bloom: BloomLevel;
  topic: string;
}

export interface ProctorLite {
  focusLock: true;
  timerMinutes: number;
  allowPaste: false;
}

const STEMS: Record<BloomLevel, (topic: string, n: number) => string> = {
  remember: (topic, n) => `Remember: name one fact about ${topic} from example ${n}. Use a fact that was not the original question.`,
  understand: (topic, n) => `Understand: explain ${topic} in your own words for situation ${n}.`,
  apply: (topic, n) => `Apply: use ${topic} on this new case ${n}. The numbers are different from the first sitting.`,
  analyse: (topic, n) => `Analyse: compare two parts of ${topic} in case ${n} and say how they differ.`,
  evaluate: (topic, n) => `Evaluate: judge a claim about ${topic} in scenario ${n} and give one reason.`,
  create: (topic, n) => `Create: design a short example that uses ${topic}. This is set ${n}.`,
};

function asBloom(level: string): BloomLevel {
  const found = BLOOM_LEVELS.find(item => item === level);
  return found ?? 'understand';
}

/** Same topic and Bloom level, different wording from the original prompts. */
export function equivalentVariant(input: {
  title: string;
  topic: string;
  bloom: string;
  originalPrompts?: string[];
}): { questions: VariantQuestion[]; note: string; bloom: BloomLevel; topic: string } {
  const bloom = asBloom(input.bloom);
  const topic = input.topic.trim() || input.title.trim() || 'this topic';
  const originals = new Set((input.originalPrompts ?? []).map(item => item.trim().toLowerCase()));
  const questions: VariantQuestion[] = [1, 2, 3].map(n => {
    let prompt = STEMS[bloom](topic, n);
    if (originals.has(prompt.toLowerCase())) prompt = `${prompt} Fresh variant.`;
    return { id: `q${n}`, prompt, bloom, topic };
  });
  return {
    questions,
    bloom,
    topic,
    note: `New sitting for “${input.title || topic}”. Same Bloom level (${bloom}) and topic. The examples are new. A teacher compares the reasoning.`,
  };
}

export function proctorLite(timerMinutes = 25): ProctorLite {
  return { focusLock: true, timerMinutes, allowPaste: false };
}

export function vivaSet(topic: string, bloom: string): string[] {
  const level = asBloom(bloom);
  const subject = topic.trim() || 'this work';
  return [
    `Explain, in your own words, the main idea of ${subject}.`,
    `Which step of this ${level} question was hardest, and what did you try?`,
    `How would you teach one idea from ${subject} to a classmate?`,
  ];
}

export type VerdictRecommendation = 'supports_original' | 'inconsistent' | 'inconclusive';

export function compareReexam(input: {
  originalText: string;
  resitText: string;
  originalScore?: number;
  resitScore?: number;
  vivaAnswered: number;
  vivaCount: number;
}): { recommendation: VerdictRecommendation; reasons: string[]; automaticPenalty: false } {
  const reasons: string[] = [];
  const overlap = tokenSimilarity(input.originalText, input.resitText);
  const vivaCount = Math.max(input.vivaCount, 1);
  const vivaShare = input.vivaAnswered / vivaCount;
  const original = input.originalScore;
  const resit = input.resitScore;
  const scoreClose = original != null && resit != null && Math.abs(original - resit) <= 15;
  const scoreDrop = original != null && resit != null && resit < original - 30;

  if (vivaShare >= 0.5) reasons.push('The student answered the viva questions.');
  else reasons.push('The viva was thin or missing.');
  if (original != null && resit != null) reasons.push(`Original ${original}%, re-examination ${resit}%.`);
  reasons.push(overlap >= 85
    ? 'The re-examination repeats the original wording closely.'
    : 'The re-examination uses different wording from the original.');

  let recommendation: VerdictRecommendation = 'inconclusive';
  if (scoreDrop || overlap >= 85 || input.vivaAnswered === 0) recommendation = 'inconsistent';
  else if (scoreClose && overlap < 85 && vivaShare >= 0.5) recommendation = 'supports_original';

  reasons.push('This is a recommendation. The teacher decides. No mark changes automatically.');
  return { recommendation, reasons, automaticPenalty: AUTOMATIC_PENALTY };
}

export type TeacherReview = 'dismiss' | 'discuss' | 'reexam';

export function applyReview(action: TeacherReview): {
  status: 'dismissed' | 'discussing' | 'reexam';
  decision: 'no_action' | 'discuss' | 'resit_ai_variant';
  studentMessage: string;
  automaticPenalty: false;
} {
  if (action === 'dismiss') {
    return {
      status: 'dismissed',
      decision: 'no_action',
      studentMessage: 'Your teacher looked at the evidence and dismissed the flag. Your mark is unchanged.',
      automaticPenalty: AUTOMATIC_PENALTY,
    };
  }
  if (action === 'discuss') {
    return {
      status: 'discussing',
      decision: 'discuss',
      studentMessage: 'Your teacher wants to talk about this work. Your mark is unchanged.',
      automaticPenalty: AUTOMATIC_PENALTY,
    };
  }
  return {
    status: 'reexam',
    decision: 'resit_ai_variant',
    studentMessage: 'Your teacher has set a fresh sitting. It covers the same topic. Your original mark is unchanged until they decide.',
    automaticPenalty: AUTOMATIC_PENALTY,
  };
}

export function recordVerdict(choice: 'confirm' | 'clear'): {
  decision: 'confirmed' | 'no_action';
  integrityNote: string | null;
  automaticPenalty: false;
} {
  if (choice === 'clear') {
    return { decision: 'no_action', integrityNote: null, automaticPenalty: AUTOMATIC_PENALTY };
  }
  return {
    decision: 'confirmed',
    integrityNote: 'A teacher confirmed an integrity review after looking at the evidence and any re-examination. The mark was not changed automatically.',
    automaticPenalty: AUTOMATIC_PENALTY,
  };
}

export function upholdAppeal(): { decision: 'upheld_appeal'; integrityNote: null; automaticPenalty: false } {
  return { decision: 'upheld_appeal', integrityNote: null, automaticPenalty: AUTOMATIC_PENALTY };
}
