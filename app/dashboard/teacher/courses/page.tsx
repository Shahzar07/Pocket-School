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

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
  pending_approval: { label: 'Pending Review', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  published: { label: 'Published', className: 'bg-emerald-50 text-emerald-700' },
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
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Course Management</h1>
          <p className="text-muted-foreground">Create courses, eBooks, exams, papers — sell on the public marketplace.</p>
        </div>
        <Button onClick={onCreate} className="bg-google-blue hover:bg-[#1967D2] text-white">
          <Plus className="w-5 h-5 mr-2" /> New Product
        </Button>
      </div>

      {/* Info banner */}
      <div className="rounded-xl bg-blue-50 border border-blue-100 px-5 py-4 text-sm text-blue-800">
        <strong>Publish flow:</strong> Save as draft → Submit for Review → Admin approves → Your course appears on the marketplace automatically.
      </div>

      {loading && (
        <div className="text-center py-16">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
        </div>
      )}

      {!loading && courses.length === 0 && (
        <Card className="p-12 text-center border-dashed">
          <BookOpen className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-4">You haven&apos;t created any products yet.</p>
          <Button onClick={onCreate} className="bg-google-blue hover:bg-[#1967D2] text-white">
            <Plus className="w-4 h-4 mr-2" /> Create your first product
          </Button>
        </Card>
      )}

      {!loading && courses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((c) => {
            const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE.draft;
            return (
              <Card key={c.id} className="p-6 rounded-[24px] border flex flex-col">
                {/* Thumbnail */}
                {c.thumbnailUrl && (
                  <div className="w-full h-36 rounded-xl overflow-hidden mb-4 bg-muted">
                    <img src={c.thumbnailUrl} alt={c.title} className="w-full h-full object-cover" />
                  </div>
                )}
                {!c.thumbnailUrl && (
                  <div className="w-full h-36 rounded-xl overflow-hidden mb-4 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                    <BookOpen className="w-10 h-10 text-blue-300" />
                  </div>
                )}

                <div className="flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-muted text-muted-foreground">
                      {c.type ?? 'course'}
                    </span>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg text-foreground mb-1 line-clamp-2">{c.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{c.description}</p>
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span className="text-xs px-2 py-1 rounded-full font-medium bg-amber-50 text-amber-700">
                      {fmtPrice(c)}
                    </span>
                    {c.level && (
                      <span className="text-xs px-2 py-1 rounded-full font-medium bg-slate-50 text-slate-600">
                        {c.level}
                      </span>
                    )}
                    {c.isPublic && c.status === 'published' && (
                      <span className="text-xs px-2 py-1 rounded-full font-medium bg-blue-50 text-blue-700">
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
                      className="w-full bg-google-blue hover:bg-[#1967D2] text-white"
                      onClick={() => submitForReview(c)}
                    >
                      <Send className="w-3.5 h-3.5 mr-1.5" /> Submit for Review
                    </Button>
                  )}
                  {c.status === 'pending_approval' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
                      onClick={() => withdrawReview(c)}
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Withdraw Review Request
                    </Button>
                  )}
                  {c.status === 'published' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
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
