'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getAttendanceForStudent, AttendanceRecord } from '@/lib/db';
import { Timestamp } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, CheckCircle2, XCircle, Clock, BookOpen } from 'lucide-react';

type AttStatus = 'present' | 'absent' | 'late' | 'excused';

const STATUS_STYLES: Record<AttStatus, string> = {
  present: 'bg-green-100 text-green-700',
  absent: 'bg-red-100 text-red-700',
  late: 'bg-amber-100 text-amber-700',
  excused: 'bg-blue-100 text-blue-700',
};

const STATUS_ICONS: Record<AttStatus, React.ReactNode> = {
  present: <CheckCircle2 className="w-3 h-3" />,
  absent: <XCircle className="w-3 h-3" />,
  late: <Clock className="w-3 h-3" />,
  excused: <BookOpen className="w-3 h-3" />,
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

  useEffect(() => {
    if (!user) return;
    getAttendanceForStudent(user.uid).then(records => {
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
      setCourseMap(Array.from(map.values()));
      setLoading(false);
    });
  }, [user]);

  const getRate = (ca: CourseAttendance) => {
    if (!ca.records.length) return 0;
    const present = ca.records.filter(r => r.status === 'present' || r.status === 'late').length;
    return Math.round((present / ca.records.length) * 100);
  };

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />)}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">My Attendance</h1>
        <p className="text-muted-foreground text-sm mt-1">Track your attendance across all enrolled courses.</p>
      </div>

      {courseMap.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No attendance records yet.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {courseMap.map((ca, i) => {
            const rate = getRate(ca);
            const rateColor = rate >= 80 ? 'text-green-600' : rate >= 60 ? 'text-amber-600' : 'text-red-600';
            const ringColor = rate >= 80 ? 'bg-green-500' : rate >= 60 ? 'bg-amber-500' : 'bg-red-500';
            return (
              <motion.div key={ca.courseId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className="bg-card border border-border rounded-2xl overflow-hidden"
              >
                {/* Course header */}
                <div className="flex items-center justify-between p-5 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center shrink-0">
                      <ClipboardCheck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{ca.courseTitle}</p>
                      <p className="text-xs text-muted-foreground">{ca.records.length} session{ca.records.length !== 1 ? 's' : ''} recorded</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-extrabold ${rateColor}`}>{rate}%</p>
                    <p className="text-xs text-muted-foreground">attendance rate</p>
                  </div>
                </div>
                {/* Attendance bar */}
                <div className="px-5 pt-3 pb-1">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${ringColor} rounded-full transition-all`} style={{ width: `${rate}%` }} />
                  </div>
                </div>
                {/* Records list */}
                <div className="px-5 py-3 space-y-2">
                  {ca.records.slice(0, 6).map((r, j) => (
                    <div key={j} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-foreground">{r.lessonTitle}</p>
                        <p className="text-xs text-muted-foreground">{r.date.toLocaleDateString()}</p>
                      </div>
                      <Badge className={`rounded-full text-[10px] flex items-center gap-1 ${STATUS_STYLES[r.status]}`}>
                        {STATUS_ICONS[r.status]} {r.status}
                      </Badge>
                    </div>
                  ))}
                  {ca.records.length > 6 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">+{ca.records.length - 6} more sessions</p>
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
