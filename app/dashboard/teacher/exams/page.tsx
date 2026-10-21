'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  getTeacherCourses, Course, createExam, getExamsForCourse, Exam, ExamQuestion,
  getExamSubmissions, ExamSubmission, deleteExam, updateExam,
} from '@/lib/db';
import { CreateExamForm } from '@/components/exams/create-exam-form';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Eye, Trash2, PenSquare } from 'lucide-react';
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

  async function handleSave(status: 'draft' | 'published', extra: { level: string; subject: string; boardStyle: string }) {
    if (!user) return;
    if (!selectedCourse) { toast.error('Choose a course first.'); return; }
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (questions.some(q => !q.question.trim())) { toast.error('All questions need text'); return; }
    setSaving(true);
    try {
      await createExam({
        courseId: selectedCourse, title: form.title, description: form.description,
        questions, timeLimit: form.timeLimit ? Number(form.timeLimit) : undefined,
        passingScore: Number(form.passingScore), status,
        availableFrom: form.availableFrom ? Timestamp.fromDate(new Date(form.availableFrom)) : undefined,
        availableTo: form.availableTo ? Timestamp.fromDate(new Date(form.availableTo)) : undefined,
        ...(extra.level ? { level: extra.level } : {}),
        ...(extra.subject ? { subject: extra.subject } : {}),
        ...(extra.boardStyle ? { boardStyle: extra.boardStyle } : {}),
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
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-12 sm:px-6">
      <div className="space-y-4 pt-8">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-muted animate-pulse rounded-3xl h-24" />
        ))}
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-8 px-4 pb-12 sm:px-6">
      {/* Header */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={0}
        className="flex items-center justify-between pt-2"
      >
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--studio-accent-text)]">
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
              className="h-11 gap-2 rounded-full bg-[#3FE0D0] px-5 font-bold text-[#203337] hover:opacity-90"
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
                  <div className="w-64 h-64 bg-success/20 rounded-full blur-3xl" />
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
                    <Badge className={e.status === 'published' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>{e.status}</Badge>
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

      {view === 'create' && (
        <CreateExamForm
          draft={form}
          onDraft={setForm}
          questions={questions}
          onQuestions={setQuestions}
          courses={courses}
          courseId={selectedCourse}
          onCourse={setSelectedCourse}
          saving={saving}
          onSave={handleSave}
        />
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
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-success">Results</p>
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
                <div className="w-64 h-64 bg-success/20 rounded-full blur-3xl" />
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
                <Badge className={s.passed ? 'bg-success/10 text-success' : 'bg-red-500/10 text-red-700'}>{s.passed ? 'PASSED' : 'FAILED'}</Badge>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
