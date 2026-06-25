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

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 } }),
};

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
    p === 100 ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
    p > 0 ? 'bg-primary/10 text-primary border-primary/20' :
    'bg-muted text-muted-foreground border-border';
  const statusLabel = (p: number) => p === 100 ? 'Completed' : p > 0 ? 'In progress' : 'Not started';

  if (loading) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10 pt-10">
      <div className="space-y-3">
        <div className="h-4 w-24 bg-muted animate-pulse rounded-full" />
        <div className="h-12 w-72 bg-muted animate-pulse rounded-2xl" />
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-28 bg-muted animate-pulse rounded-3xl" />)}
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">
      {/* Page Header */}
      <motion.header
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={0}
        className="space-y-2 pt-2"
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
          Course Library
        </p>
        <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight">
          My <span className="gradient-text italic">Courses</span>
        </h1>
        <p className="text-muted-foreground text-sm">
          {enrolled.length} enrolled &middot; {available.length} available to join
        </p>
      </motion.header>

      {/* Enrolled Section */}
      {enrolled.length > 0 && (
        <motion.section
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
          className="space-y-5"
        >
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Currently Learning</p>
            <h2 className="font-heading text-3xl text-foreground tracking-tight">Enrolled</h2>
          </div>
          <div className="space-y-4">
            {enrolled.map(({ course, enrollment }, i) => (
              <motion.div
                key={course.id}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={i + 2}
                className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 card-glow cursor-pointer group"
                onClick={() => router.push(`/dashboard/student/courses/${course.id}`)}
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0">
                  <BookOpen className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-foreground truncate group-hover:text-primary transition-colors">
                      {course.title}
                    </h3>
                    <Badge className={`text-[10px] rounded-full border shrink-0 ${statusColor(enrollment.progress)}`}>
                      {statusLabel(enrollment.progress)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
                    {course.description}
                  </p>
                  <div className="flex items-center gap-3">
                    <Progress value={enrollment.progress} className="flex-1 h-1.5" />
                    <span className="text-xs font-semibold text-muted-foreground shrink-0">
                      {enrollment.progress}%
                    </span>
                  </div>
                </div>
                {enrollment.progress === 100 && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                )}
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Available Section */}
      {available.length > 0 && (
        <motion.section
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={enrolled.length + 2}
          className="space-y-5"
        >
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Discover</p>
            <h2 className="font-heading text-3xl text-foreground tracking-tight">Available to Join</h2>
          </div>
          <div className="space-y-4">
            {available.map((course, i) => (
              <motion.div
                key={course.id}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={enrolled.length + i + 3}
                className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 card-glow"
              >
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center shrink-0">
                  <BookOpen className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-foreground mb-0.5">{course.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-1">{course.description}</p>
                </div>
                <Button
                  className="rounded-full h-11 px-5 font-bold bg-primary text-primary-foreground shrink-0"
                  onClick={() => handleEnroll(course.id)}
                  disabled={enrolling === course.id}
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  {enrolling === course.id ? 'Enrolling...' : 'Enrol'}
                </Button>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Empty State */}
      {enrolled.length === 0 && available.length === 0 && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
          className="relative flex flex-col items-center justify-center text-center py-24"
        >
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 rounded-full bg-primary/10 blur-3xl" />
          </div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center mb-6">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-heading text-2xl text-foreground mb-2">No courses found</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Ask an admin to seed demo courses from the admin dashboard.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
