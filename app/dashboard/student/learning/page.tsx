'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  getCurriculumModules, getModulesWithLessons, getEnrollment, enrollStudent,
  getUnitQuizAttempts, getProgrammes,
  Course, Module, Lesson, Enrollment, UnitQuizAttempt, Programme,
} from '@/lib/db';
import { getUnitStatuses, getCurriculumLessonStatus, UnitStatus } from '@/lib/curriculum';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  GraduationCap, BookOpen, CheckCircle2, Lock, PlayCircle, ChevronDown,
  ChevronRight, Trophy, Sparkles, FlaskConical, Calculator, Languages, Monitor,
} from 'lucide-react';

interface ModuleTree {
  course: Course;
  units: { module: Module; lessons: Lesson[] }[];
  enrollment: Enrollment | null;
  attempts: UnitQuizAttempt[];
  unitStatuses: UnitStatus[];
}

const SUBJECT_ICONS: Record<string, React.ElementType> = {
  Science: FlaskConical,
  Maths: Calculator,
  English: Languages,
  Computing: Monitor,
};

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 } }),
};

export default function MyLearningPage() {
  const router = useRouter();
  const { user, profile } = useAuthSTORE();
  const [trees, setTrees] = useState<ModuleTree[]>([]);
  const [programme, setProgramme] = useState<Programme | null>(null);
  const [expandedUnits, setExpandedUnits] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const yearGroup = profile?.yearGroup;
  const tier = profile?.subscriptionTier ?? 'free';

  useEffect(() => {
    if (!user || !profile) return;
    if (!yearGroup) { setLoading(false); return; }

    (async () => {
      const [courses, programmes] = await Promise.all([
        getCurriculumModules(yearGroup),
        getProgrammes(),
      ]);
      setProgramme(programmes.find(p => p.status === 'active') ?? null);

      const result: ModuleTree[] = [];
      for (const course of courses) {
        let enrollment = await getEnrollment(user.uid, course.id);
        if (!enrollment) {
          // Auto-enroll into curriculum modules for the student's year group
          await enrollStudent(user.uid, course.id);
          enrollment = await getEnrollment(user.uid, course.id);
        }
        const [allUnits, attempts] = await Promise.all([
          getModulesWithLessons(course.id),
          getUnitQuizAttempts(user.uid, course.id),
        ]);
        const units = allUnits.map(u => ({
          module: u.module,
          lessons: u.lessons.filter(l => l.status === 'published'),
        })).filter(u => u.lessons.length > 0);
        result.push({
          course,
          units,
          enrollment,
          attempts,
          unitStatuses: getUnitStatuses(units, enrollment, attempts),
        });
      }
      setTrees(result);
      // Expand the first in-progress unit of each module by default
      setExpandedUnits(result.flatMap(t => {
        const active = t.unitStatuses.find(s => s.state === 'in_progress');
        return active ? [active.unitId] : [];
      }));
      setLoading(false);
    })();
  }, [user, profile, yearGroup]);

  /* ── Loading skeleton ── */
  if (loading) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-6 pt-10">
      <div className="h-10 w-48 bg-muted animate-pulse rounded-3xl" />
      <div className="h-48 bg-muted animate-pulse rounded-3xl" />
      <div className="h-48 bg-muted animate-pulse rounded-3xl" />
    </div>
  );

  /* ── No year group ── */
  if (!yearGroup) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12">
      <div className="relative flex flex-col items-center justify-center text-center py-24">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-72 h-72 rounded-full bg-primary/10 blur-[100px]" />
        </div>
        <GraduationCap className="w-12 h-12 mb-5 text-muted-foreground opacity-40 relative" />
        <h2 className="font-heading text-2xl text-foreground mb-2 relative">Set your year group</h2>
        <p className="text-sm text-muted-foreground mb-8 max-w-sm relative">
          Tell us which year you&apos;re in to see your curriculum — units, lessons and mastery quizzes for your level.
        </p>
        <Button onClick={() => router.push('/dashboard/profile')} className="rounded-full h-11 px-5 font-bold relative">
          Go to My Profile
        </Button>
      </div>
    </div>
  );

  const requiresUpgrade = programme?.requiredTier === 'academic' && tier !== 'academic';

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">
      {/* ── Page header ── */}
      <motion.header variants={fadeUp} initial="hidden" animate="visible" className="space-y-2 pt-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
          {programme?.name ?? 'Curriculum'} {yearGroup && `· ${yearGroup}`}
        </p>
        <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight">
          My <span className="gradient-text italic">Learning</span>
        </h1>
        <p className="text-muted-foreground text-sm max-w-xl">
          Work through each unit, then pass the mastery quiz (70%+) to unlock the next one.
        </p>
      </motion.header>

      {/* ── Subscription gate ── */}
      {requiresUpgrade && (
        <div className="relative">
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-3xl border border-border">
            <Sparkles className="w-8 h-8 text-primary mb-3" />
            <h3 className="font-heading text-xl text-foreground mb-1">Academic subscription required</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm px-4">
              The {programme?.name} curriculum — with all 11 learning formats, mastery quizzes and a monthly ⚡400 Sparks allowance — is part of the Academic plan.
            </p>
            <Button className="rounded-full h-11 px-5 font-bold bg-primary text-primary-foreground"
              onClick={() => router.push('/dashboard/helpdesk')}>
              Contact us to upgrade
            </Button>
          </div>
          <div className="space-y-4 opacity-60 pointer-events-none" aria-hidden>
            {trees.slice(0, 1).map(tree => (
              <div key={tree.course.id} className="bg-card border border-border rounded-3xl p-5 h-40" />
            ))}
            <div className="bg-card border border-border rounded-3xl p-5 h-40" />
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!requiresUpgrade && trees.length === 0 && (
        <div className="relative flex flex-col items-center justify-center text-center py-24">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-72 h-72 rounded-full bg-primary/10 blur-[100px]" />
          </div>
          <BookOpen className="w-10 h-10 mb-4 text-muted-foreground opacity-30 relative" />
          <h2 className="font-heading text-2xl text-foreground mb-1 relative">No curriculum published for {yearGroup} yet</h2>
          <p className="text-sm text-muted-foreground relative">Your school is preparing your subjects. Check back soon!</p>
        </div>
      )}

      {/* ── Module trees ── */}
      {!requiresUpgrade && trees.map((tree, ti) => {
        const SubjectIcon = SUBJECT_ICONS[tree.course.subject ?? ''] ?? BookOpen;
        const completedIds = new Set(tree.enrollment?.completedLessons ?? []);
        return (
          <motion.div key={tree.course.id}
            variants={fadeUp} initial="hidden" animate="visible" custom={ti}
            className="bg-card border border-border rounded-3xl overflow-hidden card-glow"
          >
            {/* Module header */}
            <div className="flex items-center gap-4 p-5 border-b border-border bg-muted/30">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <SubjectIcon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-heading text-xl text-foreground">{tree.course.title}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {tree.units.length} unit{tree.units.length === 1 ? '' : 's'} · {tree.enrollment?.progress ?? 0}% complete
                </p>
              </div>
            </div>

            {/* Units */}
            <div className="divide-y divide-border">
              {tree.units.map((unit, ui) => {
                const status = tree.unitStatuses[ui];
                const isExpanded = expandedUnits.includes(unit.module.id);
                const locked = status.state === 'locked';
                return (
                  <div key={unit.module.id}>
                    <button
                      className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${
                        locked ? 'opacity-50' : 'hover:bg-muted/40'
                      }`}
                      onClick={() => !locked && setExpandedUnits(prev =>
                        prev.includes(unit.module.id)
                          ? prev.filter(id => id !== unit.module.id)
                          : [...prev, unit.module.id]
                      )}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        status.state === 'passed' ? 'bg-emerald-500/10' :
                        status.state === 'in_progress' ? 'bg-primary/10' : 'bg-muted'
                      }`}>
                        {status.state === 'passed' && <Trophy className="w-4.5 h-4.5 text-emerald-500" />}
                        {status.state === 'in_progress' && <PlayCircle className="w-5 h-5 text-primary" />}
                        {locked && <Lock className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-foreground text-sm">{unit.module.title}</p>
                          {unit.module.term && (
                            <Badge variant="outline" className="text-[10px] rounded-full">{unit.module.term}</Badge>
                          )}
                          {status.bestQuizPercentage !== undefined && (
                            <Badge className={`text-[10px] rounded-full ${
                              status.state === 'passed'
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            }`}>
                              Quiz best: {status.bestQuizPercentage}%
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {locked
                            ? `Pass the previous unit's mastery quiz (≥${unit.module.masteryThreshold ?? 70}%) to unlock`
                            : `${status.completedLessons}/${status.totalLessons} lessons complete`}
                        </p>
                      </div>
                      {!locked && (isExpanded
                        ? <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
                        : <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />)}
                    </button>

                    {isExpanded && !locked && (
                      <div className="border-t border-border divide-y divide-border bg-muted/20">
                        {unit.lessons.map(lesson => {
                          const lessonStatus = getCurriculumLessonStatus(lesson, unit.lessons, status.state, completedIds);
                          return (
                            <button
                              key={lesson.id}
                              disabled={lessonStatus === 'locked'}
                              onClick={() => router.push(`/dashboard/student/courses/${tree.course.id}/lessons/${lesson.id}`)}
                              className={`w-full flex items-center gap-4 pl-10 pr-5 py-3.5 text-left transition-colors ${
                                lessonStatus === 'locked' ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted/50'
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                lessonStatus === 'completed' ? 'bg-emerald-500/10' :
                                lessonStatus === 'available' ? 'bg-primary/10' : 'bg-muted'
                              }`}>
                                {lessonStatus === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                                {lessonStatus === 'available' && (lesson.isUnitQuiz
                                  ? <Trophy className="w-4 h-4 text-primary" />
                                  : <PlayCircle className="w-4 h-4 text-primary" />)}
                                {lessonStatus === 'locked' && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground text-sm truncate">
                                  {lesson.lessonNumber ? `L${lesson.lessonNumber} · ` : ''}{lesson.title}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {lesson.isUnitQuiz
                                    ? `Mastery quiz · pass at ${unit.module.masteryThreshold ?? 70}% to unlock the next unit`
                                    : lessonStatus === 'completed' ? '✓ Completed'
                                    : lessonStatus === 'available' ? 'Start lesson · +50 XP · ⚡10'
                                    : lesson.isUnitQuiz ? 'Complete all lessons first' : 'Complete the previous lesson to unlock'}
                                </p>
                              </div>
                              {lessonStatus !== 'locked' && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {tree.units.length === 0 && (
                <p className="px-5 py-6 text-sm text-muted-foreground">Units for this subject are being prepared.</p>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
