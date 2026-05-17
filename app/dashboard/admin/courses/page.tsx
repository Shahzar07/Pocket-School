'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
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

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
  pending_approval: { label: 'Pending Review', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  published: { label: 'Published', className: 'bg-emerald-50 text-emerald-700' },
};

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
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">All Courses & Products</h1>
          <p className="text-muted-foreground">Admin view of every product across all teachers.</p>
        </div>
        <Button onClick={onCreate} className="bg-google-blue hover:bg-[#1967D2] text-white">
          <Plus className="w-5 h-5 mr-2" /> New Product
        </Button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'pending'
              ? 'border-amber-500 text-amber-700'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Clock className="w-4 h-4" />
          Pending Approval
          {pendingCourses.length > 0 && (
            <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {pendingCourses.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'all'
              ? 'border-google-blue text-google-blue'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          All Courses
          <span className="ml-1 bg-muted text-muted-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5">
            {courses.length}
          </span>
        </button>
      </div>

      {loading && (
        <div className="text-center py-16">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
        </div>
      )}

      {!loading && activeTab === 'pending' && pendingCourses.length === 0 && (
        <Card className="p-12 text-center border-dashed">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-3" />
          <p className="text-sm text-muted-foreground">No courses pending approval — you&apos;re all caught up!</p>
        </Card>
      )}

      {!loading && activeTab === 'all' && courses.length === 0 && (
        <Card className="p-12 text-center border-dashed">
          <BookOpen className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No courses in the system yet.</p>
        </Card>
      )}

      {!loading && displayCourses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayCourses.map((c) => {
            const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE.draft;
            return (
              <Card key={c.id} className="p-6 rounded-[24px] border flex flex-col">
                {/* Thumbnail */}
                {c.thumbnailUrl ? (
                  <div className="w-full h-36 rounded-xl overflow-hidden mb-4 bg-muted">
                    <img src={c.thumbnailUrl} alt={c.title} className="w-full h-full object-cover" />
                  </div>
                ) : (
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
                  <h3 className="font-bold text-lg text-foreground mb-0.5 line-clamp-2">{c.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-1 mb-1">by {c.ownerName ?? 'Unknown'}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{c.description}</p>
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span className="text-xs px-2 py-1 rounded-full font-medium bg-amber-50 text-amber-700">{fmtPrice(c)}</span>
                    {c.level && (
                      <span className="text-xs px-2 py-1 rounded-full font-medium bg-slate-50 text-slate-600">{c.level}</span>
                    )}
                    {c.isPublic && <span className="text-xs px-2 py-1 rounded-full font-medium bg-blue-50 text-blue-700">Public</span>}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border space-y-2">
                  {/* Approve / Reject for pending */}
                  {c.status === 'pending_approval' && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => onApprove(c)}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => onReject(c)}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
                      </Button>
                    </div>
                  )}

                  {/* Standard admin controls */}
                  <div className="flex justify-between gap-2">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => onEdit(c)}>
                        <Edit className="w-4 h-4 mr-1" /> Edit
                      </Button>
                      {c.status !== 'pending_approval' && (
                        <Button variant="ghost" size="sm" onClick={() => togglePublish(c)}>
                          {c.status === 'published' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {c.status === 'published' && c.isPublic && (
                        <Link href={`/courses/${c.id}`} target="_blank">
                          <Button variant="ghost" size="sm"><ExternalLink className="w-4 h-4" /></Button>
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
          ownerId={editing?.ownerId || user.uid}
          ownerName={editing?.ownerName || profile?.name || 'Admin'}
          onSaved={load}
        />
      )}
    </div>
  );
}
