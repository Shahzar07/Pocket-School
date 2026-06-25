'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Plus, BookOpen, Edit, Trash2, Eye, EyeOff, ExternalLink, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  getAllCourses, getPendingCourses, deleteCourse, updateCourse,
  approveCourse, rejectCourse,
  type Course,
} from '@/lib/db';
import CourseEditorModal from '@/components/course-editor-modal';

type ViewTab = 'pending' | 'all';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 } }),
};

const COURSE_GRADIENTS = [
  'from-[#1A73E8] to-[#7C3AED]',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
];

export default function AdminCourseMgmt() {
  const { user, profile } = useAuthSTORE();
  const [courses, setCourses] = useState<Course[]>([]);
  const [pendingCourses, setPendingCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>('pending');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [all, pending] = await Promise.all([getAllCourses(), getPendingCourses()]);
      setCourses(all);
      setPendingCourses(pending);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load courses.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onCreate = () => { setEditing(null); setEditorOpen(true); };
  const onEdit = (c: Course) => { setEditing(c); setEditorOpen(true); };

  const onDelete = async (c: Course) => {
    if (!confirm(`Delete "${c.title}"? This cannot be undone.`)) return;
    try {
      await deleteCourse(c.id);
      toast.success('Deleted.');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete.');
    }
  };

  const onApprove = async (c: Course) => {
    try {
      await approveCourse(c.id);
      toast.success(`"${c.title}" approved and published to marketplace.`);
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to approve.');
    }
  };

  const onReject = async (c: Course) => {
    if (!confirm(`Reject "${c.title}"? It will be moved back to draft.`)) return;
    try {
      await rejectCourse(c.id);
      toast.success(`"${c.title}" rejected — moved back to draft.`);
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to reject.');
    }
  };

  const togglePublish = async (c: Course) => {
    const next = c.status === 'published' ? 'draft' : 'published';
    try {
      await updateCourse(c.id, { status: next, isPublic: next === 'published' });
      toast.success(next === 'published' ? 'Published.' : 'Unpublished.');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed.');
    }
  };

  const fmtPrice = (c: Course) => {
    if (!c.price || c.price === 0) return 'Free';
    const symbol = c.currency === 'USD' ? '$' : c.currency === 'EUR' ? '€' : '£';
    return `${symbol}${c.price.toFixed(2)}`;
  };

  const displayCourses = activeTab === 'pending' ? pendingCourses : courses;

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">

      {/* Header */}
      <motion.header variants={fadeUp} initial="hidden" animate="visible" custom={0}
        className="pt-2 flex flex-col lg:flex-row lg:items-end justify-between gap-6"
      >
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-600 flex items-center gap-2">
            <span className="w-5 h-px bg-violet-600 inline-block" /> Course management
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-3">
            All <span className="gradient-text italic">courses</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-[15px]">Admin view of every product across all teachers.</p>
        </div>
        <Button onClick={onCreate}
          className="rounded-full h-11 px-5 gap-2 font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 text-white shrink-0"
        >
          <Plus className="w-4 h-4" /> New Product
        </Button>
      </motion.header>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'All Courses', value: courses.length, icon: BookOpen, accent: 'text-[#1A73E8]', bar: 'bg-[#1A73E8]' },
          { label: 'Pending', value: pendingCourses.length, icon: Clock, accent: 'text-amber-600', bar: 'bg-amber-500' },
          { label: 'Published', value: courses.filter(c => c.status === 'published').length, icon: CheckCircle2, accent: 'text-emerald-600', bar: 'bg-emerald-500' },
          { label: 'Drafts', value: courses.filter(c => c.status === 'draft').length, icon: Edit, accent: 'text-violet-600', bar: 'bg-violet-500' },
        ].map((s, i) => (
          <motion.div key={s.label} variants={fadeUp} initial="hidden" animate="visible" custom={1 + i}
            className="bg-card border border-border rounded-3xl p-5 sm:p-6 relative overflow-hidden card-glow"
          >
            <span className={`absolute top-0 left-6 right-6 h-[3px] rounded-b-full ${s.bar} opacity-80`} />
            <s.icon className={`w-5 h-5 ${s.accent}`} />
            <p className="font-heading text-4xl sm:text-5xl text-foreground mt-3 leading-none">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-2 font-semibold uppercase tracking-wider">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-2xl w-fit">
        {([
          { key: 'pending' as ViewTab, label: 'Pending Approval', icon: Clock, count: pendingCourses.length },
          { key: 'all' as ViewTab, label: 'All Courses', icon: BookOpen, count: courses.length },
        ]).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === t.key
                ? 'bg-card shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.count > 0 && (
              <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                activeTab === t.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-16">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
        </div>
      )}

      {!loading && activeTab === 'pending' && pendingCourses.length === 0 && (
        <div className="relative text-center py-16 bg-card rounded-[2rem] border border-border overflow-hidden">
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-emerald-500/8 blur-[80px]" />
          <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-emerald-600/40" />
          <h3 className="font-heading text-2xl text-foreground mb-1.5">All caught up</h3>
          <p className="text-sm text-muted-foreground">No courses pending approval.</p>
        </div>
      )}

      {!loading && activeTab === 'all' && courses.length === 0 && (
        <div className="relative text-center py-16 bg-card rounded-[2rem] border border-border overflow-hidden">
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-primary/8 blur-[80px]" />
          <BookOpen className="w-12 h-12 mx-auto mb-4 text-primary/40" />
          <h3 className="font-heading text-2xl text-foreground mb-1.5">No courses yet</h3>
          <p className="text-sm text-muted-foreground">Create your first course to get started.</p>
        </div>
      )}

      {!loading && displayCourses.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayCourses.map((c, i) => (
            <motion.div key={c.id} variants={fadeUp} initial="hidden" animate="visible" custom={5 + i}
              className="bg-card border border-border rounded-3xl overflow-hidden card-glow flex flex-col"
            >
              {/* Thumbnail */}
              {c.thumbnailUrl ? (
                <div className="w-full h-36 overflow-hidden bg-muted">
                  <img src={c.thumbnailUrl} alt={c.title} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className={`w-full h-24 bg-gradient-to-br ${COURSE_GRADIENTS[i % COURSE_GRADIENTS.length]} relative overflow-hidden`}>
                  <div className="absolute -right-6 -top-8 w-24 h-24 rounded-full bg-white/15" />
                  <div className="absolute right-10 bottom-2 w-14 h-14 rounded-full bg-white/10" />
                </div>
              )}

              <div className="flex-1 p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                    {c.type ?? 'course'}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                    c.status === 'published' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
                    c.status === 'pending_approval' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {c.status === 'published' ? 'Published' : c.status === 'pending_approval' ? 'In review' : 'Draft'}
                  </span>
                </div>
                <h3 className="font-bold text-foreground text-lg leading-snug line-clamp-2">{c.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">by {c.ownerName ?? 'Unknown'}</p>
                <p className="text-[13px] text-muted-foreground line-clamp-2 mt-1.5">{c.description}</p>
                <div className="flex items-center gap-2 flex-wrap mt-3">
                  <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600">{fmtPrice(c)}</span>
                  {c.level && <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-muted text-muted-foreground">{c.level}</span>}
                  {c.isPublic && <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-primary/10 text-primary">Public</span>}
                </div>
              </div>

              <div className="px-5 pb-5 pt-0 space-y-2.5">
                {c.status === 'pending_approval' && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" className="rounded-full font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5" onClick={() => onApprove(c)}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-full font-bold text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5" onClick={() => onReject(c)}>
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </Button>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => onEdit(c)}>
                      <Edit className="w-4 h-4 mr-1" /> Edit
                    </Button>
                    {c.status !== 'pending_approval' && (
                      <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => togglePublish(c)}>
                        {c.status === 'published' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {c.status === 'published' && c.isPublic && (
                      <Link href={`/courses/${c.id}`} target="_blank">
                        <Button variant="ghost" size="sm" className="rounded-xl"><ExternalLink className="w-4 h-4" /></Button>
                      </Link>
                    )}
                    <Button variant="ghost" size="sm" className="rounded-xl text-destructive hover:bg-destructive/10" onClick={() => onDelete(c)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {user && (
        <CourseEditorModal
          open={editorOpen}
          onOpenChange={setEditorOpen}
          initial={editing}
          ownerId={editing?.ownerId || user.uid}
          ownerName={editing?.ownerName || profile?.name || 'Admin'}
          onSaved={load}
        />
      )}
    </div>
  );
}
