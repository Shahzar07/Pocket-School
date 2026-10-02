import type { Timestamp } from 'firebase/firestore';

/* ── Exam Prep ─────────────────────────────────────────────────── */

/** Ways to learn or practise a topic. Each is generated once and cached. */
export type AssetType = 'lesson' | 'flashcards' | 'quiz' | 'truefalse' | 'exercises' | 'podcast';
export type Difficulty = 'easier' | 'similar' | 'harder';
export type PodcastStyle = 'dialogue' | 'recap' | 'qa' | 'simple' | 'deepdive';

export interface StudyTopic {
  id: string;
  title: string;
  summary: string;
  keyPoints: string[];
  /** How heavily the exam is likely to test it, 1–5. Drives time and grade weighting. */
  weight: number;
  order: number;
}

export type PlanItemKind = 'learn' | 'practice' | 'review' | 'mock';

export interface PlanItem {
  /** Stable across reschedules (`${topicId}:${asset}`), so progress survives a date change. */
  id: string;
  topicId: string | null;
  kind: PlanItemKind;
  asset: AssetType | 'mock';
  title: string;
  minutes: number;
}

export interface PlanDay { date: string; items: PlanItem[] }

export interface ExamPrep {
  id: string;
  ownerId: string;
  title: string;
  subject: string;
  /** yyyy-mm-dd, local date. */
  examDate: string;
  /** e.g. "A", "A+", "7" — shown to the student. */
  targetGrade: string;
  /** The same target as a percentage, used for the progress bar. */
  targetScore: number;
  gradeScale: GradeScaleId;
  level: string;
  language: string;
  minutesPerDay: number;
  sourceNames: string[];
  sourceChars: number;
  topics: StudyTopic[];
  plan: PlanDay[];
  /** topicId → 0–100 */
  mastery: Record<string, number>;
  /** planItemId → true */
  completed: Record<string, boolean>;
  streak: number;
  lastStudyDay?: string;
  studyDays: string[];
  shareId?: string;
  sharedFrom?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface StudyAsset {
  type: AssetType;
  topicId: string;
  variant: string;
  data: unknown;
  createdAt?: Timestamp;
}

/* Asset payloads */
export interface Flashcard { front: string; back: string }
export interface QuizQuestion { question: string; options: string[]; answer: string; explanation: string }
export interface TrueFalseItem { statement: string; answer: boolean; explanation: string }
export interface Exercise { prompt: string; hint: string; solution: string; answer: string; marks: number }
export interface LessonAsset { markdown: string; checkpoints: { question: string; answer: string }[] }
export interface PodcastAsset { title: string; style: PodcastStyle; lines: { speaker: 'A' | 'B'; text: string }[] }

/* ── Assessment ────────────────────────────────────────────────── */

export type GapSeverity = 'weakest' | 'attention' | 'minor';
export interface KnowledgeGap { topicId: string; topic: string; severity: GapSeverity; issue: string; fix: string }

export interface MockQuestion {
  id: string;
  topicId: string;
  type: 'mcq' | 'short' | 'structured';
  question: string;
  options?: string[];
  marks: number;
  markScheme: string;
  answer: string;
}

export interface MarkedAnswer {
  questionId: string;
  awarded: number;
  marks: number;
  feedback: string;
}

export interface ExamAttempt {
  id?: string;
  kind: 'mock' | 'oral' | 'quiz';
  topicId?: string | null;
  score: number;
  max: number;
  percent: number;
  grade?: string;
  durationSec?: number;
  marked?: MarkedAnswer[];
  gaps?: KnowledgeGap[];
  summary?: string;
  transcript?: { role: 'examiner' | 'student'; text: string }[];
  createdAt?: Timestamp;
}

/* ── Maths tutor ───────────────────────────────────────────────── */

export interface SolutionStep { title: string; explanation: string; result: string }

export interface GraphSpec {
  functions: string[];
  xMin?: number; xMax?: number;
  points?: { x: number; y: number; label?: string }[];
}

export interface MathSolution {
  problem: string;
  topic: string;
  level: string;
  finalAnswer: string;
  /** Plain value(s) for automatic checking when the answer is numeric. */
  checkValues?: number[];
  steps: SolutionStep[];
  method: string;
  commonMistakes: string[];
  graph?: GraphSpec | null;
}

export type MathMode = 'guide' | 'solve';

export interface MathMessage { role: 'student' | 'tutor'; text: string; stepIndex?: number; verdict?: 'correct' | 'partly' | 'wrong' }

export interface MathSession {
  id: string;
  problem: string;
  image?: string | null;
  solution: MathSolution | null;
  mode: MathMode;
  messages: MathMessage[];
  /** Steps the student has completed in guide mode. */
  stepsDone: number;
  solved: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/* ── Grades ────────────────────────────────────────────────────── */

export type GradeScaleId = 'spm' | 'igcse' | 'alevel' | 'ib' | 'percent';
