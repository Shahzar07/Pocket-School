'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { useAuthSTORE } from '@/hooks/use-auth';
import { useTutorContext } from '@/hooks/use-tutor-context';
import { getLessonByIds, markLessonComplete, getLessonNote, saveLessonNote, saveSubmission, AiOutputs } from '@/lib/db';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  ArrowLeft, CheckCircle2, FileText, Headphones, FlipHorizontal,
  ClipboardList, Presentation, BookMarked, BookOpen, Network,
  Zap, ChevronLeft, ChevronRight, RotateCcw, Check, X,
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

// ─── Main Page ────────────────────────────────────────────────
export default function LessonPage() {
  const router = useRouter();
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const { user, fetchProfile } = useAuthSTORE();
  const { setLessonContext, clearLessonContext } = useTutorContext();

  const [lesson, setLesson] = useState<{ id: string; title: string; aiOutputs?: AiOutputs } | null>(null);
  const [moduleId, setModuleId] = useState('');
  const [completed, setCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [note, setNote] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('text');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !courseId || !lessonId) return;
    Promise.all([
      getLessonByIds(courseId, lessonId),
      getLessonNote(user.uid, lessonId),
    ]).then(([result, savedNote]) => {
      if (result) {
        setLesson(result.lesson);
        setModuleId(result.moduleId);
        setLessonContext(
          result.lesson.title,
          result.lesson.aiOutputs?.summary ?? result.lesson.aiOutputs?.text ?? ''
        );
      }
      setNote(savedNote);
      setLoading(false);
    });
    return () => clearLessonContext();
  }, [user, courseId, lessonId]);

  const handleComplete = async () => {
    if (!user || completed) return;
    setCompleting(true);
    await markLessonComplete(user.uid, courseId, lessonId);
    await fetchProfile(user.uid);
    setCompleted(true);
    toast.success('Lesson complete! +50 XP earned 🎉', { duration: 4000 });
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

  const TABS = [
    { id: 'text', label: 'Lesson', icon: <FileText className="w-3.5 h-3.5" />, available: !!aiOutputs?.text },
    { id: 'flashcards', label: 'Flashcards', icon: <FlipHorizontal className="w-3.5 h-3.5" />, available: !!(aiOutputs?.flashcards?.length) },
    { id: 'quiz', label: 'Quiz', icon: <ClipboardList className="w-3.5 h-3.5" />, available: !!(aiOutputs?.quiz?.length) },
    { id: 'slides', label: 'Slides', icon: <Presentation className="w-3.5 h-3.5" />, available: !!(aiOutputs?.slides?.length) },
    { id: 'notes', label: 'Study Notes', icon: <BookOpen className="w-3.5 h-3.5" />, available: !!aiOutputs?.notes },
    { id: 'summary', label: 'Summary', icon: <Headphones className="w-3.5 h-3.5" />, available: !!aiOutputs?.summary },
    { id: 'glossary', label: 'Glossary', icon: <BookMarked className="w-3.5 h-3.5" />, available: !!(aiOutputs?.glossary?.length) },
    { id: 'mindmap', label: 'Mind Map', icon: <Network className="w-3.5 h-3.5" />, available: !!aiOutputs?.mindmap },
    { id: 'mynotes', label: 'My Notes', icon: <FileText className="w-3.5 h-3.5" />, available: true },
  ].filter(t => t.available);

  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-4">
      <div className="h-16 bg-muted animate-pulse rounded-2xl" />
      <div className="h-96 bg-muted animate-pulse rounded-2xl" />
    </div>
  );

  if (!lesson) return (
    <div className="text-center py-16 text-muted-foreground">Lesson not found.</div>
  );

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
              {completing ? 'Saving…' : 'Mark Complete (+50 XP)'}
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
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Text */}
          <TabsContent value="text">
            <div className="prose prose-sm dark:prose-invert max-w-none bg-card border border-border rounded-2xl p-6 sm:p-8">
              <ReactMarkdown>{aiOutputs.text ?? ''}</ReactMarkdown>
            </div>
          </TabsContent>

          {/* Flashcards */}
          <TabsContent value="flashcards">
            {aiOutputs.flashcards?.length ? (
              <FlashcardViewer cards={aiOutputs.flashcards} />
            ) : <p className="text-center py-8 text-muted-foreground">No flashcards available.</p>}
          </TabsContent>

          {/* Quiz */}
          <TabsContent value="quiz">
            {aiOutputs.quiz?.length ? (
              <QuizViewer questions={aiOutputs.quiz} onComplete={handleQuizComplete} />
            ) : <p className="text-center py-8 text-muted-foreground">No quiz available.</p>}
          </TabsContent>

          {/* Slides */}
          <TabsContent value="slides">
            {aiOutputs.slides?.length ? (
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
            ) : <p className="text-center py-8 text-muted-foreground">No slides available.</p>}
          </TabsContent>

          {/* Study Notes */}
          <TabsContent value="notes">
            <div className="prose prose-sm dark:prose-invert max-w-none bg-amber-50 dark:bg-amber-900/10 border border-amber-200 rounded-2xl p-6 sm:p-8">
              <ReactMarkdown>{aiOutputs.notes ?? ''}</ReactMarkdown>
            </div>
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
            {aiOutputs.glossary?.length ? (
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
            ) : <p className="text-center py-8 text-muted-foreground">No glossary available.</p>}
          </TabsContent>

          {/* Mind Map */}
          <TabsContent value="mindmap">
            <div className="prose prose-sm dark:prose-invert max-w-none bg-card border border-border rounded-2xl p-6 sm:p-8">
              <ReactMarkdown>{aiOutputs.mindmap ?? ''}</ReactMarkdown>
            </div>
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
