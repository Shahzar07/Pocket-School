'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  getInstitutions, createInstitution, deleteInstitution, updateInstitution,
  normaliseSubdomain, isSubdomainAvailable, Institution,
} from '@/lib/db';
import { institutionOrigin } from '@/lib/white-label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Building2, Plus, Trash2, X, Users, Globe, Palette } from 'lucide-react';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 } }),
};

export default function AdminInstitutions() {
  const { user } = useAuthSTORE();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', domain: '', adminId: '' });

  const [branding, setBranding] = useState<Institution | null>(null);
  const [savingBrand, setSavingBrand] = useState(false);
  const [bForm, setBForm] = useState({
    subdomain: '', displayName: '', tagline: '', logoUrl: '', primaryColor: '', hidePoweredBy: false,
  });

  const openBranding = (inst: Institution) => {
    setBranding(inst);
    setBForm({
      subdomain: inst.subdomain ?? '',
      displayName: inst.branding?.displayName ?? '',
      tagline: inst.branding?.tagline ?? '',
      logoUrl: inst.branding?.logoUrl ?? '',
      primaryColor: inst.branding?.primaryColor ?? '',
      hidePoweredBy: !!inst.branding?.hidePoweredBy,
    });
  };

  const saveBranding = async () => {
    if (!branding?.id) return;
    const raw = bForm.subdomain.trim();
    let subdomain: string | undefined;

    if (raw) {
      const normalised = normaliseSubdomain(raw);
      if (!normalised) {
        toast.error('That subdomain is reserved or invalid. Use 3–63 letters, numbers or hyphens.');
        return;
      }
      // Two institutions resolving to one host would make the tenant lookup
      // non-deterministic, so check before writing.
      const free = await isSubdomainAvailable(normalised, branding.id).catch(() => false);
      if (!free) {
        toast.error(`“${normalised}” is already taken by another institution.`);
        return;
      }
      subdomain = normalised;
    }

    setSavingBrand(true);
    try {
      const patch: Partial<Institution> = {
        subdomain: subdomain ?? '',
        branding: {
          displayName: bForm.displayName.trim() || undefined,
          tagline: bForm.tagline.trim() || undefined,
          logoUrl: bForm.logoUrl.trim() || undefined,
          primaryColor: bForm.primaryColor.trim() || undefined,
          hidePoweredBy: bForm.hidePoweredBy,
        },
      };
      await updateInstitution(branding.id, patch);
      setInstitutions(list => list.map(i => (i.id === branding.id ? { ...i, ...patch } : i)));
      toast.success(subdomain ? `Live at ${institutionOrigin(subdomain)}` : 'Branding saved.');
      setBranding(null);
    } catch {
      toast.error('Could not save that branding.');
    } finally {
      setSavingBrand(false);
    }
  };

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

  const active = institutions.filter(i => i.status === 'active');
  const pending = institutions.filter(i => i.status !== 'active');

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
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-600 flex items-center gap-2">
            <span className="w-5 h-px bg-violet-600 inline-block" /> Organization management
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-3">
            All <span className="gradient-text italic">institutions</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-[15px]">Manage schools and organisations on the platform.</p>
        </div>
        <Button onClick={() => setShowForm(true)}
          className="rounded-full h-11 px-5 gap-2 font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 text-white shrink-0"
        >
          <Plus className="w-4 h-4" /> Add Institution
        </Button>
      </motion.header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-5">
        {[
          { label: 'Total', value: institutions.length, icon: Building2, accent: 'text-violet-600', bar: 'bg-violet-500' },
          { label: 'Active', value: active.length, icon: Users, accent: 'text-emerald-600', bar: 'bg-emerald-500' },
          { label: 'Pending', value: pending.length, icon: Globe, accent: 'text-amber-600', bar: 'bg-amber-500' },
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

      {/* Create form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-3xl p-7 max-w-md w-full space-y-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-2xl text-foreground">Add Institution</h2>
              <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setShowForm(false)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Institution Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Lincoln High School" className="rounded-xl h-11 bg-muted/50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Domain (optional)</Label>
                <Input value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} placeholder="e.g. lincoln.edu" className="rounded-xl h-11 bg-muted/50" />
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-full h-11 font-semibold" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button className="flex-1 rounded-full h-11 font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white" onClick={handleCreate} disabled={saving}>
                {saving ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* White-label configuration */}
      {branding && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-card border border-border rounded-3xl p-7 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading text-2xl text-foreground">White-label</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{branding.name}</p>
              </div>
              <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setBranding(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Subdomain</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={bForm.subdomain}
                    onChange={e => setBForm(f => ({ ...f, subdomain: e.target.value }))}
                    placeholder="kolej-utama"
                    className="rounded-xl h-11 bg-muted/50"
                  />
                  <span className="text-sm text-muted-foreground shrink-0">.poketschool.ai</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Letters, numbers and hyphens, 3–63 characters. Point a CNAME at the platform to serve it.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Display name</Label>
                <Input value={bForm.displayName} onChange={e => setBForm(f => ({ ...f, displayName: e.target.value }))}
                  placeholder={branding.name} className="rounded-xl h-11 bg-muted/50" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Tagline</Label>
                <Input value={bForm.tagline} onChange={e => setBForm(f => ({ ...f, tagline: e.target.value }))}
                  placeholder="Learning, personalised." className="rounded-xl h-11 bg-muted/50" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Logo URL</Label>
                <Input value={bForm.logoUrl} onChange={e => setBForm(f => ({ ...f, logoUrl: e.target.value }))}
                  placeholder="https://…/logo.svg" className="rounded-xl h-11 bg-muted/50" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Accent colour</Label>
                <div className="flex items-center gap-2">
                  <input type="color" aria-label="Accent colour"
                    value={/^#[0-9a-fA-F]{6}$/.test(bForm.primaryColor) ? bForm.primaryColor : '#f5c451'}
                    onChange={e => setBForm(f => ({ ...f, primaryColor: e.target.value }))}
                    className="h-11 w-14 rounded-xl border border-border bg-muted/50 cursor-pointer" />
                  <Input value={bForm.primaryColor} onChange={e => setBForm(f => ({ ...f, primaryColor: e.target.value }))}
                    placeholder="#f5c451" className="rounded-xl h-11 bg-muted/50" />
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-sm text-foreground cursor-pointer">
                <input type="checkbox" checked={bForm.hidePoweredBy}
                  onChange={e => setBForm(f => ({ ...f, hidePoweredBy: e.target.checked }))}
                  className="w-4 h-4 rounded" />
                Hide “Powered by Poket School”
              </label>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-full h-11 font-semibold" onClick={() => setBranding(null)}>
                Cancel
              </Button>
              <Button className="flex-1 rounded-full h-11 font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white"
                onClick={saveBranding} disabled={savingBrand}>
                {savingBrand ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Institutions list */}
      <motion.section variants={fadeUp} initial="hidden" animate="visible" custom={4}>
        <div className="mb-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-600">Directory</p>
          <h2 className="font-heading text-3xl text-foreground mt-1.5">All organizations</h2>
        </div>

        {institutions.length === 0 ? (
          <div className="relative text-center py-16 bg-card rounded-[2rem] border border-border overflow-hidden">
            <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-violet-500/8 blur-[80px]" />
            <Building2 className="w-12 h-12 mx-auto mb-4 text-violet-600/40" />
            <h3 className="font-heading text-2xl text-foreground mb-1.5">No institutions yet</h3>
            <p className="text-sm text-muted-foreground">Add one using the button above to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {institutions.map((inst, i) => (
              <motion.div key={inst.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.06 }}
                className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 card-glow"
              >
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shrink-0 text-white font-bold shadow-md">
                  {inst.name?.charAt(0)?.toUpperCase() ?? 'I'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground text-sm truncate">{inst.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {inst.subdomain
                      ? <span className="text-violet-600 font-medium">{inst.subdomain}.poketschool.ai</span>
                      : (inst.domain || 'No domain set')}
                  </p>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shrink-0 ${inst.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'}`}>
                  {inst.status}
                </span>
                <Button variant="ghost" size="sm" className="rounded-xl shrink-0 text-xs font-semibold gap-1.5"
                  onClick={() => openBranding(inst)}
                >
                  <Palette className="w-3.5 h-3.5" /> White-label
                </Button>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive rounded-xl shrink-0"
                  disabled={deleting === inst.id}
                  onClick={() => handleDelete(inst.id!, inst.name)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                </motion.div>
            ))}
          </div>
        )}
      </motion.section>
    </div>
  );
}
