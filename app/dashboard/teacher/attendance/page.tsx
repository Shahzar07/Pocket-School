'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  getTeacherCourses, getEnrollmentsForCourse, getModulesWithLessons,
  createAttendanceRecord, getAttendanceForCourse, getUser,
  AttendanceRecord, AttendanceEntry, Course,
} from '@/lib/db';
import { Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ClipboardCheck, CheckCircle2, XCircle, Clock, BookOpen, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

type AttStatus = 'present' | 'absent' | 'late' | 'excused';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 },
  }),
};

const STATUS_STYLES_SELECTED: Record<AttStatus, string> = {
  present: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  absent: 'bg-red-500/10 text-red-600 border-red-500/20',
  late: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  excused: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
};

const STATUS_BADGE_STYLES: Record<AttStatus, string> = {
  present: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  absent: 'bg-red-500/10 text-red-600 border-red-500/20',
  late: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  excused: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
};

const STATUS_ICONS: Record<AttStatus, React.ReactNode> = {
  present: <CheckCircle2 className="w-3.5 h-3.5" />,
  absent: <XCircle className="w-3.5 h-3.5" />,
  late: <Clock className="w-3.5 h-3.5" />,
  excused: <BookOpen className="w-3.5 h-3.5" />,
};

export default function TeacherAttendancePage() {
  const { user, profile } = useAuthSTORE();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [lessons, setLessons] = useState<{ id: string; title: string }[]>([]);
  const [selectedLesson, setSelectedLesson] = useState('');
  const [students, setStudents] = useState<{ studentId: string; name: string }[]>([]);
  const [statuses, setStatuses] = useState<Record<string, AttStatus>>({});
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getTeacherCourses(user.uid).then(c => { setCourses(c); setLoading(false); });
  }, [user]);

  useEffect(() => {
    if (!selectedCourse) return;
    const course = courses.find(c => c.id === selectedCourse);
    Promise.all([
      getModulesWithLessons(selectedCourse),
      getEnrollmentsForCourse(selectedCourse),
      getAttendanceForCourse(selectedCourse),
    ]).then(async ([mods, enrs, recs]) => {
      const allLessons = mods.flatMap(m => m.lessons.map(l => ({ id: l.id!, title: l.title })));
      setLessons(allLessons);
      setSelectedLesson('');
      const roster = await Promise.all(enrs.map(async e => {
        const profile = await getUser(e.studentId);
        return { studentId: e.studentId, name: profile?.name ?? 'Student' };
      }));
      setStudents(roster.sort((a, b) => a.name.localeCompare(b.name)));
      setStatuses({});
      setRecords(recs);
    });
  }, [selectedCourse, courses]);

  const handleSave = async () => {
    if (!user || !selectedCourse || !selectedLesson) return;
    const course = courses.find(c => c.id === selectedCourse);
    const lesson = lessons.find(l => l.id === selectedLesson);
    if (!course || !lesson) return;
    setSaving(true);
    try {
      const entries: AttendanceEntry[] = students.map(s => ({
        studentId: s.studentId,
        studentName: s.name,
        status: statuses[s.studentId] ?? 'present',
      }));
      await createAttendanceRecord({
        courseId: selectedCourse,
        courseTitle: course.title,
        lessonId: selectedLesson,
        lessonTitle: lesson.title,
        teacherId: user.uid,
        date: Timestamp.now(),
        records: entries,
      });
      toast.success('Attendance saved!');
      const updated = await getAttendanceForCourse(selectedCourse);
      setRecords(updated);
    } catch { toast.error('Failed to save attendance.'); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">
      {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-3xl" />)}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">
      {/* Page Header */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600">ATTENDANCE</p>
        <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight">
          Track <span className="gradient-text italic">Attendance</span>
        </h1>
        <p className="text-muted-foreground mt-1">Mark attendance for each lesson session.</p>
      </motion.div>

      {/* Mark Attendance */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}
        className="bg-card border border-border rounded-3xl p-5 sm:p-6 space-y-5 card-glow"
      >
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600">New Record</p>
          <h2 className="font-heading text-2xl text-foreground">Mark Attendance</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Course</label>
            <Select value={selectedCourse} onValueChange={v => setSelectedCourse(v ?? '')}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select course..." /></SelectTrigger>
              <SelectContent>
                {courses.map(c => <SelectItem key={c.id} value={c.id!}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Lesson</label>
            <Select value={selectedLesson} onValueChange={v => setSelectedLesson(v ?? '')} disabled={!lessons.length}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select lesson..." /></SelectTrigger>
              <SelectContent>
                {lessons.map(l => <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedCourse && selectedLesson && (
          <div className="space-y-3">
            {students.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No students enrolled in this course.</p>
            ) : (
              <>
                {students.map((s, i) => (
                  <motion.div key={s.studentId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                    className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 card-glow"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-foreground truncate">{s.name}</span>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {(['present', 'absent', 'late', 'excused'] as AttStatus[]).map(st => (
                        <button key={st}
                          onClick={() => setStatuses(prev => ({ ...prev, [s.studentId]: st }))}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${statuses[s.studentId] === st ? STATUS_STYLES_SELECTED[st] : 'border-border text-muted-foreground hover:bg-muted'}`}
                        >
                          {STATUS_ICONS[st]}
                          <span className="hidden sm:inline capitalize">{st}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                ))}
                <Button onClick={handleSave} disabled={saving}
                  className="w-full rounded-full h-11 font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-600/25 transition-all gap-2 mt-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                  Save Attendance
                </Button>
              </>
            )}
          </div>
        )}
      </motion.div>

      {/* Past Records */}
      {records.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2} className="space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600">History</p>
            <h2 className="font-heading text-3xl text-foreground">Past Records ({records.length})</h2>
          </div>
          {records.map((r, i) => {
            const date = r.date instanceof Timestamp ? r.date.toDate() : new Date(r.date as any);
            const presentCount = r.records.filter(e => e.status === 'present').length;
            const rate = r.records.length > 0 ? Math.round((presentCount / r.records.length) * 100) : 0;
            const isExp = expanded === r.id;
            return (
              <motion.div key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                className="bg-card border border-border rounded-3xl card-glow overflow-hidden"
              >
                <button className="w-full flex items-center justify-between p-4 text-left gap-3" onClick={() => setExpanded(isExp ? null : r.id!)}>
                  <div className="flex items-center gap-3">
                    <ClipboardCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div>
                      <p className="font-semibold text-foreground text-sm">{r.lessonTitle}</p>
                      <p className="text-xs text-muted-foreground">{r.courseTitle} · {date.toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge className={`rounded-full text-[10px] border ${rate >= 80 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : rate >= 60 ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'}`}>
                      {rate}% present
                    </Badge>
                    {isExp ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>
                {isExp && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
                    {r.records.map(e => (
                      <div key={e.studentId} className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{e.studentName || 'Student'}</span>
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_BADGE_STYLES[e.status]}`}>
                          {STATUS_ICONS[e.status]} {e.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Empty State */}
      {courses.length === 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}
          className="relative text-center py-20"
        >
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
          </div>
          <div className="relative">
            <ClipboardCheck className="w-14 h-14 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="font-heading text-2xl text-foreground">No courses yet</h3>
            <p className="text-muted-foreground mt-1">Create a course to start taking attendance.</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
