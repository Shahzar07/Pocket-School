'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { useAccountMode } from '@/hooks/use-account-mode';
import { hasAccountRole } from '@/lib/account-modes';
import { getAnnouncements, createAnnouncement, deleteAnnouncement, updateAnnouncement, Announcement } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AllocationPicker } from '@/components/allocation-picker';
import { describeTargets } from '@/lib/allocation-targets';
import { toast } from 'sonner';
import { Megaphone, Plus, Pin, Trash2, X, Loader2, Bell } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { RichComposer } from '@/components/rich-composer';
import { deliveryWhen, type DeliveryChannel } from '@/lib/compose';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 } }),
};

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-destructive/10 text-destructive border border-destructive/20',
  high: 'bg-[var(--ps-cyan-soft)] text-[var(--ps-cyan-text)] border border-[var(--ps-cyan-border)]/20',
  normal: 'bg-primary/10 text-primary border border-primary/20',
  low: 'bg-muted text-muted-foreground',
};

const PRIORITY_BORDER: Record<string, string> = {
  urgent: 'border-l-destructive',
  high: 'border-l-[var(--ps-cyan-border)]',
  normal: 'border-l-primary',
  low: 'border-l-border',
};

export default function AnnouncementsPage() {
  const { user, profile } = useAuthSTORE();
  const { mode, activeRole } = useAccountMode();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', priority: 'normal' as Announcement['priority'], targets: ['all'] as string[], channels: ['in_app'] as DeliveryChannel[], schedule: '' });

  const canCreate = (mode === 'teacher' && hasAccountRole(profile, 'teacher')) || profile?.role === 'admin';

  const load = async () => {
    if (!profile) return;
    const audience = activeRole === 'admin' ? 'admin'
      : activeRole === 'student' ? 'students'
      : activeRole === 'parent' ? 'parents'
      : activeRole === 'teacher' ? 'teachers'
      : 'all';
    const data = await getAnnouncements(audience);
    setAnnouncements(data.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    }));
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile, activeRole]);

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
        audience: (form.targets.find(target => target === 'all' || target === 'students' || target === 'teachers' || target === 'parents') ?? 'all') as Announcement['audience'],
        targets: form.targets,
        pinned: false,
        createdBy: user.uid,
        createdByName: profile?.name ?? 'Staff',
        createdAt: Timestamp.now(),
        ...(form.channels.length ? { channels: form.channels } : {}),
        ...(form.schedule ? { scheduledFor: form.schedule } : {}),
      } as Announcement);
      toast.success(deliveryWhen(form.schedule) === 'later' ? 'Announcement scheduled.' : 'Announcement created!');
      setForm({ title: '', content: '', priority: 'normal', targets: ['all'], channels: ['in_app'], schedule: '' });
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
    <div className="max-w-6xl mx-auto px-0 sm:px-2 py-2 space-y-5">
      <div className="h-24 bg-muted animate-pulse rounded-3xl" />
      {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-3xl" />)}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">

      {/* Header */}
      <motion.header variants={fadeUp} initial="hidden" animate="visible" custom={0}
        className="pt-2 flex flex-col sm:flex-row sm:items-end justify-between gap-6"
      >
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary flex items-center gap-2">
            <span className="w-5 h-px bg-primary inline-block" /> School news
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-3">
            Latest <span className="gradient-text italic">announcements</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-[15px]">Stay informed with the latest school news.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreate(true)}
            className="rounded-full h-11 px-5 gap-2 font-bold bg-primary hover:opacity-90 text-primary-foreground shrink-0"
          >
            <Plus className="w-4 h-4" /> New Announcement
          </Button>
        )}
      </motion.header>

      {/* Create form */}
      {showCreate && canCreate && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-3xl p-6 sm:p-7 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-2xl text-foreground">New Announcement</h2>
            <button onClick={() => setShowCreate(false)} className="p-2 rounded-xl hover:bg-muted transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Title *" className="rounded-xl h-11 bg-muted/50" />
          <RichComposer
            value={form.content}
            onChange={(content) => setForm((current) => ({ ...current, content }))}
            channels={form.channels}
            onChannels={(channels) => setForm((current) => ({ ...current, channels }))}
            schedule={form.schedule}
            onSchedule={(schedule) => setForm((current) => ({ ...current, schedule }))}
          />
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
            <div className="col-span-2 space-y-1.5">
              <AllocationPicker
                label="Who can see this"
                chips={[
                  { token: 'all', label: 'Everyone' },
                  { token: 'students', label: 'Students' },
                  { token: 'teachers', label: 'Teachers' },
                  { token: 'parents', label: 'Parents' },
                ]}
                value={form.targets}
                onChange={targets => setForm(current => ({ ...current, targets }))}
              />
            </div>
          </div>
          <Button onClick={handleCreate} disabled={saving} className="w-full rounded-full h-11 font-bold bg-primary text-primary-foreground gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
            Post Announcement
          </Button>
        </motion.div>
      )}

      {/* List */}
      {announcements.length === 0 ? (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}
          className="relative text-center py-16 bg-card rounded-[2rem] border border-border overflow-hidden"
        >
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-primary/8 blur-[80px]" />
          <Bell className="w-12 h-12 mx-auto mb-4 text-primary/40" />
          <h3 className="font-heading text-2xl text-foreground mb-1.5">No announcements yet</h3>
          <p className="text-sm text-muted-foreground">Check back later for the latest school news.</p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann, i) => (
            <motion.div key={ann.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.04 }}
              className={`bg-card border-l-4 border border-border rounded-2xl p-5 card-glow ${PRIORITY_BORDER[ann.priority]}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {ann.pinned && <Pin className="w-3.5 h-3.5 text-[var(--ps-cyan-text)] shrink-0" />}
                    <h3 className="font-bold text-foreground">{ann.title}</h3>
                    <Badge className={`rounded-full text-[10px] ${PRIORITY_STYLES[ann.priority]}`}>{ann.priority}</Badge>
                    <Badge className="rounded-full text-[10px] bg-muted text-muted-foreground">{describeTargets(ann.targets?.length ? ann.targets : [ann.audience])}</Badge>
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
                    <button onClick={() => togglePin(ann)} className={`p-1.5 rounded-lg hover:bg-muted transition-colors ${ann.pinned ? 'text-[var(--ps-cyan-text)]' : 'text-muted-foreground'}`}>
                      <Pin className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(ann.id!)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors">
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
