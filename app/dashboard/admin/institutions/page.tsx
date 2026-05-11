'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getInstitutions, createInstitution, deleteInstitution, Institution } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Building2, Plus, Trash2, X } from 'lucide-react';

export default function AdminInstitutions() {
  const { user } = useAuthSTORE();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', domain: '', adminId: '' });

  const load = async () => {
    const inst = await getInstitutions();
    setInstitutions(inst);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error('Institution name is required.'); return; }
    if (!user) return;
    setSaving(true);
    try {
      await createInstitution({
        name: form.name.trim(),
        domain: form.domain.trim() || undefined,
        adminId: form.adminId.trim() || user.uid,
        studentCount: 0,
        teacherCount: 0,
        status: 'active',
      });
      toast.success(`${form.name} created!`);
      setForm({ name: '', domain: '', adminId: '' });
      setShowForm(false);
      await load();
    } catch (e: any) {
      toast.error('Failed: ' + e.message);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await deleteInstitution(id);
      toast.success(`${name} deleted.`);
      await load();
    } catch (e: any) {
      toast.error('Failed: ' + e.message);
    }
    setDeleting(null);
  };

  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-2xl" />)}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Institutions</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage schools and organisations on the platform.</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="rounded-xl gap-2 bg-primary text-white">
          <Plus className="w-4 h-4" /> Add Institution
        </Button>
      </div>

      {/* Create form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-md w-full space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-foreground">Add Institution</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Institution Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Lincoln High School" className="rounded-xl h-11" />
              </div>
              <div className="space-y-1.5">
                <Label>Domain (optional)</Label>
                <Input value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} placeholder="e.g. lincoln.edu" className="rounded-xl h-11" />
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button className="flex-1 rounded-xl bg-primary text-white" onClick={handleCreate} disabled={saving}>
                {saving ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {institutions.length === 0 ? (
        <div className="text-center py-16 bg-muted/30 rounded-2xl border border-dashed border-border">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-muted-foreground">No institutions yet.</p>
          <p className="text-sm text-muted-foreground mt-1">Add one using the button above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {institutions.map((inst, i) => (
            <motion.div key={inst.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4"
            >
              <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground">{inst.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{inst.domain || 'No domain'}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge className={`rounded-full text-[10px] ${inst.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  {inst.status}
                </Badge>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive rounded-xl"
                  disabled={deleting === inst.id}
                  onClick={() => handleDelete(inst.id!, inst.name)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
