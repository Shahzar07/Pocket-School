'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  BookOpen, Brain, CheckCircle2, FileText, Download, Loader2, ArrowLeft,
  Clock, Layers, GraduationCap, BarChart3, Users, Globe, Sparkles, Smartphone,
  Infinity as InfinityIcon, ShieldCheck, CalendarDays, Award,
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import {
  getPublicCourseById, getModulesWithLessons, enrollStudent, incrementEnrollment,
  createInvoice, getUser, getEnrollment,
  type Course, type UserProfile,
} from '@/lib/db';
import {
  CourseCurriculum, formatDuration, totalMinutes, lessonCount,
  type CurriculumUnit,
} from '@/components/course-curriculum';
import { courseCover } from '@/lib/course-cover';
import { toast } from 'sonner';

function priceLabel(c: Course) {
  if (!c.price || c.price === 0) return 'Free';
  const symbol = c.currency === 'USD' ? '$' : c.currency === 'EUR' ? '€' : '£';
  return `${symbol}${c.price.toFixed(2)}`;
}

/** Sections the in-page nav jumps to. Rendered only when they have content. */
const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'curriculum', label: 'Course content' },
  { id: 'resources', label: 'Resources' },
  { id: 'certification', label: 'Certification' },
  { id: 'instructor', label: 'Instructor' },
] as const;

function ResourceCard({
  icon: Icon, title, note, href, action,
}: { icon: typeof FileText; title: string; note: string; href?: string; action: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3.5">
      <span className="w-10 h-10 rounded-xl bg-muted grid place-items-center shrink-0">
        <Icon className="w-4.5 h-4.5 text-teal-600" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{note}</p>
      </div>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer">
          <Button size="sm" variant="outline" className="rounded-full h-8 text-xs">{action}</Button>
        </a>
      ) : (
        <Button size="sm" variant="outline" className="rounded-full h-8 text-xs" disabled>{action}</Button>
      )}
    </div>
  );
}

function StatTile({ icon: Icon, value, label }: { icon: typeof Clock; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3">
      <Icon className="w-4 h-4 shrink-0 text-teal-600" />
      <div className="min-w-0">
        <p className="text-sm font-bold text-foreground leading-tight truncate">{value}</p>
        <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
      </div>
    </div>
  );
}

export default function CourseDetailPage() {
  const params = useParams<{ courseId: string }>();
  const courseId = params?.courseId;
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [units, setUnits] = useState<CurriculumUnit[]>([]);
  const [enrolled, setEnrolled] = useState(false);

  const load = async () => {
    if (!courseId) return;
    setLoading(true);
    setError(null);
    try {
      const c = await getPublicCourseById(courseId);
      setCourse(c);
      // The chapter breakdown is the part a learner actually reads before
      // enrolling, but it needs a signed-in read. Failing to load it must not
      // take the whole page down, so it is fetched best-effort.
      const mods = await getModulesWithLessons(courseId).catch(() => []);
      setUnits(mods);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // Someone already enrolled should see "Continue learning", not "Buy now".
  useEffect(() => {
    if (!user || !courseId) { setEnrolled(false); return; }
    let live = true;
    getEnrollment(user.uid, courseId)
      .then(e => { if (live) setEnrolled(Boolean(e)); })
      .catch(() => { /* not enrolled, or no permission to check */ });
    return () => { live = false; };
  }, [user, courseId]);

  const isFree = !course?.price || course.price === 0;

  // Only student accounts may enrol; returns the profile on success, null otherwise.
  const getStudentProfile = async (): Promise<UserProfile | null> => {
    if (!user) return null;
    const prof = await getUser(user.uid);
    if (!prof || prof.role !== 'student') {
      toast.error('Only student accounts can enrol in courses.');
      return null;
    }
    return prof;
  };

  const enrolFree = async () => {
    if (!course) return;
    if (!user) {
      router.push(`/login?next=/courses/${course.id}`);
      return;
    }
    try {
      setEnrolling(true);
      const prof = await getStudentProfile();
      if (!prof) return;
      await enrollStudent(user.uid, course.id);
      await incrementEnrollment(course.id);
      toast.success(`Enrolled in ${course.title}.`);
      router.push(`/dashboard/student/courses/${course.id}`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to enrol.');
    } finally {
      setEnrolling(false);
    }
  };

  const buyPaid = () => {
    if (!course) return;
    if (!user) {
      router.push(`/login?next=/courses/${course.id}`);
      return;
    }
    setConfirmOpen(true);
  };

  const confirmPaidEnrol = async () => {
    if (!course || !user) return;
    try {
      setEnrolling(true);
      const prof = await getStudentProfile();
      if (!prof) { setConfirmOpen(false); return; }
      await enrollStudent(user.uid, course.id);
      await incrementEnrollment(course.id);
      // Best-effort invoice: security rules may reserve invoice creation for
      // teachers/admins, in which case the school issues it instead.
      let invoiced = false;
      try {
        await createInvoice({
          studentId: user.uid,
          studentName: prof.name ?? user.displayName ?? 'Student',
          courseId: course.id,
          description: `Course purchase: ${course.title}`,
          amount: course.price ?? 0,
          currency: course.currency ?? 'GBP',
          status: 'sent',
          dueDate: Timestamp.fromDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)),
          createdBy: user.uid,
        });
        invoiced = true;
      } catch { /* fall through to school-issued invoice message */ }
      toast.success(invoiced
        ? `Enrolled in ${course.title} — an invoice was added to your school account.`
        : `Enrolled in ${course.title} — an invoice will be issued by the school.`);
      setConfirmOpen(false);
      router.push(`/dashboard/student/courses/${course.id}`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to enrol.');
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <span className="text-[15px] font-bold tracking-tight">Poket School</span>
          </Link>
          <Link href="/courses" className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to marketplace
          </Link>
        </div>
      </header>

      {loading && (
        <div className="text-center py-32">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
        </div>
      )}

      {!loading && error && (
        <div className="py-32 px-4 flex justify-center">
          <div className="bg-card border border-border rounded-2xl p-8 text-center max-w-md w-full">
            <p className="font-bold text-xl text-foreground mb-2">Couldn&apos;t load this page.</p>
            <p className="text-sm text-muted-foreground mb-6 break-words">{error}</p>
            <Button onClick={load} className="rounded-full h-11 px-6 font-semibold">Retry</Button>
          </div>
        </div>
      )}

      {!loading && !error && !course && (
        <div className="text-center py-32">
          <p className="text-muted-foreground mb-4">Product not found or not publicly listed.</p>
          <Button variant="outline" onClick={() => router.push('/courses')}>Browse marketplace</Button>
        </div>
      )}

      {course && (
        <>
          {(() => {
            const mins = totalMinutes(units);
            const lessons = lessonCount(units);
            const hours = mins > 0 ? mins / 60 : (course.durationHours ?? 0);
            const learn = course.whatYouLearn ?? [];
            const hasResources = Boolean(course.workbookUrl || course.sowDocUrl || course.previewUrl);
            const updated = course.updatedAt?.toDate?.();

            /* What the purchase card lists, built from what the course really
               has rather than a hardcoded marketing list. */
            const includes: { icon: typeof Clock; text: string }[] = [
              ...(hours > 0 ? [{ icon: Clock, text: `${formatDuration(Math.round(hours * 60))} of teaching content` }] : []),
              ...(lessons > 0 ? [{ icon: BookOpen, text: `${lessons} lessons across ${units.length} chapters` }] : []),
              { icon: Sparkles, text: 'AI study kit: notes, flashcards, quizzes and audio' },
              ...(course.workbookUrl ? [{ icon: Download, text: 'Downloadable workbook PDF' }] : []),
              { icon: Smartphone, text: 'Learn on mobile and desktop' },
              { icon: InfinityIcon, text: 'Lifetime access to everything inside' },
              { icon: Award, text: 'Certificate of completion' },
            ];

            const cta = enrolled ? (
              <Button
                onClick={() => router.push(`/dashboard/student/courses/${course.id}`)}
                className="w-full h-12 rounded-full bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-semibold"
              >
                Continue learning
              </Button>
            ) : isFree ? (
              <Button
                onClick={enrolFree}
                disabled={enrolling}
                className="w-full h-12 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold"
              >
                {enrolling ? 'Enrolling…' : user ? 'Enrol for free' : 'Sign in to enrol'}
              </Button>
            ) : (
              <Button
                onClick={buyPaid}
                disabled={enrolling}
                className="w-full h-12 rounded-full bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold"
              >
                {enrolling ? 'Enrolling…' : user ? `Buy now — ${priceLabel(course)}` : 'Sign in to buy'}
              </Button>
            );

            return (
              <>
                {/* ── Hero ── */}
                <section className="bg-gradient-to-b from-slate-900 to-slate-800 text-white">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14 grid lg:grid-cols-[1.5fr_minmax(0,380px)] gap-10">
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                      <nav className="flex flex-wrap items-center gap-1.5 text-xs text-white/60 mb-4">
                        <Link href="/courses" className="hover:text-white">Marketplace</Link>
                        {course.category && <><span>/</span><span>{course.category}</span></>}
                        {course.subject && <><span>/</span><span className="text-white/80">{course.subject}</span></>}
                      </nav>

                      <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold tracking-tight leading-[1.1] mb-4">
                        {course.title}
                      </h1>
                      <p className="text-base sm:text-lg text-white/75 leading-relaxed mb-5 max-w-2xl">
                        {course.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 mb-5">
                        <Badge className="rounded-full bg-white/10 text-white border-white/20 text-xs font-semibold uppercase tracking-wide">
                          {course.type ?? 'course'}
                        </Badge>
                        {course.level && (
                          <Badge className="rounded-full bg-white/10 text-white border-white/20 text-xs font-semibold">
                            {course.level}
                          </Badge>
                        )}
                        {course.yearGroup && (
                          <Badge className="rounded-full bg-white/10 text-white border-white/20 text-xs font-semibold">
                            {course.yearGroup}
                          </Badge>
                        )}
                        {course.category && (
                          <Badge className="rounded-full bg-amber-400/15 text-amber-200 border-amber-300/30 text-xs font-semibold">
                            {course.category}
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/70">
                        <span className="flex items-center gap-1.5">
                          <GraduationCap className="w-4 h-4" />
                          Created by <span className="font-semibold text-white">{course.ownerName ?? 'Poket School'}</span>
                        </span>
                        {course.enrollmentCount ? (
                          <span className="flex items-center gap-1.5">
                            <Users className="w-4 h-4" /> {course.enrollmentCount} enrolled
                          </span>
                        ) : null}
                        {updated && (
                          <span className="flex items-center gap-1.5">
                            <CalendarDays className="w-4 h-4" />
                            Updated {updated.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5">
                          <Globe className="w-4 h-4" /> English
                        </span>
                      </div>
                    </motion.div>

                    {/* Purchase card — overlaps the hero on desktop, the way a
                        course listing puts price and CTA above the fold. */}
                    <motion.div
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
                      className="hidden lg:block lg:sticky lg:top-20 h-fit lg:-mb-24 z-10"
                    >
                      <Card className="p-5 border-2 shadow-2xl bg-card">
                        <div className="aspect-video rounded-xl mb-5 overflow-hidden bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={course.thumbnailUrl || courseCover(course.title, course.subject ?? '')}
                            alt={course.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <p className="text-4xl font-extrabold tracking-tight mb-4">{priceLabel(course)}</p>
                        {cta}
                        {course.previewUrl && (
                          <a href={course.previewUrl} target="_blank" rel="noreferrer" className="block mt-3">
                            <Button variant="outline" className="w-full h-11 rounded-full">Watch free preview</Button>
                          </a>
                        )}
                        <p className="text-center text-xs text-muted-foreground mt-3">
                          {isFree ? 'No card required.' : 'Invoiced to your school account.'}
                        </p>
                        <div className="mt-5 pt-4 border-t border-border">
                          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2.5">
                            This course includes
                          </p>
                          <ul className="space-y-2 text-sm text-muted-foreground">
                            {includes.map((it, i) => (
                              <li key={i} className="flex items-start gap-2.5">
                                <it.icon className="w-4 h-4 mt-0.5 shrink-0 text-teal-600" />
                                <span>{it.text}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </Card>
                    </motion.div>
                  </div>
                </section>

                {/* ── Section nav ── */}
                <nav className="sticky top-16 z-30 border-b border-border bg-card/95 backdrop-blur">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto">
                    {SECTIONS.map(sec => {
                      if (sec.id === 'resources' && !hasResources) return null;
                      if (sec.id === 'curriculum' && units.length === 0) return null;
                      return (
                        <a
                          key={sec.id}
                          href={`#${sec.id}`}
                          className="shrink-0 px-4 py-3.5 text-sm font-semibold text-muted-foreground hover:text-foreground border-b-2 border-transparent hover:border-teal-500 transition-colors"
                        >
                          {sec.label}
                        </a>
                      );
                    })}
                  </div>
                </nav>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-[1.5fr_minmax(0,380px)] gap-10 pb-24">
                  <div className="min-w-0 pt-10 space-y-12">

                    {/* At a glance */}
                    <section id="overview" className="scroll-mt-32">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                        <StatTile icon={Clock} value={hours > 0 ? formatDuration(Math.round(hours * 60)) : '—'} label="Total length" />
                        <StatTile icon={BookOpen} value={lessons > 0 ? String(lessons) : '—'} label="Lessons" />
                        <StatTile icon={Layers} value={units.length > 0 ? String(units.length) : '—'} label="Chapters" />
                        <StatTile icon={BarChart3} value={course.level ?? course.yearGroup ?? 'All levels'} label="Level" />
                      </div>

                      {learn.length > 0 && (
                        <div className="rounded-2xl border border-border bg-card p-6">
                          <h2 className="text-xl font-bold mb-4">What you&apos;ll learn</h2>
                          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
                            {learn.map((item, i) => (
                              <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed">
                                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </section>

                    {/* Course content */}
                    {units.length > 0 && (
                      <section id="curriculum" className="scroll-mt-32">
                        <h2 className="text-xl font-bold mb-4">Course content</h2>
                        <CourseCurriculum units={units} courseId={course.id} enrolled={enrolled} />
                        {!enrolled && (
                          <p className="mt-3 text-xs text-muted-foreground">
                            Lessons unlock as soon as you enrol. The first lesson is free to preview.
                          </p>
                        )}
                      </section>
                    )}

                    {/* Requirements */}
                    {course.requirements && course.requirements.length > 0 && (
                      <section className="scroll-mt-32">
                        <h2 className="text-xl font-bold mb-4">Requirements</h2>
                        <ul className="space-y-2 text-sm">
                          {course.requirements.map((r, i) => (
                            <li key={i} className="flex items-start gap-2.5">
                              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                              {r}
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {/* Resources */}
                    {hasResources && (
                      <section id="resources" className="scroll-mt-32">
                        <h2 className="text-xl font-bold mb-4">Resources</h2>
                        <div className="grid sm:grid-cols-2 gap-3">
                          {course.workbookUrl && (
                            <ResourceCard
                              icon={FileText}
                              title="Workbook PDF"
                              note={user ? 'Ready to download' : 'Sign in to download'}
                              href={user ? course.workbookUrl : undefined}
                              action="Download"
                            />
                          )}
                          {course.sowDocUrl && (
                            <ResourceCard
                              icon={Layers}
                              title="Scheme of work"
                              note="Chapter-by-chapter teaching plan"
                              href={user ? course.sowDocUrl : undefined}
                              action="Open"
                            />
                          )}
                          {course.previewUrl && (
                            <ResourceCard
                              icon={BookOpen}
                              title="Free preview"
                              note="Sample the teaching style before enrolling"
                              href={course.previewUrl}
                              action="Watch"
                            />
                          )}
                        </div>
                      </section>
                    )}

                    {/* Certification */}
                    <section id="certification" className="scroll-mt-32">
                      <h2 className="text-xl font-bold mb-4">Certification</h2>
                      <div className="rounded-2xl border border-border bg-gradient-to-br from-amber-50 to-background p-6 flex flex-col sm:flex-row gap-5">
                        <span className="w-12 h-12 rounded-2xl bg-amber-100 grid place-items-center shrink-0">
                          <Award className="w-6 h-6 text-amber-600" />
                        </span>
                        <div className="min-w-0 space-y-3">
                          <div>
                            <p className="font-bold text-foreground">Certificate of completion</p>
                            <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                              Finish every lesson and pass each chapter&apos;s mastery quiz to earn a
                              verifiable certificate, issued to your Poket School transcript.
                            </p>
                          </div>
                          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-muted-foreground">
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Every lesson completed
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Chapter quizzes passed
                            </li>
                            <li className="flex items-center gap-2">
                              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" /> Publicly verifiable link
                            </li>
                            <li className="flex items-center gap-2">
                              <BarChart3 className="w-4 h-4 text-emerald-500 shrink-0" /> Added to your transcript
                            </li>
                          </ul>
                        </div>
                      </div>
                    </section>

                    {/* Instructor */}
                    <section id="instructor" className="scroll-mt-32">
                      <h2 className="text-xl font-bold mb-4">Your instructor</h2>
                      <div className="rounded-2xl border border-border bg-card p-6 flex gap-4">
                        <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white grid place-items-center text-lg font-bold shrink-0">
                          {(course.ownerName ?? 'Poket School').slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-foreground">{course.ownerName ?? 'Poket School'}</p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {course.subject ? `${course.subject} educator` : 'Educator'}
                            {course.enrollmentCount ? ` · ${course.enrollmentCount} learners enrolled` : ''}
                          </p>
                          <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                            Every lesson here is supported by Ayla for one-to-one tutoring and ET for
                            study materials, so you are never stuck on a concept on your own.
                          </p>
                        </div>
                      </div>
                    </section>
                  </div>

                  {/* Spacer so the sticky purchase card has a column on desktop. */}
                  <div className="hidden lg:block" />
                </div>

                {/* Mobile purchase bar */}
                <div className="lg:hidden sticky bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0">
                      <p className="text-xl font-extrabold leading-none">{priceLabel(course)}</p>
                      {hours > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {formatDuration(Math.round(hours * 60))} · {lessons} lessons
                        </p>
                      )}
                    </div>
                    <div className="flex-1">{cta}</div>
                  </div>
                </div>
              </>
            );
          })()}

          {/* Paid enrolment confirmation */}
          <Dialog open={confirmOpen} onOpenChange={open => !enrolling && setConfirmOpen(open)}>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle>Confirm enrolment</DialogTitle>
                <DialogDescription>
                  This is a paid course ({priceLabel(course)}). Your school account
                  will be invoiced — no card payment is taken now.
                </DialogDescription>
              </DialogHeader>
              <div className="bg-muted/50 border border-border rounded-xl p-4 text-sm space-y-1">
                <p className="font-semibold text-foreground">{course.title}</p>
                <p className="text-muted-foreground">Price: {priceLabel(course)}</p>
              </div>
              <DialogFooter>
                <Button variant="outline" className="rounded-full h-11 px-5" disabled={enrolling} onClick={() => setConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={confirmPaidEnrol}
                  disabled={enrolling}
                  className="rounded-full h-11 px-5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-semibold"
                >
                  {enrolling ? 'Enrolling…' : 'Confirm & enrol'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
