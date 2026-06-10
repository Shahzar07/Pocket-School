'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Timestamp } from 'firebase/firestore';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getTeacherCourses, getLiveClassesForTeacher, createLiveClass, Course, LiveClass } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Video, Plus, Calendar, Clock, Loader2, Radio, Link as LinkIcon } from 'lucide-react';

const STATUS_STYLES: Record<LiveClass['status'], string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  live: 'bg-red-100 text-red-700',
  ended: 'bg-gray-100 text-gray-600',
};

export default function TeacherLiveClassesPage() {
  const { user, profile } = useAuthSTORE();
  const [courses, setCourses] = useState<Course[]>([]);
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ courseId: '', title: '', scheduledAt: '', joinUrl: '' });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const cs = await getTeacherCourses(user.uid);
      setCourses(cs);
      if (cs.length) setForm(f => ({ ...f, courseId: cs[0].id }));
      const live = await getLiveClassesForTeacher(user.uid);
      setClasses(live);
      setLoading(false);
    })();
  }, [user]);

  const courseTitle = (id: string) => courses.find(c => c.id === id)?.title ?? 'Course';

  async function handleSchedule() {
    if (!user || !profile) return;
    if (!form.courseId || !form.title.trim() || !form.scheduledAt) {
      toast.error('Select a course, title, and date/time.');
      return;
    }
    setSaving(true);
    try {
      await createLiveClass({
        title: form.title.trim(),
        teacherId: user.uid,
        teacherName: profile.name,
        courseId: form.courseId,
        scheduledAt: Timestamp.fromDate(new Date(form.scheduledAt)),
        joinUrl: form.joinUrl.trim() || undefined,
        status: 'scheduled',
      });
      toast.success('Live class scheduled!');
      setForm(f => ({ ...f, title: '', scheduledAt: '', joinUrl: '' }));
      const updated = await getLiveClassesForTeacher(user.uid);
      setClasses(updated);
    } catch {
      toast.error('Failed to schedule live class.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />)}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Live Classes</h1>
        <p className="text-muted-foreground text-sm mt-1">Schedule and manage virtual sessions for your courses.</p>
      </div>

      {/* Schedule new */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h2 className="font-bold text-foreground">Schedule a New Class</h2>
        {courses.length === 0 ? (
          <p className="text-sm text-muted-foreground">Create a course first to schedule live classes.</p>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Course</label>
                <Select value={form.courseId} onValueChange={v => setForm(f => ({ ...f, courseId: v ?? '' }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select course…" /></SelectTrigger>
                  <SelectContent>
                    {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Class Title</label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Cell Biology Q&A" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Date & Time</label>
                <Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Meeting Link (optional)</label>
                <Input value={form.joinUrl} onChange={e => setForm(f => ({ ...f, joinUrl: e.target.value }))} placeholder="https://meet.google.com/…" className="rounded-xl" />
              </div>
            </div>
            <Button onClick={handleSchedule} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Schedule Class
            </Button>
          </>
        )}
      </div>

      {/* Upcoming classes */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Scheduled Classes ({classes.length})</h2>
        {classes.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Video className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No live classes scheduled yet.</p>
          </div>
        ) : (
          classes.map((cls, idx) => {
            const date = cls.scheduledAt?.toDate?.();
            return (
              <motion.div key={cls.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl shrink-0 ${cls.status === 'live' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
                    {cls.status === 'live' ? <Radio className="w-5 h-5 animate-pulse" /> : <Video className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{cls.title}</p>
                    <p className="text-xs text-muted-foreground">{courseTitle(cls.courseId)}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {date && (
                        <>
                          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                        </>
                      )}
                      {cls.joinUrl && (
                        <a href={cls.joinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                          <LinkIcon className="w-3.5 h-3.5" /> Meeting link
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <Badge className={`rounded-full text-[10px] capitalize ${STATUS_STYLES[cls.status]}`}>{cls.status}</Badge>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
