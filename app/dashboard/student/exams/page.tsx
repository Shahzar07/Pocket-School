'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getEnrolledCourses, getPublishedExamsForStudent, getStudentExamSubmission, submitExam, Exam, ExamSubmission } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { PenSquare, CheckCircle2, Clock, Loader2, ChevronRight, Trophy } from 'lucide-react';

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
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
      {[1, 2].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />)}
    </div>
  );

  if (activeExam) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-foreground">{activeExam.title}</h1>
          {timeLeft !== null && (
            <div className={`flex items-center gap-2 font-bold text-lg px-4 py-2 rounded-xl ${timeLeft < 60 ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
              <Clock className="w-5 h-5" />{formatTime(timeLeft)}
            </div>
          )}
        </div>
        <div className="space-y-6">
          {activeExam.questions.map((q, i) => (
            <div key={q.id} className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <p className="font-semibold text-foreground"><span className="text-muted-foreground mr-2">Q{i + 1}.</span>{q.question}</p>
              {q.type === 'multiple_choice' && q.options && (
                <div className="space-y-2">
                  {q.options.filter(Boolean).map((opt, oi) => (
                    <label key={oi} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${answers[q.id] === opt ? 'border-blue-500 bg-blue-50' : 'border-border hover:bg-muted/50'}`}>
                      <input type="radio" name={q.id} value={opt} checked={answers[q.id] === opt}
                        onChange={() => setAnswers(a => ({ ...a, [q.id]: opt }))} className="accent-blue-600" />
                      <span className="text-sm">{opt}</span>
                    </label>
                  ))}
                </div>
              )}
              {q.type === 'true_false' && (
                <div className="flex gap-3">
                  {['True', 'False'].map(opt => (
                    <label key={opt} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${answers[q.id] === opt ? 'border-blue-500 bg-blue-50 font-semibold' : 'border-border hover:bg-muted/50'}`}>
                      <input type="radio" name={q.id} value={opt} checked={answers[q.id] === opt}
                        onChange={() => setAnswers(a => ({ ...a, [q.id]: opt }))} className="accent-blue-600" />
                      {opt}
                    </label>
                  ))}
                </div>
              )}
              {q.type === 'short_answer' && (
                <textarea
                  className="w-full rounded-xl border border-border p-3 text-sm min-h-20 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="Your answer…"
                  value={answers[q.id] ?? ''}
                  onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                />
              )}
              <p className="text-xs text-muted-foreground text-right">{q.points} pt{q.points !== 1 ? 's' : ''}</p>
            </div>
          ))}
        </div>
        <Button onClick={handleSubmit} disabled={submitting} className="w-full h-12 bg-green-600 hover:bg-green-700 text-white rounded-xl gap-2 font-bold">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {submitting ? 'Grading…' : 'Submit Exam'}
        </Button>
      </div>
    );
  }

  const pending = exams.filter(e => !e.submission);
  const completed = exams.filter(e => !!e.submission);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Exams</h1>
        <p className="text-muted-foreground text-sm mt-1">Take timed assessments and see your results.</p>
      </div>

      {exams.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <PenSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No exams available yet.</p>
        </div>
      )}

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Available ({pending.length})</h2>
          {pending.map((item, i) => (
            <motion.div key={item.exam.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                  <PenSquare className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-foreground">{item.exam.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.exam.questions.length} questions · {item.exam.timeLimit ? `${item.exam.timeLimit} min` : 'No time limit'} · Pass: {item.exam.passingScore}%
                  </p>
                </div>
              </div>
              <Button onClick={() => startExam(item.exam)} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-2 shrink-0">
                Start <ChevronRight className="w-4 h-4" />
              </Button>
            </motion.div>
          ))}
        </section>
      )}

      {completed.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Completed ({completed.length})</h2>
          {completed.map((item, i) => {
            const pct = item.submission ? Math.round((item.submission.score / item.submission.maxScore) * 100) : 0;
            const passed = pct >= item.exam.passingScore;
            return (
              <motion.div key={item.exam.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <Trophy className={`w-5 h-5 shrink-0 ${passed ? 'text-amber-500' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="font-semibold text-foreground">{item.exam.title}</p>
                    <Badge className={`rounded-full text-[10px] mt-1 ${passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {passed ? 'Passed' : 'Failed'}
                    </Badge>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-extrabold text-foreground">{pct}%</p>
                  <p className="text-xs text-muted-foreground">{item.submission?.score}/{item.submission?.maxScore}</p>
                </div>
              </motion.div>
            );
          })}
        </section>
      )}
    </div>
  );
}
