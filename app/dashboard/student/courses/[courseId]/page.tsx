'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getCourse, getModulesWithLessons, getEnrolledCourses, getUnitQuizAttempts, Course, Module, Lesson, Enrollment, UnitQuizAttempt } from '@/lib/db';
import { getUnitStatuses, getCurriculumLessonStatus } from '@/lib/curriculum';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, BookOpen, CheckCircle2, Lock, PlayCircle, ChevronDown, ChevronRight, Trophy } from 'lucide-react';

interface ModuleWithLessons { module: Module; lessons: Lesson[] }

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 } }),
};

export default function CourseDetailPage() {
  const router = useRouter();
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuthSTORE();
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<ModuleWithLessons[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [attempts, setAttempts] = useState<UnitQuizAttempt[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!user || !courseId) return;
    setLoading(true);
    setError(null);
    try {
      const [c, modsRaw, enrolled] = await Promise.all([
        getCourse(courseId),
        getModulesWithLessons(courseId),
        getEnrolledCourses(user.uid),
      ]);
      let mods = modsRaw;
      // Curriculum modules: students only see published lessons, and unit
      // progression depends on mastery quiz attempts.
      if (c?.kind === 'curriculum') {
        mods = mods
          .map(m => ({ module: m.module, lessons: m.lessons.filter(l => l.status === 'published') }))
          .filter(m => m.lessons.length > 0);
        setAttempts(await getUnitQuizAttempts(user.uid, courseId));
      }
      setCourse(c);
      setModules(mods);
      setExpanded(mods.map(m => m.module.id));
      const e = enrolled.find(x => x.course.id === courseId);
      setEnrollment(e?.enrollment ?? null);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user, courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isCurriculum = course?.kind === 'curriculum';
  const completedIds = new Set(enrollment?.completedLessons ?? []);
  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const unitStatuses = isCurriculum ? getUnitStatuses(modules, enrollment, attempts) : [];

  const getLessonStatus = (lesson: Lesson, modIndex: number, lesIndex: number): 'completed' | 'available' | 'locked' => {
    if (isCurriculum) {
      return getCurriculumLessonStatus(lesson, modules[modIndex].lessons, unitStatuses[modIndex].state, completedIds);
    }
    if (completedIds.has(lesson.id)) return 'completed';
    if (modIndex === 0 && lesIndex === 0) return 'available';
    // Previous lesson must be completed to unlock next
    const allLessons = modules.flatMap(m => m.lessons);
    const currentIndex = allLessons.findIndex(l => l.id === lesson.id);
    if (currentIndex === 0) return 'available';
    const prev = allLessons[currentIndex - 1];
    return completedIds.has(prev?.id) ? 'available' : 'locked';
  };

  if (loading) return (
    <div className="max-w-5xl mx-auto px-0 sm:px-2 pb-12 space-y-8 pt-6">
      <div className="h-9 w-24 bg-muted animate-pulse rounded-full" />
      <div className="h-52 bg-muted animate-pulse rounded-3xl" />
      <div className="space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-3xl" />)}
      </div>
    </div>
  );

  if (error) return (
    <div className="max-w-5xl mx-auto px-0 sm:px-2 pb-12 pt-16 flex justify-center">
      <div className="bg-card border border-border rounded-3xl p-8 text-center max-w-md w-full card-glow">
        <p className="font-heading text-xl text-foreground mb-2">Couldn&apos;t load this page.</p>
        <p className="text-sm text-muted-foreground mb-6 break-words">{error}</p>
        <Button onClick={load} className="rounded-full h-11 px-6 font-bold">Retry</Button>
      </div>
    </div>
  );

  if (!course) return (
    <div className="max-w-5xl mx-auto px-0 sm:px-2 pb-12">
      <div className="relative flex flex-col items-center justify-center text-center py-24 overflow-hidden">
        <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-primary/8 blur-[80px]" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center mb-6">
            <BookOpen className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-heading text-2xl text-foreground mb-2">Course not found</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            This course may have been removed or is no longer available.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-0 sm:px-2 pb-12 space-y-8">
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0} className="pt-2">
        <Button variant="ghost" size="sm" className="text-muted-foreground rounded-full -ml-2" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
      </motion.div>

      {/* Course header hero */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}
        className="relative overflow-hidden bg-gradient-to-br from-[#1A73E8] to-[#7C3AED] rounded-[2rem] p-7 sm:p-9 text-white"
      >
        <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-[60px]" />
        <div className="pointer-events-none absolute -bottom-20 -left-12 w-72 h-72 rounded-full bg-white/10 blur-[70px]" />
        <div className="relative z-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/70 mb-3">
            {course.subject ?? 'Course'}
          </p>
          <h1 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">{course.title}</h1>
          <p className="text-white/80 text-sm leading-relaxed mb-6 max-w-2xl">{course.description}</p>
          {enrollment && (
            <div>
              <div className="flex justify-between text-xs text-white/80 mb-2">
                <span>{completedIds.size} / {totalLessons} lessons complete</span>
                <span className="font-bold">{enrollment.progress}%</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all" style={{ width: `${enrollment.progress}%` }} />
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Modules */}
      <div className="space-y-4">
        {modules.map((mod, modIndex) => {
          const unitStatus = isCurriculum ? unitStatuses[modIndex] : null;
          const unitLocked = unitStatus?.state === 'locked';
          return (
          <motion.div key={mod.module.id}
            variants={fadeUp} initial="hidden" animate="visible" custom={modIndex + 2}
            className={`bg-card border border-border rounded-3xl overflow-hidden ${unitLocked ? 'opacity-60' : 'card-glow'}`}
          >
            <button
              className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/50 transition-colors"
              disabled={unitLocked}
              onClick={() => setExpanded(prev =>
                prev.includes(mod.module.id) ? prev.filter(id => id !== mod.module.id) : [...prev, mod.module.id]
              )}
            >
              <div>
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    {isCurriculum ? `Module ${mod.module.unitNumber ?? modIndex + 1}` : `Module ${modIndex + 1}`}
                  </span>
                  {isCurriculum && mod.module.term && (
                    <Badge variant="outline" className="text-[10px] rounded-full">{mod.module.term}</Badge>
                  )}
                  {unitStatus?.state === 'passed' && (
                    <Badge className="text-[10px] rounded-full bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1">
                      <Trophy className="w-3 h-3" /> Passed{unitStatus.bestQuizPercentage !== undefined ? ` · ${unitStatus.bestQuizPercentage}%` : ''}
                    </Badge>
                  )}
                  {unitStatus?.state === 'in_progress' && unitStatus.bestQuizPercentage !== undefined && (
                    <Badge className="text-[10px] rounded-full bg-amber-500/10 text-amber-600 border-amber-500/20">
                      Quiz best: {unitStatus.bestQuizPercentage}%
                    </Badge>
                  )}
                </div>
                <h3 className="font-bold text-foreground">{mod.module.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {unitLocked
                    ? `Pass the previous module's mastery quiz (≥${mod.module.masteryThreshold ?? 70}%) to unlock`
                    : `${mod.lessons.filter(l => completedIds.has(l.id)).length}/${mod.lessons.length} lessons`}
                </p>
              </div>
              {unitLocked
                ? <Lock className="w-5 h-5 text-muted-foreground" />
                : expanded.includes(mod.module.id)
                  ? <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  : <ChevronRight className="w-5 h-5 text-muted-foreground" />
              }
            </button>

            {expanded.includes(mod.module.id) && !unitLocked && (
              <div className="border-t border-border divide-y divide-border">
                {mod.lessons.map((lesson, lesIndex) => {
                  const status = getLessonStatus(lesson, modIndex, lesIndex);
                  return (
                    <button
                      key={lesson.id}
                      disabled={status === 'locked'}
                      onClick={() => router.push(`/dashboard/student/courses/${courseId}/lessons/${lesson.id}`)}
                      className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${
                        status === 'locked'
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:bg-muted/50 cursor-pointer'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                        status === 'completed' ? 'bg-emerald-500/10' :
                        status === 'available' ? 'bg-primary/10' :
                        'bg-muted'
                      }`}>
                        {status === 'completed' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                        {status === 'available' && <PlayCircle className="w-5 h-5 text-primary" />}
                        {status === 'locked' && <Lock className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm">
                          {isCurriculum && lesson.lessonNumber ? `L${lesson.lessonNumber} · ` : ''}{lesson.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {lesson.isUnitQuiz
                            ? status === 'completed' ? '✓ Mastery quiz passed'
                              : status === 'available' ? `Mastery quiz · score ≥${mod.module.masteryThreshold ?? 70}% to unlock the next module`
                              : 'Complete all lessons in this module to unlock the quiz'
                            : status === 'completed' ? `✓ Completed · +50 XP${isCurriculum ? ' · ⚡10' : ''}` :
                              status === 'available' ? `Start lesson · +50 XP${isCurriculum ? ' · ⚡10' : ''}` :
                              'Complete previous lesson to unlock'}
                        </p>
                      </div>
                      {status !== 'locked' && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
          );
        })}
      </div>

      {modules.length === 0 && (
        <div className="relative flex flex-col items-center justify-center text-center py-24 overflow-hidden">
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-primary/8 blur-[80px]" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center mb-6">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-heading text-2xl text-foreground mb-2">No lessons yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              This course doesn&apos;t have any published lessons yet. Check back soon.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
