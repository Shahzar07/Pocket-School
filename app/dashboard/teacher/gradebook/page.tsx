'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getSubmissionsForTeacher, gradeSubmission, createGrade, Submission } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ClipboardList, CheckCircle2, Sparkles, Search, Download } from 'lucide-react';
import { motion } from 'motion/react';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 },
  }),
};

export default function GradebookPage() {
  const { user } = useAuthSTORE();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [feedback, setFeedback] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');

  const [loadError, setLoadError] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoadError(false);
    try {
      const ss = await getSubmissionsForTeacher(user.uid);
      setSubmissions(ss);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]);

  const openSubmission = (sub: Submission) => {
    setSelected(sub);
    setFeedback(sub.gradedFeedback ?? '');
  };

  const generateAIFeedback = async () => {
    if (!selected) return;
    setAiLoading(true);
    const score = selected.answers.filter(a => a.correct).length;
    const prompt = `You are a teacher. A student scored ${score}/${selected.maxScore} on a quiz about "${selected.lessonTitle}".
The questions and answers were:
${selected.answers.map((a, i) => `${i+1}. Q: ${a.question}\n   Student answered: ${a.answer} (${a.correct ? 'Correct' : 'Incorrect'})`).join('\n')}

Write encouraging, constructive feedback in 2-3 sentences that acknowledges what they got right and guides them on what to review.`;

    try {
      const res = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, mode: 'college' }),
      });
      const data = await res.json();
      setFeedback(data.reply ?? '');
    } catch {
      toast.error('Failed to generate feedback');
    }
    setAiLoading(false);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const score = selected.answers.filter(a => a.correct).length;
      await gradeSubmission(selected.id, score, feedback);
      // Record the grade in the grades collection so report cards can pick it up
      await createGrade({
        studentId: selected.studentId,
        studentName: selected.studentName,
        courseId: selected.courseId,
        lessonId: selected.lessonId,
        type: 'quiz',
        label: selected.lessonTitle,
        score,
        maxScore: selected.maxScore,
        gradedBy: user?.uid,
      });
      toast.success('Grade saved!');
      setSelected(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save grade.');
    } finally {
      setSaving(false);
    }
  };

  /** Name filter — a full class is unusable without it. */
  const matching = submissions.filter(s => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (s.studentName ?? '').toLowerCase().includes(q)
      || (s.lessonTitle ?? '').toLowerCase().includes(q);
  });
  const ungraded = matching.filter(s => s.score === undefined);
  const graded = matching.filter(s => s.score !== undefined);

  /** Download the gradebook so teachers can reconcile against school systems. */
  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Student', 'Lesson', 'Score', 'Out of', 'Percentage', 'Status', 'Feedback'],
      ...matching.map(s => [
        s.studentName ?? 'Student',
        s.lessonTitle ?? '',
        s.score ?? '',
        s.maxScore ?? '',
        s.score !== undefined && s.maxScore ? `${Math.round((s.score / s.maxScore) * 100)}%` : '',
        s.score === undefined ? 'Awaiting grading' : 'Graded',
        s.gradedFeedback ?? '',
      ]),
    ];
    const csv = rows.map(r => r.map(esc).join(',')).join('\n');
    // Prepend a BOM so Excel reads UTF-8 names correctly.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gradebook-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10 pt-8">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-20 bg-muted animate-pulse rounded-3xl" />
      ))}
    </div>
  );

  if (loadError) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 pt-8">
      <div className="bg-card border border-border rounded-3xl p-10 text-center space-y-4 card-glow">
        <ClipboardList className="w-10 h-10 mx-auto text-amber-500" />
        <p className="font-heading text-2xl text-foreground">Couldn&apos;t load submissions</p>
        <p className="text-sm text-muted-foreground">Something went wrong while fetching your gradebook. Please try again.</p>
        <Button variant="outline" className="rounded-full h-11 px-5 font-semibold" onClick={() => { setLoading(true); load(); }}>Retry</Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">
      {/* Page header */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600 mb-2">
          GRADEBOOK
        </p>
        <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight">
          Student <span className="gradient-text italic">Gradebook</span>
        </h1>
      </motion.div>

      {/* Filter + export */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}
        className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Filter by student or lesson"
            aria-label="Filter by student or lesson"
            className="h-11 w-72 rounded-full border border-border bg-card pl-11 pr-4 text-sm text-foreground"
          />
        </div>
        <Button
          onClick={exportCsv}
          variant="outline"
          disabled={matching.length === 0}
          className="rounded-full h-11 px-5 font-semibold gap-2"
        >
          <Download className="w-4 h-4" /> Export CSV
        </Button>
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{ungraded.length}</span> awaiting grading ·{' '}
          <span className="font-semibold text-foreground">{graded.length}</span> graded
          {query.trim() && <> · filtered from {submissions.length}</>}
        </p>
      </motion.div>

      {/* Submission detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.21, 0.6, 0.35, 1] }}
            className="bg-card border border-border rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-5 card-glow"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-extrabold text-foreground text-lg">{selected.lessonTitle}</h2>
                <p className="text-sm text-muted-foreground">
                  {selected.studentName || 'Student'} · {selected.answers.filter(a => a.correct).length}/{selected.maxScore} correct
                </p>
              </div>
              <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setSelected(null)}>
                ✕
              </Button>
            </div>

            {/* Answers */}
            <div className="space-y-3">
              {selected.answers.map((a, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-2xl border ${
                    a.correct
                      ? 'bg-emerald-500/10 border-emerald-500/20'
                      : 'bg-red-500/10 border-red-500/20'
                  }`}
                >
                  <p className="text-sm font-semibold text-foreground mb-1">
                    {i + 1}. {a.question}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Answer: <span className="font-medium text-foreground">{a.answer}</span>{' '}
                    {a.correct ? '✓' : '✗'}
                  </p>
                </div>
              ))}
            </div>

            {/* Feedback */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-foreground">Teacher Feedback</label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={generateAIFeedback}
                  disabled={aiLoading}
                  className="rounded-full gap-1.5 text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {aiLoading ? 'Generating…' : 'AI Suggest'}
                </Button>
              </div>
              <Textarea
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                rows={4}
                className="rounded-xl text-sm"
                placeholder="Write feedback for the student…"
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-full h-11 px-5 font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-600/25 transition-all"
            >
              {saving ? 'Saving…' : 'Save Grade & Feedback'}
            </Button>
          </motion.div>
        </div>
      )}

      {/* Ungraded section */}
      {ungraded.length > 0 && (
        <section className="space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600 mb-1">
              NEEDS GRADING · {ungraded.length}
            </p>
            <h2 className="font-heading text-3xl text-foreground">Pending Reviews</h2>
          </div>
          <div className="space-y-3">
            {ungraded.map((sub, i) => (
              <motion.div
                key={sub.id}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={i}
                className="relative overflow-hidden bg-card border border-border rounded-2xl p-4 flex items-center gap-4 card-glow"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-amber-500" />
                <ClipboardList className="w-5 h-5 text-amber-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground text-sm">{sub.lessonTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {sub.studentName || 'Student'} · {sub.answers.filter(a => a.correct).length}/{sub.maxScore} correct
                  </p>
                </div>
                <Button
                  size="sm"
                  className="rounded-full h-11 px-5 font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-600/25 transition-all shrink-0"
                  onClick={() => openSubmission(sub)}
                >
                  Grade
                </Button>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Graded section */}
      {graded.length > 0 && (
        <section className="space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600 mb-1">
              GRADED · {graded.length}
            </p>
            <h2 className="font-heading text-3xl text-foreground">Completed</h2>
          </div>
          <div className="space-y-3">
            {graded.map((sub, i) => (
              <motion.div
                key={sub.id}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={i}
                className="relative overflow-hidden bg-card border border-border rounded-2xl p-4 flex items-center gap-4 card-glow"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-emerald-500" />
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground text-sm">{sub.lessonTitle}</p>
                  <p className="text-xs text-muted-foreground">{sub.studentName || 'Student'}</p>
                </div>
                <Badge className="rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-xs shrink-0">
                  {sub.score}/{sub.maxScore}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full shrink-0 text-xs"
                  onClick={() => openSubmission(sub)}
                >
                  View
                </Button>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {submissions.length === 0 && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0}
          className="text-center py-16"
        >
          <div className="relative inline-flex items-center justify-center mb-4">
            <div className="absolute inset-0 bg-emerald-400/10 blur-3xl rounded-full" />
            <ClipboardList className="w-12 h-12 text-muted-foreground relative" />
          </div>
          <h3 className="font-heading text-2xl text-foreground">No submissions yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Students will appear here after they complete quizzes in your lessons.
          </p>
        </motion.div>
      )}
    </div>
  );
}
