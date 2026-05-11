'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  getTeacherCourses, getEnrollmentsForCourse, getModulesWithLessons,
  createAttendanceRecord, getAttendanceForCourse,
  AttendanceRecord, AttendanceEntry, Course,
} from '@/lib/db';
import { Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ClipboardCheck, CheckCircle2, XCircle, Clock, BookOpen, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

type AttStatus = 'present' | 'absent' | 'late' | 'excused';

const STATUS_STYLES: Record<AttStatus, string> = {
  present: 'bg-green-100 text-green-700 border-green-200',
  absent: 'bg-red-100 text-red-700 border-red-200',
  late: 'bg-amber-100 text-amber-700 border-amber-200',
  excused: 'bg-blue-100 text-blue-700 border-blue-200',
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
    ]).then(([mods, enrs, recs]) => {
      const allLessons = mods.flatMap(m => m.lessons.map(l => ({ id: l.id!, title: l.title })));
      setLessons(allLessons);
      setSelectedLesson('');
      setStudents(enrs.map(e => ({ studentId: e.studentId, name: `Student ${e.studentId.slice(0, 6)}` })));
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
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-2xl" />)}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Attendance</h1>
        <p className="text-muted-foreground text-sm mt-1">Mark attendance for each lesson session.</p>
      </div>

      {/* Mark Attendance */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h2 className="font-bold text-foreground">Mark New Attendance</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Course</label>
            <Select value={selectedCourse} onValueChange={v => setSelectedCourse(v ?? '')}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select course…" /></SelectTrigger>
              <SelectContent>
                {courses.map(c => <SelectItem key={c.id} value={c.id!}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Lesson</label>
            <Select value={selectedLesson} onValueChange={v => setSelectedLesson(v ?? '')} disabled={!lessons.length}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select lesson…" /></SelectTrigger>
              <SelectContent>
                {lessons.map(l => <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedCourse && selectedLesson && (
          <div className="space-y-2">
            {students.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No students enrolled in this course.</p>
            ) : (
              <>
                {students.map((s, i) => (
                  <motion.div key={s.studentId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                    className="flex items-center justify-between bg-muted/40 rounded-xl px-4 py-3 gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                        {s.studentId.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-foreground">{s.name}</span>
                    </div>
                    <div className="flex gap-1.5">
                      {(['present', 'absent', 'late', 'excused'] as AttStatus[]).map(st => (
                        <button key={st}
                          onClick={() => setStatuses(prev => ({ ...prev, [s.studentId]: st }))}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${statuses[s.studentId] === st ? STATUS_STYLES[st] : 'border-border text-muted-foreground hover:bg-muted'}`}
                        >
                          {STATUS_ICONS[st]}
                          <span className="hidden sm:inline capitalize">{st}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                ))}
                <Button onClick={handleSave} disabled={saving} className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl gap-2 mt-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                  Save Attendance
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Past Records */}
      {records.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Past Records ({records.length})</h2>
          {records.map((r, i) => {
            const date = r.date instanceof Timestamp ? r.date.toDate() : new Date(r.date as any);
            const presentCount = r.records.filter(e => e.status === 'present').length;
            const rate = r.records.length > 0 ? Math.round((presentCount / r.records.length) * 100) : 0;
            const isExp = expanded === r.id;
            return (
              <motion.div key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                className="bg-card border border-border rounded-2xl overflow-hidden"
              >
                <button className="w-full flex items-center justify-between p-4 text-left gap-3" onClick={() => setExpanded(isExp ? null : r.id!)}>
                  <div className="flex items-center gap-3">
                    <ClipboardCheck className="w-4 h-4 text-teal-500 shrink-0" />
                    <div>
                      <p className="font-semibold text-foreground text-sm">{r.lessonTitle}</p>
                      <p className="text-xs text-muted-foreground">{r.courseTitle} · {date.toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge className={`rounded-full text-[10px] ${rate >= 80 ? 'bg-green-100 text-green-700' : rate >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {rate}% present
                    </Badge>
                    {isExp ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>
                {isExp && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
                    {r.records.map(e => (
                      <div key={e.studentId} className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{e.studentName || e.studentId.slice(0, 8)}</span>
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold border ${STATUS_STYLES[e.status]}`}>
                          {STATUS_ICONS[e.status]} {e.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {courses.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No courses yet. Create a course to take attendance.</p>
        </div>
      )}
    </div>
  );
}
