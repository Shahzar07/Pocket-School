'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, BookOpen, Edit, Trash2, Eye, EyeOff, ExternalLink, Loader2, Send, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  getTeacherCourses, deleteCourse, updateCourse,
  type Course,
} from '@/lib/db';
import CourseEditorModal from '@/components/course-editor-modal';
import { motion } from 'motion/react';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 },
  }),
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
  pending_approval: { label: 'Pending Review', className: 'bg-amber-500/10 text-amber-600 border border-amber-500/20' },
  published: { label: 'Published', className: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' },
};

export default function TeacherCourseMgmt() {
  const { user, profile } = useAuthSTORE();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const list = await getTeacherCourses(user.uid);
      setCourses(list);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load courses.');
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => { load(); }, [load]);

  const onCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const onEdit = (c: Course) => {
    setEditing(c);
    setEditorOpen(true);
  };

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

  const submitForReview = async (c: Course) => {
    try {
      await updateCourse(c.id, { status: 'pending_approval' });
      toast.success('Submitted for admin review. You\'ll be notified once approved.');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to submit for review.');
    }
  };

  const withdrawReview = async (c: Course) => {
    try {
      await updateCourse(c.id, { status: 'draft' });
      toast.success('Withdrawn — course is back in draft.');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to withdraw.');
    }
  };

  const unpublish = async (c: Course) => {
    try {
      await updateCourse(c.id, { status: 'draft', isPublic: false });
      toast.success('Course unpublished.');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to unpublish.');
    }
  };

  const fmtPrice = (c: Course) => {
    if (!c.price || c.price === 0) return 'Free';
    const symbol = c.currency === 'USD' ? '$' : c.currency === 'EUR' ? '€' : '£';
    return `${symbol}${c.price.toFixed(2)}`;
  };

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">
      {/* Page header */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={0}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600 mb-2">
            Course Management
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight">
            Your <span className="gradient-text italic">Courses</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Create courses, eBooks, exams, papers — sell on the public marketplace.
          </p>
        </div>
        <Button
          onClick={onCreate}
          className="rounded-full h-11 px-5 font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-600/25 transition-all"
        >
          <Plus className="w-5 h-5 mr-2" /> New Product
        </Button>
      </motion.div>

      {/* Info banner */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={1}
        className="bg-card border border-border rounded-3xl p-5 card-glow text-sm text-foreground"
      >
        <strong>Publish flow:</strong> Save as draft → Submit for Review → Admin approves → Your course appears on the marketplace automatically.
      </motion.div>

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-72 bg-muted animate-pulse rounded-3xl" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && courses.length === 0 && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={2}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-emerald-400/10 blur-3xl rounded-full" />
            <BookOpen className="relative w-14 h-14 text-emerald-600" />
          </div>
          <h2 className="font-heading text-2xl text-foreground mb-2">No products yet</h2>
          <p className="text-muted-foreground mb-6">You haven&apos;t created any products yet.</p>
          <Button
            onClick={onCreate}
            className="rounded-full h-11 px-5 font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-600/25 transition-all"
          >
            <Plus className="w-4 h-4 mr-2" /> Create your first product
          </Button>
        </motion.div>
      )}

      {/* Course grid */}
      {!loading && courses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((c, idx) => {
            const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE.draft;
            return (
              <motion.div
                key={c.id}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={idx + 2}
              >
                <Card className="bg-card border border-border rounded-3xl card-glow p-6 flex flex-col h-full">
                  {/* Thumbnail */}
                  {c.thumbnailUrl && (
                    <div className="w-full h-36 rounded-2xl overflow-hidden mb-4 bg-muted">
                      <img src={c.thumbnailUrl} alt={c.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  {!c.thumbnailUrl && (
                    <div className="w-full h-36 rounded-2xl overflow-hidden mb-4 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center">
                      <BookOpen className="w-10 h-10 text-emerald-600/40" />
                    </div>
                  )}

                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600 px-2 py-1 rounded bg-muted">
                        {c.type ?? 'course'}
                      </span>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                    <h3 className="font-bold text-lg text-foreground mb-1 line-clamp-2">{c.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{c.description}</p>
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      <span className="text-xs px-2 py-1 rounded-full font-medium bg-emerald-500/10 text-emerald-600">
                        {fmtPrice(c)}
                      </span>
                      {c.level && (
                        <span className="text-xs px-2 py-1 rounded-full font-medium bg-muted text-muted-foreground">
                          {c.level}
                        </span>
                      )}
                      {c.isPublic && c.status === 'published' && (
                        <span className="text-xs px-2 py-1 rounded-full font-medium bg-emerald-500/10 text-emerald-600">
                          Marketplace
                        </span>
                      )}
                    </div>
                    {c.enrollmentCount !== undefined && (
                      <p className="text-xs text-muted-foreground">{c.enrollmentCount} enrolled</p>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-border space-y-2">
                    {/* Primary action by status */}
                    {c.status === 'draft' && (
                      <Button
                        size="sm"
                        className="w-full rounded-full font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-600/25 transition-all"
                        onClick={() => submitForReview(c)}
                      >
                        <Send className="w-3.5 h-3.5 mr-1.5" /> Submit for Review
                      </Button>
                    )}
                    {c.status === 'pending_approval' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full rounded-full font-bold border-amber-500/20 text-amber-600 hover:bg-amber-500/10"
                        onClick={() => withdrawReview(c)}
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Withdraw Review Request
                      </Button>
                    )}
                    {c.status === 'published' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full rounded-full font-bold"
                        onClick={() => unpublish(c)}
                      >
                        <EyeOff className="w-3.5 h-3.5 mr-1.5" /> Unpublish
                      </Button>
                    )}

                    {/* Secondary actions */}
                    <div className="flex justify-between gap-2">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => onEdit(c)}
                          disabled={c.status === 'pending_approval'}
                          title={c.status === 'pending_approval' ? 'Withdraw review to edit' : undefined}
                        >
                          <Edit className="w-4 h-4 mr-1" /> Edit
                        </Button>
                      </div>
                      <div className="flex gap-1">
                        {c.status === 'published' && c.isPublic && (
                          <Link href={`/courses/${c.id}`} target="_blank">
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </Link>
                        )}
                        <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => onDelete(c)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {user && (
        <CourseEditorModal
          open={editorOpen}
          onOpenChange={setEditorOpen}
          initial={editing}
          ownerId={user.uid}
          ownerName={profile?.name || user.email || 'Teacher'}
          onSaved={load}
        />
      )}
    </div>
  );
}
