'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getTeacherCourses, getSubmissionsForTeacher, listInstructorActivity, Course, Submission, CourseQuestion, CourseReview } from '@/lib/db';
import { instructorSnapshot } from '@/lib/course-builder';
import { formatMoney } from '@/lib/pricing';
import { Button } from '@/components/ui/button';
import { BookOpen, ClipboardList, ArrowRight, ArrowUpRight, Upload, BarChart3, CheckCircle2, Sparkles, GraduationCap, Star, MessageSquare, Wallet } from 'lucide-react';
import Link from 'next/link';
import {
  DashPage, DashHeader, Panel, PanelHeader, StatCard, ListRow, Initials, EmptyState,
} from '@/components/dash-ui';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 } }),
};

const COURSE_GRADIENTS = [
  'from-emerald-500 to-teal-600',
  'from-[#2786A4] to-[#1E6A83]',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function TeacherDashboard() {
  const router = useRouter();
  const { user, profile } = useAuthSTORE();
  const [courses, setCourses] = useState<Course[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [reviews, setReviews] = useState<CourseReview[]>([]);
  const [questions, setQuestions] = useState<CourseQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] = useState(false);

  const load = () => {
    if (!user) return;
    setLoading(true);
    setLoadError(false);
    Promise.all([getTeacherCourses(user.uid), getSubmissionsForTeacher(user.uid)]).then(async ([cs, ss]) => {
      setCourses(cs);
      setSubmissions(ss);
      const activity = await listInstructorActivity(cs.map(course => course.id));
      setReviews(activity.reviews);
      setQuestions(activity.questions);
    }).catch(() => setLoadError(true)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [user]);

  const ungraded = submissions.filter(s => s.score === undefined);
  const published = courses.filter(c => c.status === 'published');
  const insight = instructorSnapshot({ courses, reviews, questions });
  const currencies = new Set(courses.map(course => (course.currency || 'USD').toUpperCase()));
  const revenueLabel = currencies.size <= 1
    ? formatMoney(insight.revenue, [...currencies][0] || 'USD')
    : `${insight.revenue.toFixed(2)} across currencies`;
  const firstName = profile?.name?.split(' ')[0] ?? 'Teacher';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  if (loadError) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12">
      <div className="bg-card border border-border rounded-3xl p-10 text-center space-y-4 card-glow">
        <BookOpen className="w-10 h-10 mx-auto text-amber-500" />
        <p className="font-heading text-2xl text-foreground">Couldn&apos;t load your dashboard</p>
        <p className="text-sm text-muted-foreground">Something went wrong while fetching your data. Please try again.</p>
        <Button variant="outline" className="rounded-full h-11 px-5 font-semibold" onClick={load}>Retry</Button>
      </div>
    </div>
  );

  if (loading) return (
    <DashPage>
      <div className="h-16 bg-muted animate-pulse rounded-2xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => <div key={i} className="h-36 bg-muted animate-pulse rounded-2xl" />)}
      </div>
      <div className="h-72 bg-muted animate-pulse rounded-2xl" />
    </DashPage>
  );

  return (
    <DashPage>
      <DashHeader
        eyebrow={`${greeting()} · ${today}`}
        title="Your classroom,"
        accent={firstName}
        description="What needs your attention today."
        actions={
          <>
            <Button variant="outline" onClick={() => router.push('/dashboard/teacher/courses/build')}
              className="h-10 px-4 rounded-xl font-semibold text-[13px] gap-2">
              <BookOpen className="w-3.5 h-3.5" /> Course studio
            </Button>
            <Button variant="outline" onClick={() => router.push('/dashboard/teacher/upload')}
              className="h-10 px-4 rounded-xl font-semibold text-[13px] gap-2">
              <Upload className="w-3.5 h-3.5" /> New lesson
            </Button>
            <Button onClick={() => router.push('/dashboard/teacher/gradebook')}
              className="h-10 px-4 rounded-xl font-semibold text-[13px] gap-2">
              <ClipboardList className="w-3.5 h-3.5" /> Gradebook
            </Button>
          </>
        }
      />

      {/* ── Stat row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          index={0} icon={BookOpen} label="Your courses" value={courses.length}
          badge={published.length ? `${published.length} live` : undefined}
          href="/dashboard/teacher/courses" hrefLabel="Manage courses"
        />
        <StatCard
          index={1} icon={ClipboardList} label="Awaiting marking" value={ungraded.length}
          href="/dashboard/teacher/gradebook" hrefLabel="Open gradebook"
        />
        <StatCard
          index={2} icon={CheckCircle2} label="Marked" value={submissions.length - ungraded.length}
          href="/dashboard/teacher/report-cards" hrefLabel="Report cards"
        />
        <StatCard
          index={3} icon={GraduationCap} label="Published" value={published.length}
          href="/dashboard/teacher/analytics" hrefLabel="Analytics"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard index={4} icon={GraduationCap} label="Enrolments" value={insight.enrollments} href="/dashboard/teacher/courses" hrefLabel="Courses" />
        <StatCard index={5} icon={Wallet} label="Recorded revenue" value={revenueLabel} href="/dashboard/teacher/courses" hrefLabel="Pricing" />
        <StatCard index={6} icon={Star} label="Rating" value={insight.average ?? '—'} badge={insight.reviewCount ? `${insight.reviewCount} reviews` : undefined} />
        <StatCard index={7} icon={MessageSquare} label="Open questions" value={insight.openQuestions} href="/dashboard/teacher/courses" hrefLabel="Studio" />
      </div>

      {reviews.length > 0 && (
        <Panel>
          <PanelHeader title="Reviews" meta={<span className="text-[11px] text-muted-foreground">{insight.reviewCount} ratings</span>} />
          <div className="space-y-2">
            {reviews.slice(0, 4).map(review => (
              <ListRow
                key={review.id}
                leading={<Initials name={review.userName || 'Student'} />}
                title={review.userName || 'Student'}
                subtitle={review.text || 'Rating only'}
                trailing={<span className="text-[12px] font-semibold tabular-nums">{review.rating}/5</span>}
              />
            ))}
          </div>
        </Panel>
      )}

      <Panel>
        <PanelHeader title="Questions" meta={<span className="text-[11px] text-muted-foreground">{insight.openQuestions} waiting</span>} />
        {questions.length === 0 ? (
          <EmptyState icon={MessageSquare} title="No questions yet" body="Student questions on your courses appear here." />
        ) : (
          <div className="space-y-2">
            {questions.slice(0, 6).map(question => (
              <ListRow
                key={question.id}
                href={`/dashboard/teacher/courses/${question.courseId}`}
                leading={<Initials name={question.authorName || 'Student'} />}
                title={question.text}
                subtitle={question.reply ? 'Replied' : 'Waiting for a reply'}
              />
            ))}
          </div>
        )}
      </Panel>

      {/* ── Marking queue + shortcuts ── */}
      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4 items-start">
        <Panel>
          <PanelHeader
            title="Needs marking"
            meta={<span className="text-[11px] text-muted-foreground">{ungraded.length} waiting</span>}
            action={
              <Link href="/dashboard/teacher/gradebook"
                className="text-[12px] font-semibold text-primary hover:underline flex items-center gap-1">
                Open gradebook <ArrowRight className="w-3 h-3" />
              </Link>
            }
          />
          {ungraded.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nothing waiting"
              body="Every submission has been marked. New work will appear here as students submit it."
            />
          ) : (
            <div className="space-y-2">
              {ungraded.slice(0, 6).map(sub => (
                <ListRow
                  key={sub.id}
                  href="/dashboard/teacher/gradebook"
                  leading={<Initials name={sub.studentName || 'Student'} />}
                  title={sub.studentName || 'Student'}
                  subtitle={sub.lessonTitle || 'Submission'}
                  trailing={
                    <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                      {sub.answers?.filter(a => a.correct).length ?? 0}/{sub.maxScore}
                    </span>
                  }
                />
              ))}
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Your courses" />
            {courses.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No courses yet"
                body="Create your first course and let the AI build the study material."
                action={
                  <Button onClick={() => router.push('/dashboard/teacher/courses')}
                    className="h-9 px-4 rounded-xl text-[13px] font-semibold gap-2">
                    Create a course <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                }
              />
            ) : (
              <div className="space-y-2">
                {courses.slice(0, 5).map(c => (
                  <ListRow
                    key={c.id}
                    href="/dashboard/teacher/courses"
                    leading={<Initials name={c.subject || c.title} />}
                    title={c.title}
                    subtitle={c.subject ?? 'Course'}
                    trailing={
                      <span className={`text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${
                        c.status === 'published'
                          ? 'bg-secondary text-secondary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {c.status === 'published' ? 'Live' : c.status}
                      </span>
                    }
                  />
                ))}
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Jump to" />
            <div className="space-y-2">
              {[
                { href: '/dashboard/studio', icon: Sparkles, title: 'AI Studio', sub: 'ET, Maths, and Exam Prep' },
                { href: '/dashboard/teacher/attendance', icon: CheckCircle2, title: 'Attendance', sub: 'Mark a register' },
                { href: '/dashboard/teacher/analytics', icon: BarChart3, title: 'Analytics', sub: 'How your class is doing' },
              ].map(x => (
                <ListRow
                  key={x.href}
                  href={x.href}
                  leading={<span className="w-9 h-9 rounded-xl bg-secondary grid place-items-center shrink-0"><x.icon className="w-4 h-4 text-primary" /></span>}
                  title={x.title}
                  subtitle={x.sub}
                  trailing={<ArrowUpRight className="w-4 h-4 text-muted-foreground" />}
                />
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </DashPage>
  );
}
