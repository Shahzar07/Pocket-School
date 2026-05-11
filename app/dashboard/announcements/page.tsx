'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getAnnouncements, createAnnouncement, deleteAnnouncement, updateAnnouncement, Announcement } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Megaphone, Plus, Pin, Trash2, X, Loader2, Bell } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  normal: 'bg-blue-100 text-blue-700 border-blue-200',
  low: 'bg-gray-100 text-gray-600 border-gray-200',
};

const PRIORITY_BORDER: Record<string, string> = {
  urgent: 'border-l-red-500',
  high: 'border-l-orange-500',
  normal: 'border-l-blue-500',
  low: 'border-l-gray-300',
};

export default function AnnouncementsPage() {
  const { user, profile } = useAuthSTORE();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', priority: 'normal' as Announcement['priority'], audience: 'all' as string });

  const canCreate = profile?.role === 'teacher' || profile?.role === 'admin';

  const load = async () => {
    if (!profile) return;
    const audience = profile.role === 'student' ? 'students' : profile.role === 'parent' ? 'parents' : 'all';
    const data = await getAnnouncements(audience as 'all' | 'students' | 'parents' | 'teachers');
    setAnnouncements(data.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    }));
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile]);

  const handleCreate = async () => {
    if (!user || !form.title.trim() || !form.content.trim()) {
      toast.error('Fill in all required fields.');
      return;
    }
    setSaving(true);
    try {
      await createAnnouncement({
        title: form.title.trim(),
        content: form.content.trim(),
        priority: form.priority,
        audience: form.audience as Announcement['audience'],
        pinned: false,
        createdBy: user.uid,
        createdByName: profile?.name ?? 'Staff',
        createdAt: Timestamp.now(),
      });
      toast.success('Announcement created!');
      setForm({ title: '', content: '', priority: 'normal', audience: 'all' });
      setShowCreate(false);
      await load();
    } catch { toast.error('Failed to create announcement.'); }
    finally { setSaving(false); }
  };

  const togglePin = async (ann: Announcement) => {
    await updateAnnouncement(ann.id!, { pinned: !ann.pinned });
    await load();
  };

  const handleDelete = async (id: string) => {
    await deleteAnnouncement(id);
    setAnnouncements(prev => prev.filter(a => a.id !== id));
    toast.success('Deleted.');
  };

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-2xl" />)}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Announcements</h1>
          <p className="text-muted-foreground text-sm mt-1">Stay informed with the latest school news.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2">
            <Plus className="w-4 h-4" /> New
          </Button>
        )}
      </div>

      {showCreate && canCreate && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-foreground">New Announcement</h2>
            <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
          </div>
          <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Title *" className="rounded-xl h-11" />
          <Textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Message *" className="rounded-xl min-h-24 text-sm resize-none" />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Priority</label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: (v ?? 'normal') as any }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Audience</label>
              <Select value={form.audience} onValueChange={v => setForm(f => ({ ...f, audience: v ?? 'all' }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Everyone</SelectItem>
                  <SelectItem value="students">Students</SelectItem>
                  <SelectItem value="teachers">Teachers</SelectItem>
                  <SelectItem value="parents">Parents</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleCreate} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
            Post Announcement
          </Button>
        </motion.div>
      )}

      {announcements.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No announcements yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann, i) => (
            <motion.div key={ann.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className={`bg-card border-l-4 border border-border rounded-2xl p-5 ${PRIORITY_BORDER[ann.priority]}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {ann.pinned && <Pin className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                    <h3 className="font-bold text-foreground">{ann.title}</h3>
                    <Badge className={`rounded-full text-[10px] border ${PRIORITY_STYLES[ann.priority]}`}>{ann.priority}</Badge>
                    <Badge className="rounded-full text-[10px] bg-gray-100 text-gray-600 border-gray-200">{ann.audience}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{ann.content}</p>
                  {ann.createdAt && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {ann.createdAt.toDate?.().toLocaleDateString()}
                    </p>
                  )}
                </div>
                {canCreate && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => togglePin(ann)} className={`p-1.5 rounded-lg hover:bg-muted transition-colors ${ann.pinned ? 'text-amber-500' : 'text-muted-foreground'}`}>
                      <Pin className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(ann.id!)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
