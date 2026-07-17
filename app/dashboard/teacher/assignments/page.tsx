'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  getTeacherCourses, Course, createAssignment, getAssignmentsForCourse,
  Assignment, getAssignmentSubmissions, AssignmentSubmission,
  gradeAssignmentSubmission, deleteAssignment, createNotification,
  createIntegrityReport,
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

const STATUS_COLORS = { draft: 'bg-muted text-muted-foreground', published: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' };

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 },
  }),
};

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

  const [loadError, setLoadError] = useState(false);

  const loadCourses = () => {
    if (!user) return;
    setLoading(true);
    setLoadError(false);
    getTeacherCourses(user.uid)
      .then(cs => { setCourses(cs); if (cs.length) setSelectedCourse(cs[0].id); })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCourses(); }, [user]);

  useEffect(() => {
    if (!selectedCourse) return;
    getAssignmentsForCourse(selectedCourse)
      .then(setAssignments)
      .catch(() => toast.error('Failed to load assignments.'));
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
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to create assignment.');
    } finally { setSaving(false); }
  }

  async function handleViewSubmissions(a: Assignment) {
    try {
      setSelectedAssignment(a);
      const subs = await getAssignmentSubmissions(a.id);
      setSubmissions(subs);
      setView('submissions');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to load submissions.');
    }
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
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save grade.');
    } finally { setGradingId(null); }
  }

  async function handleCheckIntegrity(sub: AssignmentSubmission) {
    if (!sub.content) { toast.error('No text content to check'); return; }
    if (!user || !selectedAssignment) return;
    toast.info('Running integrity check…');
    try {
      const res = await fetch('/api/ai/integrity-check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: sub.content, assignmentTitle: selectedAssignment.title }),
      });
      if (!res.ok) throw new Error('Integrity check request failed');
      const data = await res.json();
      await createIntegrityReport({
        submissionId: sub.id,
        submissionType: 'assignment',
        studentId: sub.studentId,
        studentName: sub.studentName,
        courseId: sub.courseId,
        assignmentTitle: selectedAssignment.title,
        contentSnippet: sub.content.slice(0, 300),
        aiScore: data.aiScore ?? 0,
        plagiarismScore: data.plagiarismScore ?? 0,
        flags: Array.isArray(data.flags) ? data.flags : [],
        recommendation: data.recommendation ?? 'Manual review recommended.',
        status: 'pending',
        reviewedBy: user.uid,
      });
      toast.success(`AI: ${data.aiScore}% | Plagiarism: ${data.plagiarismScore}% — Integrity report saved, view it in the Integrity page.`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Integrity check failed.');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this assignment?')) return;
    try {
      await deleteAssignment(id);
      setAssignments(prev => prev.filter(a => a.id !== id));
      toast.success('Deleted');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to delete assignment.');
    }
  }

  if (loading) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">
      <div className="space-y-4">
        <div className="bg-muted animate-pulse rounded-3xl h-8 w-48" />
        <div className="bg-muted animate-pulse rounded-3xl h-14 w-96" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-muted animate-pulse rounded-3xl h-32" />
        ))}
      </div>
    </div>
  );

  if (loadError) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12">
      <div className="bg-card border border-border rounded-3xl p-10 text-center space-y-4 card-glow">
        <AlertTriangle className="w-10 h-10 mx-auto text-amber-500" />
        <p className="font-heading text-2xl text-foreground">Couldn&apos;t load your courses</p>
        <p className="text-sm text-muted-foreground">Something went wrong while fetching your data. Please try again.</p>
        <Button onClick={loadCourses} variant="outline" className="rounded-full h-11 px-5 font-semibold">Retry</Button>
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
        className="flex items-center justify-between"
      >
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600">Assignments</p>
          <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-1">
            Manage <span className="gradient-text italic">Assignments</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">Create and grade assignments for your courses</p>
        </div>
        {view === 'list' && (
          <Button
            onClick={() => setView('create')}
            className="rounded-full h-11 px-5 font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white gap-2"
          >
            <Plus className="w-4 h-4" /> New Assignment
          </Button>
        )}
        {view !== 'list' && (
          <Button variant="outline" onClick={() => setView('list')} className="rounded-full h-11 px-5 font-semibold">
            ← Back to List
          </Button>
        )}
      </motion.div>

      {/* Course selector */}
      {view === 'list' && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
          className="flex items-center gap-3"
        >
          <label className="text-xs font-medium text-muted-foreground">Course:</label>
          <Select value={selectedCourse} onValueChange={v => setSelectedCourse(v ?? '')}>
            <SelectTrigger className="w-56 rounded-xl"><SelectValue placeholder="Select course" /></SelectTrigger>
            <SelectContent>
              {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </motion.div>
      )}

      {/* Create form */}
      {view === 'create' && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
          className="bg-card border border-border rounded-3xl p-6 sm:p-8 card-glow space-y-5"
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600">Create</p>
            <h2 className="font-heading text-3xl text-foreground tracking-tight mt-1">New Assignment</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Title *</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Assignment title" className="rounded-xl" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Description / Instructions</label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} placeholder="Describe the assignment…" className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Due Date *</label>
              <Input type="datetime-local" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Max Score</label>
              <Input type="number" value={form.maxScore} onChange={e => setForm(f => ({ ...f, maxScore: e.target.value }))} min={1} className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Submission Type</label>
              <Select value={form.submissionType} onValueChange={v => setForm(f => ({ ...f, submissionType: v as 'text' | 'link' | 'any' }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="link">Link/URL</SelectItem>
                  <SelectItem value="any">Any</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as 'draft' | 'published' }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.allowLate} onChange={e => setForm(f => ({ ...f, allowLate: e.target.checked }))} className="accent-emerald-600" />
              <span className="text-sm text-muted-foreground">Allow late submissions</span>
            </label>
          </div>
          <Button
            onClick={handleCreate}
            disabled={saving}
            className="rounded-full h-11 px-5 font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Create Assignment
          </Button>
        </motion.div>
      )}

      {/* List */}
      {view === 'list' && (
        <div className="space-y-3">
          {assignments.length === 0 && (
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={2}
              className="relative text-center py-20"
            >
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-64 bg-emerald-400/20 rounded-full blur-3xl" />
              </div>
              <div className="relative">
                <ClipboardList className="w-14 h-14 mx-auto mb-4 text-muted-foreground/40" />
                <p className="font-heading text-2xl text-foreground">No assignments yet</p>
                <p className="text-sm text-muted-foreground mt-2">Create your first assignment to get started.</p>
              </div>
            </motion.div>
          )}
          {assignments.map((a, i) => (
            <motion.div
              key={a.id}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={i + 2}
              className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-4 card-glow"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-foreground">{a.title}</p>
                  <Badge className={STATUS_COLORS[a.status]}>{a.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{a.description.slice(0, 80)}{a.description.length > 80 ? '…' : ''}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Due: {(a.dueDate as any).toDate?.().toLocaleString() ?? a.dueDate} · Max: {a.maxScore} pts</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => handleViewSubmissions(a)} className="gap-1 rounded-full">
                  <Eye className="w-3.5 h-3.5" /> Submissions
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)} className="text-red-500 hover:bg-red-500/10 rounded-full">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Submissions */}
      {view === 'submissions' && selectedAssignment && (
        <div className="space-y-4">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
            className="bg-card border border-border rounded-3xl p-5 sm:p-6 card-glow relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-600 to-teal-600" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600">Submissions</p>
              <h2 className="font-heading text-3xl text-foreground tracking-tight mt-1">{selectedAssignment.title}</h2>
              <p className="text-xs text-muted-foreground mt-1">{submissions.length} submission{submissions.length !== 1 ? 's' : ''} · Max score: {selectedAssignment.maxScore}</p>
            </div>
          </motion.div>

          {submissions.length === 0 && (
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={2}
              className="relative text-center py-16"
            >
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 bg-emerald-400/20 rounded-full blur-3xl" />
              </div>
              <div className="relative">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="font-heading text-2xl text-foreground">No submissions yet</p>
                <p className="text-sm text-muted-foreground mt-1">Students haven&apos;t submitted their work yet.</p>
              </div>
            </motion.div>
          )}

          {submissions.map((sub, i) => (
            <motion.div
              key={sub.id}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={i + 2}
              className="bg-card border border-border rounded-3xl p-5 sm:p-6 card-glow space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">{sub.studentName}</p>
                  <p className="text-xs text-muted-foreground">Submitted {(sub.submittedAt as any)?.toDate?.().toLocaleString() ?? 'Unknown'}{sub.isLate ? ' · ⚠️ Late' : ''}</p>
                </div>
                {sub.score !== undefined && (
                  <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200">{sub.score}/{selectedAssignment.maxScore}</Badge>
                )}
              </div>
              {sub.content && <div className="bg-muted rounded-2xl p-3 text-sm text-foreground">{sub.content}</div>}
              {sub.linkUrl && <a href={sub.linkUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 text-sm underline break-all">{sub.linkUrl}</a>}
              <div className="flex gap-3">
                <div className="flex-1 space-y-2">
                  <Input type="number" placeholder="Score" value={scores[sub.id] ?? sub.score ?? ''} onChange={e => setScores(s => ({ ...s, [sub.id]: e.target.value }))} min={0} max={selectedAssignment.maxScore} className="w-28 rounded-xl" />
                  <Textarea placeholder="Feedback…" value={feedbacks[sub.id] ?? sub.feedback ?? ''} onChange={e => setFeedbacks(f => ({ ...f, [sub.id]: e.target.value }))} rows={2} className="rounded-xl" />
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => handleGrade(sub)}
                    disabled={gradingId === sub.id}
                    className="rounded-full font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white gap-1"
                  >
                    {gradingId === sub.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Grade
                  </Button>
                  {sub.content && (
                    <Button size="sm" variant="outline" onClick={() => handleCheckIntegrity(sub)} className="gap-1 rounded-full">
                      <AlertTriangle className="w-3.5 h-3.5" /> Integrity
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
