'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  getTeacherCourses, Course, createAssignment, getAssignmentsForCourse,
  Assignment, getAssignmentSubmissions, AssignmentSubmission,
  gradeAssignmentSubmission, deleteAssignment, createNotification,
} from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, ClipboardList, Eye, CheckCircle2, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Timestamp } from 'firebase/firestore';

const STATUS_COLORS = { draft: 'bg-gray-100 text-gray-700', published: 'bg-green-100 text-green-700' };

export default function TeacherAssignmentsPage() {
  const { user, profile } = useAuthSTORE();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [view, setView] = useState<'list' | 'create' | 'submissions'>('list');
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    title: '', description: '', dueDate: '', maxScore: '100',
    submissionType: 'text' as 'text' | 'link' | 'any',
    status: 'draft' as 'draft' | 'published', allowLate: false,
  });

  useEffect(() => {
    if (!user) return;
    getTeacherCourses(user.uid).then(cs => { setCourses(cs); if (cs.length) setSelectedCourse(cs[0].id); setLoading(false); });
  }, [user]);

  useEffect(() => {
    if (!selectedCourse) return;
    getAssignmentsForCourse(selectedCourse).then(setAssignments);
  }, [selectedCourse]);

  async function handleCreate() {
    if (!user || !profile || !selectedCourse) return;
    if (!form.title.trim() || !form.dueDate) { toast.error('Title and due date are required'); return; }
    setSaving(true);
    try {
      await createAssignment({
        courseId: selectedCourse,
        title: form.title,
        description: form.description,
        dueDate: Timestamp.fromDate(new Date(form.dueDate)),
        maxScore: Number(form.maxScore),
        submissionType: form.submissionType,
        status: form.status,
        allowLate: form.allowLate,
        createdBy: user.uid,
      });
      toast.success('Assignment created!');
      setForm({ title: '', description: '', dueDate: '', maxScore: '100', submissionType: 'text', status: 'draft', allowLate: false });
      setView('list');
      const updated = await getAssignmentsForCourse(selectedCourse);
      setAssignments(updated);
    } finally { setSaving(false); }
  }

  async function handleViewSubmissions(a: Assignment) {
    setSelectedAssignment(a);
    const subs = await getAssignmentSubmissions(a.id);
    setSubmissions(subs);
    setView('submissions');
  }

  async function handleGrade(sub: AssignmentSubmission) {
    const score = Number(scores[sub.id]);
    const feedback = feedbacks[sub.id] ?? '';
    if (isNaN(score) || score < 0) { toast.error('Enter a valid score'); return; }
    setGradingId(sub.id);
    try {
      await gradeAssignmentSubmission(sub.id, score, feedback);
      await createNotification({
        userId: sub.studentId, title: 'Assignment Graded',
        message: `Your submission for "${selectedAssignment?.title}" received ${score}/${selectedAssignment?.maxScore}.`,
        type: 'grade', link: '/dashboard/student/assignments', read: false,
      });
      toast.success('Graded!');
      const updated = await getAssignmentSubmissions(selectedAssignment!.id);
      setSubmissions(updated);
    } finally { setGradingId(null); }
  }

  async function handleCheckIntegrity(sub: AssignmentSubmission) {
    if (!sub.content) { toast.error('No text content to check'); return; }
    toast.info('Running integrity check…');
    const res = await fetch('/api/ai/integrity-check', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: sub.content, assignmentTitle: selectedAssignment?.title }),
    });
    const data = await res.json();
    toast.success(`AI: ${data.aiScore}% | Plagiarism: ${data.plagiarismScore}% — ${data.recommendation}`);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this assignment?')) return;
    await deleteAssignment(id);
    setAssignments(prev => prev.filter(a => a.id !== id));
    toast.success('Deleted');
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#202124]">Assignments</h1>
          <p className="text-sm text-[#5F6368] mt-0.5">Create and grade assignments for your courses</p>
        </div>
        {view === 'list' && (
          <Button onClick={() => setView('create')} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
            <Plus className="w-4 h-4" /> New Assignment
          </Button>
        )}
        {view !== 'list' && (
          <Button variant="outline" onClick={() => setView('list')}>← Back to List</Button>
        )}
      </div>

      {/* Course selector */}
      {view === 'list' && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-[#5F6368]">Course:</label>
          <Select value={selectedCourse} onValueChange={v => setSelectedCourse(v ?? '')}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Select course" /></SelectTrigger>
            <SelectContent>
              {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Create form */}
      {view === 'create' && (
        <div className="bg-white rounded-2xl border border-[#DADCE0] p-6 space-y-4">
          <h2 className="font-semibold text-[#202124]">New Assignment</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-[#5F6368] mb-1 block">Title *</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Assignment title" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-[#5F6368] mb-1 block">Description / Instructions</label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} placeholder="Describe the assignment…" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#5F6368] mb-1 block">Due Date *</label>
              <Input type="datetime-local" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-[#5F6368] mb-1 block">Max Score</label>
              <Input type="number" value={form.maxScore} onChange={e => setForm(f => ({ ...f, maxScore: e.target.value }))} min={1} />
            </div>
            <div>
              <label className="text-xs font-medium text-[#5F6368] mb-1 block">Submission Type</label>
              <Select value={form.submissionType} onValueChange={v => setForm(f => ({ ...f, submissionType: v as 'text' | 'link' | 'any' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="link">Link/URL</SelectItem>
                  <SelectItem value="any">Any</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-[#5F6368] mb-1 block">Status</label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as 'draft' | 'published' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.allowLate} onChange={e => setForm(f => ({ ...f, allowLate: e.target.checked }))} className="accent-teal-600" />
              <span className="text-sm text-[#5F6368]">Allow late submissions</span>
            </label>
          </div>
          <Button onClick={handleCreate} disabled={saving} className="bg-teal-600 hover:bg-teal-700 text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Create Assignment
          </Button>
        </div>
      )}

      {/* List */}
      {view === 'list' && (
        <div className="space-y-3">
          {assignments.length === 0 && (
            <div className="text-center py-16 text-[#5F6368]">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No assignments yet</p>
              <p className="text-sm mt-1">Create your first assignment to get started.</p>
            </div>
          )}
          {assignments.map(a => (
            <div key={a.id} className="bg-white rounded-xl border border-[#DADCE0] p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-[#202124]">{a.title}</p>
                  <Badge className={STATUS_COLORS[a.status]}>{a.status}</Badge>
                </div>
                <p className="text-xs text-[#5F6368] mt-0.5 truncate">{a.description.slice(0, 80)}{a.description.length > 80 ? '…' : ''}</p>
                <p className="text-xs text-gray-400 mt-1">Due: {(a.dueDate as any).toDate?.().toLocaleString() ?? a.dueDate} · Max: {a.maxScore} pts</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => handleViewSubmissions(a)} className="gap-1">
                  <Eye className="w-3.5 h-3.5" /> Submissions
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)} className="text-red-500 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Submissions */}
      {view === 'submissions' && selectedAssignment && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#DADCE0] p-4">
            <h2 className="font-semibold text-[#202124]">Submissions — {selectedAssignment.title}</h2>
            <p className="text-xs text-[#5F6368] mt-0.5">{submissions.length} submission{submissions.length !== 1 ? 's' : ''} · Max score: {selectedAssignment.maxScore}</p>
          </div>
          {submissions.length === 0 && (
            <div className="text-center py-12 text-[#5F6368]">No submissions yet.</div>
          )}
          {submissions.map(sub => (
            <div key={sub.id} className="bg-white rounded-xl border border-[#DADCE0] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-[#202124]">{sub.studentName}</p>
                  <p className="text-xs text-[#5F6368]">Submitted {(sub.submittedAt as any)?.toDate?.().toLocaleString() ?? 'Unknown'}{sub.isLate ? ' · ⚠️ Late' : ''}</p>
                </div>
                {sub.score !== undefined && (
                  <Badge className="bg-green-100 text-green-700">{sub.score}/{selectedAssignment.maxScore}</Badge>
                )}
              </div>
              {sub.content && <div className="bg-[#F8F9FA] rounded-lg p-3 text-sm text-[#202124]">{sub.content}</div>}
              {sub.linkUrl && <a href={sub.linkUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm underline break-all">{sub.linkUrl}</a>}
              <div className="flex gap-3">
                <div className="flex-1 space-y-2">
                  <Input type="number" placeholder="Score" value={scores[sub.id] ?? sub.score ?? ''} onChange={e => setScores(s => ({ ...s, [sub.id]: e.target.value }))} min={0} max={selectedAssignment.maxScore} className="w-28" />
                  <Textarea placeholder="Feedback…" value={feedbacks[sub.id] ?? sub.feedback ?? ''} onChange={e => setFeedbacks(f => ({ ...f, [sub.id]: e.target.value }))} rows={2} />
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <Button size="sm" onClick={() => handleGrade(sub)} disabled={gradingId === sub.id} className="bg-teal-600 hover:bg-teal-700 text-white gap-1">
                    {gradingId === sub.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Grade
                  </Button>
                  {sub.content && (
                    <Button size="sm" variant="outline" onClick={() => handleCheckIntegrity(sub)} className="gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Integrity
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
