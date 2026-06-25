'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getResources, createResource, deleteResource, Resource } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Library, Plus, Trash2, ExternalLink, X, Loader2, FileText, Link2, Film, BookOpen } from 'lucide-react';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 } }),
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  link: <Link2 className="w-4 h-4 text-primary" />,
  video: <Film className="w-4 h-4 text-violet-600" />,
  pdf: <FileText className="w-4 h-4 text-destructive" />,
  doc: <BookOpen className="w-4 h-4 text-emerald-600" />,
};

const TYPE_BADGE: Record<string, string> = {
  link: 'bg-primary/10 text-primary border border-primary/20',
  video: 'bg-violet-500/10 text-violet-600 border border-violet-500/20',
  pdf: 'bg-destructive/10 text-destructive border border-destructive/20',
  doc: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
};

export default function ResourcesPage() {
  const { user, profile } = useAuthSTORE();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [form, setForm] = useState({ title: '', description: '', url: '', type: 'link' as Resource['type'] });

  const canCreate = profile?.role === 'teacher' || profile?.role === 'admin';

  const load = async () => {
    const data = await getResources();
    setResources(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!user || !form.title.trim() || !form.url.trim()) { toast.error('Title and URL are required.'); return; }
    setSaving(true);
    try {
      await createResource({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        url: form.url.trim(),
        type: form.type,
        tags: [],
        uploadedBy: user.uid,
        uploadedByName: profile?.name ?? 'Staff',
        isPublic: true,
      });
      toast.success('Resource added!');
      setForm({ title: '', description: '', url: '', type: 'link' });
      setShowCreate(false);
      await load();
    } catch { toast.error('Failed to add resource.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await deleteResource(id);
    setResources(prev => prev.filter(r => r.id !== id));
    toast.success('Deleted.');
  };

  const filtered = resources.filter(r => {
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) || (r.description ?? '').toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || r.type === typeFilter;
    return matchSearch && matchType;
  });

  if (loading) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 py-2 space-y-5">
      <div className="h-24 bg-muted animate-pulse rounded-3xl" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-3xl" />)}
      </div>
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
            <span className="w-5 h-px bg-primary inline-block" /> Knowledge base
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-3">
            Learning <span className="gradient-text italic">resources</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-[15px]">Curated learning materials and references.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreate(true)}
            className="rounded-full h-11 px-5 gap-2 font-bold bg-gradient-to-r from-[#1A73E8] to-[#7C3AED] hover:opacity-90 text-white shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Resource
          </Button>
        )}
      </motion.header>

      {/* Create form */}
      {showCreate && canCreate && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-3xl p-6 sm:p-7 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-2xl text-foreground">New Resource</h2>
            <button onClick={() => setShowCreate(false)} className="p-2 rounded-xl hover:bg-muted transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Title *" className="rounded-xl h-11 bg-muted/50" />
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: (v ?? 'link') as any }))}>
              <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="link">Link</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="doc">Document</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="URL *" className="rounded-xl h-11 bg-muted/50" />
          <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" className="rounded-xl text-sm resize-none min-h-20 bg-muted/50" />
          <Button onClick={handleCreate} disabled={saving} className="w-full rounded-full h-11 font-bold bg-gradient-to-r from-[#1A73E8] to-[#7C3AED] text-white gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Library className="w-4 h-4" />}
            Add Resource
          </Button>
        </motion.div>
      )}

      {/* Filters */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}
        className="flex flex-wrap gap-3"
      >
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search resources…" className="rounded-full h-10 w-64 text-sm bg-muted/50 px-4" />
        <div className="flex gap-2">
          {['all', 'link', 'video', 'pdf', 'doc'].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-colors ${typeFilter === t ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
            >
              {t === 'all' ? 'All' : t.toUpperCase()}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}
          className="relative text-center py-16 bg-card rounded-[2rem] border border-border overflow-hidden"
        >
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-primary/8 blur-[80px]" />
          <Library className="w-12 h-12 mx-auto mb-4 text-primary/40" />
          <h3 className="font-heading text-2xl text-foreground mb-1.5">No resources found</h3>
          <p className="text-sm text-muted-foreground">Try a different search or add a new resource.</p>
        </motion.div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((r, i) => (
            <motion.div key={r.id} variants={fadeUp} initial="hidden" animate="visible" custom={2 + i}
              className="bg-card border border-border rounded-3xl p-5 flex flex-col gap-3 card-glow"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {TYPE_ICONS[r.type]}
                  <Badge className={`rounded-full text-[10px] ${TYPE_BADGE[r.type]}`}>{r.type}</Badge>
                </div>
                {canCreate && (
                  <button onClick={() => handleDelete(r.id!)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-foreground leading-tight">{r.title}</h3>
                {r.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</p>}
              </div>
              <a href={r.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                Open <ExternalLink className="w-3 h-3" />
              </a>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
