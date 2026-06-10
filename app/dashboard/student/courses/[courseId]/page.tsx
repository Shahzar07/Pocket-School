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

  useEffect(() => {
    if (!user || !courseId) return;
    Promise.all([
      getCourse(courseId),
      getModulesWithLessons(courseId),
      getEnrolledCourses(user.uid),
    ]).then(async ([c, mods, enrolled]) => {
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
      setLoading(false);
    });
  }, [user, courseId]);

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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-4">
      <div className="h-40 bg-muted animate-pulse rounded-3xl" />
      <div className="h-24 bg-muted animate-pulse rounded-2xl" />
    </div>
  );

  if (!course) return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center text-muted-foreground">
      <p>Course not found.</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => router.back()}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </Button>

      {/* Course header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-7 text-white"
      >
        <Badge className="mb-3 bg-white/20 text-white border-white/30 text-xs rounded-full">
          {course.subject ?? 'Course'}
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">{course.title}</h1>
        <p className="text-blue-100 text-sm leading-relaxed mb-5">{course.description}</p>
        {enrollment && (
          <div>
            <div className="flex justify-between text-xs text-blue-100 mb-2">
              <span>{completedIds.size} / {totalLessons} lessons complete</span>
              <span className="font-bold">{enrollment.progress}%</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all" style={{ width: `${enrollment.progress}%` }} />
            </div>
          </div>
        )}
      </motion.div>

      {/* Modules */}
      <div className="space-y-4">
        {modules.map((mod, modIndex) => {
          const unitStatus = isCurriculum ? unitStatuses[modIndex] : null;
          const unitLocked = unitStatus?.state === 'locked';
          return (
          <motion.div key={mod.module.id}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: modIndex * 0.08 }}
            className={`bg-card border border-border rounded-2xl overflow-hidden ${unitLocked ? 'opacity-60' : ''}`}
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
                    {isCurriculum ? `Unit ${mod.module.unitNumber ?? modIndex + 1}` : `Module ${modIndex + 1}`}
                  </span>
                  {isCurriculum && mod.module.term && (
                    <Badge variant="outline" className="text-[10px] rounded-full">{mod.module.term}</Badge>
                  )}
                  {unitStatus?.state === 'passed' && (
                    <Badge className="text-[10px] rounded-full bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
                      <Trophy className="w-3 h-3" /> Passed{unitStatus.bestQuizPercentage !== undefined ? ` · ${unitStatus.bestQuizPercentage}%` : ''}
                    </Badge>
                  )}
                  {unitStatus?.state === 'in_progress' && unitStatus.bestQuizPercentage !== undefined && (
                    <Badge className="text-[10px] rounded-full bg-amber-100 text-amber-700 border-amber-200">
                      Quiz best: {unitStatus.bestQuizPercentage}%
                    </Badge>
                  )}
                </div>
                <h3 className="font-bold text-foreground">{mod.module.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {unitLocked
                    ? `Pass the previous unit's mastery quiz (≥${mod.module.masteryThreshold ?? 70}%) to unlock`
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
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        status === 'completed' ? 'bg-emerald-100' :
                        status === 'available' ? 'bg-blue-100' :
                        'bg-muted'
                      }`}>
                        {status === 'completed' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                        {status === 'available' && <PlayCircle className="w-5 h-5 text-blue-600" />}
                        {status === 'locked' && <Lock className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm">
                          {isCurriculum && lesson.lessonNumber ? `L${lesson.lessonNumber} · ` : ''}{lesson.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {lesson.isUnitQuiz
                            ? status === 'completed' ? '✓ Mastery quiz passed'
                              : status === 'available' ? `Mastery quiz · score ≥${mod.module.masteryThreshold ?? 70}% to unlock the next unit`
                              : 'Complete all lessons in this unit to unlock the quiz'
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
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>No lessons available yet. Check back soon.</p>
        </div>
      )}
    </div>
  );
}
