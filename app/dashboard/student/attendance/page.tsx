'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getAttendanceForStudent, AttendanceRecord } from '@/lib/db';
import { Timestamp } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardCheck, CheckCircle2, XCircle, Clock, BookOpen } from 'lucide-react';

type AttStatus = 'present' | 'absent' | 'late' | 'excused';

const STATUS_STYLES: Record<AttStatus, string> = {
  present: 'bg-emerald-500/10 text-emerald-600',
  absent: 'bg-destructive/10 text-destructive',
  late: 'bg-amber-500/10 text-amber-600',
  excused: 'bg-primary/10 text-primary',
};

const STATUS_ICONS: Record<AttStatus, React.ReactNode> = {
  present: <CheckCircle2 className="w-3 h-3" />,
  absent: <XCircle className="w-3 h-3" />,
  late: <Clock className="w-3 h-3" />,
  excused: <BookOpen className="w-3 h-3" />,
};

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 },
  }),
};

interface CourseAttendance {
  courseId: string;
  courseTitle: string;
  records: { date: Date; lessonTitle: string; status: AttStatus }[];
}

export default function StudentAttendancePage() {
  const { user } = useAuthSTORE();
  const [courseMap, setCourseMap] = useState<CourseAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const records = await getAttendanceForStudent(user.uid);
      const map = new Map<string, CourseAttendance>();
      for (const r of records) {
        const entry = r.records.find(e => e.studentId === user.uid);
        if (!entry) continue;
        if (!map.has(r.courseId)) {
          map.set(r.courseId, { courseId: r.courseId, courseTitle: r.courseTitle, records: [] });
        }
        const date = r.date instanceof Timestamp ? r.date.toDate() : new Date(r.date as any);
        map.get(r.courseId)!.records.push({ date, lessonTitle: r.lessonTitle, status: entry.status });
      }
      // Defensive client-side sort (most recent session first)
      const list = Array.from(map.values());
      for (const ca of list) ca.records.sort((a, b) => b.date.getTime() - a.date.getTime());
      setCourseMap(list);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const getRate = (ca: CourseAttendance) => {
    if (!ca.records.length) return 0;
    const present = ca.records.filter(r => r.status === 'present' || r.status === 'late').length;
    return Math.round((present / ca.records.length) * 100);
  };

  if (loading) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10 pt-8">
      <div className="space-y-3">
        <div className="h-4 w-20 bg-muted animate-pulse rounded-full" />
        <div className="h-12 w-72 bg-muted animate-pulse rounded-2xl" />
      </div>
      <div className="space-y-5">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-48 bg-muted animate-pulse rounded-3xl" />
        ))}
      </div>
    </div>
  );

  if (error) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 pt-16 flex justify-center">
      <div className="bg-card border border-border rounded-3xl p-8 text-center max-w-md w-full card-glow">
        <p className="font-heading text-xl text-foreground mb-2">Couldn&apos;t load this page.</p>
        <p className="text-sm text-muted-foreground mb-6 break-words">{error}</p>
        <Button onClick={load} className="rounded-full h-11 px-6 font-bold">Retry</Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">
      {/* Page header */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={0}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
          Records
        </p>
        <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-1.5">
          My <span className="gradient-text italic">Attendance</span>
        </h1>
      </motion.div>

      {courseMap.length === 0 ? (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
          className="relative flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-primary/8 blur-[80px]" />
          <ClipboardCheck className="w-14 h-14 text-muted-foreground/30 mb-5" />
          <p className="font-heading text-2xl text-foreground">No attendance records yet</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            Your attendance will appear here once your courses begin tracking sessions.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {courseMap.map((ca, i) => {
            const rate = getRate(ca);
            const rateColor = rate >= 80 ? 'text-emerald-500' : rate >= 60 ? 'text-amber-500' : 'text-destructive';
            const barColor = rate >= 80 ? 'bg-emerald-500' : rate >= 60 ? 'bg-amber-500' : 'bg-destructive';
            return (
              <motion.div
                key={ca.courseId}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={i + 1}
                className="bg-card border border-border rounded-3xl overflow-hidden card-glow"
              >
                {/* Course header */}
                <div className="flex items-center justify-between p-5 sm:p-6 border-b border-border">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-r from-[#1A73E8] to-[#7C3AED] flex items-center justify-center shrink-0">
                      <ClipboardCheck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-heading font-bold text-foreground text-lg">{ca.courseTitle}</p>
                      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">
                        {ca.records.length} session{ca.records.length !== 1 ? 's' : ''} recorded
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-heading text-4xl ${rateColor}`}>{rate}%</p>
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mt-1">
                      attendance rate
                    </p>
                  </div>
                </div>

                {/* Attendance progress bar */}
                <div className="px-5 sm:px-6 pt-4 pb-2">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${barColor} rounded-full transition-all duration-500`}
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                </div>

                {/* Records list */}
                <div className="px-5 sm:px-6 py-3 space-y-2">
                  {ca.records.slice(0, 6).map((r, j) => (
                    <div
                      key={j}
                      className="flex items-center justify-between text-sm py-2.5 px-3 rounded-2xl transition-colors hover:bg-muted/50"
                    >
                      <div>
                        <p className="font-medium text-foreground">{r.lessonTitle}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{r.date.toLocaleDateString()}</p>
                      </div>
                      <Badge className={`rounded-full text-[10px] flex items-center gap-1 ${STATUS_STYLES[r.status]}`}>
                        {STATUS_ICONS[r.status]} {r.status}
                      </Badge>
                    </div>
                  ))}
                  {ca.records.length > 6 && (
                    <p className="text-xs text-muted-foreground text-center pt-2 pb-1 font-semibold uppercase tracking-wider">
                      +{ca.records.length - 6} more sessions
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
