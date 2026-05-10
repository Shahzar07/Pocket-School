'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getSubmissionsForTeacher, gradeSubmission, Submission } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ClipboardList, CheckCircle2, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

export default function GradebookPage() {
  const { user } = useAuthSTORE();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [feedback, setFeedback] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    const ss = await getSubmissionsForTeacher(user.uid);
    setSubmissions(ss);
    setLoading(false);
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
    const score = selected.answers.filter(a => a.correct).length;
    await gradeSubmission(selected.id, score, feedback);
    toast.success('Grade saved!');
    setSelected(null);
    await load();
    setSaving(false);
  };

  const ungraded = submissions.filter(s => s.score === undefined);
  const graded = submissions.filter(s => s.score !== undefined);

  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-2xl" />)}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <h1 className="text-2xl font-extrabold text-foreground">Gradebook</h1>

      {/* Submission detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-extrabold text-foreground text-lg">{selected.lessonTitle}</h2>
                <p className="text-sm text-muted-foreground">{selected.studentName || 'Student'} · {selected.answers.filter(a => a.correct).length}/{selected.maxScore} correct</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>✕</Button>
            </div>

            {/* Answers */}
            <div className="space-y-3">
              {selected.answers.map((a, i) => (
                <div key={i} className={`p-4 rounded-xl border ${a.correct ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  <p className="text-sm font-semibold text-foreground mb-1">{i + 1}. {a.question}</p>
                  <p className="text-xs text-muted-foreground">Answer: <span className="font-medium text-foreground">{a.answer}</span> {a.correct ? '✓' : '✗'}</p>
                </div>
              ))}
            </div>

            {/* Feedback */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-foreground">Teacher Feedback</label>
                <Button size="sm" variant="outline" onClick={generateAIFeedback} disabled={aiLoading} className="rounded-xl gap-1.5 text-xs">
                  <Sparkles className="w-3.5 h-3.5" />{aiLoading ? 'Generating…' : 'AI Suggest'}
                </Button>
              </div>
              <Textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={4} className="rounded-xl text-sm" placeholder="Write feedback for the student…" />
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full rounded-xl bg-primary text-white">
              {saving ? 'Saving…' : 'Save Grade & Feedback'}
            </Button>
          </div>
        </div>
      )}

      {ungraded.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Needs Grading ({ungraded.length})</h2>
          <div className="space-y-3">
            {ungraded.map((sub, i) => (
              <motion.div key={sub.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-4"
              >
                <ClipboardList className="w-5 h-5 text-amber-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground text-sm">{sub.lessonTitle}</p>
                  <p className="text-xs text-muted-foreground">{sub.studentName || 'Student'} · {sub.answers.filter(a => a.correct).length}/{sub.maxScore} correct</p>
                </div>
                <Button size="sm" className="rounded-xl shrink-0" onClick={() => openSubmission(sub)}>Grade</Button>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {graded.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Graded ({graded.length})</h2>
          <div className="space-y-3">
            {graded.map((sub, i) => (
              <motion.div key={sub.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground text-sm">{sub.lessonTitle}</p>
                  <p className="text-xs text-muted-foreground">{sub.studentName || 'Student'}</p>
                </div>
                <Badge className="rounded-full bg-emerald-50 text-emerald-700 border-emerald-200 text-xs shrink-0">
                  {sub.score}/{sub.maxScore}
                </Badge>
                <Button size="sm" variant="outline" className="rounded-xl shrink-0 text-xs" onClick={() => openSubmission(sub)}>View</Button>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {submissions.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No submissions yet.</p>
          <p className="text-sm mt-1">Students will appear here after they complete quizzes in your lessons.</p>
        </div>
      )}
    </div>
  );
}
