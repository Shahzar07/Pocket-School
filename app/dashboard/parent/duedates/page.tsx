'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getChildrenProfiles, getEnrolledCourses, getAssignmentsForStudent, Assignment } from '@/lib/db';
import { Card } from '@/components/ui/card';
import { Calendar, Clock, AlertCircle, CalendarCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-3">
      {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />)}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Upcoming Due Dates</h1>
        <p className="text-muted-foreground text-sm mt-1">Track your child's assignments and quizzes.</p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CalendarCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">All caught up!</p>
          <p className="text-sm mt-1">No upcoming assignments at the moment.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item, idx) => {
            const u = urgency(item.assignment.dueDate);
            return (
              <motion.div key={item.assignment.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                <Card className="p-6 rounded-2xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${
                      u === 'high' ? 'bg-red-50 text-red-500' :
                      u === 'medium' ? 'bg-amber-50 text-amber-500' :
                      'bg-emerald-50 text-emerald-500'
                    }`}>
                      {u === 'high' ? <AlertCircle className="w-6 h-6" /> : <Calendar className="w-6 h-6" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-lg">{item.assignment.title}</h3>
                      <p className="text-muted-foreground font-medium text-sm">{item.courseTitle} · {item.childName}</p>
                      <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {formatDate(item.assignment.dueDate)}</span>
                        <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {formatTime(item.assignment.dueDate)}</span>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" onClick={() => toast.info('Setting a reminder for this due date...')} className="text-primary self-start sm:self-center">Remind Me</Button>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
