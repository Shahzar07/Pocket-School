'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getTeacherCourses, getSubmissionsForTeacher, Course, Submission } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Users, ClipboardList, ArrowRight, Upload, BarChart3, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

const fadeUp = (i = 0) => ({ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.07 } } });

export default function TeacherDashboard() {
  const router = useRouter();
  const { user, profile } = useAuthSTORE();
  const [courses, setCourses] = useState<Course[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([getTeacherCourses(user.uid), getSubmissionsForTeacher(user.uid)]).then(([cs, ss]) => {
      setCourses(cs);
      setSubmissions(ss);
      setLoading(false);
    });
  }, [user]);

  const ungraded = submissions.filter(s => s.score === undefined);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <motion.div variants={fadeUp(0)} initial="hidden" animate="visible"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
            Welcome, {profile?.name?.split(' ')[0] ?? 'Teacher'} 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Here's what needs your attention today.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl gap-2" onClick={() => router.push('/dashboard/teacher/upload')}>
            <Upload className="w-4 h-4" /> Create Lesson
          </Button>
          <Button className="rounded-xl gap-2" onClick={() => router.push('/dashboard/teacher/gradebook')}>
            <ClipboardList className="w-4 h-4" /> Gradebook
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'My Courses', value: courses.length, icon: <BookOpen className="w-5 h-5 text-blue-500" />, color: 'bg-blue-50 border-blue-200' },
          { label: 'To Grade', value: ungraded.length, icon: <ClipboardList className="w-5 h-5 text-amber-500" />, color: 'bg-amber-50 border-amber-200' },
          { label: 'Submissions', value: submissions.length, icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />, color: 'bg-emerald-50 border-emerald-200' },
        ].map((s, i) => (
          <motion.div key={i} variants={fadeUp(i + 1)} initial="hidden" animate="visible"
            className={`${s.color} border rounded-2xl p-5 text-center`}
          >
            <div className="flex justify-center mb-2">{s.icon}</div>
            <p className="text-2xl font-extrabold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* My Courses */}
      <motion.section variants={fadeUp(4)} initial="hidden" animate="visible">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">My Courses</h2>
          <Link href="/dashboard/teacher/upload" className="text-sm text-primary hover:underline flex items-center gap-1">
            + New Lesson <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-2xl" />)}</div>
        ) : courses.length === 0 ? (
          <div className="text-center py-12 bg-muted/30 rounded-2xl border border-dashed border-border">
            <BookOpen className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-40" />
            <p className="text-muted-foreground text-sm font-medium">No courses yet.</p>
            <p className="text-muted-foreground text-xs mt-1">Use the Upload page to create and publish your first lesson.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {courses.map((course, i) => (
              <motion.div key={course.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-foreground truncate">{course.title}</h3>
                  <p className="text-xs text-muted-foreground">{course.description?.slice(0, 80)}…</p>
                </div>
                <Badge className={`rounded-full text-[10px] shrink-0 ${course.status === 'published' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  {course.status}
                </Badge>
              </motion.div>
            ))}
          </div>
        )}
      </motion.section>

      {/* Pending Grades */}
      {ungraded.length > 0 && (
        <motion.section variants={fadeUp(5)} initial="hidden" animate="visible">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">Pending Grades</h2>
            <Link href="/dashboard/teacher/gradebook" className="text-sm text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-3">
            {ungraded.slice(0, 3).map((sub, i) => (
              <div key={sub.id} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
                <ClipboardList className="w-5 h-5 text-amber-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">{sub.lessonTitle}</p>
                  <p className="text-xs text-muted-foreground">{sub.studentName || 'Student'} · Quiz · {sub.answers.filter(a => a.correct).length}/{sub.maxScore} correct</p>
                </div>
                <Button size="sm" className="rounded-xl shrink-0" onClick={() => router.push('/dashboard/teacher/gradebook')}>
                  Review
                </Button>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Quick Links */}
      <motion.div variants={fadeUp(6)} initial="hidden" animate="visible"
        className="grid sm:grid-cols-2 gap-4"
      >
        {[
          { icon: <Upload className="w-5 h-5 text-blue-600" />, title: 'Upload & Generate', desc: 'Transform lesson material into 11 AI formats', href: '/dashboard/teacher/upload', bg: 'bg-blue-50 border-blue-200' },
          { icon: <BarChart3 className="w-5 h-5 text-violet-600" />, title: 'Student Analytics', desc: 'Track class performance and identify struggling students', href: '/dashboard/teacher/analytics', bg: 'bg-violet-50 border-violet-200' },
        ].map((item, i) => (
          <button key={i} onClick={() => router.push(item.href)}
            className={`${item.bg} border rounded-2xl p-5 text-left hover:shadow-md transition-shadow`}
          >
            <div className="mb-3">{item.icon}</div>
            <p className="font-bold text-foreground text-sm">{item.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
          </button>
        ))}
      </motion.div>
    </div>
  );
}
