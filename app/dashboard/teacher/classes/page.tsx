'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  getAllCurriculumModules, getModulesWithLessons, getEnrollmentsForCourse,
  getAttemptsForCourse, getUser, Course, Module, Lesson, UnitQuizAttempt,
} from '@/lib/db';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users, BookOpen } from 'lucide-react';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 },
  }),
};

interface StudentRow {
  studentId: string;
  name: string;
  completedLessons: string[];
  progress: number;
}

export default function TeacherClassesPage() {
  const { user } = useAuthSTORE();
  const [modules, setModules] = useState<Course[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [units, setUnits] = useState<{ module: Module; lessons: Lesson[] }[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [attempts, setAttempts] = useState<UnitQuizAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMatrix, setLoadingMatrix] = useState(false);

  useEffect(() => {
    if (!user) return;
    getAllCurriculumModules().then(mods => {
      setModules(mods);
      if (mods.length > 0) setSelectedId(mods[0].id);
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (!selectedId) return;
    setLoadingMatrix(true);
    (async () => {
      const [allUnits, enrollments, courseAttempts] = await Promise.all([
        getModulesWithLessons(selectedId),
        getEnrollmentsForCourse(selectedId),
        getAttemptsForCourse(selectedId),
      ]);
      setUnits(allUnits.map(u => ({
        module: u.module,
        lessons: u.lessons.filter(l => l.status === 'published'),
      })).filter(u => u.lessons.length > 0));
      setAttempts(courseAttempts);

      const rows: StudentRow[] = await Promise.all(enrollments.map(async e => {
        const profile = await getUser(e.studentId);
        return {
          studentId: e.studentId,
          name: profile?.name ?? 'Student',
          completedLessons: e.completedLessons ?? [],
          progress: e.progress ?? 0,
        };
      }));
      setStudents(rows.sort((a, b) => a.name.localeCompare(b.name)));
      setLoadingMatrix(false);
    })();
  }, [selectedId]);

  const bestAttempt = (studentId: string, unitId: string): UnitQuizAttempt | null => {
    const unitAttempts = attempts.filter(a => a.studentId === studentId && a.unitId === unitId);
    if (unitAttempts.length === 0) return null;
    return unitAttempts.reduce((a, b) => (b.percentage > a.percentage ? b : a));
  };

  if (loading) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">
      <div className="h-24 bg-muted animate-pulse rounded-3xl" />
      <div className="h-64 bg-muted animate-pulse rounded-3xl" />
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
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600">
            Class Management
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight">
            My <span className="gradient-text italic">Classes</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Unit mastery scores and lesson progress for every student in a curriculum module.
          </p>
        </div>
        {modules.length > 0 && (
          <Select value={selectedId} onValueChange={(v) => setSelectedId(v ?? '')}>
            <SelectTrigger className="w-64 rounded-full">
              <SelectValue placeholder="Select a module" />
            </SelectTrigger>
            <SelectContent>
              {modules.map(m => (
                <SelectItem key={m.id} value={m.id}>
                  {m.title}{m.yearGroup ? ` · ${m.yearGroup}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </motion.div>

      {/* Content */}
      {modules.length === 0 ? (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
          className="text-center py-20"
        >
          <div className="relative inline-block mb-4">
            <div className="absolute inset-0 bg-emerald-400/10 blur-3xl rounded-full" />
            <BookOpen className="relative w-12 h-12 text-muted-foreground" />
          </div>
          <p className="font-heading text-2xl text-foreground">No curriculum modules yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Curriculum modules are created by your school admin in the Curriculum CMS.
          </p>
        </motion.div>
      ) : loadingMatrix ? (
        <div className="h-64 bg-muted animate-pulse rounded-3xl" />
      ) : students.length === 0 ? (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
          className="text-center py-20"
        >
          <div className="relative inline-block mb-4">
            <div className="absolute inset-0 bg-emerald-400/10 blur-3xl rounded-full" />
            <Users className="relative w-12 h-12 text-muted-foreground" />
          </div>
          <p className="font-heading text-2xl text-foreground">No students enrolled yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            No students have enrolled in this module yet.
          </p>
        </motion.div>
      ) : (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
          className="bg-card border border-border rounded-3xl card-glow overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-left text-[11px] font-bold uppercase tracking-[0.22em] text-foreground px-5 py-3.5 sticky left-0 bg-muted/40 min-w-44">
                    Student ({students.length})
                  </th>
                  {units.map(u => (
                    <th key={u.module.id} className="text-center text-[11px] font-bold uppercase tracking-[0.22em] text-foreground px-4 py-3.5 min-w-36">
                      <span className="block">{u.module.unitNumber ? `Unit ${u.module.unitNumber}` : u.module.title}</span>
                      <span className="block text-[10px] font-medium text-muted-foreground normal-case tracking-normal">
                        {u.module.term ?? ''} · pass ≥{u.module.masteryThreshold ?? 70}%
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {students.map(s => (
                  <tr key={s.studentId} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5 sticky left-0 bg-card">
                      <p className="font-semibold text-foreground">{s.name}</p>
                      <p className="text-[11px] text-muted-foreground">{s.progress}% of module</p>
                    </td>
                    {units.map(u => {
                      const attempt = bestAttempt(s.studentId, u.module.id);
                      const lessonsDone = u.lessons.filter(l => s.completedLessons.includes(l.id)).length;
                      const threshold = u.module.masteryThreshold ?? 70;
                      return (
                        <td key={u.module.id} className="px-4 py-3.5 text-center">
                          {attempt ? (
                            <Badge className={`rounded-full font-bold ${
                              attempt.percentage >= threshold
                                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                : 'bg-red-500/10 text-red-600 border border-red-500/20'
                            }`}>
                              {attempt.percentage}%
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="rounded-full text-muted-foreground">—</Badge>
                          )}
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {lessonsDone}/{u.lessons.length} lessons
                          </p>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Passed mastery quiz
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Below pass mark
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-border" /> Not attempted
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
