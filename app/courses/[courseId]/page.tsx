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
  Star, Users, Globe, Clock, PlayCircle, Lock, ChevronDown, Award, Infinity as InfinityIcon,
  Smartphone, BarChart3, ShieldCheck,
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import {
  getPublicCourseById, enrollStudent, incrementEnrollment, createInvoice, getUser,
  getPublicCurriculum, redeemCouponCode, getCouponPermissions,
  type Course, type UserProfile, type Module, type Lesson,
} from '@/lib/db';
import { coursePriceType, freePreviewCount, isLessonFree, courseMinTier, tierDefinition } from '@/lib/entitlements';
import { courseCover } from '@/lib/course-cover';
import { toast } from 'sonner';

function priceLabel(c: Course) {
  if (!c.price || c.price === 0) return 'Free';
  const symbol = c.currency === 'USD' ? '$' : c.currency === 'EUR' ? '€' : '£';
  return `${symbol}${c.price.toFixed(2)}`;
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
  const [curriculum, setCurriculum] = useState<{ module: Module; lessons: Lesson[]; lessonsHidden: boolean }[]>([]);
  const [openChapters, setOpenChapters] = useState<Set<string>>(new Set());
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  /** Coupon grants held by the signed-in user, for this course. */
  const [couponGranted, setCouponGranted] = useState(false);

  const load = async () => {
    if (!courseId) return;
    setLoading(true);
    setError(null);
    try {
      const c = await getPublicCourseById(courseId);
      setCourse(c);
      // Curriculum is supporting detail — never let it break the page.
      getPublicCurriculum(courseId)
        .then(cur => {
          setCurriculum(cur);
          // Open the first chapter so the page never looks empty.
          if (cur[0]) setOpenChapters(new Set([cur[0].module.id]));
        })
        .catch(() => setCurriculum([]));
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

  // Does this person already hold a live coupon for this course?
  useEffect(() => {
    if (!user || !courseId) { setCouponGranted(false); return; }
    let cancelled = false;
    getCouponPermissions(user.uid)
      .then(perms => {
        if (!cancelled) setCouponGranted(perms.some(p => p.startsWith(`alloc:coupon:${courseId}:`)));
      })
      .catch(() => { if (!cancelled) setCouponGranted(false); });
    return () => { cancelled = true; };
  }, [user, courseId]);

  const redeem = async () => {
    if (!user) { router.push(`/login?next=/courses/${courseId}`); return; }
    const code = couponCode.trim();
    if (!code) return;
    setRedeeming(true);
    try {
      const r = await redeemCouponCode(user.uid, code);
      if (r.courseId !== courseId) {
        toast.error('That code is for a different course.');
      } else if (r.grantedAccess) {
        setCouponGranted(true);
        setCouponOpen(false);
        setCouponCode('');
        toast.success(`Code applied — free access until ${r.expiresAt}.`);
      } else {
        toast.success(`${r.discountPct}% discount applied at checkout.`);
        setCouponOpen(false);
      }
    } catch (e: any) {
      toast.error(e?.message || 'That code could not be redeemed.');
    } finally {
      setRedeeming(false);
    }
  };

  const isFree = !course?.price || course.price === 0;

  const totalLessons = curriculum.reduce((n, c) => n + c.lessons.length, 0);
  const priceType = course ? coursePriceType(course) : 'FREE';
  // MAX_SAFE_INTEGER means "the whole course is free" — don't advertise that
  // as a preview count.
  const rawPreview = course ? freePreviewCount(course) : 0;
  const previewCount = rawPreview === Number.MAX_SAFE_INTEGER ? 0 : rawPreview;
  const tierLabel = course && courseMinTier(course) > 0 && priceType === 'SUBSCRIPTION_INCLUDED'
    ? tierDefinition(courseMinTier(course)).name
    : '';

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
          {/* ── Hero: dark band, sticky buy card overlaps it ── */}
          <section className="relative bg-[#0f1117] text-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
              <div className="lg:max-w-[62%]">
                <nav className="flex items-center gap-2 text-xs text-white/50 mb-4">
                  <Link href="/courses" className="hover:text-white">Marketplace</Link>
                  {course.category && <><span>›</span><span>{course.category}</span></>}
                  {course.subject && <><span>›</span><span className="text-white/70">{course.subject}</span></>}
                </nav>

                <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold leading-[1.15] tracking-tight mb-4">
                  {course.title}
                </h1>
                {course.description && (
                  <p className="text-base sm:text-lg text-white/70 leading-relaxed mb-5 line-clamp-3">
                    {course.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm mb-4">
                  <span className="inline-flex items-center gap-1.5 text-amber-300 font-bold">
                    {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-3.5 h-3.5 fill-amber-300" />)}
                    <span className="ml-1 text-white/80 font-medium">New course</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-white/70">
                    <Users className="w-4 h-4" />
                    {(course.enrollmentCount ?? 0).toLocaleString()} enrolled
                  </span>
                  {totalLessons > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-white/70">
                      <BookOpen className="w-4 h-4" /> {totalLessons} lessons
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/60">
                  <span className="inline-flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5" /> Created by{' '}
                    <span className="text-white/90 font-semibold underline underline-offset-2">
                      {course.ownerName || 'Poket School'}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> English</span>
                  {course.level && (
                    <span className="inline-flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> {course.level}</span>
                  )}
                  {tierLabel && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/10 text-white/80 font-semibold">
                      {tierLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ── Body: content left, sticky purchase card right ── */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 relative">
            <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-10 lg:items-start">

              {/* Left column */}
              <div className="py-10 space-y-10 min-w-0">

                {/* What you'll learn */}
                {course.whatYouLearn && course.whatYouLearn.length > 0 && (
                  <section className="border border-border rounded-xl p-6">
                    <h2 className="text-xl font-bold mb-4">What you&apos;ll learn</h2>
                    <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
                      {course.whatYouLearn.map((item, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span className="text-sm text-foreground/85 leading-relaxed">{item}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Course content — the accordion */}
                <section>
                  <h2 className="text-xl font-bold mb-2">Course content</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    {curriculum.length} chapter{curriculum.length === 1 ? '' : 's'}
                    {totalLessons > 0 && <> · {totalLessons} lesson{totalLessons === 1 ? '' : 's'}</>}
                    {previewCount > 0 && previewCount !== Number.MAX_SAFE_INTEGER && (
                      <> · <span className="text-emerald-600 font-semibold">
                        first {previewCount} lesson{previewCount === 1 ? '' : 's'} free
                      </span></>
                    )}
                  </p>

                  {curriculum.length === 0 ? (
                    <div className="border border-border rounded-xl p-8 text-center">
                      <BookOpen className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        The curriculum for this course is being finalised.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
                      {curriculum.map((ch, ci) => {
                        const open = openChapters.has(ch.module.id);
                        return (
                          <div key={ch.module.id}>
                            <button
                              onClick={() => setOpenChapters(prev => {
                                const next = new Set(prev);
                                next.has(ch.module.id) ? next.delete(ch.module.id) : next.add(ch.module.id);
                                return next;
                              })}
                              aria-expanded={open}
                              className="w-full flex items-center gap-3 px-4 sm:px-5 py-4 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
                            >
                              <ChevronDown className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${open ? '' : '-rotate-90'}`} />
                              <span className="font-bold text-sm flex-1 min-w-0 truncate">
                                {ch.module.title}
                              </span>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {ch.lessonsHidden
                                  ? 'Sign in to view'
                                  : `${ch.lessons.length} lesson${ch.lessons.length === 1 ? '' : 's'}`}
                              </span>
                            </button>

                            {open && (
                              <div className="bg-card">
                                {ch.lessonsHidden ? (
                                  <div className="px-5 py-4 flex items-center gap-2.5 text-sm text-muted-foreground">
                                    <Lock className="w-4 h-4 shrink-0" />
                                    <span>
                                      <Link href={`/login?next=/courses/${course.id}`} className="font-semibold text-foreground underline">
                                        Sign in
                                      </Link>{' '}
                                      to see the lessons in this chapter.
                                    </span>
                                  </div>
                                ) : ch.lessons.length === 0 ? (
                                  <p className="px-5 py-4 text-sm text-muted-foreground">No lessons yet.</p>
                                ) : ch.lessons.map((l, li) => {
                                  // Free-preview window runs across the whole course, not per chapter.
                                  const absoluteIndex = curriculum
                                    .slice(0, ci)
                                    .reduce((n, c) => n + c.lessons.length, 0) + li;
                                  const free = isLessonFree(course, absoluteIndex);
                                  return (
                                    <div key={l.id} className="flex items-center gap-3 px-5 py-3 border-t border-border/60">
                                      {free
                                        ? <PlayCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                                        : <Lock className="w-4 h-4 text-muted-foreground/60 shrink-0" />}
                                      <span className="text-sm flex-1 min-w-0 truncate text-foreground/85">{l.title}</span>
                                      {free && (
                                        <span className="text-[11px] font-bold text-emerald-600 shrink-0">Preview</span>
                                      )}
                                      {l.durationMinutes ? (
                                        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                                          {l.durationMinutes}m
                                        </span>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Requirements */}
                {course.requirements && course.requirements.length > 0 && (
                  <section>
                    <h2 className="text-xl font-bold mb-4">Requirements</h2>
                    <ul className="space-y-2">
                      {course.requirements.map((r, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/85">
                          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-foreground/50 shrink-0" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Description */}
                {course.description && (
                  <section>
                    <h2 className="text-xl font-bold mb-4">Description</h2>
                    <p className="text-sm sm:text-[15px] text-foreground/80 leading-[1.75] whitespace-pre-line">
                      {course.description}
                    </p>
                  </section>
                )}

                {/* Instructor */}
                <section>
                  <h2 className="text-xl font-bold mb-4">Instructor</h2>
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shrink-0">
                      {(course.ownerName || 'P').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold underline underline-offset-2">{course.ownerName || 'Poket School'}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {course.subject ? `${course.subject} educator` : 'Educator'}
                      </p>
                      <p className="text-sm text-foreground/75 mt-3 leading-relaxed">
                        Courses on Poket School are built with Quill, our AI curriculum architect, and reviewed
                        by the educator who publishes them.
                      </p>
                    </div>
                  </div>
                </section>
              </div>

              {/* Right column — sticky purchase card, pulled up over the hero */}
              <aside className="lg:sticky lg:top-20 lg:-mt-56 pb-10">
                <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
                  <div className="aspect-video relative bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={course.thumbnailUrl || courseCover(course.title, course.subject ?? '')}
                      alt={course.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="p-6">
                    <p className="text-3xl font-extrabold tracking-tight mb-1">{priceLabel(course)}</p>
                    <p className="text-xs text-muted-foreground mb-5">
                      {priceType === 'SUBSCRIPTION_INCLUDED'
                        ? 'Included in your subscription'
                        : priceType === 'MARKETPLACE_PURCHASE'
                          ? 'One-time purchase · lifetime access'
                          : 'No card required'}
                    </p>

                    {isFree ? (
                      <Button
                        onClick={enrolFree}
                        disabled={enrolling}
                        className="w-full h-12 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold"
                      >
                        {enrolling ? 'Enrolling…' : user ? 'Enrol for free' : 'Sign in to enrol'}
                      </Button>
                    ) : (
                      <Button
                        onClick={buyPaid}
                        disabled={enrolling}
                        className="w-full h-12 rounded-lg font-bold"
                      >
                        {enrolling ? 'Processing…' : user ? 'Buy this course' : 'Sign in to buy'}
                      </Button>
                    )}

                    <p className="text-[11px] text-center text-muted-foreground mt-3">
                      30-day money-back guarantee
                    </p>

                    {/* Coupon / scholarship code */}
                    {couponGranted ? (
                      <p className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg py-2.5">
                        <CheckCircle2 className="w-4 h-4" /> A scholarship code is applied to this course
                      </p>
                    ) : couponOpen ? (
                      <div className="mt-4 space-y-2">
                        <input
                          value={couponCode}
                          onChange={e => setCouponCode(e.target.value.toUpperCase())}
                          onKeyDown={e => e.key === 'Enter' && redeem()}
                          placeholder="Enter code"
                          aria-label="Coupon or scholarship code"
                          className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm font-mono tracking-wider uppercase"
                        />
                        <div className="flex gap-2">
                          <Button onClick={redeem} disabled={redeeming || !couponCode.trim()} className="flex-1 h-10 rounded-lg font-bold">
                            {redeeming ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                          </Button>
                          <Button variant="ghost" onClick={() => setCouponOpen(false)} className="h-10 rounded-lg">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setCouponOpen(true)}
                        className="mt-4 w-full text-xs font-semibold text-muted-foreground hover:text-foreground underline underline-offset-4"
                      >
                        Have a coupon or scholarship code?
                      </button>
                    )}

                    <div className="mt-6 pt-5 border-t border-border">
                      <p className="text-xs font-bold uppercase tracking-wider mb-3">This course includes</p>
                      <ul className="space-y-2.5 text-sm text-foreground/80">
                        {totalLessons > 0 && (
                          <li className="flex items-center gap-2.5">
                            <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                            {totalLessons} lessons across {curriculum.length} chapter{curriculum.length === 1 ? '' : 's'}
                          </li>
                        )}
                        {course.durationHours ? (
                          <li className="flex items-center gap-2.5">
                            <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                            {course.durationHours} hours of content
                          </li>
                        ) : null}
                        <li className="flex items-center gap-2.5">
                          <Brain className="w-4 h-4 text-muted-foreground shrink-0" />
                          AI study kit: notes, flashcards, quizzes, audio
                        </li>
                        <li className="flex items-center gap-2.5">
                          <Smartphone className="w-4 h-4 text-muted-foreground shrink-0" />
                          Learn on mobile and desktop
                        </li>
                        <li className="flex items-center gap-2.5">
                          <InfinityIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                          Lifetime access
                        </li>
                        <li className="flex items-center gap-2.5">
                          <ShieldCheck className="w-4 h-4 text-muted-foreground shrink-0" />
                          Certificate on completion
                        </li>
                      </ul>
                    </div>

                    {course.workbookUrl && (
                      <a
                        href={course.workbookUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-5 flex items-center justify-center gap-2 text-sm font-semibold text-foreground border border-border rounded-lg h-11 hover:bg-muted transition-colors"
                      >
                        <Download className="w-4 h-4" /> Download workbook
                      </a>
                    )}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </>
      )}

      {course && (
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
      )}
    </div>
  );
}
