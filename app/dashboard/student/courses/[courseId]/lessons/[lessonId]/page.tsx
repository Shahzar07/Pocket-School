'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { Timestamp } from 'firebase/firestore';
import { useAuthSTORE } from '@/hooks/use-auth';
import { useTutorContext } from '@/hooks/use-tutor-context';
import {
  getLessonByIds, getCourse, getEnrollment, getModulesWithLessons,
  getUnitQuizAttempts, markLessonComplete, getLessonNote, saveLessonNote,
  saveSubmission, unlockLessonFormat, saveUnitQuizAttempt,
  AiOutputs, Course, Module, Lesson, Enrollment, UnitQuizAttempt,
} from '@/lib/db';
import { getUnitStatuses, getCurriculumLessonStatus } from '@/lib/curriculum';
import { FORMAT_COSTS, FORMAT_LABELS, LESSON_COMPLETE_REWARD, UNIT_PASS_REWARD } from '@/lib/sparks';
import { AudioPlayer } from '@/components/audio-player';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  ArrowLeft, CheckCircle2, FileText, Headphones, FlipHorizontal,
  ClipboardList, Presentation, BookMarked, BookOpen, Network,
  Zap, ChevronLeft, ChevronRight, RotateCcw, Check, X, Lock,
  Video, Trophy, Timer, AlertTriangle, ArrowRight, ImageIcon, Calculator,
} from 'lucide-react';

// ─── Flashcard Component ─────────────────────────────────────
function FlashcardViewer({ cards }: { cards: { question: string; answer: string }[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<number>>(new Set());
  const [again, setAgain] = useState<Set<number>>(new Set());

  const card = cards[index];
  const progress = Math.round(((known.size + again.size) / cards.length) * 100);

  const next = () => { setFlipped(false); setIndex(i => Math.min(i + 1, cards.length - 1)); };
  const prev = () => { setFlipped(false); setIndex(i => Math.max(i - 1, 0)); };
  const markKnown = () => { setKnown(s => new Set([...s, index])); setAgain(s => { const n = new Set(s); n.delete(index); return n; }); next(); };
  const markAgain = () => { setAgain(s => new Set([...s, index])); setKnown(s => { const n = new Set(s); n.delete(index); return n; }); next(); };
  const reset = () => { setIndex(0); setFlipped(false); setKnown(new Set()); setAgain(new Set()); };

  return (
    <div className="max-w-2xl mx-auto py-6">
      <div className="flex justify-between text-sm text-muted-foreground mb-4">
        <span>Card {index + 1} of {cards.length}</span>
        <span>{known.size} known · {again.size} to review</span>
      </div>
      <Progress value={progress} className="h-1.5 mb-6" />

      <div className="relative h-64 cursor-pointer" onClick={() => setFlipped(f => !f)} style={{ perspective: '1000px' }}>
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformStyle: 'preserve-3d', position: 'relative', width: '100%', height: '100%' }}
        >
          {/* Front */}
          <div style={{ backfaceVisibility: 'hidden', position: 'absolute', inset: 0 }}
            className="bg-card border border-border rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-card"
          >
            <Badge className="mb-4 text-xs rounded-full bg-blue-50 text-blue-700 border-blue-200">Question</Badge>
            <p className="text-lg font-semibold text-foreground leading-relaxed">{card.question}</p>
            <p className="text-xs text-muted-foreground mt-4">Tap to reveal answer</p>
          </div>
          {/* Back */}
          <div style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', position: 'absolute', inset: 0 }}
            className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-card"
          >
            <Badge className="mb-4 text-xs rounded-full bg-emerald-50 text-emerald-700 border-emerald-200">Answer</Badge>
            <p className="text-base text-foreground leading-relaxed">{card.answer}</p>
          </div>
        </motion.div>
      </div>

      <div className="flex gap-3 mt-6 justify-center">
        <Button variant="outline" size="sm" onClick={prev} disabled={index === 0} className="rounded-xl">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        {flipped && (
          <>
            <Button onClick={markAgain} variant="outline" className="rounded-xl gap-2 border-red-200 text-red-600 hover:bg-red-50">
              <X className="w-4 h-4" /> Again
            </Button>
            <Button onClick={markKnown} className="rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              <Check className="w-4 h-4" /> Got it
            </Button>
          </>
        )}
        <Button variant="outline" size="sm" onClick={next} disabled={index === cards.length - 1} className="rounded-xl">
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={reset} className="rounded-xl text-muted-foreground">
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Quiz Component ───────────────────────────────────────────
function QuizViewer({
  questions,
  onComplete,
}: {
  questions: { question: string; options: string[]; answer: string; explanation?: string }[];
  onComplete: (score: number, total: number, answers: { question: string; answer: string; correct: boolean }[]) => void;
}) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [graded, setGraded] = useState<Record<number, { correct: boolean; feedback: string }> | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (Object.keys(answers).length < questions.length) {
      toast.error('Please answer all questions before submitting.');
      return;
    }
    setLoading(true);
    const results: Record<number, { correct: boolean; feedback: string }> = {};
    let score = 0;

    await Promise.all(questions.map(async (q, i) => {
      try {
        const res = await fetch('/api/ai/quiz-grade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q.question, correctAnswer: q.answer, studentAnswer: answers[i], explanation: q.explanation }),
        });
        const data = await res.json();
        results[i] = { correct: data.correct, feedback: data.feedback };
        if (data.correct) score++;
      } catch {
        const correct = answers[i]?.toLowerCase() === q.answer.toLowerCase();
        results[i] = { correct, feedback: correct ? 'Correct!' : `The answer is: ${q.answer}` };
        if (correct) score++;
      }
    }));

    setGraded(results);
    setLoading(false);

    const submissionAnswers = questions.map((q, i) => ({
      question: q.question,
      answer: answers[i] ?? '',
      correct: results[i]?.correct ?? false,
    }));
    onComplete(score, questions.length, submissionAnswers);
  };

  const percentage = graded ? Math.round(Object.values(graded).filter(r => r.correct).length / questions.length * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-6">
      {graded && (
        <div className={`rounded-2xl p-5 text-center ${percentage >= 70 ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
          <p className="text-3xl font-extrabold">{percentage}%</p>
          <p className={`text-sm font-semibold mt-1 ${percentage >= 70 ? 'text-emerald-700' : 'text-amber-700'}`}>
            {Object.values(graded).filter(r => r.correct).length}/{questions.length} correct
            {percentage >= 70 ? ' — Great work! 🎉' : ' — Keep studying! 📚'}
          </p>
        </div>
      )}

      {questions.map((q, i) => (
        <div key={i} className="bg-card border border-border rounded-2xl p-5">
          <p className="font-semibold text-foreground mb-4 text-sm leading-relaxed">
            <span className="text-primary font-bold">{i + 1}. </span>{q.question}
          </p>
          <div className="space-y-2">
            {q.options.map(opt => {
              const selected = answers[i] === opt;
              const isCorrect = graded ? opt === q.answer : null;
              const isWrong = graded && selected && !graded[i]?.correct;
              return (
                <button
                  key={opt}
                  disabled={!!graded}
                  onClick={() => !graded && setAnswers(a => ({ ...a, [i]: opt }))}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                    graded
                      ? isCorrect ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                        : isWrong ? 'border-red-400 bg-red-50 text-red-800'
                        : selected ? 'border-border bg-muted text-muted-foreground'
                        : 'border-border bg-background text-muted-foreground'
                      : selected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50 text-foreground'
                  }`}
                >
                  {opt}
                  {graded && isCorrect && <span className="float-right text-emerald-600">✓</span>}
                  {graded && isWrong && <span className="float-right text-red-500">✗</span>}
                </button>
              );
            })}
          </div>
          {graded?.[i] && (
            <p className={`mt-3 text-xs px-3 py-2 rounded-lg ${graded[i].correct ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {graded[i].feedback}
            </p>
          )}
        </div>
      ))}

      {!graded && (
        <Button onClick={handleSubmit} disabled={loading || Object.keys(answers).length < questions.length}
          className="w-full h-11 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
        >
          {loading ? 'Grading with AI…' : `Submit Quiz (${Object.keys(answers).length}/${questions.length})`}
        </Button>
      )}
    </div>
  );
}

// ─── Unit Mastery Quiz Mode ───────────────────────────────────
function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function UnitQuizMode({
  courseId, lesson, unit, unitLessons, attempts, onAttemptSaved,
}: {
  courseId: string;
  lesson: Lesson;
  unit: Module;
  unitLessons: Lesson[];
  attempts: UnitQuizAttempt[];
  onAttemptSaved: (attempt: UnitQuizAttempt) => void;
}) {
  const router = useRouter();
  const { user, profile, fetchProfile } = useAuthSTORE();
  const questions = lesson.aiOutputs?.quiz ?? [];
  const threshold = unit.masteryThreshold ?? 70;

  const [phase, setPhase] = useState<'intro' | 'active' | 'result'>('intro');
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<UnitQuizAttempt | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (phase !== 'active') return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const bestPercentage = attempts.length ? Math.max(...attempts.map(a => a.percentage)) : null;
  const lessonTitleById = new Map(unitLessons.map(l => [l.id, l]));

  const startQuiz = () => {
    setAnswers({});
    setElapsed(0);
    startedAtRef.current = Date.now();
    setPhase('active');
  };

  const handleSubmit = async () => {
    if (!user || submitting) return;
    if (Object.keys(answers).length < questions.length) {
      toast.error('Please answer all questions before submitting.');
      return;
    }
    setSubmitting(true);
    const timeTakenSeconds = Math.floor((Date.now() - startedAtRef.current) / 1000);

    // Deterministic option-match grading — no AI calls for the mastery gate.
    const responses = questions.map((q, i) => ({
      questionIndex: i,
      question: q.question,
      ...(q.objectiveCode ? { objectiveCode: q.objectiveCode } : {}),
      ...(q.sourceLessonId ? { sourceLessonId: q.sourceLessonId } : {}),
      selected: answers[i] ?? '',
      correct: answers[i] === q.answer,
    }));
    const score = responses.filter(r => r.correct).length;
    const total = questions.length;
    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
    const passed = percentage >= threshold;

    try {
      const saved = await saveUnitQuizAttempt({
        studentId: user.uid,
        studentName: profile?.name ?? '',
        courseId,
        unitId: unit.id,
        lessonId: lesson.id,
        score,
        total,
        percentage,
        passed,
        timeTakenSeconds,
        responses,
        startedAt: Timestamp.fromMillis(startedAtRef.current),
      });
      setResult(saved);
      setPhase('result');
      onAttemptSaved(saved);
      if (passed) {
        await fetchProfile(user.uid);
        toast.success(`Unit passed! +${UNIT_PASS_REWARD}⚡ earned 🏆`, { duration: 5000 });
      }
    } catch {
      toast.error('Could not save your attempt. Please try again.');
    }
    setSubmitting(false);
  };

  // ── Intro ──
  if (phase === 'intro') {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white text-center mb-6">
          <Trophy className="w-10 h-10 mx-auto mb-3 text-amber-300" />
          <h2 className="font-heading text-3xl mb-2">{unit.title} — Mastery Quiz</h2>
          <p className="text-blue-100 text-sm max-w-md mx-auto">
            {questions.length} questions covering every lesson in this unit.
            Score {threshold}% or higher to pass and unlock the next unit.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <p className="text-2xl font-extrabold text-foreground">{questions.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Questions</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <p className="text-2xl font-extrabold text-foreground">{threshold}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">Pass mark</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <p className="text-2xl font-extrabold text-foreground">{bestPercentage !== null ? `${bestPercentage}%` : '—'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{attempts.length ? `Best of ${attempts.length}` : 'No attempts yet'}</p>
          </div>
        </div>

        <Button onClick={startQuiz} className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-base gap-2">
          <Timer className="w-4 h-4" />
          {attempts.length ? 'Retake quiz' : 'Start quiz'} — your time will be recorded
        </Button>
        <p className="text-xs text-muted-foreground text-center mt-3">
          Unlimited attempts. If you score below {threshold}%, we&apos;ll show you exactly which lessons to review.
        </p>
      </div>
    );
  }

  // ── Result ──
  if (phase === 'result' && result) {
    const wrongByObjective: Record<string, { wrong: number; total: number }> = {};
    for (const r of result.responses) {
      if (!r.objectiveCode) continue;
      wrongByObjective[r.objectiveCode] ??= { wrong: 0, total: 0 };
      wrongByObjective[r.objectiveCode].total++;
      if (!r.correct) wrongByObjective[r.objectiveCode].wrong++;
    }
    const reviewLessons = (result.recommendedLessonIds ?? [])
      .map(id => lessonTitleById.get(id))
      .filter((l): l is Lesson => !!l);

    return (
      <div className="max-w-2xl mx-auto py-8 space-y-5">
        <div className={`rounded-3xl p-8 text-center border ${
          result.passed ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
        }`}>
          {result.passed
            ? <Trophy className="w-10 h-10 mx-auto mb-3 text-emerald-600" />
            : <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-amber-600" />}
          <p className="text-5xl font-extrabold text-foreground">{result.percentage}%</p>
          <p className={`text-sm font-semibold mt-2 ${result.passed ? 'text-emerald-700' : 'text-amber-700'}`}>
            {result.score}/{result.total} correct · {formatTime(result.timeTakenSeconds)} · attempt #{result.attemptNumber}
          </p>
          <p className={`text-base font-bold mt-3 ${result.passed ? 'text-emerald-700' : 'text-amber-700'}`}>
            {result.passed
              ? `Unit mastered! +${UNIT_PASS_REWARD}⚡ — the next unit is now unlocked. 🎉`
              : `Not quite — you need ${threshold}% to pass. Review the lessons below and try again.`}
          </p>
        </div>

        {/* Per-objective breakdown */}
        {Object.keys(wrongByObjective).length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-bold text-foreground text-sm mb-3">Breakdown by objective</h3>
            <div className="space-y-2">
              {Object.entries(wrongByObjective).map(([code, stats]) => {
                const pct = Math.round(((stats.total - stats.wrong) / stats.total) * 100);
                return (
                  <div key={code} className="flex items-center gap-3">
                    <span className={`text-xs font-mono font-bold w-20 shrink-0 ${
                      code === result.weakestObjective ? 'text-red-600' : 'text-muted-foreground'
                    }`}>
                      {code}
                    </span>
                    <Progress value={pct} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
            {result.weakestObjective && !result.passed && (
              <p className="text-xs text-red-600 mt-3">
                Weakest objective: <strong>{result.weakestObjective}</strong>
              </p>
            )}
          </div>
        )}

        {/* Adaptive review */}
        {!result.passed && reviewLessons.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
            <h3 className="font-bold text-blue-900 text-sm mb-1">Review these lessons before your next attempt</h3>
            <p className="text-xs text-blue-700 mb-3">Based on the questions you missed:</p>
            <div className="space-y-2">
              {reviewLessons.map(l => (
                <button
                  key={l.id}
                  onClick={() => router.push(`/dashboard/student/courses/${courseId}/lessons/${l.id}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white border border-blue-200 hover:border-blue-400 transition-colors text-left"
                >
                  <BookOpen className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-sm font-semibold text-foreground flex-1">
                    {l.lessonNumber ? `L${l.lessonNumber} · ` : ''}{l.title}
                  </span>
                  <ArrowRight className="w-4 h-4 text-blue-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          {!result.passed && (
            <Button onClick={startQuiz} variant="outline" className="flex-1 h-11 rounded-xl gap-2">
              <RotateCcw className="w-4 h-4" /> Retake quiz
            </Button>
          )}
          <Button
            onClick={() => router.push(`/dashboard/student/courses/${courseId}`)}
            className={`flex-1 h-11 rounded-xl ${result.passed ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white' : ''}`}
            variant={result.passed ? 'default' : 'outline'}
          >
            Back to course
          </Button>
        </div>
      </div>
    );
  }

  // ── Active quiz ──
  return (
    <div className="max-w-2xl mx-auto py-6 space-y-6">
      <div className="sticky top-0 z-10 bg-card border border-border rounded-2xl p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Timer className="w-4 h-4 text-blue-600" /> {formatTime(elapsed)}
        </div>
        <span className="text-sm text-muted-foreground">
          {Object.keys(answers).length}/{questions.length} answered
        </span>
      </div>

      {questions.map((q, i) => (
        <div key={i} className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-start justify-between gap-2 mb-4">
            <p className="font-semibold text-foreground text-sm leading-relaxed">
              <span className="text-primary font-bold">{i + 1}. </span>{q.question}
            </p>
            {q.objectiveCode && (
              <Badge variant="outline" className="text-[10px] font-mono rounded-full shrink-0">{q.objectiveCode}</Badge>
            )}
          </div>
          <div className="space-y-2">
            {q.options.map(opt => (
              <button
                key={opt}
                onClick={() => setAnswers(a => ({ ...a, [i]: opt }))}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                  answers[i] === opt
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50 text-foreground'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}

      <Button
        onClick={handleSubmit}
        disabled={submitting || Object.keys(answers).length < questions.length}
        className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
      >
        {submitting ? 'Saving attempt…' : `Submit Mastery Quiz (${Object.keys(answers).length}/${questions.length})`}
      </Button>
    </div>
  );
}

// ─── Sparks unlock card ───────────────────────────────────────
function FormatLockCard({
  format, cost, balance, unlocking, onUnlock,
}: {
  format: string; cost: number; balance: number; unlocking: boolean; onUnlock: () => void;
}) {
  const canAfford = balance >= cost;
  return (
    <div className="liquid-glass rounded-3xl border border-border p-10 text-center max-w-md mx-auto my-8">
      <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
        <Lock className="w-6 h-6 text-amber-600" />
      </div>
      <h3 className="font-heading text-2xl text-foreground mb-1">
        Unlock {FORMAT_LABELS[format] ?? format}
      </h3>
      <p className="text-sm text-muted-foreground mb-5">
        Spend <strong className="text-amber-600">⚡{cost}</strong> Sparks to unlock this format for this lesson — yours forever once unlocked.
      </p>
      <Button
        onClick={onUnlock}
        disabled={!canAfford || unlocking}
        className="rounded-xl gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6"
      >
        <Zap className="w-4 h-4 fill-white" />
        {unlocking ? 'Unlocking…' : `Unlock for ⚡${cost}`}
      </Button>
      <p className="text-xs text-muted-foreground mt-3">
        {canAfford
          ? `Your balance: ⚡${balance}`
          : `You have ⚡${balance} — complete lessons to earn ⚡${LESSON_COMPLETE_REWARD} each.`}
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function LessonPage() {
  const router = useRouter();
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const { user, profile, fetchProfile } = useAuthSTORE();
  const { setLessonContext, clearLessonContext } = useTutorContext();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [unit, setUnit] = useState<Module | null>(null);
  const [unitLessons, setUnitLessons] = useState<Lesson[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [attempts, setAttempts] = useState<UnitQuizAttempt[]>([]);
  const [completed, setCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [note, setNote] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('text');
  const [unlockingFormat, setUnlockingFormat] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !courseId || !lessonId) return;
    (async () => {
      const [result, savedNote, courseDoc] = await Promise.all([
        getLessonByIds(courseId, lessonId),
        getLessonNote(user.uid, lessonId),
        getCourse(courseId),
      ]);
      if (!result) { setLoading(false); return; }
      setNote(savedNote);
      setCourse(courseDoc);

      if (courseDoc?.kind === 'curriculum') {
        const [allUnits, enroll, quizAttempts] = await Promise.all([
          getModulesWithLessons(courseId),
          getEnrollment(user.uid, courseId),
          getUnitQuizAttempts(user.uid, courseId),
        ]);
        const units = allUnits
          .map(u => ({ module: u.module, lessons: u.lessons.filter(l => l.status === 'published') }))
          .filter(u => u.lessons.length > 0);
        const unitIndex = units.findIndex(u => u.module.id === result.moduleId);
        const completedIds = new Set(enroll?.completedLessons ?? []);

        // Lock guard — direct URLs can't bypass unit/lesson progression
        if (unitIndex >= 0) {
          const statuses = getUnitStatuses(units, enroll, quizAttempts);
          const lessonStatus = getCurriculumLessonStatus(
            result.lesson, units[unitIndex].lessons, statuses[unitIndex].state, completedIds
          );
          if (lessonStatus === 'locked') {
            toast.error('This lesson is locked. Complete the previous lessons first.');
            router.replace(`/dashboard/student/courses/${courseId}`);
            return;
          }
          setUnit(units[unitIndex].module);
          setUnitLessons(units[unitIndex].lessons);
        }
        setEnrollment(enroll);
        setAttempts(quizAttempts.filter(a => a.lessonId === lessonId));
        setCompleted(completedIds.has(lessonId));
      }

      setLesson(result.lesson);
      setLessonContext(
        result.lesson.title,
        result.lesson.aiOutputs?.summary ?? result.lesson.aiOutputs?.text ?? ''
      );
      setLoading(false);
    })();
    return () => clearLessonContext();
  }, [user, courseId, lessonId]);

  const isCurriculum = course?.kind === 'curriculum';
  const isUnitQuiz = isCurriculum && !!lesson?.isUnitQuiz;
  const unlockedFormats = enrollment?.unlockedFormats?.[lessonId] ?? [];
  const balance = profile?.sparksBalance ?? 0;

  const isFormatLocked = (format?: string) =>
    !!format && isCurriculum && FORMAT_COSTS[format] != null && !unlockedFormats.includes(format);

  const handleUnlock = async (format: string) => {
    if (!user || unlockingFormat) return;
    const cost = FORMAT_COSTS[format];
    setUnlockingFormat(format);
    try {
      await unlockLessonFormat(user.uid, courseId, lessonId, format, cost);
      setEnrollment(prev => prev ? {
        ...prev,
        unlockedFormats: {
          ...prev.unlockedFormats,
          [lessonId]: [...(prev.unlockedFormats?.[lessonId] ?? []), format],
        },
      } : prev);
      await fetchProfile(user.uid);
      toast.success(`${FORMAT_LABELS[format] ?? format} unlocked for ⚡${cost}!`);
    } catch (err: any) {
      if (err?.message === 'INSUFFICIENT_SPARKS') {
        toast.error(`Not enough Sparks — complete lessons to earn ⚡${LESSON_COMPLETE_REWARD} each.`);
      } else if (err?.message === 'NOT_ENROLLED') {
        toast.error('You are not enrolled in this course.');
      } else {
        toast.error('Unlock failed. Please try again.');
      }
    }
    setUnlockingFormat(null);
  };

  const handleComplete = async () => {
    if (!user || completed) return;
    setCompleting(true);
    await markLessonComplete(user.uid, courseId, lessonId, 50, isCurriculum ? LESSON_COMPLETE_REWARD : 0);
    await fetchProfile(user.uid);
    setCompleted(true);
    toast.success(
      isCurriculum
        ? `Lesson complete! +50 XP · +${LESSON_COMPLETE_REWARD}⚡ earned 🎉`
        : 'Lesson complete! +50 XP earned 🎉',
      { duration: 4000 }
    );
    setCompleting(false);
  };

  const handleSaveNote = useCallback(async () => {
    if (!user) return;
    setNoteSaving(true);
    await saveLessonNote(user.uid, lessonId, note);
    toast.success('Note saved');
    setNoteSaving(false);
  }, [user, lessonId, note]);

  const handleQuizComplete = async (score: number, total: number, answers: { question: string; answer: string; correct: boolean }[]) => {
    if (!user || !lesson) return;
    toast.success(`Quiz submitted! ${score}/${total} correct`);
    await saveSubmission({
      studentId: user.uid,
      studentName: '',
      courseId,
      lessonId,
      lessonTitle: lesson.title,
      type: 'quiz',
      maxScore: total,
      score,
      answers,
    });
  };

  const aiOutputs = lesson?.aiOutputs;

  const TABS: { id: string; label: string; icon: React.ReactNode; available: boolean; format?: string }[] = [
    { id: 'text', label: 'Lesson', icon: <FileText className="w-3.5 h-3.5" />, available: !!aiOutputs?.text, format: 'text' },
    { id: 'video', label: 'Video', icon: <Video className="w-3.5 h-3.5" />, available: !!aiOutputs?.videoScript, format: 'videoScript' },
    { id: 'flashcards', label: 'Flashcards', icon: <FlipHorizontal className="w-3.5 h-3.5" />, available: !!(aiOutputs?.flashcards?.length), format: 'flashcards' },
    { id: 'quiz', label: 'Quiz', icon: <ClipboardList className="w-3.5 h-3.5" />, available: !!(aiOutputs?.quiz?.length), format: 'quiz' },
    { id: 'problems', label: 'Practice', icon: <Calculator className="w-3.5 h-3.5" />, available: !!aiOutputs?.problems, format: 'problems' },
    { id: 'slides', label: 'Slides', icon: <Presentation className="w-3.5 h-3.5" />, available: !!(aiOutputs?.slides?.length), format: 'slides' },
    { id: 'notes', label: 'Study Notes', icon: <BookOpen className="w-3.5 h-3.5" />, available: !!aiOutputs?.notes, format: 'notes' },
    { id: 'audio', label: 'Audio', icon: <Headphones className="w-3.5 h-3.5" />, available: !!aiOutputs?.audioScript, format: 'audioScript' },
    { id: 'infographic', label: 'Infographic', icon: <ImageIcon className="w-3.5 h-3.5" />, available: !!aiOutputs?.infographic, format: 'infographic' },
    { id: 'summary', label: 'Summary', icon: <Headphones className="w-3.5 h-3.5" />, available: !!aiOutputs?.summary },
    { id: 'glossary', label: 'Glossary', icon: <BookMarked className="w-3.5 h-3.5" />, available: !!(aiOutputs?.glossary?.length), format: 'glossary' },
    { id: 'mindmap', label: 'Mind Map', icon: <Network className="w-3.5 h-3.5" />, available: !!aiOutputs?.mindmap, format: 'mindmap' },
    { id: 'mynotes', label: 'My Notes', icon: <FileText className="w-3.5 h-3.5" />, available: true },
  ].filter(t => t.available);

  // Wrap gated tab content in an unlock card when the format is still locked
  const gate = (format: string | undefined, content: React.ReactNode) =>
    isFormatLocked(format) ? (
      <FormatLockCard
        format={format!}
        cost={FORMAT_COSTS[format!]}
        balance={balance}
        unlocking={unlockingFormat === format}
        onUnlock={() => handleUnlock(format!)}
      />
    ) : content;

  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-4">
      <div className="h-16 bg-muted animate-pulse rounded-2xl" />
      <div className="h-96 bg-muted animate-pulse rounded-2xl" />
    </div>
  );

  if (!lesson) return (
    <div className="text-center py-16 text-muted-foreground">Lesson not found.</div>
  );

  // ── Unit mastery quiz takes over the whole page ──
  if (isUnitQuiz && unit) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/student/courses/${courseId}`)} className="shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="font-extrabold text-foreground text-lg truncate">{lesson.title}</h1>
          {completed && (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 rounded-full gap-1.5 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" /> Passed
            </Badge>
          )}
        </div>
        {(lesson.aiOutputs?.quiz?.length ?? 0) > 0 ? (
          <UnitQuizMode
            courseId={courseId}
            lesson={lesson}
            unit={unit}
            unitLessons={unitLessons}
            attempts={attempts}
            onAttemptSaved={(a) => {
              setAttempts(prev => [a, ...prev]);
              if (a.passed) setCompleted(true);
            }}
          />
        ) : (
          <div className="text-center py-20 text-muted-foreground bg-muted/30 rounded-3xl border border-dashed border-border">
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-semibold">Quiz not yet published</p>
            <p className="text-sm mt-1">Your school is preparing this mastery quiz. Check back soon.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="font-extrabold text-foreground text-lg truncate">{lesson.title}</h1>
            {!aiOutputs && <p className="text-xs text-muted-foreground">No content generated yet</p>}
            {isCurriculum && lesson.objectiveCodes && lesson.objectiveCodes.length > 0 && (
              <p className="text-xs text-muted-foreground font-mono truncate">{lesson.objectiveCodes.join(' · ')}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {completed ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 rounded-full gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Completed
            </Badge>
          ) : (
            <Button
              size="sm"
              className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white gap-1.5"
              onClick={handleComplete}
              disabled={completing}
            >
              <Zap className="w-3.5 h-3.5" />
              {completing ? 'Saving…' : isCurriculum ? `Mark Complete (+50 XP · ⚡${LESSON_COMPLETE_REWARD})` : 'Mark Complete (+50 XP)'}
            </Button>
          )}
        </div>
      </div>

      {!aiOutputs ? (
        <div className="text-center py-20 text-muted-foreground bg-muted/30 rounded-3xl border border-dashed border-border">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-semibold">Content not yet generated</p>
          <p className="text-sm mt-1">Your teacher needs to publish this lesson from the teacher upload page.</p>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1 rounded-2xl mb-6">
            {TABS.map(t => (
              <TabsTrigger key={t.id} value={t.id} className="rounded-xl h-8 px-3 text-xs font-medium gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                {t.icon}{t.label}
                {isFormatLocked(t.format) && (
                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-600">
                    <Lock className="w-2.5 h-2.5" />⚡{FORMAT_COSTS[t.format!]}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Text */}
          <TabsContent value="text">
            {gate('text',
              <div className="prose prose-sm dark:prose-invert max-w-none bg-card border border-border rounded-2xl p-6 sm:p-8">
                <ReactMarkdown>{aiOutputs.text ?? ''}</ReactMarkdown>
              </div>
            )}
          </TabsContent>

          {/* Video (script storyboard) */}
          <TabsContent value="video">
            {gate('videoScript',
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-3.5 flex items-center gap-3">
                  <Video className="w-5 h-5 text-blue-600 shrink-0" />
                  <p className="text-xs text-blue-800">
                    <strong>Video storyboard.</strong> This is the script for this lesson&apos;s video — full video production is coming soon.
                  </p>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none bg-card border border-border rounded-2xl p-6 sm:p-8">
                  <ReactMarkdown>{aiOutputs.videoScript ?? ''}</ReactMarkdown>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Flashcards */}
          <TabsContent value="flashcards">
            {gate('flashcards',
              aiOutputs.flashcards?.length
                ? <FlashcardViewer cards={aiOutputs.flashcards} />
                : <p className="text-center py-8 text-muted-foreground">No flashcards available.</p>
            )}
          </TabsContent>

          {/* Quiz */}
          <TabsContent value="quiz">
            {gate('quiz',
              aiOutputs.quiz?.length
                ? <QuizViewer questions={aiOutputs.quiz} onComplete={handleQuizComplete} />
                : <p className="text-center py-8 text-muted-foreground">No quiz available.</p>
            )}
          </TabsContent>

          {/* Practice Problems */}
          <TabsContent value="problems">
            {gate('problems',
              <div className="prose prose-sm dark:prose-invert max-w-none bg-card border border-border rounded-2xl p-6 sm:p-8">
                <ReactMarkdown>{aiOutputs.problems ?? ''}</ReactMarkdown>
              </div>
            )}
          </TabsContent>

          {/* Slides */}
          <TabsContent value="slides">
            {gate('slides',
              aiOutputs.slides?.length ? (
                <div className="space-y-4">
                  {aiOutputs.slides.map((slide, i) => (
                    <div key={i} className="bg-card border border-border rounded-2xl p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">{i + 1}</div>
                        <h3 className="font-bold text-foreground">{slide.title}</h3>
                      </div>
                      <ul className="space-y-2">
                        {slide.bullets.map((b, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="text-primary mt-0.5 shrink-0">•</span>{b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : <p className="text-center py-8 text-muted-foreground">No slides available.</p>
            )}
          </TabsContent>

          {/* Study Notes */}
          <TabsContent value="notes">
            {gate('notes',
              <div className="prose prose-sm dark:prose-invert max-w-none bg-amber-50 dark:bg-amber-900/10 border border-amber-200 rounded-2xl p-6 sm:p-8">
                <ReactMarkdown>{aiOutputs.notes ?? ''}</ReactMarkdown>
              </div>
            )}
          </TabsContent>

          {/* Audio Summary (text-to-speech) */}
          <TabsContent value="audio">
            {gate('audioScript',
              <div className="bg-card border border-border rounded-2xl p-6 sm:p-8">
                <AudioPlayer script={aiOutputs.audioScript ?? ''} title={`${lesson.title} — Audio Summary`} />
              </div>
            )}
          </TabsContent>

          {/* Infographic */}
          <TabsContent value="infographic">
            {gate('infographic',
              <div className="prose prose-sm dark:prose-invert max-w-none bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 sm:p-8">
                <ReactMarkdown>{aiOutputs.infographic ?? ''}</ReactMarkdown>
              </div>
            )}
          </TabsContent>

          {/* Summary */}
          <TabsContent value="summary">
            <div className="bg-card border border-border rounded-2xl p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-4">
                <Headphones className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-foreground">Quick Summary</h3>
              </div>
              <p className="text-base text-foreground leading-relaxed">{aiOutputs.summary}</p>
            </div>
          </TabsContent>

          {/* Glossary */}
          <TabsContent value="glossary">
            {gate('glossary',
              aiOutputs.glossary?.length ? (
                <div className="space-y-3">
                  {aiOutputs.glossary.map((g, i) => (
                    <div key={i} className="bg-card border border-border rounded-2xl p-5 flex gap-4">
                      <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                        <BookMarked className="w-4 h-4 text-violet-600" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{g.term}</p>
                        <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{g.definition}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-center py-8 text-muted-foreground">No glossary available.</p>
            )}
          </TabsContent>

          {/* Mind Map */}
          <TabsContent value="mindmap">
            {gate('mindmap',
              <div className="prose prose-sm dark:prose-invert max-w-none bg-card border border-border rounded-2xl p-6 sm:p-8">
                <ReactMarkdown>{aiOutputs.mindmap ?? ''}</ReactMarkdown>
              </div>
            )}
          </TabsContent>

          {/* My Notes */}
          <TabsContent value="mynotes">
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-foreground">My Personal Notes</h3>
                <Button size="sm" variant="outline" onClick={handleSaveNote} disabled={noteSaving} className="rounded-xl">
                  {noteSaving ? 'Saving…' : 'Save Note'}
                </Button>
              </div>
              <Textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Write your notes here… they're saved to your account."
                className="min-h-64 rounded-xl resize-none text-sm"
              />
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
