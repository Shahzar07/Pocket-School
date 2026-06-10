'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  getProgrammes, createProgramme, getAllCurriculumModules, createCurriculumModule,
  Programme, Course,
} from '@/lib/db';
import { seedY7ScienceUnit1 } from '@/lib/curriculum-seed';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus, Layers, Sparkles, BookOpen, ChevronRight } from 'lucide-react';
import Link from 'next/link';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending_approval: 'bg-amber-50 text-amber-700 border border-amber-200',
  published: 'bg-emerald-50 text-emerald-700',
};

const YEAR_GROUPS = ['Year 7', 'Year 8', 'Year 9'];

export default function AdminCurriculumPage() {
  const { user } = useAuthSTORE();
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [modules, setModules] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  // New programme form
  const [showProgrammeForm, setShowProgrammeForm] = useState(false);
  const [progName, setProgName] = useState('');
  const [progSubjects, setProgSubjects] = useState('');
  const [progYearGroups, setProgYearGroups] = useState('Year 7, Year 8, Year 9');
  const [progTier, setProgTier] = useState<'free' | 'academic'>('academic');
  const [creatingProgramme, setCreatingProgramme] = useState(false);

  // New curriculum module form
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [modTitle, setModTitle] = useState('');
  const [modSubject, setModSubject] = useState('');
  const [modYearGroup, setModYearGroup] = useState(YEAR_GROUPS[0]);
  const [modProgrammeId, setModProgrammeId] = useState<string>('');
  const [creatingModule, setCreatingModule] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [progs, mods] = await Promise.all([getProgrammes(), getAllCurriculumModules()]);
      setProgrammes(progs);
      setModules(mods);
      if (progs.length > 0) setModProgrammeId(prev => prev || progs[0].id);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load curriculum data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSeed = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      const result = await seedY7ScienceUnit1(user.uid);
      if (result.created) {
        toast.success(`Seeded "Science — Year 7" with ${result.lessonsCreated} lessons.`);
      } else {
        toast.info('Science — Year 7 already exists — nothing to seed.');
      }
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Seeding failed.');
    } finally {
      setSeeding(false);
    }
  };

  const handleCreateProgramme = async () => {
    if (!progName.trim()) { toast.error('Enter a programme name.'); return; }
    setCreatingProgramme(true);
    try {
      await createProgramme({
        name: progName.trim(),
        yearGroups: progYearGroups.split(',').map(s => s.trim()).filter(Boolean),
        subjects: progSubjects.split(',').map(s => s.trim()).filter(Boolean),
        requiredTier: progTier,
        status: 'active',
      });
      toast.success('Programme created.');
      setProgName('');
      setProgSubjects('');
      setProgYearGroups('Year 7, Year 8, Year 9');
      setProgTier('academic');
      setShowProgrammeForm(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create programme.');
    } finally {
      setCreatingProgramme(false);
    }
  };

  const handleCreateModule = async () => {
    if (!user) return;
    if (!modTitle.trim()) { toast.error('Enter a module title.'); return; }
    if (!modSubject.trim()) { toast.error('Enter a subject.'); return; }
    setCreatingModule(true);
    try {
      const courseId = await createCurriculumModule({
        title: modTitle.trim(),
        description: `${modSubject.trim()} curriculum module — ${modYearGroup}`,
        subject: modSubject.trim(),
        ownerId: user.uid,
        status: 'draft',
        isPublic: false,
        yearGroup: modYearGroup,
        programmeId: modProgrammeId || undefined,
      });
      toast.success('Curriculum module created.');
      setModTitle('');
      setModSubject('');
      setModYearGroup(YEAR_GROUPS[0]);
      setShowModuleForm(false);
      await load();
      window.location.href = `/dashboard/admin/curriculum/${courseId}`;
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create module.');
    } finally {
      setCreatingModule(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-16 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Layers className="w-7 h-7 text-blue-600" /> Curriculum CMS
          </h1>
          <p className="text-muted-foreground mt-1">
            Programmes, curriculum modules and the lesson generation/review pipeline.
          </p>
        </div>
        <Button onClick={handleSeed} disabled={seeding} variant="outline" className="gap-2 rounded-xl">
          <Sparkles className="w-4 h-4" />
          {seeding ? 'Seeding…' : 'Seed Y7 Science Unit 1'}
        </Button>
      </div>

      {/* Programmes */}
      <Card className="p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-foreground text-lg">Programmes ({programmes.length})</h2>
          <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" onClick={() => setShowProgrammeForm(o => !o)}>
            <Plus className="w-3.5 h-3.5" /> New Programme
          </Button>
        </div>

        {showProgrammeForm && (
          <div className="mb-4 p-4 bg-muted/40 rounded-xl border border-dashed border-border space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input value={progName} onChange={e => setProgName(e.target.value)} placeholder="e.g. iLowerSecondary" className="rounded-xl h-10" />
              </div>
              <div className="space-y-1.5">
                <Label>Required tier</Label>
                <Select value={progTier} onValueChange={v => setProgTier(v as 'free' | 'academic')}>
                  <SelectTrigger className="rounded-xl h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="academic">Academic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Year groups (comma-separated)</Label>
                <Input value={progYearGroups} onChange={e => setProgYearGroups(e.target.value)} className="rounded-xl h-10" />
              </div>
              <div className="space-y-1.5">
                <Label>Subjects (comma-separated)</Label>
                <Input value={progSubjects} onChange={e => setProgSubjects(e.target.value)} placeholder="e.g. Science, Maths, English, Computing" className="rounded-xl h-10" />
              </div>
            </div>
            <Button onClick={handleCreateProgramme} disabled={creatingProgramme} className="rounded-xl">
              {creatingProgramme ? 'Creating…' : 'Create Programme'}
            </Button>
          </div>
        )}

        {programmes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No programmes yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {programmes.map(p => (
              <div key={p.id} className="border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-bold text-foreground">{p.name}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    p.requiredTier === 'academic' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                  }`}>
                    {p.requiredTier === 'academic' ? 'Academic' : 'Free'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{p.yearGroups?.join(' · ')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{p.subjects?.join(', ')}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Curriculum modules */}
      <Card className="p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-foreground text-lg">Curriculum Modules ({modules.length})</h2>
          <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" onClick={() => setShowModuleForm(o => !o)}>
            <Plus className="w-3.5 h-3.5" /> New Module
          </Button>
        </div>

        {showModuleForm && (
          <div className="mb-4 p-4 bg-muted/40 rounded-xl border border-dashed border-border space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Title *</Label>
                <Input value={modTitle} onChange={e => setModTitle(e.target.value)} placeholder="e.g. Maths — Year 7" className="rounded-xl h-10" />
              </div>
              <div className="space-y-1.5">
                <Label>Subject *</Label>
                <Input value={modSubject} onChange={e => setModSubject(e.target.value)} placeholder="e.g. Maths" className="rounded-xl h-10" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Year group</Label>
                <Select value={modYearGroup} onValueChange={(v) => setModYearGroup(v ?? '')}>
                  <SelectTrigger className="rounded-xl h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {YEAR_GROUPS.map(yg => <SelectItem key={yg} value={yg}>{yg}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Programme</Label>
                <Select value={modProgrammeId} onValueChange={(v) => setModProgrammeId(v ?? '')} disabled={programmes.length === 0}>
                  <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    {programmes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleCreateModule} disabled={creatingModule} className="rounded-xl">
              {creatingModule ? 'Creating…' : 'Create Module'}
            </Button>
          </div>
        )}

        {modules.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No curriculum modules yet — seed Y7 Science or create one.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {modules.map(m => (
              <Link
                key={m.id}
                href={`/dashboard/admin/curriculum/${m.id}`}
                className="flex items-center justify-between gap-4 py-3.5 hover:bg-muted/40 transition-colors -mx-2 px-2 rounded-lg"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">{m.title}</p>
                  <p className="text-xs text-muted-foreground">{m.subject} · {m.yearGroup ?? '—'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE[m.status] ?? STATUS_BADGE.draft}`}>
                    {m.status}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
