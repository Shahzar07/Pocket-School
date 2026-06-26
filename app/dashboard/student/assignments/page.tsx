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

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 },
  }),
};

interface AssignmentWithSubmission { assignment: Assignment; submission?: AssignmentSubmission }

export default function StudentAssignmentsPage() {
  const { user, profile } = useAuthSTORE();
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
      await submitAssignment({ assignmentId: a.id!, studentId: user.uid, studentName: profile?.name ?? 'Student', courseId: a.courseId, content, isLate: due ? new Date() > due : false });
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
    graded: 'bg-emerald-500/10 text-emerald-600',
    submitted: 'bg-primary/10 text-primary',
    overdue: 'bg-destructive/10 text-destructive',
    pending: 'bg-amber-500/10 text-amber-600',
  };

  if (loading) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10 pt-8">
      <div className="space-y-3">
        <div className="h-3 w-28 bg-muted animate-pulse rounded-full" />
        <div className="h-12 w-72 bg-muted animate-pulse rounded-2xl" />
      </div>
      {[1, 2, 3].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-3xl" />)}
    </div>
  );

  const pending = items.filter(i => getStatus(i) === 'pending' || getStatus(i) === 'overdue');
  const done = items.filter(i => getStatus(i) === 'submitted' || getStatus(i) === 'graded');

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">
      {/* Header */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Coursework</p>
        <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-1.5">
          <span className="gradient-text italic">Assignments</span>
        </h1>
      </motion.div>

      {/* Empty state */}
      {items.length === 0 && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
          className="relative text-center py-24"
        >
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-primary/8 blur-[80px]" />
          <ClipboardList className="w-14 h-14 mx-auto mb-4 text-muted-foreground opacity-40" />
          <p className="font-heading text-2xl text-foreground">No assignments yet</p>
          <p className="text-sm text-muted-foreground mt-2">Your coursework will appear here once assigned.</p>
        </motion.div>
      )}

      {/* Pending / To Do */}
      {pending.length > 0 && (
        <section className="space-y-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">To Do</p>
            <h2 className="font-heading text-3xl text-foreground mt-1.5">
              Pending ({pending.length})
            </h2>
          </div>
          {pending.map((item, i) => {
            const status = getStatus(item);
            const due = item.assignment.dueDate?.toDate?.() ?? (item.assignment.dueDate ? new Date(item.assignment.dueDate as any) : null);
            return (
              <motion.div
                key={item.assignment.id}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={i}
                className="bg-card border border-border rounded-3xl p-6 space-y-4 card-glow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-heading text-lg text-foreground">{item.assignment.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{item.assignment.description}</p>
                    {due && (
                      <div className={`flex items-center gap-1 text-xs mt-2 ${status === 'overdue' ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {status === 'overdue' ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                        Due: {due.toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <Badge className={`rounded-full text-[10px] shrink-0 ${STATUS_STYLES[status]}`}>{status}</Badge>
                </div>
                <div className="space-y-3">
                  {item.assignment.submissionType === 'link' ? (
                    <Input
                      value={answers[item.assignment.id!] ?? ''}
                      onChange={e => setAnswers(a => ({ ...a, [item.assignment.id!]: e.target.value }))}
                      placeholder="Paste your link here…"
                      className="bg-background rounded-xl h-10"
                    />
                  ) : (
                    <Textarea
                      value={answers[item.assignment.id!] ?? ''}
                      onChange={e => setAnswers(a => ({ ...a, [item.assignment.id!]: e.target.value }))}
                      placeholder="Write your answer here…"
                      className="bg-background rounded-xl min-h-24 text-sm resize-none"
                    />
                  )}
                  <Button
                    onClick={() => handleSubmit(item.assignment)}
                    disabled={submitting === item.assignment.id}
                    className="rounded-full h-11 px-5 font-bold bg-gradient-to-r from-[#1A73E8] to-[#7C3AED] text-white gap-2"
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

      {/* Completed / Submitted */}
      {done.length > 0 && (
        <section className="space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Completed</p>
            <h2 className="font-heading text-3xl text-foreground mt-1.5">
              Submitted ({done.length})
            </h2>
          </div>
          {done.map((item, i) => {
            const status = getStatus(item);
            return (
              <motion.div
                key={item.assignment.id}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={i}
                className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 card-glow"
              >
                <CheckCircle2 className={`w-5 h-5 shrink-0 ${status === 'graded' ? 'text-emerald-500' : 'text-primary'}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-heading text-foreground">{item.assignment.title}</p>
                  {item.submission?.feedback && <p className="text-sm text-muted-foreground mt-1">{item.submission.feedback}</p>}
                </div>
                {item.submission?.score !== undefined && (
                  <div className="text-right shrink-0">
                    <p className="font-heading text-2xl text-foreground">{item.submission.score}/{item.assignment.maxScore}</p>
                    <p className="text-xs text-muted-foreground font-semibold">{Math.round((item.submission.score / item.assignment.maxScore) * 100)}%</p>
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
