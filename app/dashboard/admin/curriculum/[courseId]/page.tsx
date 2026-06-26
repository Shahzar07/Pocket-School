'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Timestamp } from 'firebase/firestore';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  getCourse, getModulesWithLessons, updateCourse, createModule, updateUnit,
  createLesson, updateLesson, saveAiOutputsToLesson,
  Course, Module, Lesson, AiOutputs,
} from '@/lib/db';
import { FormatPreview } from '@/components/lesson-format-views';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Loader2, ArrowLeft, Plus, ChevronDown, ChevronRight, Sparkles, CheckCircle2,
  Trophy, Eye, EyeOff, Send, RotateCcw,
} from 'lucide-react';

interface UnitWithLessons { module: Module; lessons: Lesson[] }

const CMS_FORMATS: { id: keyof AiOutputs; label: string }[] = [
  { id: 'text', label: 'Lesson Text' },
  { id: 'videoScript', label: 'Video Script' },
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'quiz', label: 'Quiz' },
  { id: 'slides', label: 'Slides' },
  { id: 'notes', label: 'Study Notes' },
  { id: 'summary', label: 'Summary' },
  { id: 'problems', label: 'Practice Problems' },
  { id: 'audioScript', label: 'Audio Summary' },
  { id: 'glossary', label: 'Glossary' },
  { id: 'mindmap', label: 'Mind Map' },
  { id: 'infographic', label: 'Infographic' },
];

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  in_review: 'bg-amber-50 text-amber-700 border border-amber-200',
  approved: 'bg-blue-50 text-blue-700 border border-blue-200',
  published: 'bg-emerald-50 text-emerald-700',
};

async function generateFormat(content: string, format: string, briefPrompt?: string): Promise<unknown> {
  const res = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, format, briefPrompt }),
  });
  if (!res.ok) throw new Error(`Failed: ${format}`);
  const data = await res.json();
  return data.result;
}

export default function AdminCurriculumModulePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const { user, profile } = useAuthSTORE();
  const [course, setCourse] = useState<Course | null>(null);
  const [units, setUnits] = useState<UnitWithLessons[]>([]);
  const [loading, setLoading] = useState(true);

  const [showUnitForm, setShowUnitForm] = useState(false);
  const [unitTitle, setUnitTitle] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [unitTerm, setUnitTerm] = useState('');
  const [unitThreshold, setUnitThreshold] = useState('70');
  const [creatingUnit, setCreatingUnit] = useState(false);

  const load = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    try {
      const [c, mods] = await Promise.all([getCourse(courseId), getModulesWithLessons(courseId)]);
      setCourse(c);
      setUnits(mods);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load subject.');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  const togglePublish = async () => {
    if (!course) return;
    const next = course.status === 'published' ? 'draft' : 'published';
    try {
      await updateCourse(course.id, { status: next });
      toast.success(next === 'published' ? 'Subject published — visible in My Learning.' : 'Subject unpublished.');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed.');
    }
  };

  const handleCreateUnit = async () => {
    if (!unitTitle.trim()) { toast.error('Enter a module title.'); return; }
    setCreatingUnit(true);
    try {
      await createModule(courseId, {
        title: unitTitle.trim(),
        courseId,
        order: units.length + 1,
        unitNumber: unitNumber ? Number(unitNumber) : units.length + 1,
        term: unitTerm.trim() || undefined,
        masteryThreshold: unitThreshold ? Number(unitThreshold) : 70,
      });
      toast.success('Module created.');
      setUnitTitle(''); setUnitNumber(''); setUnitTerm(''); setUnitThreshold('70');
      setShowUnitForm(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create module.');
    } finally {
      setCreatingUnit(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-16 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="max-w-5xl mx-auto py-16 text-center text-muted-foreground">
        <p>Subject not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => router.push('/dashboard/admin/curriculum')}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Curriculum CMS
      </Button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{course.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">{course.subject} · {course.yearGroup ?? '—'}</p>
        </div>
        <Button onClick={togglePublish} variant="outline" className="gap-2 rounded-xl">
          {course.status === 'published' ? <><EyeOff className="w-4 h-4" /> Unpublish subject</> : <><Eye className="w-4 h-4" /> Publish subject</>}
        </Button>
      </div>

      {/* Add unit */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-foreground">Modules (Chapters) ({units.length})</h2>
          <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" onClick={() => setShowUnitForm(o => !o)}>
            <Plus className="w-3.5 h-3.5" /> Add Module
          </Button>
        </div>
        {showUnitForm && (
          <div className="mt-4 p-4 bg-muted/40 rounded-xl border border-dashed border-border space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Title *</Label>
                <Input value={unitTitle} onChange={e => setUnitTitle(e.target.value)} placeholder="e.g. Module 2: Materials" className="rounded-xl h-10" />
              </div>
              <div className="space-y-1.5">
                <Label>Term</Label>
                <Input value={unitTerm} onChange={e => setUnitTerm(e.target.value)} placeholder="e.g. Autumn 2" className="rounded-xl h-10" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Module number</Label>
                <Input type="number" value={unitNumber} onChange={e => setUnitNumber(e.target.value)} placeholder={String(units.length + 1)} className="rounded-xl h-10" />
              </div>
              <div className="space-y-1.5">
                <Label>Mastery threshold (%)</Label>
                <Input type="number" value={unitThreshold} onChange={e => setUnitThreshold(e.target.value)} className="rounded-xl h-10" />
              </div>
            </div>
            <Button onClick={handleCreateUnit} disabled={creatingUnit} className="rounded-xl">
              {creatingUnit ? 'Creating…' : 'Create Module'}
            </Button>
          </div>
        )}
      </div>

      {/* Units */}
      <div className="space-y-4">
        {units.map(u => (
          <UnitEditor key={u.module.id} courseId={courseId} unit={u.module} lessons={u.lessons} onReload={load} />
        ))}
        {units.length === 0 && (
          <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border">
            <p className="text-sm">No modules yet. Add one above.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Unit editor ────────────────────────────────────────────────

function UnitEditor({ courseId, unit, lessons, onReload }: {
  courseId: string; unit: Module; lessons: Lesson[]; onReload: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [title, setTitle] = useState(unit.title);
  const [term, setTerm] = useState(unit.term ?? '');
  const [unitNumber, setUnitNumber] = useState(String(unit.unitNumber ?? ''));
  const [threshold, setThreshold] = useState(String(unit.masteryThreshold ?? 70));
  const [saving, setSaving] = useState(false);

  const [showLessonForm, setShowLessonForm] = useState(false);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonNumber, setLessonNumber] = useState(String(lessons.length + 1));
  const [isUnitQuiz, setIsUnitQuiz] = useState(false);
  const [creatingLesson, setCreatingLesson] = useState(false);

  const handleSaveUnit = async () => {
    setSaving(true);
    try {
      await updateUnit(courseId, unit.id, {
        title: title.trim() || unit.title,
        term: term.trim() || undefined,
        unitNumber: unitNumber ? Number(unitNumber) : undefined,
        masteryThreshold: threshold ? Number(threshold) : 70,
      });
      toast.success('Module updated.');
      onReload();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update module.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateLesson = async () => {
    if (!lessonTitle.trim()) { toast.error('Enter a lesson (unit) title.'); return; }
    setCreatingLesson(true);
    try {
      await createLesson(courseId, unit.id, {
        title: lessonTitle.trim(),
        moduleId: unit.id,
        courseId,
        order: lessonNumber ? Number(lessonNumber) : lessons.length + 1,
        lessonNumber: lessonNumber ? Number(lessonNumber) : lessons.length + 1,
        status: 'draft',
        isUnitQuiz,
      });
      toast.success('Lesson (Unit) created.');
      setLessonTitle(''); setLessonNumber(String(lessons.length + 2)); setIsUnitQuiz(false);
      setShowLessonForm(false);
      onReload();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create lesson.');
    } finally {
      setCreatingLesson(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/30 transition-colors">
        <div>
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Module {unit.unitNumber ?? '—'}{unit.term ? ` · ${unit.term}` : ''}
          </span>
          <h3 className="font-bold text-foreground">{unit.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{lessons.length} lessons (units) · pass ≥{unit.masteryThreshold ?? 70}%</p>
        </div>
        {open ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border p-5 space-y-5">
          {/* Unit metadata */}
          <div className="grid sm:grid-cols-4 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} className="rounded-xl h-10" />
            </div>
            <div className="space-y-1.5">
              <Label>Term</Label>
              <Input value={term} onChange={e => setTerm(e.target.value)} className="rounded-xl h-10" />
            </div>
            <div className="space-y-1.5">
              <Label>Module #</Label>
              <Input type="number" value={unitNumber} onChange={e => setUnitNumber(e.target.value)} className="rounded-xl h-10" />
            </div>
            <div className="space-y-1.5">
              <Label>Pass mark (%)</Label>
              <Input type="number" value={threshold} onChange={e => setThreshold(e.target.value)} className="rounded-xl h-10" />
            </div>
            <div className="flex items-end">
              <Button size="sm" variant="outline" onClick={handleSaveUnit} disabled={saving} className="rounded-xl w-full">
                {saving ? 'Saving…' : 'Save Module'}
              </Button>
            </div>
          </div>

          {/* Lessons */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-foreground text-sm">Lessons (Units) ({lessons.length})</h4>
              <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" onClick={() => setShowLessonForm(o => !o)}>
                <Plus className="w-3.5 h-3.5" /> Add Lesson (Unit)
              </Button>
            </div>

            {showLessonForm && (
              <div className="p-4 bg-muted/40 rounded-xl border border-dashed border-border space-y-3">
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Title *</Label>
                    <Input value={lessonTitle} onChange={e => setLessonTitle(e.target.value)} placeholder="e.g. L1: What is life?" className="rounded-xl h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Lesson (Unit) #</Label>
                    <Input type="number" value={lessonNumber} onChange={e => setLessonNumber(e.target.value)} className="rounded-xl h-10" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={isUnitQuiz} onCheckedChange={setIsUnitQuiz} />
                  <Label className="cursor-pointer" onClick={() => setIsUnitQuiz(v => !v)}>This is the module's mastery quiz</Label>
                </div>
                <Button onClick={handleCreateLesson} disabled={creatingLesson} className="rounded-xl">
                  {creatingLesson ? 'Creating…' : 'Create Lesson (Unit)'}
                </Button>
              </div>
            )}

            {lessons.map(l => (
              <LessonEditor key={l.id} courseId={courseId} unitId={unit.id} lesson={l} onReload={onReload} />
            ))}
            {lessons.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No lessons (units) in this module yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Lesson editor ──────────────────────────────────────────────

function LessonEditor({ courseId, unitId, lesson, onReload }: {
  courseId: string; unitId: string; lesson: Lesson; onReload: () => void;
}) {
  const { user, profile } = useAuthSTORE();
  const [open, setOpen] = useState(false);
  const [objectiveCodes, setObjectiveCodes] = useState((lesson.objectiveCodes ?? []).join(', '));
  const [briefPrompt, setBriefPrompt] = useState(lesson.briefPrompt ?? '');
  const [teacherNotes, setTeacherNotes] = useState(lesson.teacherNotes ?? '');
  const [contentText, setContentText] = useState(
    lesson.contentSources?.find(s => s.type === 'text')?.value ?? ''
  );
  const [savingBrief, setSavingBrief] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState<Record<string, 'pending' | 'done' | 'error'>>({});
  const [working, setWorking] = useState(false);

  const status = lesson.status ?? 'draft';

  const handleSaveBrief = async () => {
    setSavingBrief(true);
    try {
      await updateLesson(courseId, unitId, lesson.id, {
        objectiveCodes: objectiveCodes.split(',').map(s => s.trim()).filter(Boolean),
        briefPrompt: briefPrompt.trim() || undefined,
        teacherNotes: teacherNotes.trim() || undefined,
        contentSources: contentText.trim() ? [{ type: 'text', value: contentText.trim() }] : [],
      });
      toast.success('Brief saved.');
      onReload();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save brief.');
    } finally {
      setSavingBrief(false);
    }
  };

  const handleGenerate = async () => {
    const content = contentText.trim() || lesson.title;
    setGenerating(true);
    setGenProgress({});
    const formats = CMS_FORMATS.filter(f => !(lesson.isUnitQuiz && f.id === 'quiz'));
    const outputs: AiOutputs = { ...(lesson.aiOutputs ?? {}) };
    for (const f of formats) {
      setGenProgress(p => ({ ...p, [f.id]: 'pending' }));
      try {
        const result = await generateFormat(content, f.id, briefPrompt.trim() || undefined);
        (outputs as Record<string, unknown>)[f.id] = result;
        setGenProgress(p => ({ ...p, [f.id]: 'done' }));
      } catch {
        setGenProgress(p => ({ ...p, [f.id]: 'error' }));
      }
    }
    try {
      await saveAiOutputsToLesson(courseId, unitId, lesson.id, outputs);
      await updateLesson(courseId, unitId, lesson.id, { status: 'in_review' });
      toast.success('Generation complete — sent for review.');
      onReload();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save generated content.');
    } finally {
      setGenerating(false);
    }
  };

  const setStatus = async (next: Lesson['status'], withReview = false) => {
    setWorking(true);
    try {
      await updateLesson(courseId, unitId, lesson.id, {
        status: next,
        ...(withReview ? { reviewedBy: profile?.name ?? user?.uid, reviewedAt: Timestamp.now() } : {}),
      });
      onReload();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update status.');
    } finally {
      setWorking(false);
    }
  };

  const generatedFormats = CMS_FORMATS.filter(f => {
    const v = lesson.aiOutputs?.[f.id];
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'string') return v.trim().length > 0;
    return true;
  });

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-3 p-3.5 text-left hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono text-muted-foreground shrink-0">L{lesson.lessonNumber ?? '—'}</span>
          <p className="font-semibold text-foreground text-sm truncate">{lesson.title}</p>
          {lesson.isUnitQuiz && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 font-bold shrink-0 flex items-center gap-1">
              <Trophy className="w-3 h-3" /> Mastery Quiz
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE[status] ?? STATUS_BADGE.draft}`}>{status}</span>
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-4">
          {/* Brief */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Objective codes (comma-separated)</Label>
              <Input value={objectiveCodes} onChange={e => setObjectiveCodes(e.target.value)} placeholder="e.g. B7.1.1A, B7.1.2A" className="rounded-xl h-10 font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label>AI generation brief</Label>
              <Textarea value={briefPrompt} onChange={e => setBriefPrompt(e.target.value)} className="min-h-20 rounded-xl text-sm resize-none" placeholder="Instructions for the AI generator (tone, scope, examples to include)…" />
            </div>
            <div className="space-y-1.5">
              <Label>Teacher notes</Label>
              <Textarea value={teacherNotes} onChange={e => setTeacherNotes(e.target.value)} className="min-h-16 rounded-xl text-sm resize-none" placeholder="Notes for the reviewing specialist…" />
            </div>
            <div className="space-y-1.5">
              <Label>Source content</Label>
              <Textarea value={contentText} onChange={e => setContentText(e.target.value)} className="min-h-32 rounded-xl text-sm resize-none" placeholder="Raw lesson content / source material the AI should base generation on…" />
              <p className="text-xs text-muted-foreground text-right">{contentText.length} characters</p>
            </div>
            <Button size="sm" variant="outline" onClick={handleSaveBrief} disabled={savingBrief} className="rounded-xl">
              {savingBrief ? 'Saving…' : 'Save Brief'}
            </Button>
          </div>

          {/* Generation */}
          <div className="border-t border-border pt-4 space-y-3">
            <Button onClick={handleGenerate} disabled={generating} className="gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <Sparkles className="w-4 h-4" />
              {generating ? 'Generating…' : `Generate with AI (${CMS_FORMATS.length - (lesson.isUnitQuiz ? 1 : 0)} formats)`}
            </Button>
            {Object.keys(genProgress).length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CMS_FORMATS.filter(f => !(lesson.isUnitQuiz && f.id === 'quiz')).map(f => {
                  const s = genProgress[f.id];
                  return (
                    <div key={f.id} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${
                      s === 'done' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                      s === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
                      s === 'pending' ? 'bg-blue-50 border-blue-200 text-blue-700 animate-pulse' :
                      'bg-muted border-border text-muted-foreground'
                    }`}>
                      {s === 'done' ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <div className="w-3 h-3 rounded-full border-2 border-current shrink-0" />}
                      {f.label}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Review workflow */}
          <div className="border-t border-border pt-4 flex flex-wrap items-center gap-2">
            {status === 'in_review' && (
              <>
                <Button size="sm" onClick={() => setStatus('approved', true)} disabled={working} className="gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => setStatus('draft')} disabled={working} className="gap-1.5 rounded-xl">
                  <RotateCcw className="w-3.5 h-3.5" /> Request changes
                </Button>
              </>
            )}
            {status === 'approved' && (
              <>
                <Button size="sm" onClick={() => setStatus('published')} disabled={working} className="gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Send className="w-3.5 h-3.5" /> Publish
                </Button>
                <Button size="sm" variant="outline" onClick={() => setStatus('in_review')} disabled={working} className="gap-1.5 rounded-xl">
                  <RotateCcw className="w-3.5 h-3.5" /> Back to review
                </Button>
              </>
            )}
            {status === 'published' && (
              <Button size="sm" variant="outline" onClick={() => setStatus('approved')} disabled={working} className="gap-1.5 rounded-xl">
                <EyeOff className="w-3.5 h-3.5" /> Unpublish
              </Button>
            )}
            {lesson.reviewedBy && (
              <span className="text-xs text-muted-foreground">Last reviewed by {lesson.reviewedBy}</span>
            )}
          </div>

          {/* Format previews */}
          {generatedFormats.length > 0 && (
            <div className="border-t border-border pt-4">
              <Tabs defaultValue={generatedFormats[0].id}>
                <TabsList className="flex-wrap h-auto">
                  {generatedFormats.map(f => (
                    <TabsTrigger key={f.id} value={f.id} className="text-xs">{f.label}</TabsTrigger>
                  ))}
                </TabsList>
                {generatedFormats.map(f => (
                  <TabsContent key={f.id} value={f.id} className="mt-3 max-h-96 overflow-y-auto">
                    <FormatPreview format={f.id} outputs={lesson.aiOutputs ?? {}} />
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
