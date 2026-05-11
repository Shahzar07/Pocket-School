'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  getAssignmentsForStudent, getStudentSubmissionsForCourse, submitAssignment,
  getEnrolledCourses, Assignment, AssignmentSubmission,
} from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ClipboardList, Upload, CheckCircle2, Clock, AlertTriangle, Loader2, Send } from 'lucide-react';

interface AssignmentWithSubmission { assignment: Assignment; submission?: AssignmentSubmission }

export default function StudentAssignmentsPage() {
  const { user } = useAuthSTORE();
  const [items, setItems] = useState<AssignmentWithSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      const enrollments = await getEnrolledCourses(user.uid);
      const allAssignments: Assignment[] = [];
      const allSubmissions: AssignmentSubmission[] = [];
      for (const { course } of enrollments) {
        const [asgns, subs] = await Promise.all([
          getAssignmentsForStudent([course.id!]),
          getStudentSubmissionsForCourse(user.uid, course.id!),
        ]);
        allAssignments.push(...asgns);
        allSubmissions.push(...subs);
      }
      const mapped = allAssignments.map(a => ({
        assignment: a,
        submission: allSubmissions.find(s => s.assignmentId === a.id),
      }));
      setItems(mapped);
      setLoading(false);
    })();
  }, [user]);

  const handleSubmit = async (a: Assignment) => {
    if (!user) return;
    const content = answers[a.id!] ?? '';
    if (!content.trim()) { toast.error('Please enter your answer.'); return; }
    setSubmitting(a.id!);
    try {
      const due = a.dueDate?.toDate?.() ?? null;
      await submitAssignment({ assignmentId: a.id!, studentId: user.uid, studentName: '', courseId: a.courseId, content, isLate: due ? new Date() > due : false });
      toast.success('Submitted!');
      setItems(prev => prev.map(i => i.assignment.id === a.id
        ? { ...i, submission: { assignmentId: a.id!, studentId: user.uid, courseId: a.courseId, content, id: '' } as AssignmentSubmission }
        : i));
    } catch { toast.error('Submission failed.'); }
    finally { setSubmitting(null); }
  };

  const getStatus = (item: AssignmentWithSubmission) => {
    if (item.submission?.score !== undefined) return 'graded';
    if (item.submission) return 'submitted';
    const due = item.assignment.dueDate?.toDate?.() ?? (item.assignment.dueDate ? new Date(item.assignment.dueDate as any) : null);
    if (due && due < new Date()) return 'overdue';
    return 'pending';
  };

  const STATUS_STYLES: Record<string, string> = {
    graded: 'bg-green-100 text-green-700',
    submitted: 'bg-blue-100 text-blue-700',
    overdue: 'bg-red-100 text-red-700',
    pending: 'bg-amber-100 text-amber-700',
  };

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-2xl" />)}
    </div>
  );

  const pending = items.filter(i => getStatus(i) === 'pending' || getStatus(i) === 'overdue');
  const done = items.filter(i => getStatus(i) === 'submitted' || getStatus(i) === 'graded');

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Assignments</h1>
        <p className="text-muted-foreground text-sm mt-1">Submit your work and track grades.</p>
      </div>

      {items.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No assignments yet.</p>
        </div>
      )}

      {pending.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">To Do ({pending.length})</h2>
          {pending.map((item, i) => {
            const status = getStatus(item);
            const due = item.assignment.dueDate?.toDate?.() ?? (item.assignment.dueDate ? new Date(item.assignment.dueDate as any) : null);
            return (
              <motion.div key={item.assignment.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-card border border-border rounded-2xl p-6 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-foreground">{item.assignment.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{item.assignment.description}</p>
                    {due && (
                      <div className={`flex items-center gap-1 text-xs mt-2 ${status === 'overdue' ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {status === 'overdue' ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                        Due: {due.toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <Badge className={`rounded-full text-[10px] shrink-0 ${STATUS_STYLES[status]}`}>{status}</Badge>
                </div>
                <div className="space-y-2">
                  {item.assignment.submissionType === 'link' ? (
                    <Input
                      value={answers[item.assignment.id!] ?? ''}
                      onChange={e => setAnswers(a => ({ ...a, [item.assignment.id!]: e.target.value }))}
                      placeholder="Paste your link here…"
                      className="rounded-xl h-10"
                    />
                  ) : (
                    <Textarea
                      value={answers[item.assignment.id!] ?? ''}
                      onChange={e => setAnswers(a => ({ ...a, [item.assignment.id!]: e.target.value }))}
                      placeholder="Write your answer here…"
                      className="rounded-xl min-h-24 text-sm resize-none"
                    />
                  )}
                  <Button
                    onClick={() => handleSubmit(item.assignment)}
                    disabled={submitting === item.assignment.id}
                    className="bg-blue-600 hover:bg-blue-700 text-white gap-2 rounded-xl"
                  >
                    {submitting === item.assignment.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Submit Assignment
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </section>
      )}

      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Submitted ({done.length})</h2>
          {done.map((item, i) => {
            const status = getStatus(item);
            return (
              <motion.div key={item.assignment.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                className="bg-card border border-border rounded-2xl p-5 flex items-start justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className={`w-5 h-5 shrink-0 ${status === 'graded' ? 'text-green-500' : 'text-blue-500'}`} />
                  <div>
                    <p className="font-semibold text-foreground">{item.assignment.title}</p>
                    {item.submission?.feedback && <p className="text-sm text-muted-foreground mt-1">{item.submission.feedback}</p>}
                  </div>
                </div>
                {item.submission?.score !== undefined && (
                  <div className="text-right shrink-0">
                    <p className="text-xl font-extrabold text-foreground">{item.submission.score}/{item.assignment.maxScore}</p>
                    <p className="text-xs text-muted-foreground">{Math.round((item.submission.score / item.assignment.maxScore) * 100)}%</p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </section>
      )}
    </div>
  );
}
