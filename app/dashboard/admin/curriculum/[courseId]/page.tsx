'use client';

/**
 * Content Builder — three-panel curriculum authoring studio.
 * Left: course structure tree. Centre: block editor. Right: Properties /
 * Publish / Allocate / History tabs. Auto-saves the selected lesson.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { deleteField, Timestamp } from 'firebase/firestore';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  getCourse, getModulesWithLessons, updateCourse, clearCourseFields, createModule, updateUnit,
  createLesson, updateLesson, deleteLesson, duplicateLesson, deleteUnit, getInstitutions,
  moveLessonToUnit,
  Course, Module, Lesson, AiOutputs, Institution, LessonVisual,
} from '@/lib/db';
import {
  BLOCK_DEFS, BLOOMS, BlockShell, ObjectivesBlock, VideoBlock, LessonTextBlock, blockPalette,
  VocabularyBlock, ActivityBlock, QuizBlock, AssignmentBlock, AssessmentBlock,
  AudioBlock, MarkdownEditBlock, ProblemsBlock, type AiRunOptions, type BlockDef,
} from '@/components/builder-blocks';
import { VisualBlock } from '@/components/lesson-visual';
import { FormatPreview } from '@/components/lesson-format-views';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ROLE_LABELS } from '@/lib/roles';
import {
  BUILT_IN_TEMPLATES, getTemplate, suggestTemplateId, templatesForSubject,
} from '@/lib/content-templates';
import { TierSelector } from '@/components/tier-selector';
import type {
  TierId, Tier2SubjectType, LawStage, Tier3Assessment,
} from '@/lib/curriculum-tiers';
import { getFormatCost } from '@/lib/sparks';
import { appendImageMarkdown, lessonBodyPatch, manuscriptToMarkdown, readLessonBody } from '@/lib/lesson-body';
import { problemsAreWorked } from '@/lib/generation-quality';
import { hasCmsAddon } from '@/lib/entitlements';
import { stripUnitPrefix } from '@/lib/unit-title';
import { describeSaveError } from '@/lib/save-status';
import { writeAutosave } from '@/components/editor';
import { CoverArtPicker, storeMedia } from '@/components/media';
import { jobUpdate, visibleJob } from '@/lib/generation-jobs';
import { filesToAssets, LessonIllustrationBlock, LessonImageBlock } from '@/components/lesson-pictures';
import type { ImportResult } from '@/components/editor';
import { LessonLanguagePanel } from '@/components/lesson-language-panel';
import { CopyrightSign } from '@/components/courses/copyright-sign';
import { teacherMustSignCopyright } from '@/lib/courses/copyright';
import { SIGN } from '@/lib/courses/sign-copy';
import { CMS_DESK } from '@/lib/cms/desk-copy';
import { clearCrumbTitle, setCrumbTitle } from '@/lib/shell/crumb-titles';
import { VisualBlockEditor } from '@/components/visual-blocks';
import { UnitTestEditor } from '@/components/unit-test-editor';
import { emptyVisualBlock, isVisualBlockId, upsertVisualBlock, visualPublishErrors } from '@/lib/visual-blocks';
import { emptyUnitTest, resolvePassMark } from '@/lib/unit-test';
import { AllocationPanel } from '@/components/allocation-panel';
import { AllocationPicker } from '@/components/allocation-picker';
import { allocationFields, migrateAllocation } from '@/lib/allocation-targets';
import { moveItem, popUndo, pushUndo, type UndoEntry } from '@/lib/reorder';
import {
  appendQuiz, applyGlossaryResult, BLOCK_OUTPUT_KEY, DEFAULT_LESSON_MARKS, describeFirestoreError,
  displayUnitTitle, lessonFieldPatch,
} from '@/lib/cms-guards';
import { fetchWithBackoff, withBackoff } from '@/lib/net-retry';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Copy, CornerDownRight,
  Eye, GripVertical, Loader2, Pencil, Plus, RotateCcw, Send, Sparkles, Trash2, Archive, X,
} from 'lucide-react';

/* ── Constants ──────────────────────────────────────────────── */

const LESSON_TYPES = [
  { id: 'lesson', icon: '📝', label: 'Lesson' },
  { id: 'video', icon: '🎬', label: 'Video Lesson' },
  { id: 'assignment', icon: '📋', label: 'Assignment' },
  { id: 'assessment', icon: '🏅', label: 'Assessment / Test' },
  { id: 'live', icon: '📡', label: 'Live Session' },
  { id: 'resource', icon: '📁', label: 'Resource Pack' },
  { id: 'unit_test', icon: '🧪', label: 'Unit Test' },
] as const;

const TYPE_ICON: Record<string, string> = Object.fromEntries(LESSON_TYPES.map(t => [t.id, t.icon]));

const STATUS_DOT: Record<string, string> = {
  published: 'bg-success',
  approved: 'bg-blue-500',
  in_review: 'bg-[var(--ps-cyan)]',
  draft: 'bg-slate-300',
  archived: 'bg-red-300',
};

const STATUS_CARD: Record<string, { bg: string; label: string }> = {
  draft: { bg: 'bg-slate-100 text-slate-700 border-slate-200', label: 'Draft' },
  in_review: { bg: 'bg-[var(--ps-cyan-soft)] text-[var(--ps-cyan-text)] border-[var(--ps-cyan-border)]', label: 'In Review' },
  approved: { bg: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Approved' },
  published: { bg: 'bg-success/15 text-success border-success/40', label: 'Published' },
  archived: { bg: 'bg-red-50 text-red-600 border-red-200', label: 'Archived' },
};

const STUDENT_GROUPS = ['IGCSE All', 'IGCSE Advanced', 'SPM Target', 'Free Trial'];

const DEFAULT_BLOCKS = ['objectives', 'video', 'text', 'vocabulary', 'quiz'];

/** Visibility options — wording fixed by the curriculum team. */
const VISIBILITY_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: 'all', label: 'All Students', hint: 'Every enrolled student can open this lesson now.' },
  { value: 'teacher_only', label: 'Teachers Only', hint: 'Hidden from students — use while the lesson is still being written.' },
  { value: 'teachers_students', label: 'Teachers & Students', hint: 'Visible to enrolled students and their teachers.' },
  { value: 'scheduled', label: 'Scheduled Release', hint: 'Hidden until the release date below.' },
];

/** A teaching week is planned as 5 × 60-minute sessions, so lesson duration can
 * be entered in weeks and stored honestly in the existing `durationMinutes`. */
const MINUTES_PER_WEEK = 300;
const DURATION_PRESETS = [1, 2, 3, 4];

/** Client-mandated publish disclaimer — do not reword. */
const PUBLISH_DISCLAIMER = `Before you publish, please confirm the following. You are responsible for everything in this course — all text, questions, videos, audio, and materials. Poket School does not check or verify your content before it goes live. Make sure everything you publish is accurate, original or properly licensed, age-appropriate for your intended students, and compliant with the curriculum it references. Do not include content that is copied without permission, misleading, harmful, or in breach of any examination board's intellectual property. By clicking Publish, you confirm that this course is your own work or that you have the right to use all materials within it, and that you accept full responsibility for its content. Any violations may have your course taken down or account terminated.`;

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

type CoursePatch = Omit<Partial<Course>, 'minTier' | 'priceType' | 'downloadsEnabled'> & {
  minTier?: number | null;
  priceType?: Course['priceType'] | null;
  downloadsEnabled?: boolean | null;
};

async function callGenerate(
  content: string, format: string, briefPrompt?: string, templateId?: string,
  tier?: string, tierMeta?: Record<string, string | undefined>,
  options?: Pick<AiRunOptions, 'quizCount' | 'scaffold'>,
): Promise<{ result: unknown; warning?: string }> {
  const res = await fetchWithBackoff('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content, format, briefPrompt, templateId, tier, tierMeta,
      quizCount: options?.quizCount, scaffold: options?.scaffold,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Generation failed: ${format}`);
  return { result: data.result, warning: data.warning };
}

/** ET AI — the CMS assistant (objectives, briefs, rewrites, assessments). */
async function callEt<T>(task: string, context: Record<string, unknown>): Promise<T> {
  const res = await fetch('/api/ai/course-architect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, context }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'ET AI could not complete that request.');
  return data as T;
}

/* ── Firestore-safe cloning ─────────────────────────────────────
 * A JSON round-trip would turn every Firestore Timestamp into a plain
 * {seconds, nanoseconds} map — which is exactly why history entries and
 * scheduled release dates lost their dates. These helpers keep Timestamps
 * intact while still deep-copying / dropping undefined values. */

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function cloneDeep<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneDeep) as unknown as T;
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = cloneDeep(v);
    return out as T;
  }
  return value; // Timestamps, primitives, class instances pass through untouched
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.filter(v => v !== undefined).map(stripUndefined) as unknown as T;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

/** Renders a history timestamp, tolerating legacy entries that were saved as
 * plain {seconds} maps before the cloning bug was fixed. */
function formatHistoryDate(at: unknown): string {
  const d =
    at instanceof Timestamp ? at.toDate()
      : at && typeof (at as any).toDate === 'function' ? (at as any).toDate()
      : at && typeof (at as any).seconds === 'number' ? new Date((at as any).seconds * 1000)
      : null;
  if (!d || Number.isNaN(d.getTime())) return 'Date unavailable';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/* ── Lesson numbering (sub-lessons) ──────────────────────────── */

/** Sub-lessons are numbered with decimals (L1.1) or titled "L1.1 …". */
function isSubLesson(l: Lesson): boolean {
  if (typeof l.lessonNumber === 'number' && !Number.isInteger(l.lessonNumber)) return true;
  return /^L?\s*\d+\.\d+/i.test(l.title ?? '');
}

/** Renumbers a unit after a drag-drop: top-level lessons get 1,2,3…, and each
 * sub-lesson hangs off the top-level lesson above it (1.1, 1.2 …). */
function renumber(lessons: Lesson[]): Lesson[] {
  let top = 0;
  let sub = 0;
  return lessons.map((l, i) => {
    let lessonNumber: number;
    if (isSubLesson(l) && top > 0) {
      sub += 1;
      lessonNumber = Number((top + sub / (sub < 10 ? 10 : 100)).toFixed(2));
    } else {
      top += 1;
      sub = 0;
      lessonNumber = top;
    }
    return { ...l, order: i + 1, lessonNumber };
  });
}

/* ── Page ───────────────────────────────────────────────────── */

export default function ContentBuilderPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const { user, profile } = useAuthSTORE();

  const [course, setCourse] = useState<Course | null>(null);
  const needsCopyright = teacherMustSignCopyright(profile?.role, course?.copyrightSignatureId);

  useEffect(() => {
    const title = course?.title?.trim();
    if (!title) return;
    setCrumbTitle(courseId, title);
    return () => clearCrumbTitle(courseId);
  }, [course?.title, courseId]);
  const [units, setUnits] = useState<UnitWithLessons[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selUnit, setSelUnit] = useState<string | null>(null);
  const [selLesson, setSelLesson] = useState<string | null>(null);
  const [treeOpen, setTreeOpen] = useState(false);
  const [draft, setDraft] = useState<Lesson | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<UndoEntry<UnitWithLessons[]>[]>([]);
  const [rightTab, setRightTab] = useState<'properties' | 'publish' | 'allocate' | 'history'>('properties');
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [etBusy, setEtBusy] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishAccepted, setPublishAccepted] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef<Lesson | null>(null);
  const selectionRef = useRef({ unit: null as string | null, lesson: null as string | null });
  const saveStateRef = useRef(saveState);
  const lastSavedRef = useRef(new Map<string, Lesson>());
  const saveChain = useRef(Promise.resolve());
  const inflightAi = useRef(new Set<string>());
  const hydratedKey = useRef<string | null>(null);
  selectionRef.current = { unit: selUnit, lesson: selLesson };
  saveStateRef.current = saveState;
  draftRef.current = draft;
  const cmsTools = hasCmsAddon(profile);

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
      const repaired = mods.map(entry => {
        const title = stripUnitPrefix(entry.module.title, entry.module.unitNumber);
        if (title === entry.module.title.trim()) return entry;
        return { ...entry, module: { ...entry.module, title } };
      });
      setUnits(repaired);
      setInstitutions(inst);
      const stale = mods.filter(entry => stripUnitPrefix(entry.module.title, entry.module.unitNumber) !== entry.module.title.trim());
      if (stale.length) {
        void Promise.all(stale.map(entry => updateUnit(courseId, entry.module.id, {
          title: stripUnitPrefix(entry.module.title, entry.module.unitNumber),
        }).catch(() => undefined)));
      }
      if (!keepSelection && mods.length) {
        const requested = typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('lesson')
          : null;
        const owner = requested ? mods.find(u => u.lessons.some(l => l.id === requested)) : undefined;
        if (owner && requested) {
          setSelUnit(owner.module.id);
          setSelLesson(requested);
        } else if (mods[0].lessons.length) {
          setSelUnit(mods[0].module.id);
          setSelLesson(mods[0].lessons[0].id);
        }
      }
    } catch (e: any) {
      setLoadError(describeFirestoreError(e));
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (!cmsTools) {
      setLoading(false);
      return;
    }
    load();
  }, [load, cmsTools]);

  // Hydrate only when the open lesson changes. A save updates `units` too,
  // and re-copying that into the editor was wiping text the admin had just typed.
  useEffect(() => {
    const key = `${selUnit ?? ''}:${selLesson ?? ''}`;
    if (!selUnit || !selLesson) {
      setDraft(null);
      draftRef.current = null;
      hydratedKey.current = key;
      return;
    }
    if (hydratedKey.current === key) return;
    const lesson = units.find(u => u.module.id === selUnit)?.lessons.find(l => l.id === selLesson) ?? null;
    if (!lesson) return;
    hydratedKey.current = key;
    const copy = cloneDeep(lesson);
    draftRef.current = copy;
    lastSavedRef.current.set(lesson.id, cloneDeep(lesson));
    setDraft(copy);
    setSaveState('saved');
    setSaveError(null);
  }, [selUnit, selLesson, units]);

  /* ── Saving — one changed field at a time, queued, retried ── */

  const enqueueSave = useCallback((moduleId: string, snapshot: Lesson, historyLabel?: string) => {
    const run = async () => {
      const withHistory = historyLabel
        ? {
          ...snapshot,
          history: [{ label: historyLabel, actor: actorName, at: Timestamp.now() }, ...(snapshot.history ?? [])].slice(0, 30),
        }
        : snapshot;
      const previous = lastSavedRef.current.get(snapshot.id) ?? null;
      const raw = lessonFieldPatch(
        previous as unknown as Record<string, unknown> | null,
        stripUndefined(withHistory) as unknown as Record<string, unknown>,
      );
      const fields: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(raw)) fields[key] = value === null ? deleteField() : value;
      if (Object.keys(fields).length === 0) {
        if (selectionRef.current.lesson === snapshot.id) { setSaveState('saved'); setSaveError(null); }
        return;
      }
      if (selectionRef.current.lesson === snapshot.id) setSaveState('saving');
      writeAutosave(`poket-lesson:${snapshot.id}`, readLessonBody(withHistory));
      try {
        await withBackoff(() => updateLesson(courseId, moduleId, snapshot.id, fields as Partial<Lesson>));
        lastSavedRef.current.set(snapshot.id, cloneDeep(withHistory));
        setUnits(prev => prev.map(u => u.module.id !== moduleId ? u : {
          ...u, lessons: u.lessons.map(l => l.id === snapshot.id ? withHistory : l),
        }));
        if (selectionRef.current.lesson === snapshot.id) { setSaveState('saved'); setSaveError(null); }
      } catch (e: unknown) {
        const message = describeSaveError(e);
        writeAutosave(`poket-lesson:${snapshot.id}`, readLessonBody(withHistory));
        if (selectionRef.current.lesson === snapshot.id) { setSaveState('error'); setSaveError(message); }
        toast.error(message, { duration: 12000 });
        throw e;
      }
    };
    const job = saveChain.current.then(run, run);
    saveChain.current = job.then(() => undefined, () => undefined);
    return job;
  }, [actorName, courseId]);

  const flushNow = useCallback((historyLabel?: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const current = draftRef.current;
    const moduleId = selectionRef.current.unit;
    if (!current || !moduleId) return Promise.resolve();
    return enqueueSave(moduleId, cloneDeep(current), historyLabel);
  }, [enqueueSave]);

  const persistDraft = useCallback(async (d: Lesson, historyLabel?: string) => {
    const moduleId = selectionRef.current.unit;
    if (!moduleId) return;
    await enqueueSave(moduleId, d, historyLabel);
  }, [enqueueSave]);

  const patchDraft = useCallback((patch: Partial<Lesson>) => {
    setDraft(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      draftRef.current = next;
      setSaveState('dirty');
      setSaveError(null);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => { void flushNow(); }, 4000);
      return next;
    });
  }, [flushNow]);

  const saveNow = useCallback(() => { void flushNow('Manual save'); }, [flushNow]);

  const selectLesson = useCallback((unitId: string, lessonId: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const current = draftRef.current;
    const moduleId = selectionRef.current.unit;
    if (current && moduleId && current.id !== lessonId && saveStateRef.current !== 'saved') {
      void enqueueSave(moduleId, cloneDeep(current));
    }
    setSelUnit(unitId);
    setSelLesson(lessonId);
    setTreeOpen(false);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('lesson', lessonId);
      window.history.replaceState(null, '', `${url.pathname}${url.search}`);
    }
  }, [enqueueSave]);

  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (saveStateRef.current === 'saved') return;
      event.preventDefault();
      event.returnValue = '';
    };
    const onHide = () => {
      if (document.visibilityState !== 'hidden' || saveStateRef.current === 'saved') return;
      const current = draftRef.current;
      const moduleId = selectionRef.current.unit;
      if (current && moduleId) void enqueueSave(moduleId, cloneDeep(current));
    };
    window.addEventListener('beforeunload', onLeave);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('beforeunload', onLeave);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [enqueueSave]);

  /* ── AI generation ── */

  const runAi = useCallback(async (format: string, extra?: string | AiRunOptions) => {
    const opts: AiRunOptions = typeof extra === 'string' ? { extraBrief: extra } : (extra ?? {});
    const started = draftRef.current;
    const moduleId = selectionRef.current.unit;
    if (!started || !moduleId) return;
    const lessonId = started.id;
    const lock = `${lessonId}:${format}`;
    if (inflightAi.current.has(lock)) return;
    inflightAi.current.add(lock);
    const existing = (started.aiOutputs as Record<string, unknown> | undefined)?.[format];
    const already = existing != null && existing !== '' && !(Array.isArray(existing) && existing.length === 0);
    if (already && !opts.append && !opts.confirmed) {
      const label = AI_SHORTCUTS.find(item => item.id === format)?.label ?? format;
      const ok = window.confirm(
        `${label} already exists on “${started.title}”. Generate again and replace it? Students unlock this format for ${getFormatCost(format)} Sparks.`,
      );
      if (!ok) { inflightAi.current.delete(lock); return; }
    }
    setAiBusy(format);
    const generating = {
      ...started,
      generationJobs: jobUpdate(started.generationJobs, format, 'generating', Date.now()),
    };
    if (draftRef.current?.id === lessonId) {
      draftRef.current = generating;
      setDraft(generating);
    }
    try {
      const content = readLessonBody(started).trim()
        || started.contentSources?.find(s => s.type === 'text')?.value?.trim()
        || started.title;
      const brief = [started.briefPrompt, opts.extraBrief].filter(Boolean).join('\n');
      const templateId = started.contentTemplateId
        || course?.contentTemplateId
        || suggestTemplateId(course?.subject);
      const tier = started.curriculumTier || course?.curriculumTier;
      const generated = await callGenerate(content, format, brief || undefined, format === 'problems' ? undefined : templateId, tier, {
        subject: course?.subject,
        yearLevel: course?.yearGroup ?? course?.level,
        courseTitle: course?.title,
        unit: units.find(u => u.module.id === moduleId)?.module.title,
        topic: started.title,
        subjectType: started.tierSubjectType || course?.tierSubjectType,
        lawStage: started.tierLawStage || course?.tierLawStage,
        assessmentStyle: started.tierAssessmentStyle || course?.tierAssessmentStyle,
      }, opts);
      if (format === 'problems' && (typeof generated.result !== 'string' || !problemsAreWorked(generated.result))) {
        throw new Error('Problems must be practice problems with a worked solution, not study notes.');
      }
      const live = draftRef.current?.id === lessonId ? draftRef.current : generating;
      const aiOutputs: AiOutputs = { ...(live.aiOutputs ?? {}) };
      if (format === 'glossary' && Array.isArray(generated.result)) {
        const frozen = applyGlossaryResult(aiOutputs, generated.result as { term: string; definition: string }[]);
        aiOutputs.vocabulary = frozen.vocabulary;
        aiOutputs.glossary = frozen.glossary;
      } else if (format === 'quiz' && opts.append && Array.isArray(generated.result)) {
        aiOutputs.quiz = appendQuiz(aiOutputs.quiz, generated.result as NonNullable<AiOutputs['quiz']>);
      } else {
        (aiOutputs as Record<string, unknown>)[format] = generated.result;
      }
      const blockId = format === 'videoScript' ? 'video' : format === 'audioScript' ? 'audio' : format;
      const blocks = live.blocksOrder?.length ? [...live.blocksOrder] : [...DEFAULT_BLOCKS];
      if (!blocks.includes(blockId) && BLOCK_DEFS.some(def => def.id === blockId)) blocks.push(blockId);
      const bodySync = format === 'text' && typeof generated.result === 'string'
        ? lessonBodyPatch({ ...live, aiOutputs }, generated.result)
        : null;
      const next = {
        ...live,
        aiOutputs,
        blocksOrder: blocks,
        generationJobs: jobUpdate(live.generationJobs, format, 'done', Date.now()),
        ...(bodySync ?? {}),
      } as Lesson;
      if (draftRef.current?.id === lessonId) {
        draftRef.current = next;
        setDraft(next);
      }
      await enqueueSave(moduleId, next, `AI generated: ${format}`);
      toast.success(generated.warning ? `${format} generated. ${generated.warning}` : `${format} generated.`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : `Failed to generate ${format}.`;
      const base = draftRef.current?.id === lessonId ? draftRef.current : started;
      const failed = {
        ...base,
        generationJobs: jobUpdate(base.generationJobs, format, 'failed', Date.now(), message),
      };
      if (draftRef.current?.id === lessonId) {
        draftRef.current = failed;
        setDraft(failed);
      }
      await enqueueSave(moduleId, failed, `AI failed: ${format}`);
      toast.error(message);
    } finally {
      inflightAi.current.delete(lock);
      setAiBusy(current => current === format ? null : current);
    }
  }, [course, units, enqueueSave]);

  /* ── ET AI assistance ── */

  /** Runs a ET AI task against the selected lesson and persists the patch it
   * produces, adding an audit-trail entry for the action. */
  const runEt = useCallback(async (
    key: string,
    task: string,
    buildContext: (d: Lesson) => Record<string, unknown>,
    apply: (d: Lesson, data: any) => Partial<Lesson> | null,
    historyLabel: string,
  ) => {
    const d = draftRef.current;
    const moduleId = selectionRef.current.unit;
    if (!d || !moduleId) return;
    const lessonId = d.id;
    if (inflightAi.current.has(`${lessonId}:${key}`)) return;
    inflightAi.current.add(`${lessonId}:${key}`);
    setEtBusy(key);
    try {
      const data = await callEt<any>(task, buildContext(d));
      const live = draftRef.current?.id === lessonId ? draftRef.current : d;
      const patch = apply(live, data);
      if (!patch) { toast.error('ET AI returned nothing usable — try again.'); return; }
      const next = { ...live, ...patch } as Lesson;
      if (patch.aiOutputs) next.aiOutputs = { ...(live.aiOutputs ?? {}), ...patch.aiOutputs };
      if (draftRef.current?.id === lessonId) {
        draftRef.current = next;
        setDraft(next);
      }
      await enqueueSave(moduleId, next, historyLabel);
      toast.success(historyLabel);
    } catch (e: any) {
      toast.error(e?.message || 'ET AI request failed.');
    } finally {
      inflightAi.current.delete(`${lessonId}:${key}`);
      setEtBusy(null);
    }
  }, [enqueueSave]);

  const suggestObjectives = useCallback(() => runEt(
    'objectives', 'objectives',
    d => ({
      lessonTitle: d.title,
      bloom: d.bloomsLevel ?? 'Understand',
      yearLevel: course?.yearGroup ?? course?.level ?? '',
      subject: course?.subject ?? '',
      // Where this lesson sits, and what it actually teaches — without these
      // ET AI can only paraphrase the title.
      siblingLessons: (units.find(u => u.module.id === selUnit)?.lessons ?? [])
        .filter(l => l.id !== d.id).map(l => l.title),
      lessonText: readLessonBody(d),
    }),
    (d, data) => {
      const objectives = Array.isArray(data?.objectives) ? data.objectives : [];
      if (!objectives.length) return null;
      const blocks = d.blocksOrder?.length ? d.blocksOrder : DEFAULT_BLOCKS;
      return {
        objectives,
        blocksOrder: blocks.includes('objectives') ? blocks : ['objectives', ...blocks],
      };
    },
    'ET AI suggested objectives',
  ), [runEt, course, units, selUnit]);

  const writeBrief = useCallback(() => {
    const current = draftRef.current;
    if (!current) return;
    const replacing = Boolean(current.briefPrompt?.trim());
    const ok = window.confirm(
      replacing
        ? `Replace the generation brief on “${current.title}”? ET AI will rewrite only this lesson.`
        : `Ask ET AI to write a generation brief for “${current.title}”? You can also type one in the brief box without using ET AI.`,
    );
    if (!ok) return;
    return runEt(
    'brief', 'brief',
    d => ({
      lessonTitle: d.title,
      subject: course?.subject ?? '',
      yearLevel: course?.yearGroup ?? course?.level ?? '',
      objectives: (d.objectives ?? []).map((o: any) => (typeof o === 'string' ? o : o?.text)),
      siblingLessons: (units.find(u => u.module.id === selUnit)?.lessons ?? [])
        .filter(l => l.id !== d.id).map(l => l.title),
    }),
    (_d, data) => (typeof data?.brief === 'string' && data.brief.trim() ? { briefPrompt: data.brief } : null),
    'ET AI wrote the generation brief',
  );
  }, [runEt, course, units, selUnit]);

  const improveText = useCallback((instruction: string) => runEt(
    'improve', 'improve',
    d => ({
      text: readLessonBody(d),
      instruction,
      // "Simplify" needs a target reader to be meaningful.
      subject: course?.subject ?? '',
      yearLevel: course?.yearGroup ?? course?.level ?? '',
    }),
    (d, data) => (typeof data?.text === 'string' && data.text.trim()
      ? lessonBodyPatch(d, data.text)
      : null),
    'ET AI rewrote the lesson text',
  ), [runEt, course]);

  const applyManuscript = useCallback(async (result: ImportResult) => {
    const d = draftRef.current;
    if (!d || !selUnit || result.blocks.length === 0) return;
    const [first, ...rest] = result.blocks;
    const next = {
      ...d,
      ...lessonBodyPatch(d, manuscriptToMarkdown([first])),
      title: d.title?.trim() ? d.title : first.title,
    };
    setDraft(next);
    await persistDraft(next, 'Imported manuscript');
    if (rest.length === 0) {
      toast.success('Imported into this lesson.');
      return;
    }
    try {
      const unit = units.find(u => u.module.id === selUnit);
      let count = unit?.lessons.length ?? 0;
      for (const block of rest) {
        count += 1;
        const body = manuscriptToMarkdown([block]);
        await createLesson(courseId, selUnit, {
          title: block.title || `Lesson ${count}`,
          moduleId: selUnit,
          courseId,
          order: count,
          lessonNumber: count,
          status: 'draft',
          lessonType: 'lesson',
          blocksOrder: DEFAULT_BLOCKS,
          ...lessonBodyPatch({ aiOutputs: {} }, body),
        });
      }
      toast.success(`Imported this lesson and added ${rest.length} more from the headings.`);
      await load(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'The extra sections could not be saved.');
    }
  }, [selUnit, persistDraft, units, courseId, load]);

  const takePastedImages = useCallback(async (files: File[]) => {
    const d = draftRef.current;
    if (!d) return;
    try {
      const added = await filesToAssets(courseId, files);
      if (added.length === 0) return;
      const blocks = d.blocksOrder?.length ? d.blocksOrder : DEFAULT_BLOCKS;
      patchDraft({
        mediaLibrary: [...(d.mediaLibrary ?? []), ...added],
        blocksOrder: blocks.includes('image') ? blocks : [...blocks, 'image'],
      });
      toast.message('Images are in the Image block. Add alt text, then place them.');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'That image could not be added.');
    }
  }, [patchDraft, courseId]);

  const draftAssessment = useCallback(() => runEt(
    'assessment', 'assessment',
    d => ({
      lessonTitle: d.title,
      totalMarks: d.assessmentConfig?.totalMarks ?? d.marks ?? 40,
      // Without the objectives the assessment tests the title, not the lesson.
      objectives: (d.objectives ?? []).map((o: any) => (typeof o === 'string' ? o : o?.text)),
      yearLevel: course?.yearGroup ?? course?.level ?? '',
    }),
    (d, data) => {
      const sections = Array.isArray(data?.sections) ? data.sections : [];
      if (!sections.length) return null;
      const total = sections.reduce((s: number, x: any) => s + (Number(x.marks) || 0), 0);
      return {
        assessmentConfig: {
          ...(d.assessmentConfig ?? {}),
          sections,
          totalMarks: d.assessmentConfig?.totalMarks ?? total,
        },
      };
    },
    'ET AI drafted assessment sections',
  ), [runEt, course]);

  /* ── Status workflow ── */

  const setStatus = async (next: NonNullable<Lesson['status']>, label: string) => {
    const d = draftRef.current;
    if (!d) return;
    const patched = {
      ...d, status: next,
      ...(next === 'approved' ? { reviewedBy: actorName, reviewedAt: Timestamp.now() } : {}),
    };
    draftRef.current = patched;
    setDraft(patched);
    await enqueueSave(selectionRef.current.unit ?? d.moduleId, patched, label);
    toast.success(label);
  };

  /* ── Publish confirmation (responsibility disclaimer) ── */

  const openPublishModal = () => {
    const missing = visualPublishErrors(draftRef.current);
    if (missing.length) {
      toast.error(missing[0]);
      return;
    }
    setPublishAccepted(false);
    setPublishOpen(true);
  };

  const confirmPublish = async () => {
    if (!publishAccepted || needsCopyright) return;
    setPublishing(true);
    try {
      await setStatus('published', 'Published');
      setPublishOpen(false);
    } finally {
      setPublishing(false);
    }
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
      await updateUnit(courseId, unit.id, { title: stripUnitPrefix(title.trim(), unit.unitNumber) });
      load(true);
    } catch (e: any) { toast.error(e?.message || 'Failed.'); }
  };

  const removeUnit = async (unit: Module, lessonCount: number) => {
    const detail = lessonCount === 0
      ? 'It has no lessons yet.'
      : `This will also delete ${lessonCount} lesson${lessonCount === 1 ? '' : 's'} inside it.`;
    if (!confirm(`Delete the unit "${unit.title}"?\n\n${detail}\n\nThis cannot be undone.`)) return;
    try {
      await deleteUnit(courseId, unit.id);
      toast.success(`"${unit.title}" deleted.`);
      await load(true);
    } catch (e: any) { toast.error(e?.message || 'Failed to delete unit.'); }
  };

  const addUnitTest = async (unitId: string, count: number) => {
    try {
      const id = await createLesson(courseId, unitId, {
        title: 'Unit Test', moduleId: unitId, courseId,
        order: count + 1, lessonNumber: count + 1, status: 'draft',
        lessonType: 'unit_test', isUnitQuiz: true, blocksOrder: ['unitTest'],
        unitTest: emptyUnitTest(), marks: 0,
      });
      await load(true);
      selectLesson(unitId, id);
      toast.success('Unit test added.');
    } catch (e: any) { toast.error(e?.message || 'Failed.'); }
  };

  const addLesson = async (unitId: string, count: number) => {
    const title = window.prompt('New lesson title:');
    if (!title?.trim()) return;
    try {
      const id = await createLesson(courseId, unitId, {
        title: title.trim(), moduleId: unitId, courseId,
        order: count + 1, lessonNumber: count + 1, status: 'draft',
        lessonType: 'lesson', blocksOrder: DEFAULT_BLOCKS, marks: DEFAULT_LESSON_MARKS,
      });
      await load(true);
      selectLesson(unitId, id);
    } catch (e: any) { toast.error(e?.message || 'Failed.'); }
  };

  /** Inline rename from the course tree. */
  const renameLesson = async (unitId: string, lesson: Lesson, title: string) => {
    const next = title.trim();
    if (!next || next === lesson.title) return;
    try {
      await updateLesson(courseId, unitId, lesson.id, { title: next });
      setUnits(prev => prev.map(u => u.module.id !== unitId ? u : {
        ...u, lessons: u.lessons.map(l => (l.id === lesson.id ? { ...l, title: next } : l)),
      }));
      toast.success('Lesson renamed.');
    } catch (e: any) { toast.error(e?.message || 'Rename failed.'); }
  };

  /** Creates a nested lesson numbered off its parent, e.g. L1 → L1.1. */
  const addSubLesson = async (unitId: string, parent: Lesson, lessons: Lesson[]) => {
    const title = window.prompt(`New sub-lesson under “${parent.title}”:`);
    if (!title?.trim()) return;
    const parentIdx = lessons.findIndex(l => l.id === parent.id);
    const top = Math.floor(parent.lessonNumber ?? parentIdx + 1) || parentIdx + 1;
    const siblings = lessons.filter(l => isSubLesson(l) && Math.floor(l.lessonNumber ?? 0) === top);
    const subIndex = siblings.length + 1;
    try {
      const id = await createLesson(courseId, unitId, {
        title: title.trim(), moduleId: unitId, courseId,
        order: (parent.order ?? parentIdx + 1) + subIndex / 100,
        lessonNumber: Number((top + subIndex / (subIndex < 10 ? 10 : 100)).toFixed(2)),
        status: 'draft', lessonType: 'lesson', blocksOrder: DEFAULT_BLOCKS, marks: DEFAULT_LESSON_MARKS,
      });
      await load(true);
      selectLesson(unitId, id);
      toast.success('Sub-lesson created.');
    } catch (e: any) { toast.error(e?.message || 'Failed.'); }
  };

  /** Drag-and-drop reordering inside one unit — rewrites order + lessonNumber. */
  const reorderLessons = async (unitId: string, fromId: string, toId: string) => {
    if (fromId === toId) return;
    const unit = units.find(u => u.module.id === unitId);
    if (!unit) return;
    const from = unit.lessons.findIndex(l => l.id === fromId);
    const to = unit.lessons.findIndex(l => l.id === toId);
    if (from < 0 || to < 0) return;

    // Flush any pending edit first — re-hydrating the tree resets the draft.
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (draftRef.current && saveState !== 'saved') await flushNow();

    const list = [...unit.lessons];
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    const next = renumber(list);
    setUnits(prev => prev.map(u => (u.module.id === unitId ? { ...u, lessons: next } : u)));
    try {
      await Promise.all(next.map(l =>
        updateLesson(courseId, unitId, l.id, { order: l.order, lessonNumber: l.lessonNumber })
      ));
      toast.success('Lesson order updated.');
    } catch (e: any) {
      toast.error(e?.message || 'Could not save the new order.');
      load(true);
    }
  };

  const rememberStructure = (label: string) => {
    setUndoStack(stack => pushUndo(stack, { label, snapshot: units }));
  };

  const undoStructure = async () => {
    const popped = popUndo(undoStack);
    setUndoStack(popped.stack);
    const previous = popped.entry?.snapshot;
    if (!previous) return;
    const current = new Map(units.flatMap(unit => unit.lessons.map(lesson => [lesson.id, unit.module.id] as const)));
    setUnits(previous);
    try {
      for (const unit of previous) {
        await updateUnit(courseId, unit.module.id, { order: unit.module.order, unitNumber: unit.module.unitNumber });
        for (const lesson of unit.lessons) {
          const from = current.get(lesson.id);
          if (from && from !== unit.module.id) {
            await moveLessonToUnit(courseId, from, unit.module.id, lesson.id, lesson.order, lesson.lessonNumber ?? lesson.order);
          } else {
            await updateLesson(courseId, unit.module.id, lesson.id, { order: lesson.order, lessonNumber: lesson.lessonNumber });
          }
        }
      }
      toast.success('Undone.');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not undo that.');
      load(true);
    }
  };

  const reorderUnits = async (from: number, to: number) => {
    rememberStructure('Reorder units');
    const next = moveItem(units, from, to).map((unit, index) => ({
      ...unit,
      module: { ...unit.module, order: index + 1, unitNumber: index + 1 },
    }));
    setUnits(next);
    try {
      await Promise.all(next.map(unit => updateUnit(courseId, unit.module.id, { order: unit.module.order, unitNumber: unit.module.unitNumber })));
      toast.success('Unit order saved.');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not save the unit order.');
      load(true);
    }
  };

  const moveLessonAcross = async (fromUnitId: string, lessonId: string, toUnitId: string) => {
    if (fromUnitId === toUnitId) return;
    const fromUnit = units.find(unit => unit.module.id === fromUnitId);
    const lesson = fromUnit?.lessons.find(item => item.id === lessonId);
    const toUnit = units.find(unit => unit.module.id === toUnitId);
    if (!lesson || !toUnit) return;
    rememberStructure('Move lesson');
    const order = toUnit.lessons.length + 1;
    setUnits(prev => prev.map(unit => {
      if (unit.module.id === fromUnitId) return { ...unit, lessons: unit.lessons.filter(item => item.id !== lessonId) };
      if (unit.module.id === toUnitId) return { ...unit, lessons: [...unit.lessons, { ...lesson, moduleId: toUnitId, order, lessonNumber: order }] };
      return unit;
    }));
    try {
      await moveLessonToUnit(courseId, fromUnitId, toUnitId, lessonId, order, order);
      toast.success('Lesson moved.');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not move that lesson.');
      load(true);
    }
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

  const patchCourse = async (patch: CoursePatch, msg?: string) => {
    if (!course) return;
    const clears: ('minTier' | 'priceType' | 'downloadsEnabled')[] = [];
    const data: Partial<Course> = {};
    for (const [key, value] of Object.entries(patch) as [keyof Course, unknown][]) {
      if (value === null && (key === 'minTier' || key === 'priceType' || key === 'downloadsEnabled')) {
        clears.push(key);
        continue;
      }
      if (value !== undefined) (data as Record<string, unknown>)[key] = value;
    }
    try {
      if (Object.keys(data).length) await updateCourse(course.id, data);
      if (clears.length) await clearCourseFields(course.id, clears);
      setCourse(current => {
        if (!current) return current;
        const next = { ...current, ...data };
        if (data.accessPolicy && typeof current.accessPolicy?.seatsUsed === 'number') {
          next.accessPolicy = { ...data.accessPolicy, seatsUsed: current.accessPolicy.seatsUsed };
        }
        for (const field of clears) delete next[field];
        return next;
      });
      if (msg) toast.success(msg);
    } catch (e: any) { toast.error(e?.message || 'Failed.'); }
  };

  /* ── Derived ── */

  const blocksOrder = useMemo(
    () => draft?.blocksOrder?.length ? draft.blocksOrder : DEFAULT_BLOCKS,
    [draft?.blocksOrder]
  );

  /* ── Render ── */

  if (!cmsTools) {
    return (
      <div className="py-24 text-center space-y-3 max-w-md mx-auto">
        <p className="font-semibold text-foreground">The CMS add-on is not on this account.</p>
        <p className="text-sm text-muted-foreground">An admin can allocate it from Access allocation. Platform admins already have the editor, imports, image library, and covers.</p>
      </div>
    );
  }

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
        <label className="hidden lg:flex items-center gap-1 text-[11px] text-muted-foreground">
          Unit test pass
          <input
            type="number"
            min={1}
            max={100}
            defaultValue={course.unitTestPassMark ?? 70}
            key={course.unitTestPassMark ?? 70}
            onBlur={(event) => {
              const unitTestPassMark = Math.min(100, Math.max(1, Number(event.target.value) || 70));
              event.target.value = String(unitTestPassMark);
              if (unitTestPassMark === (course.unitTestPassMark ?? 70)) return;
              void updateCourse(course.id, { unitTestPassMark }).then(() => {
                setCourse(current => current ? { ...current, unitTestPassMark } : current);
              }).catch(() => toast.error('Could not save the pass mark.'));
            }}
            className="h-8 w-14 rounded-lg border border-border bg-card px-1 text-xs text-foreground"
          />
          %
        </label>
        <span className="flex-1" />
        {/* Save status */}
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground max-w-sm" role="status" aria-live="polite" data-save-state={saveState}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${
            saveState === 'saved' ? 'bg-success' : saveState === 'error' ? 'bg-red-500' : 'bg-[var(--ps-cyan)] animate-pulse'
          }`} />
          {saveState === 'saved' && 'All changes saved'}
          {saveState === 'saving' && 'Saving…'}
          {saveState === 'dirty' && 'Unsaved changes'}
          {saveState === 'error' && (
            <span className="text-red-700">
              {saveError ?? 'Saving failed. Your changes are kept on this device.'}{' '}
              <button type="button" className="underline font-bold" onClick={saveNow}>Retry</button>
            </span>
          )}
        </span>
        <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs" onClick={() => void undoStructure()} disabled={undoStack.length === 0}>
          Undo{undoStack[0] ? ` ${undoStack[0].label}` : ''}
        </Button>
        <span className="hidden sm:inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-violet-100 text-violet-700">
          {profile?.role ? ROLE_LABELS[profile.role] : 'Teacher'}
        </span>
        {draft && (
          /* Admin preview — always available, whatever the publish status. */
          <Link
            href={`/dashboard/admin/curriculum/${courseId}/preview`}
            title="Review the whole course as a student sees it"
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-border hover:bg-muted"
          >
            <Eye className="w-3.5 h-3.5" /> Preview course
          </Link>
        )}
        <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs" onClick={saveNow} disabled={!draft || saveState === 'saved' || saveState === 'saving'}>
          Save
        </Button>
        <Button size="sm" data-publish-lesson="1" className="rounded-xl h-8 text-xs gap-1.5 bg-success hover:bg-success text-white"
          disabled={!draft || status === 'published'} onClick={openPublishModal}>
          <Send className="w-3 h-3" /> Publish
        </Button>
      </div>

      {/* ── Three panels ── */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[270px_minmax(0,1fr)_320px]">
        <div className="flex items-center justify-between border-b border-border px-3 py-2 lg:hidden">
          <button type="button" className="h-10 rounded-full border border-[#1E6A83] px-4 text-sm font-semibold text-[#1E6A83]" onClick={() => setTreeOpen(true)}>
            Course structure
          </button>
        </div>

        {/* ── Left: course tree. A drawer below the large breakpoint. ── */}
        {treeOpen ? <button type="button" className="fixed inset-0 z-30 bg-black/40 lg:hidden" aria-label="Close course structure" onClick={() => setTreeOpen(false)} /> : null}
        <aside className={`${treeOpen ? 'fixed inset-y-0 left-0 z-40 flex w-72 shadow-xl' : 'hidden'} lg:static lg:z-auto lg:flex lg:w-auto lg:shadow-none flex-col border-r border-border bg-muted/20 overflow-y-auto`}>
          <div className="p-3 flex items-center justify-between sticky top-0 bg-muted/40 backdrop-blur-sm border-b border-border/50 z-10">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Course Structure</p>
            <button onClick={addUnit} className="p-1 rounded-md hover:bg-muted text-muted-foreground" title="Add module">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-2 space-y-1">
            {units.map((u, unitIndex) => (
              <TreeUnit
                key={u.module.id}
                unit={u.module}
                lessons={u.lessons}
                unitIndex={unitIndex}
                unitCount={units.length}
                activeLessonId={selLesson}
                onSelect={(lid) => selectLesson(u.module.id, lid)}
                onRename={() => renameUnit(u.module)}
                onAddLesson={() => addLesson(u.module.id, u.lessons.length)}
                onAddUnitTest={() => addUnitTest(u.module.id, u.lessons.length)}
                onDeleteUnit={() => removeUnit(u.module, u.lessons.length)}
                onDeleteLesson={(l) => removeLesson(u.module.id, l)}
                onDuplicateLesson={(l) => copyLesson(u.module.id, l)}
                onRenameLesson={(l, title) => renameLesson(u.module.id, l, title)}
                onAddSubLesson={(l) => addSubLesson(u.module.id, l, u.lessons)}
                onReorder={(fromId, toId) => {
                  rememberStructure('Reorder lessons');
                  void reorderLessons(u.module.id, fromId, toId);
                }}
                onMoveUnit={to => { void reorderUnits(unitIndex, to); }}
                onReceiveLesson={(fromUnitId, lessonId) => { void moveLessonAcross(fromUnitId, lessonId, u.module.id); }}
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
                    onChange={e => {
                      const lessonType = e.target.value as Lesson['lessonType'];
                      patchDraft(lessonType === 'unit_test'
                        ? {
                          lessonType,
                          isUnitQuiz: true,
                          unitTest: draft.unitTest ?? emptyUnitTest(),
                          blocksOrder: (draft.blocksOrder ?? DEFAULT_BLOCKS).includes('unitTest')
                            ? draft.blocksOrder
                            : [...(draft.blocksOrder ?? DEFAULT_BLOCKS), 'unitTest'],
                        }
                        : { lessonType });
                    }}
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

                <LessonLanguagePanel draft={draft} patch={patchDraft} />

                {/* ET AI assist bar */}
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-violet-200 bg-violet-50/60 px-3 py-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-violet-700">
                    <Sparkles className="w-3.5 h-3.5" /> ET AI
                  </span>
                  <Button size="sm" variant="outline" className="rounded-xl h-7 text-[11px] gap-1.5 bg-card border-violet-200 text-violet-700 hover:bg-violet-100"
                    disabled={etBusy !== null} onClick={suggestObjectives}>
                    {etBusy === 'objectives' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Suggest objectives
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl h-7 text-[11px] gap-1.5 bg-card border-violet-200 text-violet-700 hover:bg-violet-100"
                    disabled={etBusy !== null} onClick={writeBrief}>
                    {etBusy === 'brief' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Write generation brief
                  </Button>
                  <span className="text-[10px] text-violet-700/70">ET AI drafts — always review before publishing.</span>
                </div>

                {/* Curriculum tier — sets the academic depth and the
                    assessment shape the AI writes to. Auto-detected from the
                    subject and year, overridable per lesson. */}
                <TierSelector
                  compact
                  scope="Lesson"
                  context={{
                    subject: course?.subject,
                    yearLevel: course?.yearGroup ?? course?.level,
                    courseTitle: course?.title,
                  }}
                  value={draft.curriculumTier ? {
                    tier: draft.curriculumTier as TierId,
                    subjectType: draft.tierSubjectType as Tier2SubjectType | undefined,
                    lawStage: draft.tierLawStage as LawStage | undefined,
                    assessmentStyle: draft.tierAssessmentStyle as Tier3Assessment | undefined,
                  } : null}
                  overridden={draft.tierOverridden}
                  onClearOverride={() => patchDraft({
                    curriculumTier: undefined, tierSubjectType: undefined,
                    tierLawStage: undefined, tierAssessmentStyle: undefined,
                    tierOverridden: false,
                  })}
                  onChange={(sel, manual) => patchDraft({
                    curriculumTier: sel.tier,
                    tierSubjectType: sel.subjectType,
                    tierLawStage: sel.lawStage,
                    tierAssessmentStyle: sel.assessmentStyle,
                    tierOverridden: manual,
                  })}
                />

                {/* Content format — decides the shape everything ET AI writes. */}
                <div className="rounded-xl border border-border bg-card px-3 py-2.5 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Content format
                    </span>
                    <select
                      aria-label="Content format template"
                      value={draft.contentTemplateId ?? ''}
                      onChange={e => patchDraft({ contentTemplateId: e.target.value || undefined })}
                      className="h-8 rounded-lg border border-border bg-background px-2 text-xs font-medium"
                    >
                      <option value="">
                        Course default — {getTemplate(course?.contentTemplateId || suggestTemplateId(course?.subject)).name}
                      </option>
                      {templatesForSubject(course?.subject).map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    {getTemplate(
                      draft.contentTemplateId
                        || course?.contentTemplateId
                        || suggestTemplateId(course?.subject),
                    ).description}
                    {' '}Generation follows this shape instead of defaulting to bullet points.
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-card px-3 py-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Generation brief
                  </p>
                  <textarea
                    value={draft.briefPrompt ?? ''}
                    onChange={e => patchDraft({ briefPrompt: e.target.value })}
                    placeholder="Type the brief for this lesson. ET AI can draft one too — that button asks first."
                    className="mt-2 w-full min-h-28 rounded-lg border border-border bg-background p-2 text-xs leading-relaxed outline-none"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Every AI generation on this lesson follows this brief. Typing here does not use Sparks.
                  </p>
                </div>
              </div>

              {/* Duration sits directly below Objectives; if the Objectives block
                  has been removed it stays pinned at the top of the editor. */}
              {!blocksOrder.includes('objectives') && (
                <DurationPanel draft={draft} patch={patchDraft} />
              )}

              {/* Blocks */}
              <AnimatePresence>
                {blocksOrder.map((blockId, idx) => (
                  <div
                    key={blockId}
                    className="space-y-5"
                    onDragOver={event => event.preventDefault()}
                    onDrop={event => {
                      const token = event.dataTransfer.getData('text/plain');
                      if (!token.startsWith('block:')) return;
                      const id = token.slice('block:'.length);
                      if (!blocksOrder.includes(id)) {
                        const next = [...blocksOrder];
                        next.splice(idx, 0, id);
                        patchDraft({ blocksOrder: next });
                      } else if (id !== blockId) {
                        const from = blocksOrder.indexOf(id);
                        patchDraft({ blocksOrder: moveItem(blocksOrder, from, idx) });
                      }
                    }}
                  >
                    <BuilderBlock
                      blockId={blockId}
                      draft={draft}
                      selected={selectedBlock === blockId}
                      onSelect={() => setSelectedBlock(blockId)}
                      onDelete={() => {
                        const outputs = { ...(draft.aiOutputs ?? {}) };
                        const outputKey = BLOCK_OUTPUT_KEY[blockId];
                        if (outputKey) delete (outputs as Record<string, unknown>)[outputKey];
                        patchDraft({ blocksOrder: blocksOrder.filter(b => b !== blockId), aiOutputs: outputs });
                      }}
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
                      etBusy={etBusy}
                      onSuggestObjectives={suggestObjectives}
                      onImproveText={improveText}
                      onDraftAssessment={draftAssessment}
                      onImport={result => { void applyManuscript(result); }}
                      onPasteImages={files => { void takePastedImages(files); }}
                      courseId={courseId}
                      siblingLessons={(units.find(u => u.module.id === draft.moduleId)?.lessons) ?? []}
                      coursePassMark={resolvePassMark(course, null)}
                      unitPassMark={units.find(u => u.module.id === draft.moduleId)?.module.unitTestPassMark}
                      onUnitPassMark={(value) => {
                        const unitId = draft.moduleId;
                        void updateUnit(courseId, unitId, value == null
                          ? { unitTestPassMark: deleteField() }
                          : { unitTestPassMark: value },
                        ).then(() => {
                          setUnits(prev => prev.map(u => u.module.id === unitId
                            ? { ...u, module: { ...u.module, unitTestPassMark: value ?? undefined } }
                            : u));
                        }).catch(() => toast.error('Could not save the unit pass mark.'));
                      }}
                    />
                    {blockId === 'objectives' && <DurationPanel draft={draft} patch={patchDraft} />}
                  </div>
                ))}
              </AnimatePresence>

              {/* Add-block palette */}
              <div
                className="rounded-2xl border border-dashed border-border p-4"
                onDragOver={event => event.preventDefault()}
                onDrop={event => {
                  const token = event.dataTransfer.getData('text/plain');
                  if (!token.startsWith('block:')) return;
                  const id = token.slice('block:'.length);
                  if (!blocksOrder.includes(id)) patchDraft({ blocksOrder: [...blocksOrder, id] });
                }}
              >
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Add a block</p>
                <div className="space-y-4" data-block-grid="1">
                  {blockPalette().map(group => (
                    <div key={group.group}>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.group}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {group.defs.map(def => {
                          const added = blocksOrder.includes(def.id);
                          return (
                            <button
                              key={def.id}
                              data-block-id={def.id}
                              disabled={added}
                              draggable={!added}
                              onDragStart={event => {
                                event.dataTransfer.effectAllowed = 'copy';
                                event.dataTransfer.setData('text/plain', `block:${def.id}`);
                              }}
                              onClick={() => {
                                const visual = isVisualBlockId(def.id) ? emptyVisualBlock(def.id) : null;
                                patchDraft({
                                  blocksOrder: [...blocksOrder, def.id],
                                  ...(visual ? { visualBlocks: upsertVisualBlock(draft.visualBlocks, visual) } : {}),
                                  ...(def.id === 'unitTest' ? { lessonType: 'unit_test' as const, isUnitQuiz: true, unitTest: draft.unitTest ?? emptyUnitTest() } : {}),
                                });
                              }}
                              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
                                added
                                  ? 'border-border/50 text-muted-foreground/40 cursor-not-allowed'
                                  : 'border-border text-foreground hover:border-teal-400 hover:shadow-sm active:scale-95'
                              }`}
                            >
                              <span className="text-base">{def.icon}</span>
                              <span className="flex-1">{def.label}</span>
                              {def.sparks && !added && <span className="text-[10px] text-[var(--ps-cyan-text)]">⚡{def.sparks}</span>}
                              {added && <CheckCircle2 className="w-3 h-3" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ── Right: tabs ── */}
        <aside className="flex flex-col border-t border-border bg-muted/10 overflow-y-auto lg:border-t-0 lg:border-l">
          <div role="tablist" aria-label="Desk" className="sticky top-0 z-10 grid grid-cols-2 gap-1 border-b border-border bg-card p-2">
            {([
              ['properties', 'Properties'],
              ['publish', 'Publish'],
              ['allocate', 'Allocate'],
              ['history', 'History'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={rightTab === id}
                data-right-tab={id}
                onClick={() => setRightTab(id)}
                className={`min-h-11 rounded-xl px-2 text-sm font-semibold transition-colors ${rightTab === id ? 'bg-[#203337] text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="p-4 space-y-5 text-sm">
            {rightTab === 'properties' && draft && (
              <PropertiesTab
                draft={draft} patch={patchDraft} ai={runAi} aiBusy={aiBusy}
                etBusy={etBusy}
                isCurriculumCourse={course?.kind === 'curriculum'}
                onSuggestObjectives={suggestObjectives}
                onWriteBrief={writeBrief}
                onImproveText={improveText}
                onDraftAssessment={draftAssessment}
                onSave={saveNow}
              />
            )}
            {rightTab === 'publish' && draft && (
              <PublishTab
                draft={draft} course={course} statusCard={statusCard}
                setStatus={setStatus} patchCourse={patchCourse} courseId={courseId}
                institutions={institutions}
                onPublishRequest={openPublishModal}
              />
            )}
            {rightTab === 'allocate' && (
              <AllocateTab course={course} institutions={institutions} patchCourse={patchCourse} />
            )}
            {rightTab === 'history' && draft && <HistoryTab draft={draft} onSave={saveNow} />}
            {!draft && rightTab !== 'allocate' && (
              <p className="text-xs text-muted-foreground">Select a lesson first.</p>
            )}
          </div>
        </aside>
      </div>

      {/* ── Publish responsibility confirmation ── */}
      <AnimatePresence>
        {publishOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            role="dialog" aria-modal="true" aria-labelledby="publish-disclaimer-title"
            onClick={() => !publishing && setPublishOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              onClick={e => e.stopPropagation()}
              data-publish-dialog="1"
              className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl"
            >
              <div className="flex items-start gap-3 px-5 py-4 border-b border-border">
                <span className="w-9 h-9 rounded-xl bg-[var(--ps-cyan-soft)] border border-[var(--ps-cyan-border)] flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4.5 h-4.5 text-[var(--ps-cyan-text)]" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 id="publish-disclaimer-title" className="font-heading text-lg text-foreground leading-tight">
                    Confirm before publishing
                  </h2>
                  <p className="text-xs text-muted-foreground truncate">{draft?.title}</p>
                </div>
                <button onClick={() => !publishing && setPublishOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted" title="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">
                <p className="text-sm leading-relaxed text-foreground">{PUBLISH_DISCLAIMER}</p>
                {needsCopyright && user ? (
                  <div data-copyright-gate="teacher">
                    <p className="mb-2 text-sm font-semibold text-foreground">{CMS_DESK.signFirst}</p>
                    <CopyrightSign
                      uid={user.uid}
                      profileName={profile?.name || ''}
                      role="teacher"
                      context="course_create"
                      courseId={courseId}
                      onSigned={(id) => {
                        void updateCourse(courseId, { copyrightSignatureId: id }).then(() => {
                          setCourse(current => current ? { ...current, copyrightSignatureId: id } : current);
                        }).catch(() => toast.error(SIGN.failed));
                      }}
                    />
                  </div>
                ) : null}
                <label className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 px-3 py-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={publishAccepted}
                    onChange={e => setPublishAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-emerald-600 shrink-0"
                  />
                  <span className="text-sm font-semibold text-foreground">
                    I understand and accept full responsibility
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
                <Button variant="outline" className="rounded-xl" disabled={publishing} onClick={() => setPublishOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="rounded-xl gap-2 bg-success hover:bg-success text-white"
                  disabled={!publishAccepted || publishing || needsCopyright}
                  onClick={confirmPublish}
                >
                  {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Publish
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Duration (weeks ↔ minutes) ─────────────────────────────── */

/** Course/Lesson duration, expressed in weeks for planners and stored in the
 * existing `durationMinutes` field (1 week = 5 × 60-minute sessions). */
function DurationPanel({ draft, patch }: { draft: Lesson; patch: (p: Partial<Lesson>) => void }) {
  const minutes = draft.durationMinutes;
  const weeks = minutes ? minutes / MINUTES_PER_WEEK : undefined;
  const preset = weeks && DURATION_PRESETS.includes(weeks) ? weeks : undefined;
  const [custom, setCustom] = useState(preset === undefined && minutes != null);

  return (
    <section className="rounded-2xl border border-border bg-card">
      <header className="flex items-center gap-2 px-4 py-2.5 border-b border-border/60">
        <span className="text-base leading-none">🗓️</span>
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Course / Lesson Duration</span>
      </header>
      <div className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {DURATION_PRESETS.map(w => (
            <button
              key={w}
              onClick={() => { setCustom(false); patch({ durationMinutes: w * MINUTES_PER_WEEK }); }}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                !custom && preset === w
                  ? 'border-teal-400 bg-teal-50 text-teal-700'
                  : 'border-border text-muted-foreground hover:border-teal-300'
              }`}
            >
              {w} Week{w > 1 ? 's' : ''}
            </button>
          ))}
          <button
            onClick={() => setCustom(true)}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
              custom ? 'border-teal-400 bg-teal-50 text-teal-700' : 'border-border text-muted-foreground hover:border-teal-300'
            }`}
          >
            Custom
          </button>
        </div>

        {custom && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Input
                type="number" min={0} step={5}
                value={minutes ?? ''}
                placeholder="450"
                onChange={e => patch({ durationMinutes: e.target.value ? Number(e.target.value) : undefined })}
                className="h-9 w-24 rounded-xl text-xs"
              />
              minutes of teaching time
            </label>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          {minutes
            ? `${minutes} minutes ≈ ${(minutes / MINUTES_PER_WEEK).toFixed(minutes % MINUTES_PER_WEEK === 0 ? 0 : 1)} week(s) of teaching.`
            : 'No duration set yet.'}
          {' '}Planned as {MINUTES_PER_WEEK / 60} × 60-minute sessions per week.
        </p>
      </div>
    </section>
  );
}

/* ── Tree unit ──────────────────────────────────────────────── */

function TreeUnit({
  unit, lessons, unitIndex, unitCount, activeLessonId, onSelect, onRename, onAddLesson, onAddUnitTest, onDeleteUnit, onDeleteLesson,
  onDuplicateLesson, onRenameLesson, onAddSubLesson, onReorder, onMoveUnit, onReceiveLesson,
}: {
  unit: Module; lessons: Lesson[]; unitIndex: number; unitCount: number; activeLessonId: string | null;
  onSelect: (lessonId: string) => void; onRename: () => void; onAddLesson: () => void; onAddUnitTest: () => void;
  onDeleteUnit: () => void;
  onDeleteLesson: (l: Lesson) => void; onDuplicateLesson: (l: Lesson) => void;
  onRenameLesson: (l: Lesson, title: string) => void;
  onAddSubLesson: (l: Lesson) => void;
  onReorder: (fromId: string, toId: string) => void;
  onMoveUnit: (toIndex: number) => void;
  onReceiveLesson: (fromUnitId: string, lessonId: string) => void;
}) {
  const [open, setOpen] = useState<boolean>(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);

  const startEdit = (l: Lesson) => { setEditingId(l.id); setEditValue(l.title); };
  const commitEdit = (l: Lesson) => {
    if (editingId !== l.id) return;
    setEditingId(null);
    onRenameLesson(l, editValue);
  };

  return (
    <div>
      <div
        className="group flex items-center gap-1 px-1.5 py-1.5 rounded-lg hover:bg-muted/60"
        onDragOver={event => event.preventDefault()}
        onDrop={event => {
          const token = event.dataTransfer.getData('text/plain');
          const [fromUnitId, lessonId] = token.split(':');
          if (fromUnitId && lessonId && fromUnitId !== unit.id) onReceiveLesson(fromUnitId, lessonId);
        }}
      >
        <button type="button" aria-label={`Move ${unit.title} up`} disabled={unitIndex === 0} className="p-0.5 disabled:opacity-30" onClick={() => onMoveUnit(unitIndex - 1)}>↑</button>
        <button type="button" aria-label={`Move ${unit.title} down`} disabled={unitIndex >= unitCount - 1} className="p-0.5 disabled:opacity-30" onClick={() => onMoveUnit(unitIndex + 1)}>↓</button>
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
          {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          <span className="text-xs font-bold text-foreground truncate">
            {displayUnitTitle(unit.unitNumber, unit.title)}
          </span>
        </button>
        <button onClick={onRename} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted text-muted-foreground" title="Rename">
          <Pencil className="w-3 h-3" />
        </button>
        <button onClick={onAddLesson} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted text-muted-foreground" title="Add lesson">
          <Plus className="w-3 h-3" />
        </button>
        <button onClick={onAddUnitTest} className="opacity-0 group-hover:opacity-100 px-1 rounded hover:bg-muted text-[10px] font-bold text-muted-foreground" title="Add unit test">
          Test
        </button>
        <button onClick={onDeleteUnit} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive" title="Delete unit">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      {open && (
        <div className="ml-4 border-l border-border/60 pl-2 space-y-0.5 py-0.5">
          {lessons.map((l, lessonIndex) => {
            const active = l.id === activeLessonId;
            const sub = isSubLesson(l);
            const editing = editingId === l.id;
            return (
              <div key={l.id}
                draggable={!editing}
                tabIndex={0}
                onKeyDown={event => {
                  if (!event.altKey) return;
                  if (event.key === 'ArrowUp' && lessonIndex > 0) {
                    event.preventDefault();
                    onReorder(l.id, lessons[lessonIndex - 1].id);
                  }
                  if (event.key === 'ArrowDown' && lessonIndex < lessons.length - 1) {
                    event.preventDefault();
                    onReorder(l.id, lessons[lessonIndex + 1].id);
                  }
                }}
                onDragStart={e => { setDragId(l.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', `${unit.id}:${l.id}`); }}
                onDragEnd={() => { setDragId(null); setDropId(null); }}
                onDragOver={e => { if (dragId && dragId !== l.id) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropId(l.id); } }}
                onDragLeave={() => setDropId(d => (d === l.id ? null : d))}
                onDrop={e => {
                  e.preventDefault();
                  const token = e.dataTransfer.getData('text/plain');
                  const [fromUnitId, fromLessonId] = token.split(':');
                  setDragId(null); setDropId(null);
                  if (fromUnitId && fromLessonId && fromUnitId !== unit.id) onReceiveLesson(fromUnitId, fromLessonId);
                  else if (fromLessonId) onReorder(fromLessonId, l.id);
                }}
                className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
                  sub ? 'ml-4' : ''
                } ${dropId === l.id ? 'ring-2 ring-teal-400' : ''} ${dragId === l.id ? 'opacity-40' : ''} ${
                  active ? 'border border-[var(--ps-cyan-border)] bg-[var(--ps-cyan)] text-[var(--ps-cyan-ink)] font-semibold' : 'hover:bg-muted/60 text-foreground'
                }`}
                onClick={() => !editing && onSelect(l.id)}
              >
                <GripVertical className="w-3 h-3 text-muted-foreground/40 shrink-0 cursor-grab" />
                {sub
                  ? <CornerDownRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                  : <span className="shrink-0">{TYPE_ICON[l.lessonType ?? 'lesson'] ?? '📝'}</span>}
                {editing ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    onBlur={() => commitEdit(l)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); commitEdit(l); }
                      if (e.key === 'Escape') { e.preventDefault(); setEditingId(null); }
                    }}
                    className="flex-1 min-w-0 h-6 rounded-md border border-teal-400 bg-card px-1.5 text-xs outline-none"
                  />
                ) : (
                  <span className="flex-1 truncate">{l.lessonNumber ? `L${l.lessonNumber}: ` : ''}{l.title}</span>
                )}
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[l.status ?? 'draft']}`} title={l.status ?? 'draft'} />
                {!editing && (
                  <>
                    <button onClick={e => { e.stopPropagation(); startEdit(l); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted text-muted-foreground shrink-0" title="Rename lesson">
                      <Pencil className="w-3 h-3" />
                    </button>
                    {!sub && (
                      <button onClick={e => { e.stopPropagation(); onAddSubLesson(l); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted text-muted-foreground shrink-0" title="Add sub-lesson">
                        <CornerDownRight className="w-3 h-3" />
                      </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); onDuplicateLesson(l); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted text-muted-foreground shrink-0" title="Duplicate">
                      <Copy className="w-3 h-3" />
                    </button>
                    <button onClick={e => { e.stopPropagation(); onDeleteLesson(l); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 shrink-0" title="Delete">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
          {lessons.length === 0
            ? <p className="text-[10px] text-muted-foreground px-2 py-1">Empty — add a lesson.</p>
            : <p className="text-[10px] text-muted-foreground/70 px-2 pt-1">Drag to reorder or into another unit. Alt+Arrow moves a focused lesson.</p>}
        </div>
      )}
    </div>
  );
}

/* ── Centre block dispatcher ────────────────────────────────── */

function BuilderBlock({
  blockId, draft, selected, onSelect, onDelete, onMoveUp, onMoveDown, patch, ai, aiBusy,
  etBusy, onSuggestObjectives, onImproveText, onDraftAssessment, onImport, onPasteImages, courseId,
  siblingLessons, coursePassMark, unitPassMark, onUnitPassMark,
}: {
  blockId: string; draft: Lesson; selected: boolean;
  onSelect: () => void; onDelete: () => void;
  onMoveUp?: () => void; onMoveDown?: () => void;
  patch: (p: Partial<Lesson>) => void;
  ai: (format: string, extra?: string | AiRunOptions) => Promise<void>;
  aiBusy: string | null;
  etBusy: string | null;
  onSuggestObjectives: () => void;
  onImproveText: (instruction: string) => void;
  onDraftAssessment: () => void;
  onImport?: (result: ImportResult) => void;
  onPasteImages?: (files: File[]) => void;
  courseId: string;
  siblingLessons: Lesson[];
  coursePassMark: number;
  unitPassMark?: number;
  onUnitPassMark: (value: number | null) => void;
}) {
  const def: BlockDef = BLOCK_DEFS.find(d => d.id === blockId) ?? { id: blockId, icon: '📄', label: blockId, group: 'Lesson' };
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
        <ObjectivesBlock
          value={draft.objectives ?? []}
          onChange={v => patch({ objectives: v })}
          onSuggest={onSuggestObjectives}
          suggesting={etBusy === 'objectives'}
        />
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
          value={readLessonBody(draft)}
          onChange={v => patch(lessonBodyPatch(draft, v))}
          ai={ai}
          generating={aiBusy === 'text'}
          onImprove={onImproveText}
          improving={etBusy === 'improve'}
          storageKey={`poket-lesson:${draft.id}`}
          onImport={onImport}
          onPasteImages={onPasteImages}
        />
      );
    case 'image':
      return shell(
        <LessonImageBlock
          scopeId={courseId}
          images={draft.mediaLibrary ?? []}
          onChange={images => patch({ mediaLibrary: images })}
          onInsert={image => patch(lessonBodyPatch(draft, appendImageMarkdown(readLessonBody(draft), image)))}
        />
      );
    case 'illustration':
      return shell(
        <LessonIllustrationBlock
          scopeId={courseId}
          images={draft.mediaLibrary ?? []}
          onChange={images => patch({ mediaLibrary: images })}
          onInsert={image => patch(lessonBodyPatch(draft, appendImageMarkdown(readLessonBody(draft), image)))}
        />
      );
    case 'vocabulary':
      return shell(
        <VocabularyBlock
          value={Array.isArray(outputs.vocabulary)
            ? outputs.vocabulary
            : Array.isArray(outputs.glossary) ? outputs.glossary : []}
          onChange={v => patch({ aiOutputs: { ...outputs, vocabulary: v } })}
        />
      );
    case 'glossary':
      return shell(
        <VocabularyBlock
          value={Array.isArray(outputs.glossary) ? outputs.glossary : []}
          onChange={v => patch({ aiOutputs: { ...outputs, glossary: v } })}
        />,
        { regen: 'glossary' }
      );
    case 'image':
    case 'illustration':
      return shell(
        <VisualBlock
          kind={blockId}
          value={outputs[blockId] as LessonVisual | undefined}
          onChange={v => patch({ aiOutputs: { ...outputs, [blockId]: v } })}
          lessonText={outputs.text ?? draft.contentSources?.find(s => s.type === 'text')?.value ?? draft.title}
          courseId={draft.courseId}
          lessonId={draft.id}
        />
      );
    case 'problems':
      return shell(
        <ProblemsBlock
          value={typeof outputs.problems === 'string' ? outputs.problems : ''}
          onChange={v => patch({ aiOutputs: { ...outputs, problems: v } })}
          ai={ai}
          generating={aiBusy === 'problems'}
        />
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
          onDraftSections={onDraftAssessment}
          draftingSections={etBusy === 'assessment'}
        />
      );
    case 'unitTest':
      return shell(
        <UnitTestEditor
          value={draft.unitTest}
          lessons={siblingLessons}
          coursePassMark={coursePassMark}
          unitPassMark={unitPassMark}
          finalAssessment={draft.finalAssessment}
          onChange={unitTest => patch({ unitTest, lessonType: 'unit_test', isUnitQuiz: true })}
          onUnitPassMark={onUnitPassMark}
          onFinalAssessment={finalAssessment => patch({ finalAssessment })}
        />
      );
    case 'mindmapImage':
    case 'comic':
    case 'infographicImage':
    case 'revisionPoster':
    case 'gallery':
    case 'audioChant':
      return shell(
        <VisualBlockEditor
          kind={blockId as 'mindmapImage' | 'comic' | 'infographicImage' | 'revisionPoster' | 'gallery' | 'audioChant'}
          block={(draft.visualBlocks ?? []).find(item => item.kind === blockId)}
          courseId={courseId}
          lessonId={draft.id}
          onChange={next => patch({ visualBlocks: upsertVisualBlock(draft.visualBlocks, next) })}
        />
      );
    case 'audio':
      return shell(
        <AudioBlock
          script={outputs.audioScript}
          ai={ai}
          generating={aiBusy === 'audioScript'}
          scriptStatus={
            aiBusy === 'audioScript'
              ? (visibleJob(draft.generationJobs?.audioScript, Date.now())?.status === 'queued' ? 'queued' : 'generating')
              : visibleJob(draft.generationJobs?.audioScript, Date.now())?.status
          }
        />
      );
    // Read-only AI format previews (flashcards, mindmap, infographic, slides, notes, summary, problems)
    default: {
      const formatKey = blockId as keyof AiOutputs;
      const raw = outputs[formatKey];
      const prose = ['notes', 'summary'].includes(blockId);
      const visual = blockId === 'mindmap' || blockId === 'infographic';
      const textValue = typeof raw === 'string' ? raw : '';
      const has = raw != null && (!Array.isArray(raw) || raw.length > 0) && (typeof raw !== 'string' || raw.trim() !== '');
      const problemsText = typeof outputs.problems === 'string' ? outputs.problems : '';
      const problemsInvalid = blockId === 'problems' && problemsText.trim().length > 0 && !problemsAreWorked(problemsText);
      if (prose || visual) {
        return shell(
          <div className="space-y-3" data-format-block={blockId}>
            {visual ? <FormatPreview format={blockId} outputs={outputs} embedded /> : null}
            <MarkdownEditBlock
              value={textValue}
              onChange={v => patch({ aiOutputs: { ...outputs, [formatKey]: v } })}
              placeholder="Write this by hand, or generate it from the lesson."
            />
            <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-8 text-xs"
              disabled={aiBusy === blockId} onClick={() => ai(blockId)}>
              {aiBusy === blockId ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {aiBusy === blockId ? 'Generating…' : has ? 'Regenerate' : 'Generate'}
            </Button>
          </div>,
          { regen: has ? blockId : undefined }
        );
      }
      return shell(
        has ? (
          <div className="max-h-96 overflow-y-auto space-y-2">
            {problemsInvalid && (
              <p className="text-sm text-red-700">These are study notes. Use Regenerate on this block to replace them with worked problems.</p>
            )}
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

function PropertiesTab({
  draft, patch, ai, aiBusy, etBusy, isCurriculumCourse,
  onSuggestObjectives, onWriteBrief, onImproveText, onDraftAssessment, onSave,
}: {
  draft: Lesson; patch: (p: Partial<Lesson>) => void;
  ai: (f: string) => Promise<void>; aiBusy: string | null;
  etBusy: string | null;
  /** Sparks only gate curriculum lessons; marketplace lessons are free. */
  isCurriculumCourse: boolean;
  onSuggestObjectives: () => void;
  onWriteBrief: () => void;
  onImproveText: (instruction: string) => void;
  onDraftAssessment: () => void;
  onSave: () => void;
}) {
  const acc = draft.accessibility ?? {};
  const setAcc = (k: keyof NonNullable<Lesson['accessibility']>, v: boolean) =>
    patch({ accessibility: { ...acc, [k]: v } });
  const outputs = draft.aiOutputs ?? {};
  const hasText = !!(outputs.text ?? '').trim();
  // What a student pays to open every format on this lesson.
  const unlockAllCost = AI_SHORTCUTS.reduce((sum, f) => sum + getFormatCost(f.id), 0);

  const quillActions: { id: string; label: string; run: () => void; disabled?: boolean }[] = [
    { id: 'objectives', label: 'Suggest objectives', run: onSuggestObjectives },
    { id: 'brief', label: 'Write generation brief', run: onWriteBrief },
    {
      id: 'improve', label: 'Tighten lesson text', disabled: !hasText,
      run: () => onImproveText('Tighten this lesson text: remove repetition, sharpen the explanations and keep every fact and example.'),
    },
    { id: 'assessment', label: 'Draft assessment sections', run: onDraftAssessment },
  ];

  return (
    <>
      <section className="space-y-2">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-violet-700">
          <Sparkles className="w-3 h-3" /> AI assist (ET AI)
        </p>
        <div className="space-y-1.5">
          {quillActions.map(a => (
            <button
              key={a.id}
              onClick={a.run}
              disabled={etBusy !== null || a.disabled}
              title={a.disabled ? 'Add or generate lesson text first' : undefined}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border text-[11px] font-semibold text-left transition-colors border-violet-200 text-violet-700 hover:bg-violet-50 disabled:opacity-45 disabled:hover:bg-transparent"
            >
              {etBusy === a.id ? <Loader2 className="w-3 h-3 animate-spin shrink-0" /> : <Sparkles className="w-3 h-3 shrink-0" />}
              <span className="truncate">{a.label}</span>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          ET AI writes drafts into this lesson — review everything before you publish.
        </p>
      </section>

      <section className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Visibility</p>
        <select value={draft.visibility ?? 'all'} onChange={e => patch({ visibility: e.target.value as Lesson['visibility'] })}
          className="w-full h-9 rounded-xl border border-border bg-card px-2 text-xs">
          {VISIBILITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          {VISIBILITY_OPTIONS.find(o => o.value === (draft.visibility ?? 'all'))?.hint}
        </p>
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
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">AI generation (per format)</p>
          {isCurriculumCourse && (
            <span className="text-[10px] font-semibold text-[var(--ps-cyan-text)] shrink-0">
              {unlockAllCost} ⚡ to unlock all
            </span>
          )}
        </div>
        {isCurriculumCourse && (
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            The number on each format is what a student spends to unlock it. Generating costs you
            nothing — students are only charged when they open it.
          </p>
        )}
        <div className="grid grid-cols-2 gap-1.5">
          {AI_SHORTCUTS.map(f => {
            const v = outputs[f.id];
            const done = v != null && (!Array.isArray(v) || v.length > 0) && (typeof v !== 'string' || v.trim() !== '');
            const job = visibleJob(draft.generationJobs?.[f.id], Date.now());
            const status = aiBusy === f.id
              ? (job?.status === 'queued' ? 'Queued' : 'Generating')
              : job?.status === 'failed' ? 'Failed'
              : job?.status === 'done' ? 'Done'
              : null;
            const tone = status === 'Failed'
              ? 'border-red-200 bg-red-50 text-red-700'
              : status === 'Queued' || status === 'Generating'
                ? 'border-violet-200 bg-violet-50 text-violet-700'
                : done
                  ? 'border-success/40 bg-success/15 text-success'
                  : 'border-border text-muted-foreground hover:border-violet-300 hover:text-violet-700';
            return (
              <button key={f.id} onClick={() => ai(f.id)} disabled={aiBusy !== null} title={job?.error}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-medium text-left transition-colors ${tone}`}>
                {status === 'Queued' || status === 'Generating' ? <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                  : status === 'Failed' ? <Sparkles className="w-3 h-3 shrink-0" />
                  : done ? <CheckCircle2 className="w-3 h-3 shrink-0" />
                  : <Sparkles className="w-3 h-3 shrink-0" />}
                <span className="truncate flex-1">{f.label}{status ? ` · ${status}` : ''}</span>
                {isCurriculumCourse && (
                  <span className="text-[10px] font-bold text-[var(--ps-cyan-text)] shrink-0 tabular-nums">
                    {getFormatCost(f.id)}
                  </span>
                )}
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
      <Button size="sm" className="w-full rounded-xl text-xs" onClick={onSave}>Save properties</Button>
    </>
  );
}

function PublishTab({ draft, course, statusCard, setStatus, patchCourse, courseId, institutions, onPublishRequest }: {
  draft: Lesson; course: Course;
  statusCard: { bg: string; label: string };
  setStatus: (s: NonNullable<Lesson['status']>, label: string) => Promise<void>;
  patchCourse: (p: CoursePatch, msg?: string) => Promise<void>;
  courseId: string;
  institutions: Institution[];
  onPublishRequest: () => void;
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
        <Button className="w-full rounded-xl gap-2 bg-success hover:bg-success text-white"
          disabled={status === 'published'} onClick={onPublishRequest}>
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
        {/* Always available to admins, published or not. */}
        <Link href={`/dashboard/admin/curriculum/${courseId}/preview`} className="block">
          <Button variant="outline" className="w-full rounded-xl gap-2 text-xs"><Eye className="w-3.5 h-3.5" /> Preview course</Button>
        </Link>
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
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Content format
        </p>
        <select
          aria-label="Default content format for this course"
          value={course.contentTemplateId ?? suggestTemplateId(course.subject)}
          onChange={e => patchCourse(
            { contentTemplateId: e.target.value },
            `Format: ${getTemplate(e.target.value).name}`,
          )}
          className="w-full h-10 rounded-xl border border-border bg-card px-3 text-xs font-medium"
        >
          {templatesForSubject(course.subject).map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          {getTemplate(course.contentTemplateId ?? suggestTemplateId(course.subject)).description}
          {' '}Every lesson follows this unless it sets its own.
        </p>
      </section>

      <section className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Cover</p>
        {course.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={course.thumbnailUrl} alt="" className="w-full h-28 object-cover rounded-xl" />
        )}
        <CoverArtPicker
          brief={`${course.title}. ${course.subject ?? ''}`.trim()}
          onSelect={option => {
            void (async () => {
              try {
                const blob = await (await fetch(option.artSrc)).blob();
                const stored = await storeMedia(courseId, blob, `cover-${Date.now()}.jpg`);
                await patchCourse({ thumbnailUrl: stored.src }, 'Cover updated');
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'The cover could not be saved.');
              }
            })();
          }}
        />
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Text-free pictures for this course. The same picker is what a book cover uses.
        </p>
      </section>

      <section className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Downloads
        </p>
        <p className="text-[10px] text-muted-foreground leading-relaxed">{CMS_DESK.downloadsHelp}</p>
        <select
          data-downloads="1"
          aria-label="Download allowance for this course"
          value={course.downloadsEnabled === true ? 'on' : course.downloadsEnabled === false ? 'off' : 'tier'}
          onChange={e => {
            const value = e.target.value;
            if (value === 'on') patchCourse({ downloadsEnabled: true }, 'Downloads turned on');
            else if (value === 'off') patchCourse({ downloadsEnabled: false }, 'Downloads turned off');
            else patchCourse({ downloadsEnabled: null }, 'Downloads follow tier and allocation');
          }}
          className="w-full h-10 rounded-xl border border-border bg-card px-3 text-xs font-medium"
        >
          <option value="tier">Follow tier and allocation</option>
          <option value="on">Downloads on</option>
          <option value="off">Downloads off</option>
        </select>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Off stops student downloads. On allows them. The middle setting uses the paid tier or an allocation.
        </p>
      </section>

      <AllocationPicker
        label="Who can see this"
        value={migrateAllocation(course)}
        options={institutions.map(school => ({ token: `institution:${school.id}`, label: school.name, group: 'Institutions' }))}
        onChange={targets => {
          const fields = allocationFields(targets, course.accessPolicy ?? { include: [], exclude: [] });
          void patchCourse({
            targets: fields.targets,
            classIds: fields.classIds,
            audiences: fields.audiences,
            allocatedInstitutionIds: fields.allocatedInstitutionIds,
            accessPolicy: fields.accessPolicy,
            publishScope: fields.publishScope,
          }, 'Allocation updated');
        }}
      />

      <section className="space-y-1.5">
        {([
          ['allowComments', 'Student comments'],
          ['enableEtLive', 'ET AI Tutor'],
          ['notifyOnPublish', 'Notify students on publish'],
          ['timedAssessmentMode', 'Timed assessment mode'],
        ] as const).map(([key, label]) => (
          <label key={key} className="flex items-center justify-between text-xs py-0.5 cursor-pointer">
            {label}
            <Switch
              checked={key === 'enableEtLive' ? Boolean(course.enableEtLive ?? course.enableLyra) : Boolean(course[key])}
              onCheckedChange={v => patchCourse(key === 'enableEtLive' ? { enableEtLive: v, enableLyra: v } : { [key]: v })}
            />
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
  patchCourse: (p: CoursePatch, msg?: string) => Promise<void>;
}) {
  const groups = course.allocatedGroups ?? [];
  const override = course.accessOverride ?? {};
  const [price, setPrice] = useState(override.pricePerInstitution?.toString() ?? '');
  const [expiry, setExpiry] = useState(override.expiryDate ?? '');
  const [sparks, setSparks] = useState(override.sparksOverride?.toString() ?? '');

  const toggleGroup = (g: string, on: boolean) => {
    const next = on ? [...groups, g] : groups.filter(x => x !== g);
    patchCourse({ allocatedGroups: next }, on ? `Access granted to ${g}` : `Access removed from ${g}`);
  };

  return (
    <>
      <AllocationPanel
        product={course}
        institutions={institutions}
        onChange={patch => {
          void patchCourse({
            ...(patch.audiences ? { audiences: [...patch.audiences] } : {}),
            ...(patch.allocatedInstitutionIds ? { allocatedInstitutionIds: [...patch.allocatedInstitutionIds] } : {}),
            ...(patch.accessPolicy ? { accessPolicy: patch.accessPolicy } : {}),
            ...(patch.targets ? { targets: [...patch.targets] } : {}),
            ...(patch.classIds ? { classIds: [...patch.classIds] } : {}),
            ...(patch.publishScope ? { publishScope: patch.publishScope } : {}),
            ...('freePreviewCount' in patch && patch.freePreviewCount != null ? { freePreviewCount: patch.freePreviewCount } : {}),
            ...('minTier' in patch ? { minTier: patch.minTier ?? null } : {}),
            ...('priceType' in patch ? { priceType: (patch.priceType ?? null) as Course['priceType'] | null } : {}),
          }, 'Allocation updated');
        }}
      />

      <section className="space-y-1.5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Student groups</p>
        <p className="text-[10px] text-muted-foreground">Levels, separate from the audience above.</p>
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

function HistoryTab({ draft, onSave }: { draft: Lesson; onSave: () => void }) {
  const entries = draft.history ?? [];
  return (
    <>
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Content audit log</p>
      <Button size="sm" className="w-full rounded-xl text-xs" onClick={onSave}>Save lesson</Button>
      <p className="text-[10px] text-muted-foreground">A save writes a row here. Publish and allocate save from their own tabs.</p>
      {entries.length === 0 && (
        <p className="text-xs text-muted-foreground">No history yet — edits, saves, ET AI assists and publish actions will appear here with the name of whoever made them.</p>
      )}
      <div className="space-y-3">
        {entries.map((h, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${i === 0 ? 'bg-teal-500' : 'bg-slate-300'}`} />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">{h.label}</p>
              <p className="text-[10px] text-muted-foreground">
                <span className="font-medium text-foreground/70">{h.actor || 'Unknown user'}</span>
                {' · '}{formatHistoryDate(h.at)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
