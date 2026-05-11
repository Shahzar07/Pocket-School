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

const TYPE_ICONS: Record<string, React.ReactNode> = {
  link: <Link2 className="w-4 h-4 text-blue-500" />,
  video: <Film className="w-4 h-4 text-purple-500" />,
  pdf: <FileText className="w-4 h-4 text-red-500" />,
  doc: <BookOpen className="w-4 h-4 text-teal-500" />,
};

const TYPE_BADGE: Record<string, string> = {
  link: 'bg-blue-100 text-blue-700',
  video: 'bg-purple-100 text-purple-700',
  pdf: 'bg-red-100 text-red-700',
  doc: 'bg-teal-100 text-teal-700',
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
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-2xl" />)}
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Resources</h1>
          <p className="text-muted-foreground text-sm mt-1">Curated learning materials and references.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2 shrink-0">
            <Plus className="w-4 h-4" /> Add Resource
          </Button>
        )}
      </div>

      {showCreate && canCreate && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-foreground">New Resource</h2>
            <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Title *" className="rounded-xl h-11" />
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
          <Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="URL *" className="rounded-xl h-11" />
          <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" className="rounded-xl text-sm resize-none min-h-20" />
          <Button onClick={handleCreate} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Library className="w-4 h-4" />}
            Add Resource
          </Button>
        </motion.div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search resources…" className="rounded-xl h-9 w-64 text-sm" />
        <div className="flex gap-2">
          {['all', 'link', 'video', 'pdf', 'doc'].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${typeFilter === t ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              {t === 'all' ? 'All' : t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Library className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No resources found.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {TYPE_ICONS[r.type]}
                  <Badge className={`rounded-full text-[10px] ${TYPE_BADGE[r.type]}`}>{r.type}</Badge>
                </div>
                {canCreate && (
                  <button onClick={() => handleDelete(r.id!)} className="text-muted-foreground hover:text-red-500 transition-colors shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-foreground leading-tight">{r.title}</h3>
                {r.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</p>}
              </div>
              <a href={r.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline"
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
