'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, BookOpen, Edit, Trash2, Eye, EyeOff, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  getAllCourses, deleteCourse, updateCourse,
  type Course,
} from '@/lib/db';
import CourseEditorModal from '@/components/course-editor-modal';

export default function AdminCourseMgmt() {
  const { user, profile } = useAuthSTORE();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getAllCourses();
      setCourses(list);
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

  const togglePublish = async (c: Course) => {
    const next = c.status === 'published' ? 'draft' : 'published';
    try {
      await updateCourse(c.id, { status: next });
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

      {loading && (
        <div className="text-center py-16">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
        </div>
      )}

      {!loading && courses.length === 0 && (
        <Card className="p-12 text-center border-dashed">
          <BookOpen className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No courses in the system yet.</p>
        </Card>
      )}

      {!loading && courses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((c) => (
            <Card key={c.id} className="p-6 rounded-[24px] border flex flex-col">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-google-blue/10 rounded-xl flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-google-blue" />
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-muted text-muted-foreground">
                    {c.type ?? 'course'}
                  </span>
                </div>
                <h3 className="font-bold text-lg text-foreground mb-1 line-clamp-2">{c.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-1 mb-1">by {c.ownerName ?? 'Unknown'}</p>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{c.description}</p>
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${c.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                    {c.status}
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full font-medium bg-amber-50 text-amber-700">{fmtPrice(c)}</span>
                  {c.isPublic && <span className="text-xs px-2 py-1 rounded-full font-medium bg-blue-50 text-blue-700">Public</span>}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border flex flex-wrap justify-between gap-2">
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(c)}><Edit className="w-4 h-4 mr-1" /> Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => togglePublish(c)}>
                    {c.status === 'published' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
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
            </Card>
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
