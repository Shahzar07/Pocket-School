'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { BookOpen, Brain, CheckCircle2, FileText, Download, Loader2, ArrowLeft } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getPublicCourseById, enrollStudent, incrementEnrollment, type Course } from '@/lib/db';
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
  const [user, setUser] = useState<User | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    if (!courseId) return;
    (async () => {
      const c = await getPublicCourseById(courseId);
      setCourse(c);
      setLoading(false);
    })();
  }, [courseId]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  const isFree = !course?.price || course.price === 0;

  const enrolFree = async () => {
    if (!course) return;
    if (!user) {
      router.push(`/login?next=/courses/${course.id}`);
      return;
    }
    try {
      setEnrolling(true);
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
    router.push(`/courses/${course.id}/checkout`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <span className="text-[15px] font-bold tracking-tight">Pocket School</span>
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

      {!loading && !course && (
        <div className="text-center py-32">
          <p className="text-muted-foreground mb-4">Product not found or not publicly listed.</p>
          <Button variant="outline" onClick={() => router.push('/courses')}>Browse marketplace</Button>
        </div>
      )}

      {course && (
        <>
          <section className="py-12 sm:py-16 bg-gradient-to-b from-blue-50 via-background to-background">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-[1.4fr_1fr] gap-10">
              {/* Left — hero text */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <div className="flex items-center gap-2 mb-4">
                  <Badge className="rounded-full bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold uppercase">
                    {course.type ?? 'course'}
                  </Badge>
                  {course.level && (
                    <Badge className="rounded-full bg-muted text-foreground border-border text-xs font-semibold">
                      {course.level}
                    </Badge>
                  )}
                  {course.category && (
                    <Badge className="rounded-full bg-amber-50 text-amber-700 border-amber-200 text-xs font-semibold">
                      {course.category}
                    </Badge>
                  )}
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground mb-4">
                  {course.title}
                </h1>
                <p className="text-base text-muted-foreground leading-relaxed mb-6">{course.description}</p>
                <p className="text-sm text-muted-foreground">
                  Created by <span className="font-semibold text-foreground">{course.ownerName ?? 'Pocket School'}</span>
                  {course.durationHours ? ` · ${course.durationHours} hours of content` : ''}
                  {course.enrollmentCount ? ` · ${course.enrollmentCount} enrolled` : ''}
                </p>
              </motion.div>

              {/* Right — sticky buy card */}
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
                className="lg:sticky lg:top-24 h-fit"
              >
                <Card className="p-6 border-2 shadow-lg">
                  <div className="aspect-video bg-gradient-to-br from-blue-100 via-indigo-100 to-violet-100 rounded-xl mb-5 flex items-center justify-center overflow-hidden">
                    {course.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
                    ) : (
                      <BookOpen className="w-12 h-12 text-blue-400/60" />
                    )}
                  </div>
                  <p className="text-4xl font-extrabold tracking-tight mb-4">{priceLabel(course)}</p>
                  {isFree ? (
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
                      className="w-full h-12 rounded-full bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold"
                    >
                      Buy now — {priceLabel(course)}
                    </Button>
                  )}
                  {course.previewUrl && (
                    <a href={course.previewUrl} target="_blank" rel="noreferrer" className="block mt-3">
                      <Button variant="outline" className="w-full h-12 rounded-full">
                        Free preview
                      </Button>
                    </a>
                  )}
                  <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Lifetime access
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Mobile & desktop
                    </li>
                    {course.workbookUrl && (
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Downloadable workbook PDF
                      </li>
                    )}
                  </ul>
                </Card>
              </motion.div>
            </div>
          </section>

          {/* What you'll learn */}
          {course.whatYouLearn && course.whatYouLearn.length > 0 && (
            <section className="py-12 sm:py-16">
              <div className="max-w-4xl mx-auto px-4 sm:px-6">
                <h2 className="text-2xl font-bold mb-6">What you&apos;ll learn</h2>
                <ul className="grid sm:grid-cols-2 gap-3">
                  {course.whatYouLearn.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* Requirements */}
          {course.requirements && course.requirements.length > 0 && (
            <section className="py-12 sm:py-16 bg-muted/30">
              <div className="max-w-4xl mx-auto px-4 sm:px-6">
                <h2 className="text-2xl font-bold mb-6">Requirements</h2>
                <ul className="space-y-2 text-sm">
                  {course.requirements.map((r, i) => (
                    <li key={i} className="flex items-start gap-2"><span className="text-muted-foreground">•</span>{r}</li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* Workbook */}
          {course.workbookUrl && (
            <section className="py-12 sm:py-16">
              <div className="max-w-4xl mx-auto px-4 sm:px-6">
                <Card className="p-6 border-2 border-dashed flex items-center gap-4">
                  <FileText className="w-8 h-8 text-blue-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Workbook PDF</p>
                    <p className="text-xs text-muted-foreground">Available after enrolment / purchase.</p>
                  </div>
                  {user ? (
                    <a href={course.workbookUrl} target="_blank" rel="noreferrer">
                      <Button variant="outline">
                        <Download className="w-4 h-4 mr-2" /> Download
                      </Button>
                    </a>
                  ) : (
                    <Button variant="outline" disabled>Sign in to download</Button>
                  )}
                </Card>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
