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
  merit: 'bg-green-100 text-green-700',
  commendation: 'bg-blue-100 text-blue-700',
  note: 'bg-gray-100 text-gray-700',
  warning: 'bg-yellow-100 text-yellow-800',
  demerit: 'bg-red-100 text-red-700',
};

const TYPE_POINTS: Record<string, number> = { merit: 5, commendation: 10, note: 0, warning: -3, demerit: -5 };

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

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#202124]">Behaviour & Merit</h1>
          <p className="text-sm text-[#5F6368] mt-0.5">Track merits, demerits, commendations, and pastoral notes</p>
        </div>
        <Button onClick={() => setShowForm(s => !s)} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
          <Plus className="w-4 h-4" /> Add Record
        </Button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-[#DADCE0] p-6 space-y-4">
          <h2 className="font-semibold text-[#202124]">New Behaviour Record</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-[#5F6368] mb-1 block">Student Email *</label>
              <Input value={form.studentEmail} onChange={e => setForm(f => ({ ...f, studentEmail: e.target.value }))} placeholder="student@example.com" type="email" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#5F6368] mb-1 block">Type</label>
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
              <label className="text-xs font-medium text-[#5F6368] mb-1 block">Description *</label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Describe the reason for this record…" />
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleCreate} disabled={saving} className="bg-teal-600 hover:bg-teal-700 text-white">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Save Record
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {Object.keys(byStudent).length === 0 && !showForm && (
        <div className="text-center py-16 text-[#5F6368]">
          <Star className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No behaviour records yet</p>
          <p className="text-sm mt-1">Add your first record to start tracking student behaviour.</p>
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(byStudent).map(([sid, d]) => (
          <div key={sid} className="bg-white rounded-xl border border-[#DADCE0] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#DADCE0] bg-[#F8F9FA]">
              <p className="font-semibold text-[#202124]">{d.name}</p>
              <Badge className={d.total >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                {d.total >= 0 ? '+' : ''}{d.total} pts
              </Badge>
            </div>
            <div className="divide-y divide-[#F1F3F4]">
              {d.records.map(r => (
                <div key={r.id} className="px-5 py-3 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Badge className={`shrink-0 mt-0.5 ${TYPE_STYLES[r.type]}`}>{r.type}</Badge>
                    <div>
                      <p className="text-sm text-[#202124]">{r.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{(r.createdAt as any)?.toDate?.().toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${r.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {r.points >= 0 ? '+' : ''}{r.points}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
