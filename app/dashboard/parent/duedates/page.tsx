'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getChildrenProfiles, getEnrolledCourses, getAssignmentsForStudent, Assignment } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, AlertCircle, CalendarCheck } from 'lucide-react';
import { toast } from 'sonner';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 } }),
};

interface DueItem {
  assignment: Assignment;
  childName: string;
  courseTitle: string;
}

export default function ParentDueDates() {
  const { user } = useAuthSTORE();
  const [items, setItems] = useState<DueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const children = await getChildrenProfiles(user.uid);
      const all: DueItem[] = [];
      for (const child of children) {
        const enrolled = await getEnrolledCourses(child.id);
        const courseMap = new Map(enrolled.map(e => [e.course.id, e.course.title]));
        const assignments = await getAssignmentsForStudent(Array.from(courseMap.keys()));
        assignments.forEach(a => all.push({
          assignment: a,
          childName: child.data.name ?? 'Your child',
          courseTitle: courseMap.get(a.courseId) ?? 'Course',
        }));
      }
      all.sort((a, b) => (a.assignment.dueDate?.toMillis?.() ?? 0) - (b.assignment.dueDate?.toMillis?.() ?? 0));
      setItems(all);
      setLoading(false);
    })();
  }, [user]);

  const urgency = (due?: Assignment['dueDate']) => {
    if (!due?.toDate) return 'low';
    const days = (due.toDate().getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (days < 2) return 'high';
    if (days < 7) return 'medium';
    return 'low';
  };

  const formatDate = (due?: Assignment['dueDate']) => {
    if (!due?.toDate) return '';
    return due.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (due?: Assignment['dueDate']) => {
    if (!due?.toDate) return '';
    return due.toDate().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  if (loading) return (
    <div className="max-w-5xl mx-auto px-0 sm:px-2 py-2 space-y-5">
      <div className="h-24 bg-muted animate-pulse rounded-3xl" />
      {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-3xl" />)}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-0 sm:px-2 pb-12 space-y-10">

      {/* Header */}
      <motion.header variants={fadeUp} initial="hidden" animate="visible" custom={0} className="pt-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-600 flex items-center gap-2">
          <span className="w-5 h-px bg-amber-600 inline-block" /> Deadline tracker
        </p>
        <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-3">
          Upcoming <span className="gradient-text italic">due dates</span>
        </h1>
        <p className="text-muted-foreground mt-2 text-[15px]">Track your child's assignments and quizzes.</p>
      </motion.header>

      {items.length === 0 ? (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}
          className="relative text-center py-16 bg-card rounded-[2rem] border border-border overflow-hidden"
        >
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-emerald-500/8 blur-[80px]" />
          <CalendarCheck className="w-12 h-12 mx-auto mb-4 text-emerald-600/40" />
          <h3 className="font-heading text-2xl text-foreground mb-1.5">All caught up!</h3>
          <p className="text-sm text-muted-foreground">No upcoming assignments at the moment.</p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => {
            const u = urgency(item.assignment.dueDate);
            return (
              <motion.div key={item.assignment.id} variants={fadeUp} initial="hidden" animate="visible" custom={1 + idx}>
                <div className="bg-card border border-border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 card-glow">
                  <div className="flex items-center gap-4">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
                      u === 'high' ? 'bg-gradient-to-br from-red-500 to-rose-600' :
                      u === 'medium' ? 'bg-gradient-to-br from-amber-500 to-orange-600' :
                      'bg-gradient-to-br from-emerald-500 to-teal-600'
                    }`}>
                      {u === 'high' ? <AlertCircle className="w-5 h-5 text-white" /> : <Calendar className="w-5 h-5 text-white" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">{item.assignment.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.courseTitle} · {item.childName}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {formatDate(item.assignment.dueDate)}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {formatTime(item.assignment.dueDate)}</span>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => toast.info('Setting a reminder for this due date...')}
                    className="rounded-full h-10 px-4 font-semibold shrink-0"
                  >
                    Remind Me
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
