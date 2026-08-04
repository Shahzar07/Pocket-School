'use client';

import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  getProgrammes, createProgramme, updateProgramme, deleteProgramme,
  getAllCurriculumModules, createCurriculumModule,
  createModule, createLesson,
  Programme, Course,
} from '@/lib/db';
import { seedY7ScienceUnit1 } from '@/lib/curriculum-seed';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Loader2, Plus, Layers, Sparkles, BookOpen, ChevronRight, Wand2, Check, RotateCcw,
  Pencil, Trash2,
} from 'lucide-react';
import Link from 'next/link';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending_approval: 'bg-amber-50 text-amber-700 border border-amber-200',
  published: 'bg-emerald-50 text-emerald-700',
};

/** Year/Level is free text — these are only suggestions, not a fixed list. */
const YEAR_LEVEL_SUGGESTIONS = [
  ...Array.from({ length: 13 }, (_, i) => `Year ${i + 1}`),
  'Foundation', 'Advanced', 'Tertiary', 'K-12',
];

/** A teaching week is planned as 5 × 60-minute sessions. */
const MINUTES_PER_WEEK = 300;
const DEFAULT_BLOCKS = ['objectives', 'video', 'text', 'vocabulary', 'quiz'];

interface OutlineLesson { title: string; objectives: string[]; durationWeeks: number }
interface OutlineModule { title: string; description: string; lessons: OutlineLesson[] }

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
  /** Programme being edited; null means the form creates a new one. */
  const [editingProgramme, setEditingProgramme] = useState<Programme | null>(null);
  const [deletingProgramme, setDeletingProgramme] = useState<string | null>(null);

  // New curriculum module form
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [modTitle, setModTitle] = useState('');
  const [modSubject, setModSubject] = useState('');
  const [modYearGroup, setModYearGroup] = useState('Year 7');
  const [modProgrammeId, setModProgrammeId] = useState<string>('');
  const [creatingModule, setCreatingModule] = useState(false);

  // AI Course Architect (Quill)
  const [archSubject, setArchSubject] = useState('');
  const [archYear, setArchYear] = useState('Year 7');
  const [archWeeks, setArchWeeks] = useState('12');
  const [archTitle, setArchTitle] = useState('');
  const [archOutline, setArchOutline] = useState<OutlineModule[] | null>(null);
  const [archDesigning, setArchDesigning] = useState(false);
  const [archCreating, setArchCreating] = useState(false);
  const [archProgress, setArchProgress] = useState<{ done: number; total: number; step: string } | null>(null);

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

  /* ── AI Course Architect ─────────────────────────────────── */

  const lessonCount = (archOutline ?? []).reduce((n, m) => n + m.lessons.length, 0);
  const plannedWeeks = (archOutline ?? []).reduce(
    (n, m) => n + m.lessons.reduce((x, l) => x + (l.durationWeeks || 1), 0), 0
  );

  const designWithQuill = async () => {
    const subject = archSubject.trim();
    if (!subject) { toast.error('Enter a subject for Quill to design.'); return; }
    const weeks = Math.min(52, Math.max(1, Number(archWeeks) || 12));
    setArchDesigning(true);
    setArchOutline(null);
    try {
      const res = await fetch('/api/ai/course-architect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: 'outline', context: { subject, yearLevel: archYear.trim(), weeks } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Quill could not design that course.');
      const modules: OutlineModule[] = Array.isArray(data.modules) ? data.modules : [];
      if (!modules.length) throw new Error('Quill returned an empty outline — try again.');
      setArchOutline(modules);
      setArchTitle(prev => prev.trim() || `${subject}${archYear.trim() ? ` — ${archYear.trim()}` : ''}`);
      toast.success(`Quill designed ${modules.length} modules.`);
    } catch (e: any) {
      toast.error(e?.message || 'Quill request failed.');
    } finally {
      setArchDesigning(false);
    }
  };

  const createFromOutline = async () => {
    if (!user || !archOutline?.length) return;
    const title = archTitle.trim() || `${archSubject.trim()} — ${archYear.trim()}`;
    const total = 1 + archOutline.length + lessonCount;
    let done = 0;
    const tick = (step: string) => { done += 1; setArchProgress({ done, total, step }); };

    setArchCreating(true);
    setArchProgress({ done: 0, total, step: 'Creating subject…' });
    try {
      const courseId = await createCurriculumModule({
        title,
        description: `${archSubject.trim()} — ${archYear.trim() || 'all levels'} · designed with Quill`,
        subject: archSubject.trim(),
        ownerId: user.uid,
        status: 'draft',
        isPublic: false,
        yearGroup: archYear.trim() || undefined,
        programmeId: modProgrammeId || undefined,
      });
      tick('Subject created');

      for (const [mi, m] of archOutline.entries()) {
        const moduleId = await createModule(courseId, {
          title: m.title,
          description: m.description,
          courseId,
          order: mi + 1,
          unitNumber: mi + 1,
          masteryThreshold: 70,
        });
        tick(`Module ${mi + 1}: ${m.title}`);

        for (const [li, l] of m.lessons.entries()) {
          await createLesson(courseId, moduleId, {
            title: l.title,
            moduleId,
            courseId,
            order: li + 1,
            lessonNumber: li + 1,
            status: 'draft',
            lessonType: 'lesson',
            bloomsLevel: 'Understand',
            blocksOrder: DEFAULT_BLOCKS,
            durationMinutes: Math.max(1, l.durationWeeks || 1) * MINUTES_PER_WEEK,
            objectives: (l.objectives ?? []).map(text => ({ text, bloom: 'Understand' })),
          });
          tick(`Lesson: ${l.title}`);
        }
      }

      toast.success(`Created ${archOutline.length} modules and ${lessonCount} lessons.`);
      window.location.href = `/dashboard/admin/curriculum/${courseId}`;
    } catch (e: any) {
      toast.error(e?.message || 'Could not create the course structure.');
      setArchCreating(false);
      setArchProgress(null);
      load();
    }
  };

  const resetProgrammeForm = () => {
    setProgName('');
    setProgSubjects('');
    setProgYearGroups('Year 7, Year 8, Year 9');
    setProgTier('academic');
    setEditingProgramme(null);
    setShowProgrammeForm(false);
  };

  /** Load a programme into the shared form so editing reuses one form, not two. */
  const startEditProgramme = (p: Programme) => {
    setEditingProgramme(p);
    setProgName(p.name);
    setProgSubjects((p.subjects ?? []).join(', '));
    setProgYearGroups((p.yearGroups ?? []).join(', '));
    setProgTier(p.requiredTier ?? 'academic');
    setShowProgrammeForm(true);
  };

  const handleSaveProgramme = async () => {
    if (!progName.trim()) { toast.error('Enter a programme name.'); return; }
    setCreatingProgramme(true);
    const payload = {
      name: progName.trim(),
      yearGroups: progYearGroups.split(',').map(s => s.trim()).filter(Boolean),
      subjects: progSubjects.split(',').map(s => s.trim()).filter(Boolean),
      requiredTier: progTier,
    };
    try {
      if (editingProgramme) {
        await updateProgramme(editingProgramme.id, payload);
        toast.success('Programme updated.');
      } else {
        await createProgramme({ ...payload, status: 'active' });
        toast.success('Programme created.');
      }
      resetProgrammeForm();
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save programme.');
    } finally {
      setCreatingProgramme(false);
    }
  };

  const handleDeleteProgramme = async (p: Programme) => {
    if (!confirm(`Delete the programme "${p.name}"? This cannot be undone.`)) return;
    setDeletingProgramme(p.id);
    try {
      await deleteProgramme(p.id);
      toast.success(`"${p.name}" deleted.`);
      if (editingProgramme?.id === p.id) resetProgrammeForm();
      load();
    } catch (e: any) {
      // deleteProgramme refuses while subjects still reference the programme —
      // surface that reason rather than a generic failure.
      toast.error(e?.message || 'Failed to delete programme.');
    } finally {
      setDeletingProgramme(null);
    }
  };

  const handleCreateModule = async () => {
    if (!user) return;
    if (!modTitle.trim()) { toast.error('Enter a subject title.'); return; }
    if (!modSubject.trim()) { toast.error('Enter a subject.'); return; }
    setCreatingModule(true);
    try {
      const courseId = await createCurriculumModule({
        title: modTitle.trim(),
        description: `${modSubject.trim()} subject — ${modYearGroup}`,
        subject: modSubject.trim(),
        ownerId: user.uid,
        status: 'draft',
        isPublic: false,
        yearGroup: modYearGroup,
        programmeId: modProgrammeId || undefined,
      });
      toast.success('Subject created.');
      setModTitle('');
      setModSubject('');
      setModYearGroup(YEAR_LEVEL_SUGGESTIONS[0]);
      setShowModuleForm(false);
      await load();
      window.location.href = `/dashboard/admin/curriculum/${courseId}`;
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create subject.');
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
            Programmes, subjects and the lesson generation/review pipeline.
          </p>
        </div>
        <div className="sm:text-right">
          <Button onClick={handleSeed} disabled={seeding} variant="outline" className="gap-2 rounded-xl">
            <BookOpen className="w-4 h-4" />
            {seeding ? 'Loading…' : 'Load Sample Curriculum (Year 7 Science)'}
          </Button>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-xs sm:ml-auto">
            Creates a ready-made demo subject you can edit or delete at any time.
          </p>
        </div>
      </div>

      {/* ── AI Course Architect ── */}
      <Card className="p-0 rounded-2xl overflow-hidden border-violet-200">
        <div className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-teal-500 px-6 py-5 text-white">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              <Wand2 className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="font-bold text-lg leading-tight">AI Course Architect</h2>
              <p className="text-sm text-white/85">
                Tell Quill the subject, level and length — it designs the whole scheme of work,
                module by module, lesson by lesson. Review it, then build it in one click.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid sm:grid-cols-[1fr_1fr_140px_auto] gap-3 sm:items-end">
            <div className="space-y-1.5">
              <Label>Subject *</Label>
              <Input value={archSubject} onChange={e => setArchSubject(e.target.value)}
                placeholder="e.g. Combined Science" className="rounded-xl h-10" />
            </div>
            <div className="space-y-1.5">
              <Label>Year / Level</Label>
              <Input value={archYear} onChange={e => setArchYear(e.target.value)}
                list="year-level-suggestions" placeholder="e.g. Year 9, Foundation, Tertiary"
                className="rounded-xl h-10" />
            </div>
            <div className="space-y-1.5">
              <Label>Duration (weeks)</Label>
              <Input type="number" min={1} max={52} value={archWeeks}
                onChange={e => setArchWeeks(e.target.value)} className="rounded-xl h-10" />
            </div>
            <Button
              onClick={designWithQuill}
              disabled={archDesigning || archCreating}
              className="rounded-xl h-10 gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white"
            >
              {archDesigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {archDesigning ? 'Designing…' : 'Design with Quill'}
            </Button>
          </div>

          {archDesigning && (
            <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/50 px-4 py-6 text-center">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-violet-600" />
              <p className="text-sm text-violet-700 font-medium mt-2">
                Quill is planning {archWeeks || '—'} weeks of {archSubject || 'your subject'}…
              </p>
              <p className="text-xs text-muted-foreground mt-1">This usually takes 10-30 seconds.</p>
            </div>
          )}

          <AnimatePresence>
            {archOutline && !archDesigning && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-bold text-foreground text-sm">Proposed structure</span>
                  <span>{archOutline.length} modules</span>
                  <span>{lessonCount} lessons</span>
                  <span>≈ {plannedWeeks} weeks planned</span>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {archOutline.map((m, mi) => (
                    <div key={mi} className="rounded-xl border border-border p-4">
                      <p className="font-bold text-foreground text-sm">
                        Module {mi + 1}: {m.title}
                      </p>
                      {m.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                      )}
                      <ul className="mt-2.5 space-y-1.5">
                        {m.lessons.map((l, li) => (
                          <li key={li} className="text-xs">
                            <div className="flex items-start gap-2">
                              <span className="text-muted-foreground shrink-0">L{li + 1}</span>
                              <div className="min-w-0">
                                <span className="font-semibold text-foreground">{l.title}</span>
                                <span className="text-muted-foreground"> · {l.durationWeeks || 1} wk</span>
                                {l.objectives?.length > 0 && (
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {l.objectives.join(' · ')}
                                  </p>
                                )}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <div className="grid sm:grid-cols-[1fr_auto_auto] gap-3 sm:items-end pt-1">
                  <div className="space-y-1.5">
                    <Label>Subject title (as it will appear in the CMS)</Label>
                    <Input value={archTitle} onChange={e => setArchTitle(e.target.value)} className="rounded-xl h-10" />
                  </div>
                  <Button variant="outline" className="rounded-xl h-10 gap-2" disabled={archCreating} onClick={designWithQuill}>
                    <RotateCcw className="w-3.5 h-3.5" /> Redesign
                  </Button>
                  <Button
                    onClick={createFromOutline}
                    disabled={archCreating}
                    className="rounded-xl h-10 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {archCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {archCreating ? 'Creating…' : 'Create this structure'}
                  </Button>
                </div>

                {archProgress && (
                  <div className="space-y-1.5">
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-teal-500 transition-all duration-300"
                        style={{ width: `${Math.round((archProgress.done / Math.max(1, archProgress.total)) * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {archProgress.done} of {archProgress.total} · {archProgress.step}
                    </p>
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground">
                  Everything is created as a draft — nothing goes live until you publish it in the Content Builder.
                  Quill drafts still need a human review.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>

      <datalist id="year-level-suggestions">
        {YEAR_LEVEL_SUGGESTIONS.map(y => <option key={y} value={y} />)}
      </datalist>

      {/* Programmes */}
      <Card className="p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-foreground text-lg">Programmes ({programmes.length})</h2>
          <Button size="sm" variant="outline" className="gap-1.5 rounded-xl"
            onClick={() => (showProgrammeForm ? resetProgrammeForm() : setShowProgrammeForm(true))}>
            <Plus className="w-3.5 h-3.5" /> {showProgrammeForm ? 'Cancel' : 'New Programme'}
          </Button>
        </div>

        {showProgrammeForm && (
          <div className="mb-4 p-4 bg-muted/40 rounded-xl border border-dashed border-border space-y-3">
            {editingProgramme && (
              <p className="text-xs font-semibold text-violet-700">
                Editing “{editingProgramme.name}”
              </p>
            )}
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
                <Label>Year / Level groups (comma-separated)</Label>
                <Input value={progYearGroups} onChange={e => setProgYearGroups(e.target.value)} className="rounded-xl h-10" />
              </div>
              <div className="space-y-1.5">
                <Label>Subjects (comma-separated)</Label>
                <Input value={progSubjects} onChange={e => setProgSubjects(e.target.value)} placeholder="e.g. Science, Maths, English, Computing" className="rounded-xl h-10" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleSaveProgramme} disabled={creatingProgramme} className="rounded-xl">
                {creatingProgramme
                  ? 'Saving…'
                  : editingProgramme ? 'Save changes' : 'Create Programme'}
              </Button>
              {editingProgramme && (
                <Button variant="ghost" onClick={resetProgrammeForm} className="rounded-xl">Cancel</Button>
              )}
            </div>
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
                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border">
                  <Button size="sm" variant="ghost" className="h-8 rounded-lg text-xs gap-1.5"
                    onClick={() => startEditProgramme(p)}>
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost"
                    className="h-8 rounded-lg text-xs gap-1.5 text-muted-foreground hover:text-destructive"
                    disabled={deletingProgramme === p.id}
                    onClick={() => handleDeleteProgramme(p)}>
                    {deletingProgramme === p.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />}
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Curriculum modules */}
      <Card className="p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-foreground text-lg">Subjects ({modules.length})</h2>
          <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" onClick={() => setShowModuleForm(o => !o)}>
            <Plus className="w-3.5 h-3.5" /> New Subject
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
                <Label>Year / Level</Label>
                {/* Free text with suggestions — schools use Year 1…13, Advanced,
                    Tertiary, K-12 and their own custom labels. */}
                <Input
                  value={modYearGroup}
                  onChange={e => setModYearGroup(e.target.value)}
                  list="year-level-suggestions"
                  placeholder="e.g. Year 7, Advanced, Tertiary"
                  className="rounded-xl h-10"
                />
                <datalist id="year-level-suggestions">
                  {YEAR_LEVEL_SUGGESTIONS.map(yg => <option key={yg} value={yg} />)}
                </datalist>
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
              {creatingModule ? 'Creating…' : 'Create Subject'}
            </Button>
          </div>
        )}

        {modules.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No subjects yet — seed Y7 Science or create one.</p>
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
