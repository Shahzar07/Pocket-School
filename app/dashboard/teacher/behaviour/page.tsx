'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  getBehaviourRecordsForTeacher, createBehaviourRecord, BehaviourRecord,
  getUserByEmail,
} from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Star, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

const TYPE_STYLES: Record<string, string> = {
  merit: 'bg-emerald-500/10 text-emerald-700',
  commendation: 'bg-blue-500/10 text-blue-700',
  note: 'bg-muted text-muted-foreground',
  warning: 'bg-amber-500/10 text-amber-700',
  demerit: 'bg-red-500/10 text-red-700',
};

const TYPE_POINTS: Record<string, number> = { merit: 5, commendation: 10, note: 0, warning: -3, demerit: -5 };

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 },
  }),
};

export default function BehaviourPage() {
  const { user, profile } = useAuthSTORE();
  const [records, setRecords] = useState<BehaviourRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ studentEmail: '', type: 'merit' as BehaviourRecord['type'], description: '' });

  const load = async () => {
    if (!user) return;
    const r = await getBehaviourRecordsForTeacher(user.uid);
    setRecords(r);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  async function handleCreate() {
    if (!user || !profile) return;
    if (!form.studentEmail.trim() || !form.description.trim()) { toast.error('All fields required'); return; }
    setSaving(true);
    try {
      const student = await getUserByEmail(form.studentEmail.trim());
      if (!student) { toast.error('Student not found'); setSaving(false); return; }
      await createBehaviourRecord({
        studentId: student.id, studentName: student.data.name,
        type: form.type, points: TYPE_POINTS[form.type] ?? 0,
        description: form.description, recordedBy: user.uid, recordedByName: profile.name,
      });
      toast.success('Record added!');
      setForm({ studentEmail: '', type: 'merit', description: '' });
      setShowForm(false);
      await load();
    } finally { setSaving(false); }
  }

  const byStudent = records.reduce<Record<string, { name: string; records: BehaviourRecord[]; total: number }>>((acc, r) => {
    if (!acc[r.studentId]) acc[r.studentId] = { name: r.studentName, records: [], total: 0 };
    acc[r.studentId].records.push(r);
    acc[r.studentId].total += r.points;
    return acc;
  }, {});

  if (loading) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10 pt-10">
      <div className="space-y-4">
        <div className="bg-muted animate-pulse rounded-3xl h-24" />
        <div className="bg-muted animate-pulse rounded-3xl h-24" />
        <div className="bg-muted animate-pulse rounded-3xl h-24" />
      </div>
    </div>
  );

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeUp}
      className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10"
    >
      {/* Header */}
      <motion.div variants={fadeUp} custom={0} className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600">
            Behaviour & Merit
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-1">
            Student <span className="gradient-text italic">Behaviour</span>
          </h1>
        </div>
        <Button
          onClick={() => setShowForm(s => !s)}
          className="rounded-full h-11 px-5 font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:opacity-90 gap-2"
        >
          <Plus className="w-4 h-4" /> Add Record
        </Button>
      </motion.div>

      {/* Form */}
      {showForm && (
        <motion.div
          variants={fadeUp}
          custom={1}
          className="bg-card border border-border rounded-3xl p-6 sm:p-8 card-glow space-y-5"
        >
          <h2 className="font-heading text-xl text-foreground">New Behaviour Record</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Student Email *</label>
              <Input value={form.studentEmail} onChange={e => setForm(f => ({ ...f, studentEmail: e.target.value }))} placeholder="student@example.com" type="email" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as BehaviourRecord['type'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="merit">Merit (+5 pts)</SelectItem>
                  <SelectItem value="commendation">Commendation (+10 pts)</SelectItem>
                  <SelectItem value="note">Note (0 pts)</SelectItem>
                  <SelectItem value="warning">Warning (-3 pts)</SelectItem>
                  <SelectItem value="demerit">Demerit (-5 pts)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Description *</label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Describe the reason for this record..." />
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleCreate}
              disabled={saving}
              className="rounded-full h-11 px-5 font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:opacity-90"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Save Record
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-full h-11 px-5 font-bold">
              Cancel
            </Button>
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {Object.keys(byStudent).length === 0 && !showForm && (
        <motion.div variants={fadeUp} custom={1} className="relative flex flex-col items-center justify-center py-24 text-center">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl" />
          </div>
          <Star className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
          <p className="font-heading text-2xl text-foreground">No behaviour records yet</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs">Add your first record to start tracking student behaviour.</p>
        </motion.div>
      )}

      {/* Student records */}
      {Object.keys(byStudent).length > 0 && (
        <motion.div variants={fadeUp} custom={2} className="space-y-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600">Overview</p>
            <h2 className="font-heading text-3xl text-foreground tracking-tight mt-1">Student Records</h2>
          </div>

          <div className="space-y-4">
            {Object.entries(byStudent).map(([sid, d], idx) => (
              <motion.div
                key={sid}
                variants={fadeUp}
                custom={idx + 3}
                className="bg-card border border-border rounded-3xl overflow-hidden card-glow"
              >
                <div className="bg-muted/50 px-5 py-3 border-b border-border flex items-center justify-between">
                  <p className="font-heading text-lg text-foreground">{d.name}</p>
                  <Badge className={d.total >= 0 ? 'bg-emerald-500/10 text-emerald-700' : 'bg-red-500/10 text-red-700'}>
                    {d.total >= 0 ? '+' : ''}{d.total} pts
                  </Badge>
                </div>
                <div className="divide-y divide-border">
                  {d.records.map(r => (
                    <div key={r.id} className="px-5 py-3 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <Badge className={`shrink-0 mt-0.5 ${TYPE_STYLES[r.type]}`}>{r.type}</Badge>
                        <div>
                          <p className="text-sm text-foreground">{r.description}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{(r.createdAt as any)?.toDate?.().toLocaleDateString()}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-bold shrink-0 ${r.points >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {r.points >= 0 ? '+' : ''}{r.points}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
