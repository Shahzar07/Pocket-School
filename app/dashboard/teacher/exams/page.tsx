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

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#202124]">Exam Builder</h1>
          <p className="text-sm text-[#5F6368] mt-0.5">Build timed assessments with multiple question types</p>
        </div>
        <div className="flex gap-2">
          {view !== 'list' && <Button variant="outline" onClick={() => setView('list')}>← Back</Button>}
          {view === 'list' && <Button onClick={() => setView('create')} className="bg-teal-600 hover:bg-teal-700 text-white gap-2"><Plus className="w-4 h-4" /> New Exam</Button>}
        </div>
      </div>

      {view === 'list' && (
        <>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-[#5F6368]">Course:</label>
            <Select value={selectedCourse} onValueChange={v => setSelectedCourse(v ?? '')}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            {exams.length === 0 && <div className="text-center py-16 text-[#5F6368]"><PenSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" /><p>No exams yet. Create your first exam.</p></div>}
            {exams.map(e => (
              <div key={e.id} className="bg-white rounded-xl border border-[#DADCE0] p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[#202124]">{e.title}</p>
                    <Badge className={e.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>{e.status}</Badge>
                  </div>
                  <p className="text-xs text-[#5F6368] mt-0.5">{e.questions.length} questions · Pass: {e.passingScore}% {e.timeLimit ? `· ${e.timeLimit} min` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => viewResults(e)} className="gap-1"><Eye className="w-3.5 h-3.5" /> Results</Button>
                  <Button variant="outline" size="sm" onClick={() => togglePublish(e)}>{e.status === 'published' ? 'Unpublish' : 'Publish'}</Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)} className="text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {view === 'create' && (
        <div className="bg-white rounded-2xl border border-[#DADCE0] p-6 space-y-6">
          <h2 className="font-semibold text-[#202124]">Create Exam</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><label className="text-xs font-medium text-[#5F6368] mb-1 block">Title *</label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Exam title" /></div>
            <div className="md:col-span-2"><label className="text-xs font-medium text-[#5F6368] mb-1 block">Description</label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div><label className="text-xs font-medium text-[#5F6368] mb-1 block">Time Limit (minutes, optional)</label><Input type="number" value={form.timeLimit} onChange={e => setForm(f => ({ ...f, timeLimit: e.target.value }))} placeholder="No limit" /></div>
            <div><label className="text-xs font-medium text-[#5F6368] mb-1 block">Passing Score (%)</label><Input type="number" value={form.passingScore} onChange={e => setForm(f => ({ ...f, passingScore: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-[#5F6368] mb-1 block">Available From</label><Input type="datetime-local" value={form.availableFrom} onChange={e => setForm(f => ({ ...f, availableFrom: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-[#5F6368] mb-1 block">Available To</label><Input type="datetime-local" value={form.availableTo} onChange={e => setForm(f => ({ ...f, availableTo: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-[#5F6368] mb-1 block">Status</label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as 'draft' | 'published' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem></SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#202124]">Questions ({questions.length})</h3>
              <Button variant="outline" size="sm" onClick={addQuestion} className="gap-1"><Plus className="w-3.5 h-3.5" /> Add Question</Button>
            </div>
            {questions.map((q, i) => (
              <div key={q.id} className="border border-[#DADCE0] rounded-xl p-4 space-y-3 bg-[#F8F9FA]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-semibold text-[#202124]">Q{i + 1}</span>
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
                    <span className="text-xs text-[#5F6368]">pts</span>
                    <Button variant="ghost" size="icon" onClick={() => removeQuestion(i)} className="h-7 w-7 text-red-500"><X className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
                <Textarea value={q.question} onChange={e => updateQuestion(i, { question: e.target.value })} placeholder="Question text…" rows={2} className="bg-white" />
                {q.type === 'multiple_choice' && (
                  <div className="grid grid-cols-2 gap-2">
                    {(q.options ?? []).map((opt, oi) => (
                      <Input key={oi} value={opt} onChange={e => updateOption(i, oi, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + oi)}`} className="bg-white text-sm" />
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
                  <label className="text-xs text-[#5F6368]">Correct Answer:</label>
                  {q.type === 'multiple_choice' ? (
                    <Select value={q.answer} onValueChange={v => updateQuestion(i, { answer: v ?? '' })}>
                      <SelectTrigger className="w-32 h-7 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{(q.options ?? []).map((o, oi) => o && <SelectItem key={oi} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : q.type === 'short_answer' ? (
                    <Input value={q.answer} onChange={e => updateQuestion(i, { answer: e.target.value })} placeholder="Model answer" className="flex-1 h-7 text-xs bg-white" />
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <Button onClick={handleCreate} disabled={saving} className="bg-teal-600 hover:bg-teal-700 text-white">
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Save Exam
          </Button>
        </div>
      )}

      {view === 'results' && selectedExam && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#DADCE0] p-4">
            <h2 className="font-semibold text-[#202124]">Results — {selectedExam.title}</h2>
            <p className="text-xs text-[#5F6368] mt-0.5">{submissions.length} submission{submissions.length !== 1 ? 's' : ''}</p>
          </div>
          {submissions.length === 0 && <div className="text-center py-12 text-[#5F6368]">No submissions yet.</div>}
          {submissions.map(s => (
            <div key={s.id} className="bg-white rounded-xl border border-[#DADCE0] p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-[#202124]">{s.studentName}</p>
                <p className="text-xs text-[#5F6368]">Submitted {(s.submittedAt as any)?.toDate?.().toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="font-bold text-lg text-[#202124]">{s.score}/{s.maxScore}</p>
                  <p className="text-xs text-[#5F6368]">{Math.round((s.score / s.maxScore) * 100)}%</p>
                </div>
                <Badge className={s.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>{s.passed ? 'PASSED' : 'FAILED'}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
