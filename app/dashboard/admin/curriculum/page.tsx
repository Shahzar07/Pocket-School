'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  getProgrammes, createProgramme, updateProgramme, deleteProgramme, ProgrammeInUseError,
  getAllCurriculumModules, createCurriculumModule,
  createModule, createLesson,
  updateCourse, deleteCurriculumSubject, getCurriculumSubjectSize,
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
  Pencil, Trash2, Search,
} from 'lucide-react';
import Link from 'next/link';
import { reorderById, sortByOrder, withSequentialOrder } from '@/lib/reorder';
import { hasCmsAddon } from '@/lib/entitlements';
import { stripUnitPrefix } from '@/lib/unit-title';
import { ReorderControls, reorderKeyDown } from '@/components/reorder-controls';
import { displayLevels, toNamedLevel } from '@/lib/programmes';
import { LevelSelect } from '@/components/level-select';
import { useCoursePlaceholders } from '@/hooks/use-example-course';

const PAGE_SIZE = 12;

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending_approval: 'bg-[var(--ps-cyan-soft)] text-[var(--ps-cyan-text)] border border-[var(--ps-cyan-border)]',
  published: 'bg-success/15 text-success',
};

/** A teaching week is planned as 5 × 60-minute sessions. */
const MINUTES_PER_WEEK = 300;
const DEFAULT_BLOCKS = ['objectives', 'video', 'text', 'vocabulary', 'quiz'];

interface OutlineLesson { title: string; objectives: string[]; durationWeeks: number }
interface OutlineModule { title: string; description: string; lessons: OutlineLesson[] }

export default function AdminCurriculumPage() {
  const { user, profile } = useAuthSTORE();
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [modules, setModules] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  // New programme form
  const [showProgrammeForm, setShowProgrammeForm] = useState(false);
  const [progName, setProgName] = useState('');
  const [progSubjects, setProgSubjects] = useState('');
  const placeholders = useCoursePlaceholders();
  const [progYearGroups, setProgYearGroups] = useState('');
  const [progTier, setProgTier] = useState<'free' | 'academic'>('academic');
  const [creatingProgramme, setCreatingProgramme] = useState(false);
  /** Programme being edited; null means the form creates a new one. */
  const [editingProgramme, setEditingProgramme] = useState<Programme | null>(null);
  const [deletingProgramme, setDeletingProgramme] = useState<string | null>(null);

  // Inline subject editing
  const [editingSubject, setEditingSubject] = useState<string | null>(null);
  const [subjTitle, setSubjTitle] = useState('');
  const [subjSubject, setSubjSubject] = useState('');
  const [subjYear, setSubjYear] = useState('');
  const [subjProgrammeId, setSubjProgrammeId] = useState('');
  const [blockedDelete, setBlockedDelete] = useState<{ name: string; subjects: { id: string; title: string }[] } | null>(null);
  const [savingSubject, setSavingSubject] = useState(false);
  const [deletingSubject, setDeletingSubject] = useState<string | null>(null);

  const startEditSubject = (m: Course) => {
    setEditingSubject(m.id);
    setSubjTitle(m.title ?? '');
    setSubjSubject(m.subject ?? '');
    setSubjYear(toNamedLevel(m.yearGroup ?? ''));
    setSubjProgrammeId(m.programmeId ?? '');
  };

  const handleSaveSubject = async (m: Course) => {
    if (!subjTitle.trim()) { toast.error('Enter a title.'); return; }
    if (!subjProgrammeId) { toast.error('Choose the programme this subject belongs to.'); return; }
    setSavingSubject(true);
    try {
      await updateCourse(m.id, {
        title: subjTitle.trim(),
        subject: subjSubject.trim(),
        yearGroup: subjYear.trim() || undefined,
        programmeId: subjProgrammeId,
      });
      toast.success('Subject updated.');
      setEditingSubject(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update subject.');
    } finally {
      setSavingSubject(false);
    }
  };

  const handleDeleteSubject = async (m: Course) => {
    setDeletingSubject(m.id);
    try {
      // Show what will actually be destroyed before asking — units and lessons
      // live only inside the subject and go with it.
      const { units, lessons } = await getCurriculumSubjectSize(m.id);
      const detail = units === 0 && lessons === 0
        ? 'It has no units yet.'
        : `This will also delete ${units} unit${units === 1 ? '' : 's'} and ${lessons} lesson${lessons === 1 ? '' : 's'}.`;
      if (!confirm(`Delete the subject "${m.title}"?\n\n${detail}\n\nThis cannot be undone.`)) {
        setDeletingSubject(null);
        return;
      }
      await deleteCurriculumSubject(m.id);
      toast.success(`"${m.title}" deleted.`);
      if (editingSubject === m.id) setEditingSubject(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete subject.');
    } finally {
      setDeletingSubject(null);
    }
  };

  // New curriculum module form
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [modTitle, setModTitle] = useState('');
  const [modSubject, setModSubject] = useState('');
  const [modYearGroup, setModYearGroup] = useState('');
  const [modProgrammeId, setModProgrammeId] = useState<string>('');
  const [creatingModule, setCreatingModule] = useState(false);

  // AI Course Architect (ET AI)
  const [archSubject, setArchSubject] = useState('');
  const [archYear, setArchYear] = useState('');
  const [archWeeks, setArchWeeks] = useState('');
  const [archTitle, setArchTitle] = useState('');
  const [archOutline, setArchOutline] = useState<OutlineModule[] | null>(null);
  const [archDesigning, setArchDesigning] = useState(false);
  const [archCreating, setArchCreating] = useState(false);
  const [archProgress, setArchProgress] = useState<{ done: number; total: number; step: string } | null>(null);
  const [archStep, setArchStep] = useState<1 | 2 | 3>(1);
  const [programmeQuery, setProgrammeQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | 'free' | 'academic'>('all');
  const [programmePage, setProgrammePage] = useState(0);
  const [subjectQuery, setSubjectQuery] = useState('');
  const [subjectPage, setSubjectPage] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [progs, mods] = await Promise.all([getProgrammes(), getAllCurriculumModules()]);
      setProgrammes(sortByOrder(progs));
      setModules(sortByOrder(mods));
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load curriculum data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const persistOrder = async <T extends { id: string }>(
    rows: T[],
    write: (row: T & { order: number }) => Promise<void>,
    apply: (rows: T[]) => void,
    label: string,
  ) => {
    const next = withSequentialOrder(rows);
    apply(next);
    try {
      await Promise.all(next.map(write));
      toast.success(`${label} saved.`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not save the new order.');
      load();
    }
  };

  const handleSeed = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      const result = await seedY7ScienceUnit1(user.uid);
      if (result.created) {
        toast.success(`Seeded "Science — Lower Secondary" with ${result.lessonsCreated} lessons.`);
      } else {
        toast.info('Science — Lower Secondary already exists — nothing to seed.');
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

  const designWithEt = async () => {
    const subject = archSubject.trim();
    if (!subject) { toast.error('Enter a subject for ET AI to design.'); return; }
    const weeks = Number(archWeeks);
    if (!Number.isFinite(weeks) || weeks < 1 || weeks > 52) {
      toast.error('Enter a duration in weeks.');
      return;
    }

    // Designing a second copy of a subject that already exists is almost always
    // a mistake, and it is expensive to undo once units and lessons are built.
    const year = archYear.trim();
    const clash = modules.find(m =>
      (m.subject ?? '').trim().toLowerCase() === subject.toLowerCase()
      && (m.yearGroup ?? '').trim().toLowerCase() === year.toLowerCase());
    if (clash && !confirm(
      `"${clash.title}" already covers ${subject}${year ? ` for ${year}` : ''}.\n\n` +
      'Design another one anyway? Consider opening the existing subject and adding units to it instead.',
    )) return;

    setArchDesigning(true);
    setArchOutline(null);
    try {
      const res = await fetch('/api/ai/course-architect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'outline',
          context: {
            subject, yearLevel: year, weeks,
            // Lets ET AI continue from what a matching subject already teaches
            // rather than proposing the same ground again.
            existingUnits: clash ? [clash.title] : [],
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'ET AI could not design that course.');
      const modules: OutlineModule[] = Array.isArray(data.modules) ? data.modules : [];
      if (!modules.length) throw new Error('ET AI returned an empty outline — try again.');
      setArchOutline(modules);
      setArchTitle(prev => prev.trim() || `${subject}${archYear.trim() ? ` — ${archYear.trim()}` : ''}`);
      setArchStep(2);
      toast.success(`ET AI designed ${modules.length} modules.`);
    } catch (e: any) {
      toast.error(e?.message || 'ET AI request failed.');
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
    setArchStep(3);
    setArchProgress({ done: 0, total, step: 'Creating subject…' });
    try {
      const courseId = await createCurriculumModule({
        title,
        description: `${archSubject.trim()} — ${archYear.trim() || 'all levels'} · designed with ET AI`,
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
          title: stripUnitPrefix(m.title, mi + 1),
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
    setProgYearGroups('');
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
      yearGroups: [...new Set(progYearGroups.split(',').map(s => toNamedLevel(s.trim())).filter(Boolean))],
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
      if (e instanceof ProgrammeInUseError) {
        setBlockedDelete({ name: p.name, subjects: e.subjects });
      }
      toast.error(e?.message || 'Failed to delete programme.');
    } finally {
      setDeletingProgramme(null);
    }
  };

  const handleCreateModule = async () => {
    if (!user) return;
    if (!modTitle.trim()) { toast.error('Enter a subject title.'); return; }
    if (!modSubject.trim()) { toast.error('Enter a subject.'); return; }
    if (!modProgrammeId) { toast.error('Choose the programme this subject belongs to.'); return; }
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
      setModYearGroup('');
      setShowModuleForm(false);
      await load();
      window.location.href = `/dashboard/admin/curriculum/${courseId}`;
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create subject.');
    } finally {
      setCreatingModule(false);
    }
  };

  const programmeFiltering = programmeQuery.trim() !== '' || tierFilter !== 'all';
  const visibleProgrammes = useMemo(() => {
    const query = programmeQuery.trim().toLowerCase();
    return programmes.filter(programme => {
      const levels = displayLevels(programme.yearGroups).toLowerCase();
      const subjects = (programme.subjects ?? []).join(' ').toLowerCase();
      const matchesQuery = !query
        || programme.name.toLowerCase().includes(query)
        || levels.includes(query)
        || subjects.includes(query);
      const tier = programme.requiredTier ?? 'academic';
      const matchesTier = tierFilter === 'all' || tier === tierFilter;
      return matchesQuery && matchesTier;
    });
  }, [programmes, programmeQuery, tierFilter]);
  const programmePages = Math.max(1, Math.ceil(visibleProgrammes.length / PAGE_SIZE));
  const programmePageSafe = Math.min(programmePage, programmePages - 1);
  const programmeSlice = visibleProgrammes.slice(programmePageSafe * PAGE_SIZE, programmePageSafe * PAGE_SIZE + PAGE_SIZE);

  const visibleSubjects = useMemo(() => {
    const query = subjectQuery.trim().toLowerCase();
    if (!query) return modules;
    return modules.filter(module => {
      const programmeName = programmes.find(item => item.id === module.programmeId)?.name ?? '';
      return [module.title, module.subject, module.yearGroup, programmeName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [modules, programmes, subjectQuery]);
  const subjectPages = Math.max(1, Math.ceil(visibleSubjects.length / PAGE_SIZE));
  const subjectPageSafe = Math.min(subjectPage, subjectPages - 1);
  const subjectSlice = visibleSubjects.slice(subjectPageSafe * PAGE_SIZE, subjectPageSafe * PAGE_SIZE + PAGE_SIZE);

  if (!hasCmsAddon(profile)) {
    return (
      <div className="py-24 text-center space-y-3 max-w-md mx-auto">
        <p className="font-semibold text-foreground">The CMS add-on is not on this account.</p>
        <p className="text-sm text-muted-foreground">An admin can allocate it from Access allocation. Platform admins already have the course editor.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-16 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div data-cms-list="1" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
            {seeding ? 'Loading…' : 'Load Sample Curriculum (Lower Secondary Science)'}
          </Button>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-xs sm:ml-auto">
            Creates a ready-made demo subject you can edit or delete at any time.
          </p>
        </div>
      </div>

      {/* ── AI Course Architect ── */}
      <Card className="p-0 rounded-2xl overflow-hidden border-border">
        <div className="px-5 py-4 border-b border-border flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-9 h-9 rounded-lg bg-violet-50 text-violet-700 flex items-center justify-center shrink-0">
              <Wand2 className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">1 · Course builder</p>
              <h2 className="font-semibold text-foreground leading-tight">AI Course Architect</h2>
            </div>
          </div>
          <ol className="flex items-center gap-1 text-xs" aria-label="Course architect steps">
            {([
              [1, 'Brief'],
              [2, 'Review'],
              [3, 'Build'],
            ] as const).map(([step, label], index) => (
              <li key={step} className="flex items-center gap-1">
                {index > 0 ? <span className="w-4 h-px bg-border" aria-hidden /> : null}
                <button
                  type="button"
                  disabled={step === 2 && !archOutline}
                  onClick={() => {
                    if (step === 1) setArchStep(1);
                    if (step === 2 && archOutline) setArchStep(2);
                    if (step === 3 && archOutline) setArchStep(3);
                  }}
                  className={`rounded-full px-2.5 py-1 font-medium ${
                    archStep === step
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {step}. {label}
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className="p-5 space-y-4">
          {archStep === 1 && (
          <div className="grid sm:grid-cols-[1fr_1fr_140px_auto] gap-3 sm:items-end">
            <div className="space-y-1.5">
              <Label>Subject *</Label>
              <Input value={archSubject} onChange={e => setArchSubject(e.target.value)}
                placeholder={placeholders.title} className="rounded-xl h-10" />
            </div>
            <div className="space-y-1.5">
              <Label>Level</Label>
              <LevelSelect
                value={archYear}
                onChange={setArchYear}
                ariaLabel="Level"
                className="w-full rounded-xl h-10 border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Duration (weeks)</Label>
              <Input type="number" min={1} max={52} value={archWeeks}
                onChange={e => setArchWeeks(e.target.value)} placeholder={placeholders.weeks} className="rounded-xl h-10" />
            </div>
            <Button
              onClick={designWithEt}
              disabled={archDesigning || archCreating}
              className="rounded-xl h-10 gap-2"
            >
              {archDesigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {archDesigning ? 'Designing…' : 'Design with ET AI'}
            </Button>
          </div>
          )}

          {(archStep === 1 || archDesigning) && archDesigning && (
            <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/50 px-4 py-6 text-center">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-violet-600" />
              <p className="text-sm text-violet-700 font-medium mt-2">
                ET AI is planning {archWeeks || '—'} weeks of {archSubject || 'your subject'}…
              </p>
              <p className="text-xs text-muted-foreground mt-1">This usually takes 10-30 seconds.</p>
            </div>
          )}

          <AnimatePresence>
            {archOutline && !archDesigning && archStep > 1 && (
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

                {archStep === 3 && (
                <div className="space-y-1.5">
                  <Label>Subject title</Label>
                  <Input value={archTitle} onChange={e => setArchTitle(e.target.value)} placeholder={placeholders.title} className="rounded-xl h-10" />
                </div>
                )}

                <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur">
                  <p className="text-xs text-muted-foreground">
                    {archStep === 2 ? 'Review the outline, then name the subject.' : 'Draft only. Publish later in the content builder.'}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="rounded-lg gap-1.5" disabled={archCreating} onClick={() => { setArchStep(1); void designWithEt(); }}>
                      <RotateCcw className="w-3.5 h-3.5" /> Redesign
                    </Button>
                    {archStep === 2 ? (
                      <Button size="sm" className="rounded-lg" onClick={() => setArchStep(3)}>Continue</Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={createFromOutline}
                        disabled={archCreating}
                        className="rounded-lg gap-1.5"
                      >
                        {archCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        {archCreating ? 'Creating…' : 'Create this structure'}
                      </Button>
                    )}
                  </div>
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
                  ET AI drafts still need a human review.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>

      {/* Programmes */}
      <Card className="p-6 rounded-2xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">2 · Taxonomy</p>
            <h2 className="font-semibold text-foreground">Programmes ({visibleProgrammes.length}{programmeFiltering ? ` of ${programmes.length}` : ''})</h2>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5 rounded-xl"
            onClick={() => (showProgrammeForm ? resetProgrammeForm() : setShowProgrammeForm(true))}>
            <Plus className="w-3.5 h-3.5" /> {showProgrammeForm ? 'Cancel' : 'New Programme'}
          </Button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={programmeQuery}
              onChange={event => { setProgrammeQuery(event.target.value); setProgrammePage(0); }}
              placeholder="Search programmes"
              aria-label="Search programmes"
              className="rounded-xl h-9 pl-8"
            />
          </div>
          <div className="flex gap-1">
            {(['all', 'academic', 'free'] as const).map(tier => (
              <Button
                key={tier}
                type="button"
                size="sm"
                variant={tierFilter === tier ? 'default' : 'outline'}
                className="rounded-lg h-9 capitalize"
                onClick={() => { setTierFilter(tier); setProgrammePage(0); }}
              >
                {tier}
              </Button>
            ))}
          </div>
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
                <Input value={progName} onChange={e => setProgName(e.target.value)} placeholder={placeholders.title} className="rounded-xl h-10" />
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
                <Label>Levels (comma-separated)</Label>
                <Input value={progYearGroups} onChange={e => setProgYearGroups(e.target.value)} placeholder={placeholders.level} className="rounded-xl h-10" />
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

        {blockedDelete && (
          <div className="mb-4 rounded-xl border border-[var(--ps-cyan-border)] bg-[var(--ps-cyan-soft)] px-3 py-2 text-sm text-[var(--ps-cyan-text)]">
            <p className="font-semibold">{blockedDelete.name} still has these subjects. Open one and change its programme, then delete again.</p>
            <ul className="mt-1 space-y-1">
              {blockedDelete.subjects.map(s => (
                <li key={s.id}><Link className="underline" href={`/dashboard/admin/curriculum/${s.id}`}>{s.title}</Link></li>
              ))}
            </ul>
          </div>
        )}
        {programmes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No programmes yet.</p>
        ) : visibleProgrammes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No programmes match that search.</p>
        ) : (
          <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {programmeSlice.map((p) => {
              const index = programmes.findIndex(item => item.id === p.id);
              return (
              <div
                key={p.id}
                className="border border-border rounded-lg px-3 py-2.5"
                tabIndex={programmeFiltering ? -1 : 0}
                onKeyDown={event => {
                  if (programmeFiltering) return;
                  reorderKeyDown(event, index, programmes.length, to => {
                    void persistOrder(reorderById(programmes, programmes[index].id, programmes[to].id), row => updateProgramme(row.id, { order: row.order }), setProgrammes, 'Programme order');
                  });
                }}
                onDragOver={event => event.preventDefault()}
                onDrop={event => {
                  if (programmeFiltering) return;
                  const from = Number(event.dataTransfer.getData('text/plain'));
                  if (!Number.isInteger(from) || !programmes[from]) return;
                  void persistOrder(reorderById(programmes, programmes[from].id, p.id), row => updateProgramme(row.id, { order: row.order }), setProgrammes, 'Programme order');
                }}
              >
                <div className="flex items-start gap-2">
                  {!programmeFiltering && (
                    <ReorderControls
                      index={index}
                      count={programmes.length}
                      label={p.name}
                      onMove={to => {
                        void persistOrder(reorderById(programmes, p.id, programmes[to].id), row => updateProgramme(row.id, { order: row.order }), setProgrammes, 'Programme order');
                      }}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm text-foreground truncate">{p.name}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${
                        p.requiredTier === 'academic' ? 'bg-[var(--ps-cyan-soft)] text-[var(--ps-cyan-text)]' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {p.requiredTier === 'academic' ? 'Academic' : 'Free'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{displayLevels(p.yearGroups) || 'No level'}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.subjects?.slice(0, 3).join(', ') || 'No subjects'}{(p.subjects?.length ?? 0) > 3 ? ` +${(p.subjects?.length ?? 0) - 3}` : ''}</p>
                  </div>
                  <div className="flex items-center shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg" title="Edit programme"
                      onClick={() => startEditProgramme(p)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost"
                      className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-destructive"
                      title="Delete programme"
                      disabled={deletingProgramme === p.id}
                      onClick={() => handleDeleteProgramme(p)}>
                      {deletingProgramme === p.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
          <Pager page={programmePageSafe} pages={programmePages} onPage={setProgrammePage} />
          </>
        )}
      </Card>

      {/* Curriculum modules */}
      <Card className="p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">3 · Subjects</p>
            <h2 className="font-semibold text-foreground">Subjects ({visibleSubjects.length})</h2>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" onClick={() => setShowModuleForm(o => !o)}>
            <Plus className="w-3.5 h-3.5" /> New Subject
          </Button>
        </div>
        <div className="relative mb-3">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={subjectQuery}
            onChange={event => { setSubjectQuery(event.target.value); setSubjectPage(0); }}
            placeholder="Search subjects"
            aria-label="Search subjects"
            className="rounded-xl h-9 pl-8"
          />
        </div>

        {showModuleForm && (
          <div className="mb-4 p-4 bg-muted/40 rounded-xl border border-dashed border-border space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Title *</Label>
                <Input value={modTitle} onChange={e => setModTitle(e.target.value)} placeholder={placeholders.title} className="rounded-xl h-10" />
              </div>
              <div className="space-y-1.5">
                <Label>Subject *</Label>
                <Input value={modSubject} onChange={e => setModSubject(e.target.value)} placeholder={placeholders.subject} className="rounded-xl h-10" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Level</Label>
                <LevelSelect
                  value={modYearGroup}
                  onChange={setModYearGroup}
                  ariaLabel="Level"
                  className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
                />
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
            <p className="text-sm">No subjects yet — load the sample curriculum or create one.</p>
          </div>
        ) : (
          <>
          <div className="divide-y divide-border">
            {subjectSlice.map((m) => {
              const index = modules.findIndex(item => item.id === m.id);
              return (
              editingSubject === m.id ? (
                <div key={m.id} className="py-3.5 -mx-2 px-2 rounded-lg bg-muted/40 space-y-3">
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Title</Label>
                      <Input value={subjTitle} onChange={e => setSubjTitle(e.target.value)} className="rounded-xl h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Subject</Label>
                      <Input value={subjSubject} onChange={e => setSubjSubject(e.target.value)} className="rounded-xl h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Level</Label>
                      <LevelSelect
                        value={subjYear}
                        onChange={setSubjYear}
                        ariaLabel="Level"
                        className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-3">
                      <Label className="text-xs">Programme</Label>
                      <Select value={subjProgrammeId} onValueChange={(v) => setSubjProgrammeId(v ?? '')}>
                        <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="Choose a programme" /></SelectTrigger>
                        <SelectContent>
                          {programmes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" className="rounded-xl" disabled={savingSubject} onClick={() => handleSaveSubject(m)}>
                      {savingSubject ? 'Saving…' : 'Save changes'}
                    </Button>
                    <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => setEditingSubject(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-4 py-3.5 hover:bg-muted/40 transition-colors -mx-2 px-2 rounded-lg"
                  tabIndex={0}
                  onKeyDown={event => {
                    if (subjectQuery.trim()) return;
                    reorderKeyDown(event, index, modules.length, to => {
                      void persistOrder(reorderById(modules, modules[index].id, modules[to].id), row => updateCourse(row.id, { order: row.order }), setModules, 'Subject order');
                    });
                  }}
                  onDragOver={event => event.preventDefault()}
                  onDrop={event => {
                    if (subjectQuery.trim()) return;
                    const from = Number(event.dataTransfer.getData('text/plain'));
                    if (!Number.isInteger(from) || !modules[from]) return;
                    void persistOrder(reorderById(modules, modules[from].id, m.id), row => updateCourse(row.id, { order: row.order }), setModules, 'Subject order');
                  }}
                >
                  {!subjectQuery.trim() && <ReorderControls
                    index={index}
                    count={modules.length}
                    label={m.title}
                    onMove={to => {
                      void persistOrder(reorderById(modules, m.id, modules[to].id), row => updateCourse(row.id, { order: row.order }), setModules, 'Subject order');
                    }}
                  />}
                  <Link href={`/dashboard/admin/curriculum/${m.id}`} className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground text-sm truncate">{m.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.subject} · {toNamedLevel(m.yearGroup ?? '') || '—'}
                      {m.programmeId ? ` · ${programmes.find(p => p.id === m.programmeId)?.name ?? 'Programme linked'}` : ' · No programme'}
                    </p>
                  </Link>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE[m.status] ?? STATUS_BADGE.draft}`}>
                      {m.status}
                    </span>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" title="Edit subject"
                      onClick={() => startEditSubject(m)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost"
                      className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-destructive"
                      title="Delete subject"
                      disabled={deletingSubject === m.id}
                      onClick={() => handleDeleteSubject(m)}>
                      {deletingSubject === m.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                    <Link href={`/dashboard/admin/curriculum/${m.id}`}>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </Link>
                  </div>
                </div>
              )
              );
            })}
          </div>
          <Pager page={subjectPageSafe} pages={subjectPages} onPage={setSubjectPage} />
          </>
        )}
      </Card>
    </div>
  );
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 pt-3">
      <p className="text-xs text-muted-foreground">Page {page + 1} of {pages}</p>
      <div className="flex gap-1">
        <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg" disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</Button>
        <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}
