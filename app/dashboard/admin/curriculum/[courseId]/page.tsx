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
  createLesson, updateLesson, deleteLesson, duplicateLesson, deleteUnit, getInstitutions,
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
import { ROLE_LABELS } from '@/lib/roles';
import { getFormatCost } from '@/lib/sparks';
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

/** Quill — the CMS assistant (objectives, briefs, rewrites, assessments). */
async function callQuill<T>(task: string, context: Record<string, unknown>): Promise<T> {
  const res = await fetch('/api/ai/course-architect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, context }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Quill could not complete that request.');
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
  const [quillBusy, setQuillBusy] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishAccepted, setPublishAccepted] = useState(false);
  const [publishing, setPublishing] = useState(false);
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
    setDraft(lesson ? cloneDeep(lesson) : null);
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
      // Firestore rejects undefined values — strip them, but keep Timestamps
      // as Timestamps so history dates and release dates survive the round-trip.
      const clean = stripUndefined({ ...fields, ...(historyLabel ? { history } : {}) });
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
        if (!cur) return;
        // Log auto-saves in the audit trail, but collapse a burst of typing
        // into a single "Content edited" entry per 10-minute window.
        const last = cur.history?.[0];
        const lastAt = last?.at instanceof Timestamp ? last.at.toMillis() : 0;
        const recentEdit =
          last?.label === 'Content edited' && Date.now() - lastAt < 10 * 60 * 1000;
        persistDraft(cur, recentEdit ? undefined : 'Content edited');
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

  /* ── Quill assistance ── */

  /** Runs a Quill task against the selected lesson and persists the patch it
   * produces, adding an audit-trail entry for the action. */
  const runQuill = useCallback(async (
    key: string,
    task: string,
    buildContext: (d: Lesson) => Record<string, unknown>,
    apply: (d: Lesson, data: any) => Partial<Lesson> | null,
    historyLabel: string,
  ) => {
    const d = draftRef.current;
    if (!d || !selUnit) return;
    setQuillBusy(key);
    try {
      const data = await callQuill<any>(task, buildContext(d));
      const patch = apply(d, data);
      if (!patch) { toast.error('Quill returned nothing usable — try again.'); return; }
      const next = { ...d, ...patch } as Lesson;
      setDraft(next);
      await persistDraft(next, historyLabel);
      toast.success(historyLabel);
    } catch (e: any) {
      toast.error(e?.message || 'Quill request failed.');
    } finally {
      setQuillBusy(null);
    }
  }, [selUnit, persistDraft]);

  const suggestObjectives = useCallback(() => runQuill(
    'objectives', 'objectives',
    d => ({
      lessonTitle: d.title,
      bloom: d.bloomsLevel ?? 'Understand',
      yearLevel: course?.yearGroup ?? course?.level ?? '',
      subject: course?.subject ?? '',
      // Where this lesson sits, and what it actually teaches — without these
      // Quill can only paraphrase the title.
      siblingLessons: (units.find(u => u.module.id === selUnit)?.lessons ?? [])
        .filter(l => l.id !== d.id).map(l => l.title),
      lessonText: d.aiOutputs?.text ?? d.contentSources?.find(s => s.type === 'text')?.value ?? '',
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
    'Quill suggested objectives',
  ), [runQuill, course, units, selUnit]);

  const writeBrief = useCallback(() => runQuill(
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
    'Quill wrote the generation brief',
  ), [runQuill, course, units, selUnit]);

  const improveText = useCallback((instruction: string) => runQuill(
    'improve', 'improve',
    d => ({
      text: d.aiOutputs?.text ?? d.contentSources?.find(s => s.type === 'text')?.value ?? '',
      instruction,
      // "Simplify" needs a target reader to be meaningful.
      subject: course?.subject ?? '',
      yearLevel: course?.yearGroup ?? course?.level ?? '',
    }),
    (d, data) => (typeof data?.text === 'string' && data.text.trim()
      ? { aiOutputs: { ...(d.aiOutputs ?? {}), text: data.text } }
      : null),
    'Quill rewrote the lesson text',
  ), [runQuill, course]);

  const draftAssessment = useCallback(() => runQuill(
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
    'Quill drafted assessment sections',
  ), [runQuill, course]);

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

  /* ── Publish confirmation (responsibility disclaimer) ── */

  const openPublishModal = () => { setPublishAccepted(false); setPublishOpen(true); };

  const confirmPublish = async () => {
    if (!publishAccepted) return;
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
      await updateUnit(courseId, unit.id, { title: title.trim() });
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
        status: 'draft', lessonType: 'lesson', blocksOrder: DEFAULT_BLOCKS,
      });
      await load(true);
      setSelUnit(unitId);
      setSelLesson(id);
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
    if (draftRef.current && saveState !== 'saved') await persistDraft(draftRef.current);

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
          {profile?.role ? ROLE_LABELS[profile.role] : 'Teacher'}
        </span>
        {draft && (
          /* Admin preview — always available, whatever the publish status. */
          <a
            href={`/dashboard/student/courses/${courseId}/lessons/${draft.id}`}
            target="_blank" rel="noreferrer"
            title="Open the student view of this lesson in a new tab"
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-border hover:bg-muted"
          >
            <Eye className="w-3.5 h-3.5" /> Preview
          </a>
        )}
        <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs" onClick={saveNow} disabled={!draft || saveState === 'saved'}>
          Save
        </Button>
        <Button size="sm" className="rounded-xl h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          disabled={!draft || status === 'published'} onClick={openPublishModal}>
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
                onDeleteUnit={() => removeUnit(u.module, u.lessons.length)}
                onDeleteLesson={(l) => removeLesson(u.module.id, l)}
                onDuplicateLesson={(l) => copyLesson(u.module.id, l)}
                onRenameLesson={(l, title) => renameLesson(u.module.id, l, title)}
                onAddSubLesson={(l) => addSubLesson(u.module.id, l, u.lessons)}
                onReorder={(fromId, toId) => reorderLessons(u.module.id, fromId, toId)}
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

                {/* Quill assist bar */}
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-violet-200 bg-violet-50/60 px-3 py-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-violet-700">
                    <Sparkles className="w-3.5 h-3.5" /> Quill
                  </span>
                  <Button size="sm" variant="outline" className="rounded-xl h-7 text-[11px] gap-1.5 bg-card border-violet-200 text-violet-700 hover:bg-violet-100"
                    disabled={quillBusy !== null} onClick={suggestObjectives}>
                    {quillBusy === 'objectives' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Suggest objectives
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl h-7 text-[11px] gap-1.5 bg-card border-violet-200 text-violet-700 hover:bg-violet-100"
                    disabled={quillBusy !== null} onClick={writeBrief}>
                    {quillBusy === 'brief' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Write generation brief
                  </Button>
                  <span className="text-[10px] text-violet-700/70">Quill drafts — always review before publishing.</span>
                </div>

                {draft.briefPrompt && (
                  <details className="rounded-xl border border-border bg-card px-3 py-2">
                    <summary className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground cursor-pointer">
                      Generation brief
                    </summary>
                    <textarea
                      value={draft.briefPrompt}
                      onChange={e => patchDraft({ briefPrompt: e.target.value })}
                      className="mt-2 w-full min-h-32 rounded-lg border border-border bg-background p-2 text-xs leading-relaxed outline-none"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Every AI generation on this lesson follows this brief.
                    </p>
                  </details>
                )}
              </div>

              {/* Duration sits directly below Objectives; if the Objectives block
                  has been removed it stays pinned at the top of the editor. */}
              {!blocksOrder.includes('objectives') && (
                <DurationPanel draft={draft} patch={patchDraft} />
              )}

              {/* Blocks */}
              <AnimatePresence>
                {blocksOrder.map((blockId, idx) => (
                  <div key={blockId} className="space-y-5">
                    <BuilderBlock
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
                      quillBusy={quillBusy}
                      onSuggestObjectives={suggestObjectives}
                      onImproveText={improveText}
                      onDraftAssessment={draftAssessment}
                    />
                    {blockId === 'objectives' && <DurationPanel draft={draft} patch={patchDraft} />}
                  </div>
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
              <PropertiesTab
                draft={draft} patch={patchDraft} ai={runAi} aiBusy={aiBusy}
                quillBusy={quillBusy}
                isCurriculumCourse={course?.kind === 'curriculum'}
                onSuggestObjectives={suggestObjectives}
                onWriteBrief={writeBrief}
                onImproveText={improveText}
                onDraftAssessment={draftAssessment}
              />
            )}
            {rightTab === 'publish' && draft && (
              <PublishTab
                draft={draft} course={course} statusCard={statusCard}
                setStatus={setStatus} patchCourse={patchCourse} courseId={courseId}
                onPublishRequest={openPublishModal}
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
              className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl"
            >
              <div className="flex items-start gap-3 px-5 py-4 border-b border-border">
                <span className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4.5 h-4.5 text-amber-600" />
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
                  className="rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={!publishAccepted || publishing}
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
  unit, lessons, activeLessonId, onSelect, onRename, onAddLesson, onDeleteUnit, onDeleteLesson,
  onDuplicateLesson, onRenameLesson, onAddSubLesson, onReorder,
}: {
  unit: Module; lessons: Lesson[]; activeLessonId: string | null;
  onSelect: (lessonId: string) => void; onRename: () => void; onAddLesson: () => void;
  onDeleteUnit: () => void;
  onDeleteLesson: (l: Lesson) => void; onDuplicateLesson: (l: Lesson) => void;
  onRenameLesson: (l: Lesson, title: string) => void;
  onAddSubLesson: (l: Lesson) => void;
  onReorder: (fromId: string, toId: string) => void;
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
        <button onClick={onDeleteUnit} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive" title="Delete unit">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      {open && (
        <div className="ml-4 border-l border-border/60 pl-2 space-y-0.5 py-0.5">
          {lessons.map(l => {
            const active = l.id === activeLessonId;
            const sub = isSubLesson(l);
            const editing = editingId === l.id;
            return (
              <div key={l.id}
                draggable={!editing}
                onDragStart={e => { setDragId(l.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', l.id); }}
                onDragEnd={() => { setDragId(null); setDropId(null); }}
                onDragOver={e => { if (dragId && dragId !== l.id) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropId(l.id); } }}
                onDragLeave={() => setDropId(d => (d === l.id ? null : d))}
                onDrop={e => {
                  e.preventDefault();
                  const from = dragId ?? e.dataTransfer.getData('text/plain');
                  setDragId(null); setDropId(null);
                  if (from) onReorder(from, l.id);
                }}
                className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
                  sub ? 'ml-4' : ''
                } ${dropId === l.id ? 'ring-2 ring-teal-400' : ''} ${dragId === l.id ? 'opacity-40' : ''} ${
                  active ? 'bg-amber-100/80 text-amber-900 font-semibold' : 'hover:bg-muted/60 text-foreground'
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
            : <p className="text-[10px] text-muted-foreground/70 px-2 pt-1">Drag to reorder · ✎ rename · ↳ add sub-lesson</p>}
        </div>
      )}
    </div>
  );
}

/* ── Centre block dispatcher ────────────────────────────────── */

function BuilderBlock({
  blockId, draft, selected, onSelect, onDelete, onMoveUp, onMoveDown, patch, ai, aiBusy,
  quillBusy, onSuggestObjectives, onImproveText, onDraftAssessment,
}: {
  blockId: string; draft: Lesson; selected: boolean;
  onSelect: () => void; onDelete: () => void;
  onMoveUp?: () => void; onMoveDown?: () => void;
  patch: (p: Partial<Lesson>) => void;
  ai: (format: string, extraBrief?: string) => Promise<void>;
  aiBusy: string | null;
  quillBusy: string | null;
  onSuggestObjectives: () => void;
  onImproveText: (instruction: string) => void;
  onDraftAssessment: () => void;
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
        <ObjectivesBlock
          value={draft.objectives ?? []}
          onChange={v => patch({ objectives: v })}
          onSuggest={onSuggestObjectives}
          suggesting={quillBusy === 'objectives'}
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
          value={outputs.text ?? draft.contentSources?.find(s => s.type === 'text')?.value ?? ''}
          onChange={v => patch({ aiOutputs: { ...outputs, text: v } })}
          ai={ai}
          generating={aiBusy === 'text'}
          onImprove={onImproveText}
          improving={quillBusy === 'improve'}
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
          onDraftSections={onDraftAssessment}
          draftingSections={quillBusy === 'assessment'}
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

function PropertiesTab({
  draft, patch, ai, aiBusy, quillBusy, isCurriculumCourse,
  onSuggestObjectives, onWriteBrief, onImproveText, onDraftAssessment,
}: {
  draft: Lesson; patch: (p: Partial<Lesson>) => void;
  ai: (f: string) => Promise<void>; aiBusy: string | null;
  quillBusy: string | null;
  /** Sparks only gate curriculum lessons; marketplace lessons are free. */
  isCurriculumCourse: boolean;
  onSuggestObjectives: () => void;
  onWriteBrief: () => void;
  onImproveText: (instruction: string) => void;
  onDraftAssessment: () => void;
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
          <Sparkles className="w-3 h-3" /> AI assist (Quill)
        </p>
        <div className="space-y-1.5">
          {quillActions.map(a => (
            <button
              key={a.id}
              onClick={a.run}
              disabled={quillBusy !== null || a.disabled}
              title={a.disabled ? 'Add or generate lesson text first' : undefined}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border text-[11px] font-semibold text-left transition-colors border-violet-200 text-violet-700 hover:bg-violet-50 disabled:opacity-45 disabled:hover:bg-transparent"
            >
              {quillBusy === a.id ? <Loader2 className="w-3 h-3 animate-spin shrink-0" /> : <Sparkles className="w-3 h-3 shrink-0" />}
              <span className="truncate">{a.label}</span>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Quill writes drafts into this lesson — review everything before you publish.
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
            <span className="text-[10px] font-semibold text-amber-600 shrink-0">
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
            return (
              <button key={f.id} onClick={() => ai(f.id)} disabled={aiBusy !== null}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-medium text-left transition-colors ${
                  done ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-border text-muted-foreground hover:border-violet-300 hover:text-violet-700'
                }`}>
                {aiBusy === f.id ? <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                  : done ? <CheckCircle2 className="w-3 h-3 shrink-0" />
                  : <Sparkles className="w-3 h-3 shrink-0" />}
                <span className="truncate flex-1">{f.label}</span>
                {isCurriculumCourse && (
                  <span className="text-[10px] font-bold text-amber-600 shrink-0 tabular-nums">
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
    </>
  );
}

function PublishTab({ draft, course, statusCard, setStatus, patchCourse, courseId, onPublishRequest }: {
  draft: Lesson; course: Course;
  statusCard: { bg: string; label: string };
  setStatus: (s: NonNullable<Lesson['status']>, label: string) => Promise<void>;
  patchCourse: (p: Partial<Course>, msg?: string) => Promise<void>;
  courseId: string;
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
        <Button className="w-full rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
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
          ['public', 'Public Site', 'Anyone on Poket School can find it'],
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
          ['enableLyra', 'Ayla AI Tutor'],
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
        <p className="text-xs text-muted-foreground">No history yet — edits, saves, Quill assists and publish actions will appear here with the name of whoever made them.</p>
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
