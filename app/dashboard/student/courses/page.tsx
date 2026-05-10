'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getEnrolledCourses, getAllPublishedCourses, enrollStudent, Course, Enrollment } from '@/lib/db';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, Plus, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface CE { course: Course; enrollment: Enrollment }

export default function CoursesPage() {
  const router = useRouter();
  const { user } = useAuthSTORE();
  const [enrolled, setEnrolled] = useState<CE[]>([]);
  const [available, setAvailable] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const [ec, all] = await Promise.all([getEnrolledCourses(user.uid), getAllPublishedCourses()]);
    setEnrolled(ec);
    const enrolledIds = new Set(ec.map(e => e.course.id));
    setAvailable(all.filter(c => !enrolledIds.has(c.id)));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const handleEnroll = async (courseId: string) => {
    if (!user) return;
    setEnrolling(courseId);
    await enrollStudent(user.uid, courseId);
    toast.success('Enrolled! Start learning now.');
    await load();
    setEnrolling(null);
  };

  const statusColor = (p: number) =>
    p === 100 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
    p > 0 ? 'bg-blue-50 text-blue-700 border-blue-200' :
    'bg-muted text-muted-foreground border-border';
  const statusLabel = (p: number) => p === 100 ? 'Completed' : p > 0 ? 'In progress' : 'Not started';

  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-28 bg-muted animate-pulse rounded-2xl" />)}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">My Courses</h1>
        <p className="text-muted-foreground text-sm mt-1">{enrolled.length} enrolled · {available.length} available to join</p>
      </div>

      {enrolled.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Enrolled</h2>
          <div className="space-y-3">
            {enrolled.map(({ course, enrollment }, i) => (
              <motion.div key={course.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-card border border-border rounded-2xl p-5 flex items-center gap-5 hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => router.push(`/dashboard/student/courses/${course.id}`)}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-bold text-foreground truncate group-hover:text-primary transition-colors">{course.title}</h3>
                    <Badge className={`text-[10px] rounded-full border shrink-0 ${statusColor(enrollment.progress)}`}>{statusLabel(enrollment.progress)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{course.description}</p>
                  <div className="flex items-center gap-3">
                    <Progress value={enrollment.progress} className="flex-1 h-1.5" />
                    <span className="text-xs font-semibold text-muted-foreground shrink-0">{enrollment.progress}%</span>
                  </div>
                </div>
                {enrollment.progress === 100 && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />}
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {available.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Available to Join</h2>
          <div className="space-y-3">
            {available.map((course, i) => (
              <motion.div key={course.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-card border border-dashed border-border rounded-2xl p-5 flex items-center gap-5"
              >
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <BookOpen className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-foreground mb-0.5">{course.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-1">{course.description}</p>
                </div>
                <Button size="sm" className="rounded-xl shrink-0" onClick={() => handleEnroll(course.id)} disabled={enrolling === course.id}>
                  <Plus className="w-4 h-4 mr-1" />{enrolling === course.id ? 'Enrolling…' : 'Enrol'}
                </Button>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {enrolled.length === 0 && available.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No courses found.</p>
          <p className="text-sm mt-1">Ask an admin to seed demo courses from the admin dashboard.</p>
        </div>
      )}
    </div>
  );
}
