'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'motion/react';
import { MathMarkdown } from '@/components/math-markdown';
import { LessonBody } from '@/components/lesson-body';
import { readLessonBody } from '@/lib/lesson-body';
import { LessonQa } from '@/components/scope-c/lesson-qa';
import { LessonFigure } from '@/components/lesson-visual';
import { normalizeMarkdown } from '@/components/lesson-format-views';
import { Timestamp } from 'firebase/firestore';
import { useAuthSTORE } from '@/hooks/use-auth';
import { useTutorContext } from '@/hooks/use-tutor-context';
import {
  getLessonByIds, getCourse, getEnrollment, getModulesWithLessons,
  getUnitQuizAttempts, markLessonComplete, getLessonNote, saveLessonNote,
  saveSubmission, unlockLessonFormat, saveUnitQuizAttempt, rememberLesson,
  setBookmarkedLessons, updateUser,
  AiOutputs, Course, Module, Lesson, Enrollment, UnitQuizAttempt,
} from '@/lib/db';
import { getUnitStatuses, getCurriculumLessonStatus } from '@/lib/curriculum';
import { lessonVisibleToStudent } from '@/lib/course-review';
import { productAccess, viewerFromProfile } from '@/lib/allocation';
import { lessonWindow } from '@/lib/access-policy';
import { recordStudyDay, streakFromDates, toggleBookmark } from '@/lib/learning';
import { rememberOfflineLesson } from '@/components/offline-banner';
import { FORMAT_COSTS, FORMAT_LABELS, LESSON_COMPLETE_REWARD, UNIT_PASS_REWARD } from '@/lib/sparks';
import type { CertificateAward } from '@/lib/certificates';
import { authedFetch } from '@/lib/api-client';
import { CertificateCelebration } from '@/components/certificate-celebration';
import { SmartAudioPlayer } from '@/components/smart-audio-player';
import { VideoPlayer } from '@/components/video-player';
import { VideoStoryboard } from '@/components/video-storyboard';
import { MindmapRenderer } from '@/components/mindmap-renderer';
import { DownloadMenu } from '@/components/download-menu';
import { canDownload } from '@/lib/export/allow';
import { visibleJob } from '@/lib/generation-jobs';
import { InfographicRenderer } from '@/components/infographic-renderer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { resolveLessonCopy } from '@/lib/i18n/detect';
import { ContentLanguageBar } from '@/components/content-language-bar';
import { useContentTranslation } from '@/hooks/use-content-translation';
import { useQuizCopy } from '@/hooks/use-quiz-copy';
import { VisualBlockView } from '@/components/visual-blocks';
import {
  applyReviewLock, questionsForVersion, resolvePassMark, reviewGate, toAttemptSnapshot,
} from '@/lib/unit-test';
import { answersMatch, correctOptionId, optionId, optionIndex } from '@/lib/quiz';
import { getLanguage } from '@/lib/languages';
import {
  ArrowLeft, CheckCircle2, FileText, Headphones, FlipHorizontal,
  ClipboardList, Presentation, BookMarked, BookOpen, Network,
  Zap, ChevronLeft, ChevronRight, RotateCcw, Check, X, Lock,
  Video, Trophy, Timer, AlertTriangle, ArrowRight, ImageIcon, Calculator, Bookmark,
} from 'lucide-react';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 } }),
};

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
            <Badge className="mb-4 text-xs rounded-full bg-primary/10 text-primary border-primary/20">Question</Badge>
            <p className="text-lg font-semibold text-foreground leading-relaxed">{card.question}</p>
            <p className="text-xs text-muted-foreground mt-4">Tap to reveal answer</p>
          </div>
          {/* Back */}
          <div style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', position: 'absolute', inset: 0 }}
            className="bg-gradient-to-br from-primary/5 to-violet-500/5 border border-primary/20 rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-card"
          >
            <Badge className="mb-4 text-xs rounded-full bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Answer</Badge>
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
            <Button onClick={markAgain} variant="outline" className="rounded-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/10">
              <X className="w-4 h-4" /> Again
            </Button>
            <Button onClick={markKnown} className="rounded-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
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
  const { i18n } = useTranslation();
  const { display, translation } = useQuizCopy(`course-quiz:${questions[0]?.question ?? 'quiz'}`, questions, i18n.language);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [graded, setGraded] = useState<Record<number, { correct: boolean; feedback: string }> | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = () => {
    if (Object.keys(answers).length < questions.length) {
      toast.error('Please answer all questions before submitting.');
      return;
    }
    setLoading(true);
    const results: Record<number, { correct: boolean; feedback: string }> = {};
    let score = 0;
    questions.forEach((q, i) => {
      const correct = answersMatch(answers[i], q.answer, q.options);
      const answerIndex = optionIndex(correctOptionId(q.options, q.answer) ?? '', q.options.length);
      const shown = display[i] ?? q;
      const label = answerIndex >= 0 ? (shown.options[answerIndex] ?? q.options[answerIndex] ?? q.answer) : q.answer;
      results[i] = { correct, feedback: correct ? 'Correct!' : `The answer is: ${label}` };
      if (correct) score += 1;
    });
    setGraded(results);
    setLoading(false);
    onComplete(score, questions.length, questions.map((q, i) => ({
      question: q.question,
      answer: answers[i] ?? '',
      correct: results[i]?.correct ?? false,
    })));
  };

  const percentage = graded ? Math.round(Object.values(graded).filter(r => r.correct).length / questions.length * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-6" dir={translation.dir}>
      <ContentLanguageBar status={translation.status} showOriginal={translation.showOriginal} notice={translation.notice} onToggle={translation.toggle} />
      {graded && (
        <div className={`rounded-3xl p-5 text-center border ${percentage >= 70 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
          <p className="text-3xl font-extrabold">{percentage}%</p>
          <p className={`text-sm font-semibold mt-1 ${percentage >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>
            {Object.values(graded).filter(r => r.correct).length}/{questions.length} correct
            {percentage >= 70 ? ' — Great work! 🎉' : ' — Keep studying! 📚'}
          </p>
        </div>
      )}

      {questions.map((q, i) => {
        const shown = display[i] ?? q;
        return (
        <div key={i} className="bg-card border border-border rounded-3xl p-5">
          <p className="font-semibold text-foreground mb-4 text-sm leading-relaxed">
            <span className="text-primary font-bold">{i + 1}. </span>{shown.question}
          </p>
          <div className="space-y-2">
            {q.options.map((opt, k) => {
              const id = optionId(k);
              const label = shown.options[k] ?? opt;
              const selected = answers[i] === id;
              const isCorrect = graded ? answersMatch(id, q.answer, q.options) : null;
              const isWrong = graded && selected && !graded[i]?.correct;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={!!graded}
                  aria-pressed={selected}
                  onClick={() => !graded && setAnswers(a => ({ ...a, [i]: id }))}
                  className={`w-full text-start min-h-12 px-4 py-3 rounded-xl border text-sm font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    graded
                      ? isCorrect ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
                        : isWrong ? 'border-destructive/40 bg-destructive/10 text-destructive'
                        : selected ? 'border-border bg-muted text-muted-foreground'
                        : 'border-border bg-background text-muted-foreground'
                      : selected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50 text-foreground'
                  }`}
                >
                  {label}
                  {graded && isCorrect && <span className="float-right text-emerald-600">✓</span>}
                  {graded && isWrong && <span className="float-right text-destructive">✗</span>}
                </button>
              );
            })}
          </div>
          {graded?.[i] && (
            <p className={`mt-3 text-xs px-3 py-2 rounded-lg ${graded[i].correct ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
              {graded[i].feedback}
            </p>
          )}
        </div>
      );
      })}

      {!graded && (
        <Button onClick={handleSubmit} disabled={loading || Object.keys(answers).length < questions.length}
          className="w-full h-11 rounded-full font-bold bg-primary text-primary-foreground"
        >
          {loading ? 'Checking answers…' : `Submit Quiz (${Object.keys(answers).length}/${questions.length})`}
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
  courseId, lesson, unit, unitLessons, attempts, lessonCompletedAt, course, onAttemptSaved, onCertificate,
}: {
  courseId: string;
  lesson: Lesson;
  unit: Module;
  unitLessons: Lesson[];
  attempts: UnitQuizAttempt[];
  lessonCompletedAt?: Record<string, number>;
  course: Course | null;
  onAttemptSaved: (attempt: UnitQuizAttempt) => void;
  onCertificate: (award: CertificateAward) => void;
}) {
  const router = useRouter();
  const { i18n } = useTranslation();
  const { user, profile, fetchProfile } = useAuthSTORE();
  const unitMode = lesson.lessonType === 'unit_test';
  const gate = reviewGate(attempts.map(toAttemptSnapshot), lessonCompletedAt, lesson.id);
  const paper = unitMode ? questionsForVersion(lesson.unitTest, gate.nextVersion) : [];
  const questions = unitMode
    ? paper.map(q => ({
      question: q.prompt,
      options: q.options.map(option => option.text),
      answer: q.answerId,
      objectiveCode: q.bloom,
      sourceLessonId: q.lessonId,
      id: q.id,
    }))
    : (Array.isArray(lesson.aiOutputs?.quiz) ? lesson.aiOutputs.quiz : []);
  const { display, translation } = useQuizCopy(`unit-quiz:${lesson.id}:${gate.nextVersion}`, questions, i18n.language);
  const threshold = resolvePassMark(course, unit);
  const paperName = unitMode ? 'Unit Test' : 'Mastery Quiz';

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

    const saveMarkedUnitTest = async (): Promise<UnitQuizAttempt> => {
      const marked = await authedFetch('/api/unit-tests/mark', {
        method: 'POST',
        body: JSON.stringify({
          courseId,
          unitId: unit.id,
          lessonId: lesson.id,
          answers: paper.map((question, index) => ({ questionId: question.id, selected: answers[index] ?? '' })),
          timeTakenSeconds,
        }),
      });
      const lessonIds = Array.isArray(marked.lessonIds) ? marked.lessonIds.filter((id): id is string => typeof id === 'string') : [];
      const responses = Array.isArray(marked.responses) ? marked.responses as UnitQuizAttempt['responses'] : [];
      const certificate = marked.certificate && typeof marked.certificate === 'object'
        ? marked.certificate as CertificateAward
        : null;
      return {
        id: typeof marked.attemptId === 'string' ? marked.attemptId : '',
        studentId: user.uid,
        studentName: profile?.name ?? '',
        courseId,
        unitId: unit.id,
        lessonId: lesson.id,
        kind: 'unit_test',
        version: marked.version === 'B' ? 'B' : 'A',
        attemptNumber: Number(marked.attemptNumber) || 1,
        score: Number(marked.score) || 0,
        total: Number(marked.maxScore) || 0,
        marksAwarded: Number(marked.score) || 0,
        marksMax: Number(marked.maxScore) || 0,
        percentage: Number(marked.percentage) || 0,
        passed: marked.passed === true,
        counted: marked.counted !== false,
        timeTakenSeconds,
        responses,
        recommendedLessonIds: lessonIds,
        ...(typeof marked.weakestObjective === 'string' ? { weakestObjective: marked.weakestObjective } : {}),
        ...(certificate ? { certificate } : {}),
      };
    };

    const saveLegacyQuiz = async (): Promise<UnitQuizAttempt> => {
      const responses = questions.map((q, i) => ({
        questionIndex: i,
        question: q.question,
        ...(q.objectiveCode ? { objectiveCode: q.objectiveCode } : {}),
        ...(q.sourceLessonId ? { sourceLessonId: q.sourceLessonId } : {}),
        selected: answers[i] ?? '',
        correct: answersMatch(answers[i], q.answer, q.options),
      }));
      const score = responses.filter(r => r.correct).length;
      const total = questions.length;
      const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
      return saveUnitQuizAttempt({
        studentId: user.uid,
        studentName: profile?.name ?? '',
        courseId,
        unitId: unit.id,
        lessonId: lesson.id,
        score,
        total,
        percentage,
        passed: percentage >= threshold,
        timeTakenSeconds,
        responses,
        startedAt: Timestamp.fromMillis(startedAtRef.current),
      });
    };

    try {
      const saved = unitMode
        ? await saveMarkedUnitTest()
        : await saveLegacyQuiz();
      setResult(saved);
      setPhase('result');
      onAttemptSaved(saved);
      if (saved.certificate?.fresh) {
        await fetchProfile(user.uid);
        onCertificate(saved.certificate);
      } else if (saved.passed && saved.counted !== false) {
        await fetchProfile(user.uid);
        toast.success(`Module passed! +${UNIT_PASS_REWARD}⚡ earned 🏆`, { duration: 5000 });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save your attempt. Please try again.');
    }
    setSubmitting(false);
  };

  // ── Intro ──
  if (phase === 'intro') {
    return (
      <motion.div initial="hidden" animate="visible" variants={fadeUp} className="max-w-2xl mx-auto py-8">
        <div className="relative overflow-hidden bg-primary rounded-3xl p-8 text-primary-foreground text-center mb-6">
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-white/5 blur-3xl" />
          <div className="relative">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary-foreground/70 mb-3">{unitMode ? 'Unit Test' : 'Mastery Challenge'}</p>
            <Trophy className="w-10 h-10 mx-auto mb-3 text-primary-foreground" />
            <h2 className="font-heading text-3xl mb-2">{unit.title} — {paperName}{unitMode ? ` ${gate.nextVersion}` : ''}</h2>
            <p className="text-primary-foreground/80 text-sm max-w-md mx-auto">
              {questions.length} questions. Score {threshold}% or higher to pass and unlock the next module.
              {unitMode ? ' Marks are weighted, and a retake uses the other version.' : ''}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-card border border-border rounded-3xl p-4 text-center card-glow">
            <p className="text-2xl font-extrabold text-foreground">{questions.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Questions</p>
          </div>
          <div className="bg-card border border-border rounded-3xl p-4 text-center card-glow">
            <p className="text-2xl font-extrabold text-foreground">{threshold}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">Pass mark</p>
          </div>
          <div className="bg-card border border-border rounded-3xl p-4 text-center card-glow">
            <p className="text-2xl font-extrabold text-foreground">{bestPercentage !== null ? `${bestPercentage}%` : '—'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{attempts.length ? `Best of ${attempts.length}` : 'No attempts yet'}</p>
          </div>
        </div>

        {unitMode && gate.locked ? (
          <div className="bg-primary/5 border border-primary/20 rounded-3xl p-5">
            <h3 className="font-bold text-foreground text-sm mb-1">Review these lessons</h3>
            <p className="text-xs text-muted-foreground mb-3">The unit test stays locked until you complete them again. The retake will be Version {gate.nextVersion}.</p>
            <div className="space-y-2">
              {gate.pendingLessonIds.map(id => {
                const item = lessonTitleById.get(id);
                return (
                  <button
                    key={id}
                    onClick={() => router.push(`/dashboard/student/courses/${courseId}/lessons/${id}`)}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl bg-card border border-primary/20 text-left"
                  >
                    <BookOpen className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm font-semibold text-foreground flex-1">{item?.title ?? 'Lesson'}</span>
                    <ArrowRight className="w-4 h-4 text-primary/60 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <Button onClick={startQuiz} disabled={unitMode && questions.length === 0} className="w-full h-12 rounded-full font-bold bg-primary text-primary-foreground text-base gap-2">
            <Timer className="w-4 h-4" />
            {attempts.length ? `Retake ${paperName}` : `Start ${paperName}`}{unitMode ? ` ${gate.nextVersion}` : ''} — your time will be recorded
          </Button>
        )}
        <p className="text-xs text-muted-foreground text-center mt-3">
          {unitMode
            ? `Pass mark ${threshold}%. A score below that lists the lessons to review and locks the retake until you finish them.`
            : `If you score below ${threshold}%, we will show which lessons to review.`}
        </p>
      </motion.div>
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
      <motion.div initial="hidden" animate="visible" variants={fadeUp} className="max-w-2xl mx-auto py-8 space-y-5">
        <div className={`relative overflow-hidden rounded-3xl p-8 text-center border ${
          result.passed
            ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20'
            : 'bg-gradient-to-br from-amber-500/10 to-destructive/5 border-amber-500/20'
        }`}>
          {result.passed
            ? <Trophy className="w-10 h-10 mx-auto mb-3 text-emerald-600" />
            : <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-amber-600" />}
          <p className="text-5xl font-extrabold text-foreground">{result.percentage}%</p>
          <p className={`text-sm font-semibold mt-2 ${result.passed ? 'text-emerald-600' : 'text-amber-600'}`}>
            {result.marksAwarded ?? result.score}/{result.marksMax ?? result.total} marks · {formatTime(result.timeTakenSeconds)} · attempt #{result.attemptNumber}{result.version ? ` · Version ${result.version}` : ''}
          </p>
          <p className={`text-base font-bold mt-3 ${result.passed ? 'text-emerald-600' : 'text-amber-600'}`}>
            {result.passed
              ? `Passed! +${UNIT_PASS_REWARD}⚡ — the next module is now unlocked.`
              : `Not yet — you need ${threshold}% to pass. Review these lessons, then the unit test unlocks on Version ${result.version === 'A' ? 'B' : 'A'}.`}
          </p>
        </div>

        {/* Per-objective breakdown */}
        {Object.keys(wrongByObjective).length > 0 && (
          <div className="bg-card border border-border rounded-3xl p-5">
            <h3 className="font-bold text-foreground text-sm mb-3">Breakdown by objective</h3>
            <div className="space-y-2">
              {Object.entries(wrongByObjective).map(([code, stats]) => {
                const pct = Math.round(((stats.total - stats.wrong) / stats.total) * 100);
                return (
                  <div key={code} className="flex items-center gap-3">
                    <span className={`text-xs font-mono font-bold w-20 shrink-0 ${
                      code === result.weakestObjective ? 'text-destructive' : 'text-muted-foreground'
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
              <p className="text-xs text-destructive mt-3">
                Weakest objective: <strong>{result.weakestObjective}</strong>
              </p>
            )}
          </div>
        )}

        {/* Adaptive review */}
        {!result.passed && reviewLessons.length > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-3xl p-5">
            <h3 className="font-bold text-foreground text-sm mb-1">Review these lessons</h3>
            <p className="text-xs text-primary mb-3">Complete them again to unlock the retake:</p>
            <div className="space-y-2">
              {reviewLessons.map(l => (
                <button
                  key={l.id}
                  onClick={() => router.push(`/dashboard/student/courses/${courseId}/lessons/${l.id}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-card border border-primary/20 hover:border-primary/40 transition-colors text-left"
                >
                  <BookOpen className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm font-semibold text-foreground flex-1">
                    {l.lessonNumber ? `L${l.lessonNumber} · ` : ''}{l.title}
                  </span>
                  <ArrowRight className="w-4 h-4 text-primary/60 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          {!result.passed && (result.recommendedLessonIds?.length ?? 0) === 0 && (
            <Button onClick={startQuiz} variant="outline" className="flex-1 h-11 rounded-full font-bold gap-2">
              <RotateCcw className="w-4 h-4" /> Retake
            </Button>
          )}
          <Button
            onClick={() => router.push(`/dashboard/student/courses/${courseId}`)}
            className={`flex-1 h-11 rounded-full font-bold ${result.passed ? 'bg-primary text-primary-foreground' : ''}`}
            variant={result.passed ? 'default' : 'outline'}
          >
            Back to course
          </Button>
        </div>
      </motion.div>
    );
  }

  // ── Active quiz ──
  return (
    <div className="max-w-2xl mx-auto py-6 space-y-6" dir={translation.dir}>
      <ContentLanguageBar status={translation.status} showOriginal={translation.showOriginal} notice={translation.notice} onToggle={translation.toggle} />
      <div className="sticky top-0 z-10 bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Timer className="w-4 h-4 text-primary" /> {formatTime(elapsed)}
        </div>
        <span className="text-sm text-muted-foreground">
          {Object.keys(answers).length}/{questions.length} answered
        </span>
      </div>

      {questions.map((q, i) => {
        const shown = display[i] ?? q;
        return (
        <div key={i} className="bg-card border border-border rounded-3xl p-5">
          <div className="flex items-start justify-between gap-2 mb-4">
            <p className="font-semibold text-foreground text-sm leading-relaxed">
              <span className="text-primary font-bold">{i + 1}. </span>{shown.question}
            </p>
            {q.objectiveCode && (
              <Badge variant="outline" className="text-[10px] font-mono rounded-full shrink-0">{q.objectiveCode}</Badge>
            )}
          </div>
          <div className="space-y-2">
            {q.options.map((opt, k) => {
              const id = optionId(k);
              return (
              <button
                key={id}
                type="button"
                aria-pressed={answers[i] === id}
                onClick={() => setAnswers(a => ({ ...a, [i]: id }))}
                className={`w-full text-start min-h-12 px-4 py-3 rounded-xl border text-sm font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  answers[i] === id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50 text-foreground'
                }`}
              >
                {shown.options[k] ?? opt}
              </button>
              );
            })}
          </div>
        </div>
        );
      })}

      <Button
        onClick={handleSubmit}
        disabled={submitting || Object.keys(answers).length < questions.length}
        className="w-full h-12 rounded-full font-bold bg-primary text-primary-foreground"
      >
        {submitting ? 'Saving attempt…' : `Submit ${paperName} (${Object.keys(answers).length}/${questions.length})`}
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
    <motion.div
      initial="hidden" animate="visible" variants={fadeUp}
      className="relative overflow-hidden bg-card border border-border rounded-3xl p-10 text-center max-w-md mx-auto my-8 card-glow"
    >
      <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full bg-amber-500/10 blur-2xl" />
      <div className="relative">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-600 mb-3">Premium Format</p>
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-amber-600" />
        </div>
        <h3 className="font-heading text-2xl text-foreground mb-1">
          Unlock {FORMAT_LABELS[format] ?? format}
        </h3>
        <p className="text-sm text-muted-foreground mb-2">
          Unlock this format for this lesson — yours forever once unlocked.
        </p>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 mb-5">
          <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
          <span className="text-base font-extrabold text-amber-600">⚡{cost}</span>
          <span className="text-xs font-semibold text-amber-600/80">Sparks</span>
        </div>
        <div>
          <Button
            onClick={onUnlock}
            disabled={!canAfford || unlocking}
            className="rounded-full h-11 px-6 font-bold gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white"
          >
            <Zap className="w-4 h-4 fill-white" />
            {unlocking ? 'Unlocking…' : `Unlock for ⚡${cost}`}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          {canAfford
            ? `Your balance: ⚡${balance}`
            : `You have ⚡${balance} — complete lessons to earn ⚡${LESSON_COMPLETE_REWARD} each.`}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function LessonPage() {
  const { t, i18n } = useTranslation();
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
  const [celebration, setCelebration] = useState<CertificateAward | null>(null);
  const [completing, setCompleting] = useState(false);
  const [note, setNote] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('text');
  const [unlockingFormat, setUnlockingFormat] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [closedReason, setClosedReason] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const sourceCopy = lesson
    ? resolveLessonCopy(lesson, i18n.language)
    : { title: '', text: '', language: 'en', fellBack: false };
  const translation = useContentTranslation(
    `lesson:${lessonId ?? 'pending'}`,
    { title: sourceCopy.title, text: sourceCopy.text },
    i18n.language,
    Boolean(lesson) && sourceCopy.fellBack,
  );

  useEffect(() => {
    if (!user || !courseId || !lessonId) return;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
      const [result, savedNote, courseDoc] = await Promise.all([
        getLessonByIds(courseId, lessonId),
        getLessonNote(user.uid, lessonId),
        getCourse(courseId),
      ]);
      if (!result) { setLoading(false); return; }
      if (courseDoc && !lessonVisibleToStudent(result.lesson, courseDoc)) {
        setCourse(courseDoc);
        setLesson(result.lesson);
        setClosedReason('This lesson is not published.');
        setLoading(false);
        return;
      }
      setNote(savedNote);
      setCourse(courseDoc);
      let lessonIndex = Math.max(0, (result.lesson.order ?? 1) - 1);
      let unitIndex = 0;
      let enroll: Enrollment | null = null;

      if (courseDoc?.kind === 'curriculum' || result.lesson.lessonType === 'unit_test' || result.lesson.isUnitQuiz) {
        const [allUnits, enrollDoc, quizAttempts] = await Promise.all([
          getModulesWithLessons(courseId),
          getEnrollment(user.uid, courseId),
          getUnitQuizAttempts(user.uid, courseId),
        ]);
        const units = allUnits
          .map(u => ({ module: u.module, lessons: u.lessons.filter(l => l.status === 'published') }))
          .filter(u => u.lessons.length > 0);
        unitIndex = units.findIndex(u => u.module.id === result.moduleId);
        const completedIds = new Set(enrollDoc?.completedLessons ?? []);

        // Lock guard — direct URLs can't bypass unit/lesson progression
        if (unitIndex >= 0) {
          const statuses = getUnitStatuses(units, enrollDoc, quizAttempts);
          const baseStatus = getCurriculumLessonStatus(
            result.lesson, units[unitIndex].lessons, statuses[unitIndex].state, completedIds,
          );
          const lessonStatus = applyReviewLock(
            baseStatus,
            result.lesson,
            quizAttempts,
            enrollDoc?.lessonCompletedAt,
          );
          if (lessonStatus === 'locked') {
            toast.error(baseStatus !== 'locked' && result.lesson.lessonType === 'unit_test'
              ? 'Review these lessons before the unit test unlocks.'
              : t('lesson.locked'));
            router.replace(`/dashboard/student/courses/${courseId}`);
            return;
          }
          lessonIndex = Math.max(0, units[unitIndex].lessons.findIndex(item => item.id === lessonId));
          setUnit(units[unitIndex].module);
          setUnitLessons(units[unitIndex].lessons);
        }
        enroll = enrollDoc;
        setEnrollment(enroll);
        setAttempts(quizAttempts.filter(a => a.lessonId === lessonId));
        setCompleted(completedIds.has(lessonId));
      } else {
        // Marketplace courses also track enrollment/completion.
        enroll = await getEnrollment(user.uid, courseId);
        setEnrollment(enroll);
        setCompleted((enroll?.completedLessons ?? []).includes(lessonId));
      }

      if (courseDoc?.accessPolicy) {
        const enrolledOn = enroll?.enrolledAt?.toDate?.().toISOString().slice(0, 10);
        const accessViewer = {
          ...viewerFromProfile(profile, { userId: user.uid, enrolled: !!enroll }),
          enrolled: !!enroll,
          enrolledOn,
          now: new Date().toISOString().slice(0, 10),
          trial: enroll?.trial === true,
        };
        const productDecision = productAccess(courseDoc, accessViewer);
        const lessonDecision = lessonWindow(courseDoc.accessPolicy, accessViewer, lessonIndex, unitIndex);
        const scheduleClosed = productDecision.reason.startsWith('Releases')
          || productDecision.reason === 'Access ended'
          || productDecision.reason === 'Excluded'
          || productDecision.reason === 'Trial ended';
        if (!productDecision.listed) setClosedReason(productDecision.reason);
        else if (scheduleClosed) setClosedReason(productDecision.reason);
        else if (!lessonDecision.open) setClosedReason(lessonDecision.reason);
        else if (!productDecision.open && lessonDecision.reason !== 'Free preview') setClosedReason(productDecision.reason);
        else setClosedReason(null);
      } else {
        setClosedReason(null);
      }

      setLesson(result.lesson);
      setLessonContext(
        result.lesson.title,
        result.lesson.aiOutputs?.summary ?? result.lesson.aiOutputs?.text ?? ''
      );
      rememberOfflineLesson(result.lesson.title);
      void rememberLesson(user.uid, courseId, lessonId).catch(() => {});
      const today = new Date().toISOString().slice(0, 10);
      if (!(profile?.studyDates ?? []).includes(today)) {
        void updateUser(user.uid, { studyDates: recordStudyDay(profile?.studyDates ?? [], today) }).catch(() => {});
      }
      setLoading(false);
      } catch (err: any) {
        console.error('Failed to load lesson:', err);
        setLoadError(err?.message || 'Something went wrong loading this lesson.');
        setLoading(false);
      }
    })();
    return () => clearLessonContext();
  }, [user, courseId, lessonId, reloadKey]);

  const isCurriculum = course?.kind === 'curriculum';
  const isUnitQuiz = lesson?.lessonType === 'unit_test' || (isCurriculum && !!lesson?.isUnitQuiz);
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
    try {
      const result = await markLessonComplete(user.uid, courseId, lessonId, 50, isCurriculum ? LESSON_COMPLETE_REWARD : 0);
      if (result.accepted === false) {
        toast.error('This lesson is still a draft, so it does not count toward the module.');
      } else {
        await fetchProfile(user.uid);
        setCompleted(true);
        if (result.certificate?.fresh) {
          setCelebration(result.certificate);
        } else {
          toast.success(
            isCurriculum
              ? `Lesson complete! +50 XP · +${LESSON_COMPLETE_REWARD}⚡ earned 🎉`
              : 'Lesson complete! +50 XP earned 🎉',
            { duration: 4000 }
          );
        }
      }
    } catch (err: any) {
      console.error('Failed to mark lesson complete:', err);
      toast.error(err?.message || 'Could not mark the lesson complete. Please try again.');
    }
    setCompleting(false);
  };

  const bookmarked = (enrollment?.bookmarkedLessons ?? []).includes(lessonId);
  const studyStreak = streakFromDates(
    recordStudyDay(profile?.studyDates ?? [], new Date().toISOString().slice(0, 10)),
    new Date().toISOString().slice(0, 10),
  ).current;

  const handleBookmark = async () => {
    if (!user || !enrollment) {
      toast.error('Enrol in this course to bookmark a lesson.');
      return;
    }
    const next = toggleBookmark(enrollment.bookmarkedLessons ?? [], lessonId);
    setEnrollment({ ...enrollment, bookmarkedLessons: next });
    try {
      await setBookmarkedLessons(user.uid, courseId, next);
    } catch (err) {
      setEnrollment(enrollment);
      toast.error(err instanceof Error ? err.message : 'That bookmark could not be saved.');
    }
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
    try {
      await saveSubmission({
        studentId: user.uid,
        studentName: profile?.name ?? user?.displayName ?? 'Student',
        courseId,
        lessonId,
        lessonTitle: lesson.title,
        type: 'quiz',
        maxScore: total,
        score,
        answers,
      });
    } catch (err: any) {
      console.error('Failed to save quiz submission:', err);
      toast.error(err?.message || 'Could not save your quiz results.');
    }
  };

  const aiOutputs = lesson?.aiOutputs;

  // Legacy Firestore docs can contain poisoned strings where arrays are
  // expected — treat any non-array value as absent.
  const flashcards = Array.isArray(aiOutputs?.flashcards) ? aiOutputs.flashcards : [];
  const quiz = Array.isArray(aiOutputs?.quiz) ? aiOutputs.quiz : [];
  const slides = Array.isArray(aiOutputs?.slides) ? aiOutputs.slides : [];
  const glossary = Array.isArray(aiOutputs?.glossary) ? aiOutputs.glossary : [];

  const TABS: { id: string; label: string; icon: React.ReactNode; available: boolean; format?: string }[] = [
    { id: 'text', label: 'Lesson', icon: <FileText className="w-3.5 h-3.5" />, available: !!readLessonBody(lesson).trim(), format: 'text' },
    { id: 'video', label: 'Video', icon: <Video className="w-3.5 h-3.5" />, available: !!aiOutputs?.videoScript, format: 'videoScript' },
    { id: 'flashcards', label: 'Flashcards', icon: <FlipHorizontal className="w-3.5 h-3.5" />, available: flashcards.length > 0, format: 'flashcards' },
    { id: 'quiz', label: 'Quiz', icon: <ClipboardList className="w-3.5 h-3.5" />, available: quiz.length > 0, format: 'quiz' },
    { id: 'problems', label: 'Practice', icon: <Calculator className="w-3.5 h-3.5" />, available: !!aiOutputs?.problems, format: 'problems' },
    { id: 'slides', label: 'Slides', icon: <Presentation className="w-3.5 h-3.5" />, available: slides.length > 0, format: 'slides' },
    { id: 'notes', label: 'Study Notes', icon: <BookOpen className="w-3.5 h-3.5" />, available: !!aiOutputs?.notes, format: 'notes' },
    { id: 'audio', label: 'Audio', icon: <Headphones className="w-3.5 h-3.5" />, available: !!aiOutputs?.audioScript, format: 'audioScript' },
    { id: 'infographic', label: 'Infographic', icon: <ImageIcon className="w-3.5 h-3.5" />, available: !!aiOutputs?.infographic, format: 'infographic' },
    { id: 'summary', label: 'Summary', icon: <Headphones className="w-3.5 h-3.5" />, available: !!aiOutputs?.summary },
    { id: 'glossary', label: 'Glossary', icon: <BookMarked className="w-3.5 h-3.5" />, available: glossary.length > 0, format: 'glossary' },
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
      <div className="h-16 bg-muted animate-pulse rounded-3xl" />
      <div className="h-96 bg-muted animate-pulse rounded-3xl" />
    </div>
  );

  if (loadError) return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-24 text-center">
      <AlertTriangle className="w-10 h-10 mx-auto mb-4 text-amber-500" />
      <p className="font-semibold text-foreground mb-1">{t('lesson.loadFailed')}</p>
      <p className="text-sm text-muted-foreground mb-6">{loadError}</p>
      <Button onClick={() => setReloadKey(k => k + 1)} className="rounded-full px-6 font-bold gap-2">
        <RotateCcw className="w-4 h-4" /> {t('lesson.retry')}
      </Button>
    </div>
  );

  if (!lesson) return (
    <div className="text-center py-16 text-muted-foreground">{t('lesson.notFound')}</div>
  );

  if (closedReason) return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-24 text-center">
      <Lock className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
      <h1 className="font-heading text-xl text-foreground mb-2">{lesson.title}</h1>
      <p className="text-sm text-muted-foreground mb-6">{closedReason}</p>
      <Button onClick={() => router.push(`/dashboard/student/courses/${courseId}`)} className="rounded-full px-6 font-bold gap-2">
        <ArrowLeft className="w-4 h-4" /> {t('lesson.backToCourse')}
      </Button>
    </div>
  );

  const copy = {
    title: translation.values.title || sourceCopy.title,
    text: translation.values.text || sourceCopy.text,
  };
  const languageNotice = translation.autoTranslated ? (
    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-primary">
      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold">{t('lesson.autoTranslated')}</span>
      <button type="button" className="underline" onClick={translation.toggle}>
        {translation.showOriginal ? t('lesson.showTranslation') : t('lesson.showOriginal')}
      </button>
    </p>
  ) : sourceCopy.fellBack ? (
    <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
      {translation.status === 'unavailable'
        ? t('lesson.unavailable')
        : t('lesson.fallback', { language: getLanguage(i18n.language).label })}
    </p>
  ) : null;

  const hasUnitPaper = (lesson.unitTest?.versionA?.length ?? 0) + (lesson.unitTest?.versionB?.length ?? 0) > 0;

  // ── Unit mastery quiz takes over the whole page ──
  if (isUnitQuiz && unit) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <CertificateCelebration award={celebration} onClose={() => setCelebration(null)} />
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/student/courses/${courseId}`)} className="shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">{t('lesson.mastery')}</p>
            <h1 className="font-heading text-foreground text-lg truncate">{copy.title}</h1>
            {languageNotice}
          </div>
          {completed && (
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 rounded-full gap-1.5 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" /> {t('lesson.passed')}
            </Badge>
          )}
        </div>
        <VisualBlockView blocks={lesson.visualBlocks} />
        {(lesson.lessonType === 'unit_test' ? hasUnitPaper : quiz.length > 0) ? (
          <UnitQuizMode
            courseId={courseId}
            lesson={lesson}
            unit={unit}
            unitLessons={unitLessons}
            attempts={attempts}
            lessonCompletedAt={enrollment?.lessonCompletedAt}
            course={course}
            onAttemptSaved={(a) => {
              setAttempts(prev => [a, ...prev]);
              if (a.passed && a.counted !== false) setCompleted(true);
            }}
            onCertificate={setCelebration}
          />
        ) : (
          <div className="text-center py-20 text-muted-foreground bg-muted/30 rounded-3xl border border-dashed border-border">
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-semibold">{t('lesson.quizUnpublished')}</p>
            <p className="text-sm mt-1">{t('lesson.quizUnpublishedBody')}</p>
          </div>
        )}
      </div>
    );
  }

  const downloadViewer = {
    role: profile?.role,
    tier: profile?.accessTier ?? null,
    permissions: profile?.permissions ?? [],
    courseId,
    downloadsEnabled: course?.downloadsEnabled ?? null,
  };
  const downloadsOn = canDownload(downloadViewer).allowed;
  const downloadFor = (
    asset: 'notes' | 'glossary' | 'flashcards' | 'quiz' | 'problems' | 'slides' | 'infographic' | 'mindmap',
    content: unknown,
    format?: string,
    answerKeyToggle = false,
  ) => (
    downloadsOn && !isFormatLocked(format) ? (
      <DownloadMenu
        asset={asset}
        title={copy.title}
        content={content}
        viewer={downloadViewer}
        courseId={courseId}
        answerKeyToggle={answerKeyToggle}
      />
    ) : null
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <CertificateCelebration award={celebration} onClose={() => setCelebration(null)} />
      {/* Header */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">{isCurriculum ? t('lesson.unit') : t('lesson.course')}</p>
            <h1 className="font-heading text-foreground text-2xl truncate">{copy.title}</h1>
            {languageNotice}
            {!aiOutputs && !copy.text.trim() && <p className="text-xs text-muted-foreground">{t('lesson.empty')}</p>}
            {isCurriculum && lesson.objectiveCodes && lesson.objectiveCodes.length > 0 && (
              <p className="text-xs text-muted-foreground font-mono truncate">{lesson.objectiveCodes.join(' · ')}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {studyStreak > 0 && (
            <span className="hidden sm:inline text-xs font-semibold text-amber-700">{studyStreak}-day streak</span>
          )}
          <Button
            size="sm"
            variant="outline"
            className="rounded-full h-11 px-4 font-bold"
            onClick={() => { void handleBookmark(); }}
            aria-pressed={bookmarked}
          >
            <Bookmark className={`w-3.5 h-3.5 mr-1.5 ${bookmarked ? 'fill-current' : ''}`} />
            {bookmarked ? 'Saved' : 'Bookmark'}
          </Button>
          {completed ? (
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 rounded-full gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Completed
            </Badge>
          ) : (
            <Button
              size="sm"
              className="rounded-full h-11 px-5 font-bold bg-primary text-primary-foreground gap-1.5"
              onClick={handleComplete}
              disabled={completing}
            >
              <Zap className="w-3.5 h-3.5" />
              {completing ? 'Saving…' : isCurriculum ? `Mark Complete (+50 XP · ⚡${LESSON_COMPLETE_REWARD})` : 'Mark Complete (+50 XP)'}
            </Button>
          )}
        </div>
      </motion.div>

      <VisualBlockView blocks={lesson.visualBlocks} />
      {!aiOutputs && !copy.text.trim() ? (
        <div className="text-center py-20 text-muted-foreground bg-muted/30 rounded-3xl border border-dashed border-border">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-semibold">Content not yet generated</p>
          <p className="text-sm mt-1">Your teacher needs to publish this lesson from the teacher upload page.</p>
        </div>
      ) : !aiOutputs ? (
        <div className="prose prose-sm dark:prose-invert max-w-none bg-card border border-border rounded-3xl p-6 sm:p-8 card-glow" dir={translation.dir}>
          {downloadFor('notes', copy.text, 'text')}
          <LessonBody
            markdown={copy.text}
            imageDownload={downloadsOn ? image => (
              <DownloadMenu asset="image" title={image.alt} content={{ url: image.src }} viewer={downloadViewer} courseId={courseId} />
            ) : undefined}
          />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto gap-1.5 bg-muted/50 p-1.5 rounded-2xl mb-6">
            {TABS.map(t => (
              <TabsTrigger key={t.id} value={t.id} className="rounded-full h-8 px-3.5 text-xs font-semibold gap-1.5 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
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
              <motion.div initial="hidden" animate="visible" variants={fadeUp} className="prose prose-sm dark:prose-invert max-w-none bg-card border border-border rounded-3xl p-6 sm:p-8 card-glow" dir={translation.dir}>
                {downloadFor('notes', copy.text, 'text')}
                {aiOutputs.image?.placement === 'before' && <LessonFigure visual={aiOutputs.image} />}
                {aiOutputs.illustration?.placement === 'before' && <LessonFigure visual={aiOutputs.illustration} />}
                <LessonBody
                  markdown={copy.text}
                  imageDownload={downloadsOn && !isFormatLocked('text') ? image => (
                    <DownloadMenu asset="image" title={image.alt} content={{ url: image.src }} viewer={downloadViewer} courseId={courseId} />
                  ) : undefined}
                />
                {aiOutputs.image?.placement !== 'before' && <LessonFigure visual={aiOutputs.image} />}
                {aiOutputs.illustration?.placement !== 'before' && <LessonFigure visual={aiOutputs.illustration} />}
                {(lesson.mediaLibrary ?? []).length > 0 && downloadsOn && !isFormatLocked('text') && (
                  <div className="not-prose mt-6 space-y-3">
                    {(lesson.mediaLibrary ?? []).map(image => (
                      <div key={image.id}>
                        <DownloadMenu asset="image" title={image.alt || image.caption || 'Illustration'} content={{ url: image.src }} viewer={downloadViewer} courseId={courseId} />
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </TabsContent>

          {/* Video */}
          <TabsContent value="video">
            {gate('videoScript',
              <motion.div initial="hidden" animate="visible" variants={fadeUp} className="space-y-4">
                <VideoPlayer script={aiOutputs.videoScript ?? ''} title={lesson.title} />
                <details className="bg-card border border-border rounded-3xl overflow-hidden">
                  <summary className="cursor-pointer select-none px-6 py-4 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                    View storyboard &amp; script
                  </summary>
                  <div className="px-6 pb-6">
                    <VideoStoryboard script={aiOutputs.videoScript ?? ''} />
                  </div>
                </details>
              </motion.div>
            )}
          </TabsContent>

          {/* Flashcards */}
          <TabsContent value="flashcards">
            {gate('flashcards',
              flashcards.length
                ? <div>{downloadFor('flashcards', flashcards, 'flashcards')}<FlashcardViewer cards={flashcards} /></div>
                : <p className="text-center py-8 text-muted-foreground">No flashcards available.</p>
            )}
          </TabsContent>

          {/* Quiz */}
          <TabsContent value="quiz">
            {gate('quiz',
              quiz.length
                ? <div>{downloadFor('quiz', quiz, 'quiz', true)}<QuizViewer questions={quiz} onComplete={handleQuizComplete} /></div>
                : <p className="text-center py-8 text-muted-foreground">No quiz available.</p>
            )}
          </TabsContent>

          {/* Practice Problems */}
          <TabsContent value="problems">
            {gate('problems',
              <motion.div initial="hidden" animate="visible" variants={fadeUp} className="prose prose-sm dark:prose-invert max-w-none bg-card border border-border rounded-3xl p-6 sm:p-8 card-glow">
                {downloadFor('problems', aiOutputs.problems ?? '', 'problems', true)}
                <MathMarkdown>{aiOutputs.problems ?? ''}</MathMarkdown>
              </motion.div>
            )}
          </TabsContent>

          {/* Slides */}
          <TabsContent value="slides">
            {gate('slides',
              slides.length ? (
                <div className="space-y-4">
                  {downloadFor('slides', slides, 'slides')}
                  {slides.map((slide, i) => (
                    <motion.div key={i} initial="hidden" animate="visible" variants={fadeUp} custom={i} className="bg-card border border-border rounded-3xl p-6 card-glow">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">{i + 1}</div>
                        <h3 className="font-bold text-foreground">{slide.title}</h3>
                      </div>
                      <ul className="space-y-2">
                        {slide.bullets.map((b, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="text-primary mt-0.5 shrink-0">•</span>{b}
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  ))}
                </div>
              ) : <p className="text-center py-8 text-muted-foreground">No slides available.</p>
            )}
          </TabsContent>

          {/* Study Notes */}
          <TabsContent value="notes">
            {gate('notes',
              <motion.div initial="hidden" animate="visible" variants={fadeUp} className="prose prose-sm dark:prose-invert max-w-none bg-amber-500/10 dark:bg-amber-900/10 border border-amber-500/20 rounded-3xl p-6 sm:p-8">
                {downloadFor('notes', aiOutputs.notes ?? '', 'notes')}
                <MathMarkdown>{aiOutputs.notes ?? ''}</MathMarkdown>
              </motion.div>
            )}
          </TabsContent>

          {/* Audio Summary (text-to-speech) */}
          <TabsContent value="audio">
            {gate('audioScript',
              <motion.div initial="hidden" animate="visible" variants={fadeUp}>
                {(aiOutputs.audioScript ?? '').trim()
                  ? <SmartAudioPlayer script={aiOutputs.audioScript ?? ''} title="Audio Summary" />
                  : (
                    <p className="text-sm text-muted-foreground">
                      {visibleJob(lesson.generationJobs?.audioScript, Date.now())?.status === 'queued'
                        || visibleJob(lesson.generationJobs?.audioScript, Date.now())?.status === 'generating'
                        ? 'The audio script is being written.'
                        : 'The audio script is not ready yet.'}
                    </p>
                  )}
              </motion.div>
            )}
          </TabsContent>

          {/* Infographic */}
          <TabsContent value="infographic">
            {gate('infographic',
              <motion.div initial="hidden" animate="visible" variants={fadeUp}>
                {downloadFor('infographic', aiOutputs.infographic ?? '', 'infographic')}
                <InfographicRenderer content={aiOutputs.infographic ?? ''} />
              </motion.div>
            )}
          </TabsContent>

          {/* Summary */}
          <TabsContent value="summary">
            <motion.div initial="hidden" animate="visible" variants={fadeUp} className="bg-card border border-border rounded-3xl p-6 sm:p-8 card-glow">
              <div className="flex items-center gap-2 mb-4">
                <Headphones className="w-5 h-5 text-primary" />
                <h3 className="font-heading text-2xl text-foreground">Quick Summary</h3>
              </div>
              <div className="prose prose-sm max-w-none text-foreground">
                <MathMarkdown>{normalizeMarkdown(aiOutputs.summary ?? '')}</MathMarkdown>
              </div>
            </motion.div>
          </TabsContent>

          {/* Glossary */}
          <TabsContent value="glossary">
            {gate('glossary',
              glossary.length ? (
                <div className="space-y-3">
                  {downloadFor('glossary', glossary, 'glossary')}
                  {glossary.map((g, i) => (
                    <motion.div key={i} initial="hidden" animate="visible" variants={fadeUp} custom={i} className="bg-card border border-border rounded-3xl p-5 flex gap-4 card-glow">
                      <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                        <BookMarked className="w-4 h-4 text-violet-600" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{g.term}</p>
                        <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{g.definition}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : <p className="text-center py-8 text-muted-foreground">No glossary available.</p>
            )}
          </TabsContent>

          {/* Mind Map */}
          <TabsContent value="mindmap">
            {gate('mindmap',
              <motion.div initial="hidden" animate="visible" variants={fadeUp}>
                {downloadFor('mindmap', aiOutputs.mindmap ?? '', 'mindmap')}
                <MindmapRenderer content={aiOutputs.mindmap ?? ''} />
              </motion.div>
            )}
          </TabsContent>

          {/* My Notes */}
          <TabsContent value="mynotes">
            <motion.div initial="hidden" animate="visible" variants={fadeUp} className="bg-card border border-border rounded-3xl p-6 space-y-4 card-glow">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-2xl text-foreground">My Personal Notes</h3>
                <Button size="sm" variant="outline" onClick={handleSaveNote} disabled={noteSaving} className="rounded-full font-bold">
                  {noteSaving ? 'Saving…' : 'Save Note'}
                </Button>
              </div>
              <Textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Write your notes here… they're saved to your account."
                className="min-h-64 rounded-xl resize-none text-sm"
              />
            </motion.div>
          </TabsContent>
        </Tabs>
      )}
      <LessonQa courseId={courseId} lessonId={lessonId} lessonTitle={lesson.title} inAssessment={activeTab === 'quiz'} />
    </div>
  );
}
