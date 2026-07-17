'use client';

/**
 * Content Builder — three-panel curriculum authoring studio.
 * Left: course structure tree. Centre: block editor. Right: Properties /
 * Publish / Allocate / History tabs. Auto-saves the selected lesson.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Timestamp } from 'firebase/firestore';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  getCourse, getModulesWithLessons, updateCourse, createModule, updateUnit,
  createLesson, updateLesson, deleteLesson, duplicateLesson, getInstitutions,
  Course, Module, Lesson, AiOutputs, Institution,
} from '@/lib/db';
import {
  BLOCK_DEFS, BLOOMS, BlockShell, ObjectivesBlock, VideoBlock, LessonTextBlock,
  VocabularyBlock, ActivityBlock, QuizBlock, AssignmentBlock, AssessmentBlock,
  AudioBlock, type BlockDef,
} from '@/components/builder-blocks';
import { FormatPreview } from '@/components/lesson-format-views';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, Copy, Eye, Loader2,
  Pencil, Plus, RotateCcw, Send, Sparkles, Trash2, Archive,
} from 'lucide-react';

/* ── Constants ──────────────────────────────────────────────── */

const LESSON_TYPES = [
  { id: 'lesson', icon: '📝', label: 'Lesson' },
  { id: 'video', icon: '🎬', label: 'Video Lesson' },
  { id: 'assignment', icon: '📋', label: 'Assignment' },
  { id: 'assessment', icon: '🏅', label: 'Assessment / Test' },
  { id: 'live', icon: '📡', label: 'Live Session' },
  { id: 'resource', icon: '📁', label: 'Resource Pack' },
] as const;

const TYPE_ICON: Record<string, string> = Object.fromEntries(LESSON_TYPES.map(t => [t.id, t.icon]));

const STATUS_DOT: Record<string, string> = {
  published: 'bg-emerald-500',
  approved: 'bg-blue-500',
  in_review: 'bg-amber-500',
  draft: 'bg-slate-300',
  archived: 'bg-red-300',
};

const STATUS_CARD: Record<string, { bg: string; label: string }> = {
  draft: { bg: 'bg-slate-100 text-slate-700 border-slate-200', label: 'Draft' },
  in_review: { bg: 'bg-amber-50 text-amber-700 border-amber-200', label: 'In Review' },
  approved: { bg: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Approved' },
  published: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Published' },
  archived: { bg: 'bg-red-50 text-red-600 border-red-200', label: 'Archived' },
};

const STUDENT_GROUPS = ['Year 10 All', 'Year 11 Advanced', 'SPM Target', 'Free Trial'];

const DEFAULT_BLOCKS = ['objectives', 'video', 'text', 'vocabulary', 'quiz'];

/** AI formats surfaced in the right-panel shortcuts. */
const AI_SHORTCUTS: { id: keyof AiOutputs; label: string }[] = [
  { id: 'text', label: 'Lesson Text' }, { id: 'videoScript', label: 'Video Script' },
  { id: 'flashcards', label: 'Flashcards' }, { id: 'quiz', label: 'Quiz' },
  { id: 'slides', label: 'Slides' }, { id: 'notes', label: 'Study Notes' },
  { id: 'summary', label: 'Summary' }, { id: 'problems', label: 'Problems' },
  { id: 'audioScript', label: 'Audio Summary' }, { id: 'glossary', label: 'Glossary' },
  { id: 'mindmap', label: 'Mind Map' }, { id: 'infographic', label: 'Infographic' },
];

interface UnitWithLessons { module: Module; lessons: Lesson[] }

async function callGenerate(content: string, format: string, briefPrompt?: string): Promise<unknown> {
  const res = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, format, briefPrompt }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Generation failed: ${format}`);
  return data.result;
}

/* ── Page ───────────────────────────────────────────────────── */

export default function ContentBuilderPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const { user, profile } = useAuthSTORE();

  const [course, setCourse] = useState<Course | null>(null);
  const [units, setUnits] = useState<UnitWithLessons[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selUnit, setSelUnit] = useState<string | null>(null);
  const [selLesson, setSelLesson] = useState<string | null>(null);
  const [draft, setDraft] = useState<Lesson | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving'>('saved');
  const [rightTab, setRightTab] = useState<'properties' | 'publish' | 'allocate' | 'history'>('properties');
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef<Lesson | null>(null);
  draftRef.current = draft;

  const actorName = profile?.name ?? user?.email ?? 'Admin';

  const load = useCallback(async (keepSelection = false) => {
    if (!courseId) return;
    if (!keepSelection) setLoading(true);
    setLoadError(null);
    try {
      const [c, mods, inst] = await Promise.all([
        getCourse(courseId), getModulesWithLessons(courseId), getInstitutions().catch(() => []),
      ]);
      setCourse(c);
      setUnits(mods);
      setInstitutions(inst);
      if (!keepSelection && mods.length && mods[0].lessons.length) {
        setSelUnit(mods[0].module.id);
        setSelLesson(mods[0].lessons[0].id);
      }
    } catch (e: any) {
      setLoadError(e?.message || 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  // Hydrate the editable draft when selection changes.
  useEffect(() => {
    if (!selUnit || !selLesson) { setDraft(null); return; }
    const lesson = units.find(u => u.module.id === selUnit)?.lessons.find(l => l.id === selLesson) ?? null;
    setDraft(lesson ? JSON.parse(JSON.stringify(lesson)) : null);
    setSaveState('saved');
  }, [selUnit, selLesson, units]);

  /* ── Saving ── */

  const persistDraft = useCallback(async (d: Lesson, historyLabel?: string) => {
    if (!selUnit) return;
    setSaveState('saving');
    try {
      const history = [
        ...(historyLabel ? [{ label: historyLabel, actor: actorName, at: Timestamp.now() }] : []),
        ...(d.history ?? []),
      ].slice(0, 30);
      const { id: _id, ...fields } = d;
      // Firestore rejects undefined values — strip them.
      const clean = JSON.parse(JSON.stringify({ ...fields, ...(historyLabel ? { history } : {}) }));
      await updateLesson(courseId, selUnit, d.id, clean);
      setSaveState('saved');
      setUnits(prev => prev.map(u => u.module.id !== selUnit ? u : {
        ...u, lessons: u.lessons.map(l => l.id === d.id ? { ...d, ...(historyLabel ? { history } : {}) } : l),
      }));
    } catch (e: any) {
      setSaveState('dirty');
      toast.error(e?.message || 'Save failed.');
    }
  }, [courseId, selUnit, actorName]);

  const patchDraft = useCallback((patch: Partial<Lesson>) => {
    setDraft(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      setSaveState('dirty');
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const cur = draftRef.current;
        if (cur) persistDraft(cur);
      }, 2000);
      return next;
    });
  }, [persistDraft]);

  const saveNow = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (draftRef.current) persistDraft(draftRef.current, 'Manual save');
  }, [persistDraft]);

  /* ── AI generation ── */

  const runAi = useCallback(async (format: string, extraBrief?: string) => {
    const d = draftRef.current;
    if (!d || !selUnit) return;
    setAiBusy(format);
    try {
      const content =
        d.contentSources?.find(s => s.type === 'text')?.value?.trim() ||
        (d.aiOutputs?.text ?? '') || d.title;
      const brief = [d.briefPrompt, extraBrief].filter(Boolean).join('\n');
      const result = await callGenerate(content, format, brief || undefined);
      const aiOutputs = { ...(d.aiOutputs ?? {}), [format]: result };
      const next = { ...d, aiOutputs } as Lesson;
      setDraft(next);
      await persistDraft(next, `AI generated: ${format}`);
      toast.success(`${format} generated.`);
    } catch (e: any) {
      toast.error(e?.message || `Failed to generate ${format}.`);
    } finally {
      setAiBusy(null);
    }
  }, [selUnit, persistDraft]);

  /* ── Status workflow ── */

  const setStatus = async (next: NonNullable<Lesson['status']>, label: string) => {
    const d = draftRef.current;
    if (!d) return;
    const patched = {
      ...d, status: next,
      ...(next === 'approved' ? { reviewedBy: actorName, reviewedAt: Timestamp.now() } : {}),
    };
    setDraft(patched);
    await persistDraft(patched, label);
    toast.success(label);
  };

  /* ── Tree actions ── */

  const addUnit = async () => {
    const title = window.prompt('New module (chapter) title:');
    if (!title?.trim()) return;
    try {
      await createModule(courseId, {
        title: title.trim(), courseId, order: units.length + 1,
        unitNumber: units.length + 1, masteryThreshold: 70,
      });
      toast.success('Module created.');
      load(true);
    } catch (e: any) { toast.error(e?.message || 'Failed.'); }
  };

  const renameUnit = async (unit: Module) => {
    const title = window.prompt('Rename module:', unit.title);
    if (!title?.trim() || title === unit.title) return;
    try {
      await updateUnit(courseId, unit.id, { title: title.trim() });
      load(true);
    } catch (e: any) { toast.error(e?.message || 'Failed.'); }
  };

  const addLesson = async (unitId: string, count: number) => {
    const title = window.prompt('New lesson title:');
    if (!title?.trim()) return;
    try {
      const id = await createLesson(courseId, unitId, {
        title: title.trim(), moduleId: unitId, courseId,
        order: count + 1, lessonNumber: count + 1, status: 'draft',
        lessonType: 'lesson', blocksOrder: DEFAULT_BLOCKS,
      });
      await load(true);
      setSelUnit(unitId);
      setSelLesson(id);
    } catch (e: any) { toast.error(e?.message || 'Failed.'); }
  };

  const removeLesson = async (unitId: string, lesson: Lesson) => {
    if (!window.confirm(`Delete "${lesson.title}"? This cannot be undone.`)) return;
    try {
      await deleteLesson(courseId, unitId, lesson.id);
      if (selLesson === lesson.id) { setSelLesson(null); setDraft(null); }
      toast.success('Lesson deleted.');
      load(true);
    } catch (e: any) { toast.error(e?.message || 'Failed.'); }
  };

  const copyLesson = async (unitId: string, lesson: Lesson) => {
    try {
      await duplicateLesson(courseId, unitId, lesson);
      toast.success('Lesson duplicated.');
      load(true);
    } catch (e: any) { toast.error(e?.message || 'Failed.'); }
  };

  /* ── Course-level updates (publish scope, allocation) ── */

  const patchCourse = async (patch: Partial<Course>, msg?: string) => {
    if (!course) return;
    try {
      await updateCourse(course.id, patch);
      setCourse({ ...course, ...patch });
      if (msg) toast.success(msg);
    } catch (e: any) { toast.error(e?.message || 'Failed.'); }
  };

  /* ── Derived ── */

  const blocksOrder = useMemo(
    () => draft?.blocksOrder?.length ? draft.blocksOrder : DEFAULT_BLOCKS,
    [draft?.blocksOrder]
  );

  /* ── Render ── */

  if (loading) {
    return <div className="py-24 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>;
  }
  if (loadError || !course) {
    return (
      <div className="py-24 text-center space-y-3">
        <p className="text-muted-foreground">{loadError ?? 'Subject not found.'}</p>
        <Button variant="outline" className="rounded-xl" onClick={() => load()}>Retry</Button>
      </div>
    );
  }

  const status = draft?.status ?? 'draft';
  const statusCard = STATUS_CARD[status] ?? STATUS_CARD.draft;

  return (
    <div className="-mx-4 sm:-mx-6 -my-2 flex flex-col" style={{ height: 'calc(100vh - 5rem)' }}>
      {/* ── Top bar ── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card/80 backdrop-blur-sm">
        <button onClick={() => router.push('/dashboard/admin/curriculum')} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="Back">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <nav className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
          <Link href="/dashboard/admin/curriculum" className="hover:text-foreground shrink-0">All Courses</Link>
          <ChevronRight className="w-3 h-3 shrink-0" />
          <span className="truncate max-w-48">{course.title}</span>
          <ChevronRight className="w-3 h-3 shrink-0" />
          <span className="font-semibold text-foreground shrink-0">Content Builder</span>
        </nav>
        <span className="flex-1" />
        {/* Save status */}
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <span className={`w-2 h-2 rounded-full ${
            saveState === 'saved' ? 'bg-emerald-500' : saveState === 'saving' ? 'bg-amber-400 animate-pulse' : 'bg-amber-400 animate-pulse'
          }`} />
          {saveState === 'saved' ? 'All changes saved' : saveState === 'saving' ? 'Saving…' : 'Unsaved changes'}
        </span>
        <span className="hidden sm:inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-violet-100 text-violet-700">
          {profile?.role === 'admin' ? 'Super Admin' : 'Teacher'}
        </span>
        {draft && (
          <a
            href={`/dashboard/student/courses/${courseId}/lessons/${draft.id}`}
            target="_blank" rel="noreferrer"
            className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-border hover:bg-muted"
          >
            <Eye className="w-3.5 h-3.5" /> Preview
          </a>
        )}
        <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs" onClick={saveNow} disabled={!draft || saveState === 'saved'}>
          Save
        </Button>
        <Button size="sm" className="rounded-xl h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          disabled={!draft || status === 'published'} onClick={() => setStatus('published', 'Published')}>
          <Send className="w-3 h-3" /> Publish
        </Button>
      </div>

      {/* ── Three panels ── */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[270px_minmax(0,1fr)_320px]">

        {/* ── Left: course tree ── */}
        <aside className="hidden lg:flex flex-col border-r border-border bg-muted/20 overflow-y-auto">
          <div className="p-3 flex items-center justify-between sticky top-0 bg-muted/40 backdrop-blur-sm border-b border-border/50 z-10">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Course Structure</p>
            <button onClick={addUnit} className="p-1 rounded-md hover:bg-muted text-muted-foreground" title="Add module">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-2 space-y-1">
            {units.map(u => (
              <TreeUnit
                key={u.module.id}
                unit={u.module}
                lessons={u.lessons}
                activeLessonId={selLesson}
                onSelect={(lid) => { setSelUnit(u.module.id); setSelLesson(lid); }}
                onRename={() => renameUnit(u.module)}
                onAddLesson={() => addLesson(u.module.id, u.lessons.length)}
                onDeleteLesson={(l) => removeLesson(u.module.id, l)}
                onDuplicateLesson={(l) => copyLesson(u.module.id, l)}
              />
            ))}
            {units.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">No modules yet.<br />Click + to add one.</p>
            )}
          </div>
        </aside>

        {/* ── Centre: editor ── */}
        <main className="overflow-y-auto bg-background">
          {!draft ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground p-8 text-center">
              Select a lesson from the course structure to start editing.
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
              {/* Header fields */}
              <div className="space-y-3">
                <input
                  value={draft.title}
                  onChange={e => patchDraft({ title: e.target.value })}
                  className="w-full font-heading text-2xl sm:text-3xl bg-transparent outline-none text-foreground placeholder:text-muted-foreground/40"
                  placeholder="Lesson title"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={draft.lessonType ?? 'lesson'}
                    onChange={e => patchDraft({ lessonType: e.target.value as Lesson['lessonType'] })}
                    className="h-8 rounded-lg border border-border bg-card px-2 text-xs font-medium"
                  >
                    {LESSON_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
                  </select>
                  <select
                    value={draft.bloomsLevel ?? 'Understand'}
                    onChange={e => patchDraft({ bloomsLevel: e.target.value })}
                    className="h-8 rounded-lg border border-border bg-card px-2 text-xs font-medium"
                    title="Bloom's level"
                  >
                    {BLOOMS.map(b => <option key={b}>{b}</option>)}
                  </select>
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Input type="number" value={draft.durationMinutes ?? ''} placeholder="45"
                      onChange={e => patchDraft({ durationMinutes: e.target.value ? Number(e.target.value) : undefined })}
                      className="h-8 w-16 rounded-lg text-xs" /> min
                  </label>
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Input type="number" value={draft.marks ?? ''} placeholder="10"
                      onChange={e => patchDraft({ marks: e.target.value ? Number(e.target.value) : undefined })}
                      className="h-8 w-16 rounded-lg text-xs" /> marks
                  </label>
                  <span className={`ml-auto text-[10px] font-bold px-2 py-1 rounded-full border ${statusCard.bg}`}>{statusCard.label}</span>
                </div>
              </div>

              {/* Blocks */}
              <AnimatePresence>
                {blocksOrder.map((blockId, idx) => (
                  <BuilderBlock
                    key={blockId}
                    blockId={blockId}
                    draft={draft}
                    selected={selectedBlock === blockId}
                    onSelect={() => setSelectedBlock(blockId)}
                    onDelete={() => patchDraft({ blocksOrder: blocksOrder.filter(b => b !== blockId) })}
                    onMoveUp={idx > 0 ? () => {
                      const next = [...blocksOrder];
                      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                      patchDraft({ blocksOrder: next });
                    } : undefined}
                    onMoveDown={idx < blocksOrder.length - 1 ? () => {
                      const next = [...blocksOrder];
                      [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                      patchDraft({ blocksOrder: next });
                    } : undefined}
                    patch={patchDraft}
                    ai={runAi}
                    aiBusy={aiBusy}
                  />
                ))}
              </AnimatePresence>

              {/* Add-block palette */}
              <div className="rounded-2xl border border-dashed border-border p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Add a block</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {BLOCK_DEFS.map(def => {
                    const added = blocksOrder.includes(def.id);
                    return (
                      <button
                        key={def.id}
                        disabled={added}
                        onClick={() => patchDraft({ blocksOrder: [...blocksOrder, def.id] })}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
                          added
                            ? 'border-border/50 text-muted-foreground/40 cursor-not-allowed'
                            : 'border-border text-foreground hover:border-teal-400 hover:shadow-sm active:scale-95'
                        }`}
                      >
                        <span className="text-base">{def.icon}</span>
                        <span className="flex-1">{def.label}</span>
                        {def.sparks && !added && <span className="text-[10px] text-amber-500">⚡{def.sparks}</span>}
                        {added && <CheckCircle2 className="w-3 h-3" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ── Right: tabs ── */}
        <aside className="hidden lg:flex flex-col border-l border-border bg-muted/10 overflow-y-auto">
          <div className="sticky top-0 z-10 grid grid-cols-4 text-[11px] font-semibold border-b border-border bg-card">
            {(['properties', 'publish', 'allocate', 'history'] as const).map(t => (
              <button key={t} onClick={() => setRightTab(t)}
                className={`py-2.5 capitalize transition-colors ${rightTab === t ? 'text-teal-600 border-b-2 border-teal-500' : 'text-muted-foreground hover:text-foreground'}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="p-4 space-y-5 text-sm">
            {rightTab === 'properties' && draft && (
              <PropertiesTab draft={draft} patch={patchDraft} ai={runAi} aiBusy={aiBusy} />
            )}
            {rightTab === 'publish' && draft && (
              <PublishTab
                draft={draft} course={course} statusCard={statusCard}
                setStatus={setStatus} patchCourse={patchCourse} courseId={courseId}
              />
            )}
            {rightTab === 'allocate' && (
              <AllocateTab course={course} institutions={institutions} patchCourse={patchCourse} />
            )}
            {rightTab === 'history' && draft && <HistoryTab draft={draft} />}
            {!draft && rightTab !== 'allocate' && (
              <p className="text-xs text-muted-foreground">Select a lesson first.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ── Tree unit ──────────────────────────────────────────────── */

function TreeUnit({ unit, lessons, activeLessonId, onSelect, onRename, onAddLesson, onDeleteLesson, onDuplicateLesson }: {
  unit: Module; lessons: Lesson[]; activeLessonId: string | null;
  onSelect: (lessonId: string) => void; onRename: () => void; onAddLesson: () => void;
  onDeleteLesson: (l: Lesson) => void; onDuplicateLesson: (l: Lesson) => void;
}) {
  const [open, setOpen] = useState<boolean>(true);
  return (
    <div>
      <div className="group flex items-center gap-1 px-1.5 py-1.5 rounded-lg hover:bg-muted/60">
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
          {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          <span className="text-xs font-bold text-foreground truncate">
            {unit.unitNumber ? `Unit ${unit.unitNumber}: ` : ''}{unit.title}
          </span>
        </button>
        <button onClick={onRename} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted text-muted-foreground" title="Rename">
          <Pencil className="w-3 h-3" />
        </button>
        <button onClick={onAddLesson} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted text-muted-foreground" title="Add lesson">
          <Plus className="w-3 h-3" />
        </button>
      </div>
      {open && (
        <div className="ml-4 border-l border-border/60 pl-2 space-y-0.5 py-0.5">
          {lessons.map(l => {
            const active = l.id === activeLessonId;
            return (
              <div key={l.id}
                className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
                  active ? 'bg-amber-100/80 text-amber-900 font-semibold' : 'hover:bg-muted/60 text-foreground'
                }`}
                onClick={() => onSelect(l.id)}
              >
                <span className="shrink-0">{TYPE_ICON[l.lessonType ?? 'lesson'] ?? '📝'}</span>
                <span className="flex-1 truncate">{l.lessonNumber ? `L${l.lessonNumber}: ` : ''}{l.title}</span>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[l.status ?? 'draft']}`} title={l.status ?? 'draft'} />
                <button onClick={e => { e.stopPropagation(); onDuplicateLesson(l); }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted text-muted-foreground shrink-0" title="Duplicate">
                  <Copy className="w-3 h-3" />
                </button>
                <button onClick={e => { e.stopPropagation(); onDeleteLesson(l); }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 shrink-0" title="Delete">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
          {lessons.length === 0 && <p className="text-[10px] text-muted-foreground px-2 py-1">Empty — add a lesson.</p>}
        </div>
      )}
    </div>
  );
}

/* ── Centre block dispatcher ────────────────────────────────── */

function BuilderBlock({ blockId, draft, selected, onSelect, onDelete, onMoveUp, onMoveDown, patch, ai, aiBusy }: {
  blockId: string; draft: Lesson; selected: boolean;
  onSelect: () => void; onDelete: () => void;
  onMoveUp?: () => void; onMoveDown?: () => void;
  patch: (p: Partial<Lesson>) => void;
  ai: (format: string, extraBrief?: string) => Promise<void>;
  aiBusy: string | null;
}) {
  const def: BlockDef = BLOCK_DEFS.find(d => d.id === blockId) ?? { id: blockId, icon: '📄', label: blockId };
  const outputs = draft.aiOutputs ?? {};
  const shell = (children: React.ReactNode, opts?: { regen?: string }) => (
    <BlockShell
      def={def} bloom={draft.bloomsLevel} selected={selected} onSelect={onSelect} onDelete={onDelete}
      onMoveUp={onMoveUp} onMoveDown={onMoveDown}
      onRegenerate={opts?.regen ? () => ai(opts.regen!) : undefined}
      regenerating={opts?.regen ? aiBusy === opts.regen : false}
    >
      {children}
    </BlockShell>
  );

  switch (blockId) {
    case 'objectives':
      return shell(
        <ObjectivesBlock value={draft.objectives ?? []} onChange={v => patch({ objectives: v })} />
      );
    case 'video':
      return shell(
        <VideoBlock
          lesson={draft}
          videoConfig={draft.videoConfig ?? { type: 'voiceover' }}
          onConfig={v => patch({ videoConfig: v })}
          script={outputs.videoScript}
          onScriptChange={s => patch({ aiOutputs: { ...outputs, videoScript: s } })}
          ai={ai}
          generating={aiBusy === 'videoScript'}
        />
      );
    case 'text':
      return shell(
        <LessonTextBlock
          value={outputs.text ?? draft.contentSources?.find(s => s.type === 'text')?.value ?? ''}
          onChange={v => patch({ aiOutputs: { ...outputs, text: v } })}
          ai={ai}
          generating={aiBusy === 'text'}
        />
      );
    case 'vocabulary':
      return shell(
        <VocabularyBlock
          value={Array.isArray(outputs.glossary) ? outputs.glossary : []}
          onChange={v => patch({ aiOutputs: { ...outputs, glossary: v } })}
        />,
        { regen: 'glossary' }
      );
    case 'activity':
      return shell(
        <ActivityBlock value={draft.activity ?? {}} onChange={v => patch({ activity: v })} />
      );
    case 'quiz':
      return shell(
        <QuizBlock
          value={Array.isArray(outputs.quiz) ? outputs.quiz : []}
          onChange={v => patch({ aiOutputs: { ...outputs, quiz: v } })}
          ai={ai}
          generating={aiBusy === 'quiz'}
          settings={{
            passMark: draft.assessmentConfig?.passThreshold ?? 70,
            attempts: draft.assessmentConfig?.attempts ?? 3,
            randomise: false,
          }}
          onSettings={s => patch({
            assessmentConfig: { ...(draft.assessmentConfig ?? {}), passThreshold: s.passMark, attempts: s.attempts },
          })}
        />
      );
    case 'assignment':
      return shell(
        <AssignmentBlock value={draft.assignmentConfig ?? {}} onChange={v => patch({ assignmentConfig: v })} />
      );
    case 'assessment':
      return shell(
        <AssessmentBlock
          value={draft.assessmentConfig ?? {}}
          onChange={v => patch({ assessmentConfig: v })}
          ai={ai}
          generating={aiBusy === 'quiz'}
        />
      );
    case 'audio':
      return shell(
        <AudioBlock script={outputs.audioScript} ai={ai} generating={aiBusy === 'audioScript'} />
      );
    // Read-only AI format previews (flashcards, mindmap, infographic, slides, notes, summary, problems)
    default: {
      const formatKey = blockId as keyof AiOutputs;
      const has = outputs[formatKey] != null &&
        (!Array.isArray(outputs[formatKey]) || (outputs[formatKey] as unknown[]).length > 0);
      return shell(
        has ? (
          <div className="max-h-96 overflow-y-auto">
            <FormatPreview format={blockId} outputs={outputs} />
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Not generated yet.</p>
            <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-8 text-xs"
              disabled={aiBusy === blockId} onClick={() => ai(blockId)}>
              {aiBusy === blockId ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Generate
            </Button>
          </div>
        ),
        { regen: has ? blockId : undefined }
      );
    }
  }
}

/* ── Right tabs ─────────────────────────────────────────────── */

function PropertiesTab({ draft, patch, ai, aiBusy }: {
  draft: Lesson; patch: (p: Partial<Lesson>) => void;
  ai: (f: string) => Promise<void>; aiBusy: string | null;
}) {
  const acc = draft.accessibility ?? {};
  const setAcc = (k: keyof NonNullable<Lesson['accessibility']>, v: boolean) =>
    patch({ accessibility: { ...acc, [k]: v } });
  const outputs = draft.aiOutputs ?? {};

  return (
    <>
      <section className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Visibility</p>
        <select value={draft.visibility ?? 'all'} onChange={e => patch({ visibility: e.target.value as Lesson['visibility'] })}
          className="w-full h-9 rounded-xl border border-border bg-card px-2 text-xs">
          <option value="all">All students</option>
          <option value="teacher_only">Teacher only</option>
          <option value="scheduled">Scheduled release</option>
        </select>
        {draft.visibility === 'scheduled' && (
          <input
            type="date"
            value={draft.releaseDate ? draft.releaseDate.toDate().toISOString().slice(0, 10) : ''}
            onChange={e => patch({ releaseDate: e.target.value ? Timestamp.fromDate(new Date(e.target.value)) : undefined })}
            className="w-full h-9 rounded-xl border border-border bg-card px-2 text-xs"
          />
        )}
      </section>

      <section className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Prerequisite gate</p>
        <select value={draft.prerequisite ?? 'none'} onChange={e => patch({ prerequisite: e.target.value as Lesson['prerequisite'] })}
          className="w-full h-9 rounded-xl border border-border bg-card px-2 text-xs">
          <option value="none">No prerequisite</option>
          <option value="previous_lesson">Must complete previous lesson</option>
          <option value="pass_chapter_quiz">Must pass chapter quiz</option>
          <option value="teacher_approval">Teacher approval</option>
        </select>
      </section>

      <section className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">AI generation</p>
        <div className="grid grid-cols-2 gap-1.5">
          {AI_SHORTCUTS.map(f => {
            const v = outputs[f.id];
            const done = v != null && (!Array.isArray(v) || v.length > 0) && (typeof v !== 'string' || v.trim() !== '');
            return (
              <button key={f.id} onClick={() => ai(f.id)} disabled={aiBusy !== null}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-medium text-left transition-colors ${
                  done ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-border text-muted-foreground hover:border-violet-300 hover:text-violet-700'
                }`}>
                {aiBusy === f.id ? <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                  : done ? <CheckCircle2 className="w-3 h-3 shrink-0" />
                  : <Sparkles className="w-3 h-3 shrink-0" />}
                <span className="truncate">{f.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Accessibility</p>
        {([
          ['captions', 'Captions'],
          ['audioDescription', 'Audio description'],
          ['mobileOptimised', 'Mobile optimised'],
          ['offlineAvailable', 'Offline available'],
          ['dyslexicFont', 'OpenDyslexic font'],
        ] as const).map(([key, label]) => (
          <label key={key} className="flex items-center justify-between text-xs py-0.5 cursor-pointer">
            {label}
            <Switch checked={acc[key] ?? false} onCheckedChange={v => setAcc(key, v)} />
          </label>
        ))}
      </section>
    </>
  );
}

function PublishTab({ draft, course, statusCard, setStatus, patchCourse, courseId }: {
  draft: Lesson; course: Course;
  statusCard: { bg: string; label: string };
  setStatus: (s: NonNullable<Lesson['status']>, label: string) => Promise<void>;
  patchCourse: (p: Partial<Course>, msg?: string) => Promise<void>;
  courseId: string;
}) {
  const [scheduleDate, setScheduleDate] = useState('');
  const status = draft.status ?? 'draft';

  return (
    <>
      <div className={`rounded-2xl border px-4 py-3 text-center ${statusCard.bg}`}>
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Current status</p>
        <p className="text-lg font-bold">{statusCard.label}</p>
      </div>

      <div className="space-y-2">
        <Button className="w-full rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          disabled={status === 'published'} onClick={() => setStatus('published', 'Published')}>
          <Send className="w-4 h-4" /> Publish Now
        </Button>
        <div className="flex gap-2">
          <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
            className="flex-1 h-9 rounded-xl border border-border bg-card px-2 text-xs" />
          <Button variant="outline" className="rounded-xl text-xs h-9" disabled={!scheduleDate}
            onClick={async () => {
              await setStatus('approved', `Scheduled for ${scheduleDate}`);
              toast.success(`Will release ${scheduleDate} (set visibility to Scheduled in Properties).`);
            }}>
            Schedule
          </Button>
        </div>
        <a href={`/dashboard/student/courses/${courseId}/lessons/${draft.id}`} target="_blank" rel="noreferrer" className="block">
          <Button variant="outline" className="w-full rounded-xl gap-2 text-xs"><Eye className="w-3.5 h-3.5" /> Preview as Student</Button>
        </a>
        {status === 'draft' && (
          <Button variant="outline" className="w-full rounded-xl gap-2 text-xs" onClick={() => setStatus('in_review', 'Submitted for review')}>
            <RotateCcw className="w-3.5 h-3.5" /> Submit for Review
          </Button>
        )}
        {status === 'in_review' && (
          <Button variant="outline" className="w-full rounded-xl gap-2 text-xs" onClick={() => setStatus('approved', 'Approved')}>
            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
          </Button>
        )}
      </div>

      <section className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Scope</p>
        {([
          ['institution', 'Institution Only', 'Visible to allocated institutions'],
          ['public', 'Public Site', 'Anyone on Pocket School can find it'],
          ['marketplace', 'Marketplace', 'Listed for purchase in the marketplace'],
        ] as const).map(([id, label, desc]) => (
          <button key={id} onClick={() => patchCourse({ publishScope: id }, `Scope: ${label}`)}
            className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${
              (course.publishScope ?? 'institution') === id ? 'border-teal-400 bg-teal-50' : 'border-border hover:border-teal-300'
            }`}>
            <p className="text-xs font-bold text-foreground">{label}</p>
            <p className="text-[10px] text-muted-foreground">{desc}</p>
          </button>
        ))}
      </section>

      <section className="space-y-1.5">
        {([
          ['allowComments', 'Student comments'],
          ['enableLyra', 'Lyra AI Teacher'],
          ['notifyOnPublish', 'Notify students on publish'],
          ['timedAssessmentMode', 'Timed assessment mode'],
        ] as const).map(([key, label]) => (
          <label key={key} className="flex items-center justify-between text-xs py-0.5 cursor-pointer">
            {label}
            <Switch checked={(course[key] as boolean) ?? false} onCheckedChange={v => patchCourse({ [key]: v })} />
          </label>
        ))}
      </section>

      <div className="space-y-2 pt-2 border-t border-border">
        <Button variant="outline" className="w-full rounded-xl text-xs" disabled={status !== 'published'}
          onClick={() => setStatus('approved', 'Unpublished')}>
          Unpublish
        </Button>
        <Button variant="outline" className="w-full rounded-xl text-xs gap-2 border-red-200 text-red-500 opacity-70 hover:opacity-100 hover:bg-red-50"
          onClick={() => { if (window.confirm('Archive this lesson? Students will no longer see it.')) setStatus('archived', 'Archived'); }}>
          <Archive className="w-3.5 h-3.5" /> Archive
        </Button>
      </div>
    </>
  );
}

function AllocateTab({ course, institutions, patchCourse }: {
  course: Course; institutions: Institution[];
  patchCourse: (p: Partial<Course>, msg?: string) => Promise<void>;
}) {
  const allocated = course.allocatedInstitutionIds ?? [];
  const groups = course.allocatedGroups ?? [];
  const override = course.accessOverride ?? {};
  const [price, setPrice] = useState(override.pricePerInstitution?.toString() ?? '');
  const [expiry, setExpiry] = useState(override.expiryDate ?? '');
  const [sparks, setSparks] = useState(override.sparksOverride?.toString() ?? '');

  const toggleInstitution = (inst: Institution, on: boolean) => {
    const next = on ? [...allocated, inst.id] : allocated.filter(id => id !== inst.id);
    patchCourse(
      { allocatedInstitutionIds: next },
      on ? `Access granted to ${inst.name}` : `Access removed from ${inst.name}`
    );
  };

  const toggleGroup = (g: string, on: boolean) => {
    const next = on ? [...groups, g] : groups.filter(x => x !== g);
    patchCourse({ allocatedGroups: next }, on ? `Access granted to ${g}` : `Access removed from ${g}`);
  };

  return (
    <>
      <section className="space-y-1.5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Institutions</p>
        {institutions.length === 0 && (
          <p className="text-[11px] text-muted-foreground">No institutions yet — add them in Admin → Institutions.</p>
        )}
        {institutions.map(inst => (
          <label key={inst.id} className="flex items-center justify-between gap-2 text-xs py-1 cursor-pointer">
            <span className="min-w-0">
              <span className="font-semibold text-foreground block truncate">{inst.name}</span>
              <span className="text-[10px] text-muted-foreground">{inst.studentCount} students</span>
            </span>
            <Switch checked={allocated.includes(inst.id)} onCheckedChange={v => toggleInstitution(inst, v)} />
          </label>
        ))}
      </section>

      <section className="space-y-1.5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Student groups</p>
        {STUDENT_GROUPS.map(g => (
          <label key={g} className="flex items-center justify-between text-xs py-1 cursor-pointer">
            <span className="font-semibold text-foreground">{g}</span>
            <Switch checked={groups.includes(g)} onCheckedChange={v => toggleGroup(g, v)} />
          </label>
        ))}
        <p className="text-[10px] text-muted-foreground">Changes apply instantly — no re-publishing required.</p>
      </section>

      <section className="space-y-2 pt-2 border-t border-border">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Access override</p>
        <Input value={price} onChange={e => setPrice(e.target.value)} type="number" placeholder="Price per institution (£)" className="h-9 rounded-xl text-xs" />
        <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} className="w-full h-9 rounded-xl border border-border bg-card px-2 text-xs" />
        <Input value={sparks} onChange={e => setSparks(e.target.value)} type="number" placeholder="Sparks cost override (⚡)" className="h-9 rounded-xl text-xs" />
        <Button size="sm" className="w-full rounded-xl text-xs" onClick={() => patchCourse({
          accessOverride: {
            ...(price ? { pricePerInstitution: Number(price) } : {}),
            ...(expiry ? { expiryDate: expiry } : {}),
            ...(sparks ? { sparksOverride: Number(sparks) } : {}),
          },
        }, 'Access settings saved')}>
          Save Access Settings
        </Button>
      </section>
    </>
  );
}

function HistoryTab({ draft }: { draft: Lesson }) {
  const entries = draft.history ?? [];
  return (
    <>
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Content audit log</p>
      {entries.length === 0 && (
        <p className="text-xs text-muted-foreground">No history yet — saves, AI generations and publish actions will appear here.</p>
      )}
      <div className="space-y-3">
        {entries.map((h, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${i === 0 ? 'bg-teal-500' : 'bg-slate-300'}`} />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">{h.label}</p>
              <p className="text-[10px] text-muted-foreground">
                {h.actor} · {h.at?.toDate ? h.at.toDate().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
