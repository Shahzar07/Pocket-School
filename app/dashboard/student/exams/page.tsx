'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getEnrolledCourses, getPublishedExamsForStudent, getStudentExamSubmission, submitExam, Exam, ExamSubmission } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { PenSquare, CheckCircle2, Clock, Loader2, ChevronRight, Trophy } from 'lucide-react';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 },
  }),
};

export default function StudentExamsPage() {
  const { user } = useAuthSTORE();
  const [exams, setExams] = useState<{ exam: Exam; submission?: ExamSubmission }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const enrollments = await getEnrolledCourses(user.uid);
      const all: { exam: Exam; submission?: ExamSubmission }[] = [];
      for (const { course } of enrollments) {
        const courseExams = await getPublishedExamsForStudent([course.id!]);
        for (const exam of courseExams) {
          const sub = await getStudentExamSubmission(exam.id!, user.uid);
          all.push({ exam, submission: sub ?? undefined });
        }
      }
      setExams(all);
      setLoading(false);
    })();
  }, [user]);

  const startExam = (exam: Exam) => {
    setActiveExam(exam);
    setAnswers({});
    if (exam.timeLimit) {
      setTimeLeft(exam.timeLimit * 60);
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t === null || t <= 1) { clearInterval(timerRef.current!); return 0; }
          return t - 1;
        });
      }, 1000);
    }
  };

  const handleSubmit = async () => {
    if (!user || !activeExam) return;
    clearInterval(timerRef.current!);
    setSubmitting(true);
    try {
      let score = 0;
      const maxScore = activeExam.questions.reduce((s, q) => s + q.points, 0);
      for (const q of activeExam.questions) {
        const studentAns = answers[q.id] ?? '';
        if (q.type === 'multiple_choice' || q.type === 'true_false') {
          if (studentAns.trim().toLowerCase() === q.answer.trim().toLowerCase()) score += q.points;
        } else {
          const res = await fetch('/api/ai/quiz-grade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: q.question, correctAnswer: q.answer, studentAnswer: studentAns }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.correct) score += q.points;
          }
        }
      }
      const passed = maxScore > 0 ? (score / maxScore) * 100 >= activeExam.passingScore : false;
      await submitExam({ examId: activeExam.id!, studentId: user.uid, studentName: '', courseId: activeExam.courseId, answers, score, maxScore, passed });
      toast.success(`Exam submitted! Score: ${score}/${maxScore}`);
      const newSub: ExamSubmission = { id: '', examId: activeExam.id!, studentId: user.uid, studentName: '', courseId: activeExam.courseId, answers, score, maxScore, passed };
      setExams(prev => prev.map(e => e.exam.id === activeExam.id ? { ...e, submission: newSub } : e));
      setActiveExam(null);
    } catch { toast.error('Failed to submit exam.'); }
    finally { setSubmitting(false); }
  };

  const formatTime = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

  if (loading) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">
      <div className="space-y-3 pt-8">
        <div className="h-4 w-28 bg-muted animate-pulse rounded-full" />
        <div className="h-12 w-48 bg-muted animate-pulse rounded-2xl" />
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="h-24 bg-muted animate-pulse rounded-3xl" />
      ))}
    </div>
  );

  if (activeExam) {
    return (
      <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">
        {/* Header */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="flex items-center justify-between"
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">EXAM IN PROGRESS</p>
            <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-1.5">{activeExam.title}</h1>
          </div>
          {timeLeft !== null && (
            <div className={`flex items-center gap-2 font-bold text-lg px-5 py-2.5 rounded-full ${timeLeft < 60 ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
              <Clock className="w-5 h-5" />{formatTime(timeLeft)}
            </div>
          )}
        </motion.div>

        {/* Questions */}
        <div className="space-y-6">
          {activeExam.questions.map((q, i) => (
            <motion.div
              key={q.id}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={i}
              className="bg-card border border-border rounded-3xl p-6 space-y-4 card-glow"
            >
              <p className="font-semibold text-foreground">
                <span className="text-muted-foreground mr-2">Q{i + 1}.</span>{q.question}
              </p>
              {q.type === 'multiple_choice' && q.options && (
                <div className="space-y-2">
                  {q.options.filter(Boolean).map((opt, oi) => (
                    <label key={oi} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${answers[q.id] === opt ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                      <input type="radio" name={q.id} value={opt} checked={answers[q.id] === opt}
                        onChange={() => setAnswers(a => ({ ...a, [q.id]: opt }))} className="accent-primary" />
                      <span className="text-sm">{opt}</span>
                    </label>
                  ))}
                </div>
              )}
              {q.type === 'true_false' && (
                <div className="flex gap-3">
                  {['True', 'False'].map(opt => (
                    <label key={opt} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${answers[q.id] === opt ? 'border-primary bg-primary/5 font-semibold' : 'border-border hover:bg-muted/50'}`}>
                      <input type="radio" name={q.id} value={opt} checked={answers[q.id] === opt}
                        onChange={() => setAnswers(a => ({ ...a, [q.id]: opt }))} className="accent-primary" />
                      {opt}
                    </label>
                  ))}
                </div>
              )}
              {q.type === 'short_answer' && (
                <textarea
                  className="w-full bg-background border border-border rounded-2xl p-3 text-sm min-h-20 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Your answer..."
                  value={answers[q.id] ?? ''}
                  onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                />
              )}
              <p className="text-xs text-muted-foreground text-right">{q.points} pt{q.points !== 1 ? 's' : ''}</p>
            </motion.div>
          ))}
        </div>

        {/* Submit Button */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={activeExam.questions.length}>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-full h-12 font-bold bg-gradient-to-r from-[#1A73E8] to-[#7C3AED] text-white w-full gap-2 hover:opacity-90 transition-opacity"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {submitting ? 'Grading...' : 'Submit Exam'}
          </Button>
        </motion.div>
      </div>
    );
  }

  const pending = exams.filter(e => !e.submission);
  const completed = exams.filter(e => !!e.submission);

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">
      {/* Page Header */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">ASSESSMENTS</p>
        <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-1.5">
          <span className="gradient-text italic">Exams</span>
        </h1>
      </motion.div>

      {/* Empty State */}
      {exams.length === 0 && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
          className="relative text-center py-24"
        >
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-primary/8 blur-[80px]" />
          <PenSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
          <h2 className="font-heading text-2xl text-foreground">No exams available yet</h2>
          <p className="text-sm text-muted-foreground mt-2">Exams will appear here once your instructors publish them.</p>
        </motion.div>
      )}

      {/* Available Exams */}
      {pending.length > 0 && (
        <section className="space-y-4">
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Available ({pending.length})</p>
            <h2 className="font-heading text-3xl text-foreground mt-1.5">Ready to Take</h2>
          </motion.div>
          <div className="space-y-3">
            {pending.map((item, i) => (
              <motion.div
                key={item.exam.id}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={i + 2}
                className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-4 card-glow"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#1A73E8] to-[#7C3AED] flex items-center justify-center shrink-0">
                    <PenSquare className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{item.exam.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.exam.questions.length} questions · {item.exam.timeLimit ? `${item.exam.timeLimit} min` : 'No time limit'} · Pass: {item.exam.passingScore}%
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => startExam(item.exam)}
                  className="rounded-full h-11 px-5 font-bold bg-gradient-to-r from-[#1A73E8] to-[#7C3AED] text-white hover:opacity-90 transition-opacity gap-2 shrink-0"
                >
                  Start <ChevronRight className="w-4 h-4" />
                </Button>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Completed Exams */}
      {completed.length > 0 && (
        <section className="space-y-4">
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Completed ({completed.length})</p>
            <h2 className="font-heading text-3xl text-foreground mt-1.5">Past Results</h2>
          </motion.div>
          <div className="space-y-3">
            {completed.map((item, i) => {
              const pct = item.submission ? Math.round((item.submission.score / item.submission.maxScore) * 100) : 0;
              const passed = pct >= item.exam.passingScore;
              return (
                <motion.div
                  key={item.exam.id}
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  custom={i + 2}
                  className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-4 card-glow"
                >
                  <div className="flex items-center gap-3">
                    <Trophy className={`w-5 h-5 shrink-0 ${passed ? 'text-amber-500' : 'text-muted-foreground'}`} />
                    <div>
                      <p className="font-semibold text-foreground">{item.exam.title}</p>
                      <Badge className={`rounded-full text-[10px] mt-1 ${passed ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'}`}>
                        {passed ? 'Passed' : 'Failed'}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-heading text-3xl text-foreground">{pct}%</p>
                    <p className="text-xs text-muted-foreground">{item.submission?.score}/{item.submission?.maxScore}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
