'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  getTeacherCourses, Course, createExam, getExamsForCourse, Exam, ExamQuestion,
  getExamSubmissions, ExamSubmission, deleteExam, updateExam,
} from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Eye, Trash2, Loader2, PenSquare, X, GripVertical } from 'lucide-react';
import { motion } from 'motion/react';
import { Timestamp } from 'firebase/firestore';

type ViewMode = 'list' | 'create' | 'results';

const emptyQuestion = (): ExamQuestion => ({
  id: crypto.randomUUID(), type: 'multiple_choice', question: '', options: ['', '', '', ''], answer: '', points: 1,
});

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 },
  }),
};

export default function TeacherExamsPage() {
  const { user } = useAuthSTORE();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [exams, setExams] = useState<Exam[]>([]);
  const [view, setView] = useState<ViewMode>('list');
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [submissions, setSubmissions] = useState<ExamSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: '', description: '', timeLimit: '', passingScore: '60',
    status: 'draft' as 'draft' | 'published',
    availableFrom: '', availableTo: '',
  });
  const [questions, setQuestions] = useState<ExamQuestion[]>([emptyQuestion()]);

  useEffect(() => {
    if (!user) return;
    getTeacherCourses(user.uid).then(cs => { setCourses(cs); if (cs.length) setSelectedCourse(cs[0].id); setLoading(false); });
  }, [user]);

  useEffect(() => {
    if (!selectedCourse) return;
    getExamsForCourse(selectedCourse).then(setExams);
  }, [selectedCourse]);

  function addQuestion() { setQuestions(q => [...q, emptyQuestion()]); }
  function removeQuestion(idx: number) { setQuestions(q => q.filter((_, i) => i !== idx)); }
  function updateQuestion(idx: number, patch: Partial<ExamQuestion>) {
    setQuestions(q => q.map((qq, i) => i === idx ? { ...qq, ...patch } : qq));
  }
  function updateOption(qIdx: number, oIdx: number, val: string) {
    setQuestions(q => q.map((qq, i) => {
      if (i !== qIdx) return qq;
      const opts = [...(qq.options ?? [])];
      opts[oIdx] = val;
      return { ...qq, options: opts };
    }));
  }

  async function handleCreate() {
    if (!user || !selectedCourse) return;
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (questions.some(q => !q.question.trim())) { toast.error('All questions need text'); return; }
    setSaving(true);
    try {
      await createExam({
        courseId: selectedCourse, title: form.title, description: form.description,
        questions, timeLimit: form.timeLimit ? Number(form.timeLimit) : undefined,
        passingScore: Number(form.passingScore), status: form.status,
        availableFrom: form.availableFrom ? Timestamp.fromDate(new Date(form.availableFrom)) : undefined,
        availableTo: form.availableTo ? Timestamp.fromDate(new Date(form.availableTo)) : undefined,
        createdBy: user.uid,
      });
      toast.success('Exam created!');
      setView('list');
      setExams(await getExamsForCourse(selectedCourse));
      setForm({ title: '', description: '', timeLimit: '', passingScore: '60', status: 'draft', availableFrom: '', availableTo: '' });
      setQuestions([emptyQuestion()]);
    } finally { setSaving(false); }
  }

  async function viewResults(exam: Exam) {
    setSelectedExam(exam);
    setSubmissions(await getExamSubmissions(exam.id));
    setView('results');
  }

  async function togglePublish(exam: Exam) {
    const newStatus = exam.status === 'published' ? 'draft' : 'published';
    await updateExam(exam.id, { status: newStatus });
    setExams(await getExamsForCourse(selectedCourse));
    toast.success(`Exam ${newStatus}`);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this exam?')) return;
    await deleteExam(id);
    setExams(prev => prev.filter(e => e.id !== id));
    toast.success('Deleted');
  }

  if (loading) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">
      <div className="space-y-4 pt-8">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-muted animate-pulse rounded-3xl h-24" />
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">
      {/* Header */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={0}
        className="flex items-center justify-between pt-2"
      >
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600">
            Exam Builder
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-1">
            Build <span className="gradient-text italic">Exams</span>
          </h1>
        </div>
        <div className="flex gap-2">
          {view !== 'list' && (
            <Button
              variant="outline"
              onClick={() => setView('list')}
              className="rounded-full h-11 px-5 font-semibold"
            >
              Back
            </Button>
          )}
          {view === 'list' && (
            <Button
              onClick={() => setView('create')}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:opacity-90 rounded-full h-11 px-5 font-bold gap-2"
            >
              <Plus className="w-4 h-4" /> New Exam
            </Button>
          )}
        </div>
      </motion.div>

      {/* List View */}
      {view === 'list' && (
        <>
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
            className="flex items-center gap-3"
          >
            <label className="text-sm font-medium text-muted-foreground">Course:</label>
            <Select value={selectedCourse} onValueChange={v => setSelectedCourse(v ?? '')}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
            </Select>
          </motion.div>

          <div className="space-y-3">
            {exams.length === 0 && (
              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={2}
                className="relative flex flex-col items-center justify-center py-20"
              >
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-64 h-64 bg-emerald-400/20 rounded-full blur-3xl" />
                </div>
                <PenSquare className="w-12 h-12 mb-4 text-muted-foreground/40 relative z-10" />
                <p className="font-heading text-2xl text-foreground relative z-10">No exams yet</p>
                <p className="text-sm text-muted-foreground mt-1 relative z-10">Create your first exam to get started.</p>
              </motion.div>
            )}
            {exams.map((e, i) => (
              <motion.div
                key={e.id}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={i + 2}
                className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-4 card-glow"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">{e.title}</p>
                    <Badge className={e.status === 'published' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-muted text-muted-foreground'}>{e.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{e.questions.length} questions · Pass: {e.passingScore}% {e.timeLimit ? `· ${e.timeLimit} min` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => viewResults(e)} className="gap-1 rounded-full"><Eye className="w-3.5 h-3.5" /> Results</Button>
                  <Button variant="outline" size="sm" onClick={() => togglePublish(e)} className="rounded-full">{e.status === 'published' ? 'Unpublish' : 'Publish'}</Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)} className="text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Create View */}
      {view === 'create' && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
          className="bg-card border border-border rounded-3xl p-6 sm:p-8 card-glow space-y-6"
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600">New Assessment</p>
            <h2 className="font-heading text-3xl text-foreground tracking-tight mt-1">Create Exam</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Title *</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Exam title" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Time Limit (minutes, optional)</label>
              <Input type="number" value={form.timeLimit} onChange={e => setForm(f => ({ ...f, timeLimit: e.target.value }))} placeholder="No limit" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Passing Score (%)</label>
              <Input type="number" value={form.passingScore} onChange={e => setForm(f => ({ ...f, passingScore: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Available From</label>
              <Input type="datetime-local" value={form.availableFrom} onChange={e => setForm(f => ({ ...f, availableFrom: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Available To</label>
              <Input type="datetime-local" value={form.availableTo} onChange={e => setForm(f => ({ ...f, availableTo: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as 'draft' | 'published' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem></SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600">Questions</p>
                <h3 className="font-heading text-xl text-foreground">{questions.length} Question{questions.length !== 1 ? 's' : ''}</h3>
              </div>
              <Button variant="outline" size="sm" onClick={addQuestion} className="gap-1 rounded-full"><Plus className="w-3.5 h-3.5" /> Add Question</Button>
            </div>
            {questions.map((q, i) => (
              <motion.div
                key={q.id}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={i}
                className="border border-border rounded-2xl p-4 space-y-3 bg-muted/30"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                    <span className="text-sm font-semibold text-foreground">Q{i + 1}</span>
                    <Select value={q.type} onValueChange={v => updateQuestion(i, { type: v as ExamQuestion['type'], answer: '', options: v === 'multiple_choice' ? ['', '', '', ''] : undefined })}>
                      <SelectTrigger className="w-36 h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                        <SelectItem value="true_false">True / False</SelectItem>
                        <SelectItem value="short_answer">Short Answer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input type="number" value={q.points} onChange={e => updateQuestion(i, { points: Number(e.target.value) })} className="w-16 h-7 text-xs" min={1} />
                    <span className="text-xs text-muted-foreground">pts</span>
                    <Button variant="ghost" size="icon" onClick={() => removeQuestion(i)} className="h-7 w-7 text-red-500"><X className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
                <Textarea value={q.question} onChange={e => updateQuestion(i, { question: e.target.value })} placeholder="Question text..." rows={2} className="bg-card" />
                {q.type === 'multiple_choice' && (
                  <div className="grid grid-cols-2 gap-2">
                    {(q.options ?? []).map((opt, oi) => (
                      <Input key={oi} value={opt} onChange={e => updateOption(i, oi, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + oi)}`} className="bg-card text-sm" />
                    ))}
                  </div>
                )}
                {q.type === 'true_false' && (
                  <Select value={q.answer} onValueChange={v => updateQuestion(i, { answer: v ?? '' })}>
                    <SelectTrigger className="w-32"><SelectValue placeholder="Answer" /></SelectTrigger>
                    <SelectContent><SelectItem value="True">True</SelectItem><SelectItem value="False">False</SelectItem></SelectContent>
                  </Select>
                )}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Correct Answer:</label>
                  {q.type === 'multiple_choice' ? (
                    <Select value={q.answer} onValueChange={v => updateQuestion(i, { answer: v ?? '' })}>
                      <SelectTrigger className="w-32 h-7 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{(q.options ?? []).map((o, oi) => o && <SelectItem key={oi} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : q.type === 'short_answer' ? (
                    <Input value={q.answer} onChange={e => updateQuestion(i, { answer: e.target.value })} placeholder="Model answer" className="flex-1 h-7 text-xs bg-card" />
                  ) : null}
                </div>
              </motion.div>
            ))}
          </div>

          <Button
            onClick={handleCreate}
            disabled={saving}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:opacity-90 rounded-full h-11 px-5 font-bold"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Save Exam
          </Button>
        </motion.div>
      )}

      {/* Results View */}
      {view === 'results' && selectedExam && (
        <div className="space-y-4">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0}
            className="bg-card border border-border rounded-3xl p-5 card-glow"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600">Results</p>
            <h2 className="font-heading text-3xl text-foreground tracking-tight mt-1">{selectedExam.title}</h2>
            <p className="text-xs text-muted-foreground mt-1">{submissions.length} submission{submissions.length !== 1 ? 's' : ''}</p>
          </motion.div>

          {submissions.length === 0 && (
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={1}
              className="relative flex flex-col items-center justify-center py-16"
            >
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-64 bg-emerald-400/20 rounded-full blur-3xl" />
              </div>
              <Eye className="w-12 h-12 mb-4 text-muted-foreground/40 relative z-10" />
              <p className="font-heading text-2xl text-foreground relative z-10">No submissions yet</p>
              <p className="text-sm text-muted-foreground mt-1 relative z-10">Results will appear once students submit.</p>
            </motion.div>
          )}

          {submissions.map((s, i) => (
            <motion.div
              key={s.id}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={i + 1}
              className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between card-glow"
            >
              <div>
                <p className="font-semibold text-foreground">{s.studentName}</p>
                <p className="text-xs text-muted-foreground">Submitted {(s.submittedAt as any)?.toDate?.().toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="font-bold text-lg text-foreground">{s.score}/{s.maxScore}</p>
                  <p className="text-xs text-muted-foreground">{Math.round((s.score / s.maxScore) * 100)}%</p>
                </div>
                <Badge className={s.passed ? 'bg-emerald-500/10 text-emerald-700' : 'bg-red-500/10 text-red-700'}>{s.passed ? 'PASSED' : 'FAILED'}</Badge>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
