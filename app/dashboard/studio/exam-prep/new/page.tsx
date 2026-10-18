'use client';

/**
 * New exam prep, in four steps: add material → exam details → ET AI reads it
 * → review the topics. Files are read in the browser (PDF text, compressed
 * photos); only the extracted text and the plan are stored.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import {
  UploadCloud, FileText, Image as ImageIcon, X, Loader2, ArrowLeft, ArrowRight, Sparkles,
  CheckCircle2, GripVertical, Trash2, Plus, Zap, ClipboardPaste, Star,
} from 'lucide-react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { DashPage, DashHeader, Panel } from '@/components/dash-ui';
import { readSourceFile, type SourceFile } from '@/lib/study/files';
import { postJSON } from '@/lib/authed-fetch';
import { assertSparks, chargeSparks, createPrep, InsufficientSparks } from '@/lib/study/db';
import { buildSchedule, isoDay, addDays, daysBetween } from '@/lib/study/schedule';
import { GRADE_SCALES, scoreForGrade } from '@/lib/study/grades';
import { readLanguage } from '@/lib/languages';
import { STUDY_COSTS } from '@/lib/sparks';
import type { GradeScaleId, StudyTopic } from '@/lib/study/types';

type Step = 'material' | 'details' | 'analyzing' | 'review';

interface Pending { key: string; name: string; status: 'reading' | 'ready' | 'error'; progress?: string; file?: SourceFile; error?: string }

const ANALYSE_STAGES = ['Reading your material', 'Finding the topics', 'Weighing what matters most', 'Ordering the plan'];

export default function NewExamPrepPage() {
  const router = useRouter();
  const { user, profile } = useAuthSTORE();
  const [step, setStep] = useState<Step>('material');
  const [files, setFiles] = useState<Pending[]>([]);
  const [notes, setNotes] = useState('');
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [examDate, setExamDate] = useState(addDays(isoDay(), 14));
  const [scale, setScale] = useState<GradeScaleId>('spm');
  const [target, setTarget] = useState('A');
  const [minutes, setMinutes] = useState(30);
  const [topics, setTopics] = useState<StudyTopic[]>([]);
  const [imageNotes, setImageNotes] = useState('');
  const [warning, setWarning] = useState<string | null>(null);
  const [stage, setStage] = useState(0);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step !== 'analyzing') return;
    setStage(0);
    const t = setInterval(() => setStage(s => Math.min(ANALYSE_STAGES.length - 1, s + 1)), 3200);
    return () => clearInterval(t);
  }, [step]);

  // Keep the target grade valid when the scale changes.
  useEffect(() => {
    const grades = GRADE_SCALES[scale].grades.map(g => g.grade);
    if (!grades.includes(target)) setTarget(grades[Math.min(1, grades.length - 1)]);
  }, [scale, target]);

  const addFiles = useCallback(async (list: FileList | File[]) => {
    const arr = Array.from(list).slice(0, 20);
    for (const f of arr) {
      const key = `${f.name}-${f.size}-${Math.random()}`;
      setFiles(prev => [...prev, { key, name: f.name, status: 'reading' }]);
      try {
        const sf = await readSourceFile(f, (p, t) => setFiles(prev => prev.map(x => (x.key === key ? { ...x, progress: `page ${p}/${t}` } : x))));
        setFiles(prev => prev.map(x => (x.key === key ? { ...x, status: 'ready', file: sf, progress: undefined } : x)));
      } catch (e) {
        setFiles(prev => prev.map(x => (x.key === key ? { ...x, status: 'error', error: e instanceof Error ? e.message : 'Could not read' } : x)));
      }
    }
  }, []);

  const ready = files.filter(f => f.status === 'ready' && f.file).map(f => f.file!);
  const reading = files.some(f => f.status === 'reading');
  const hasMaterial = ready.length > 0 || notes.trim().length > 40;
  const textChars = ready.reduce((s, f) => s + (f.text?.length ?? 0), 0) + notes.length;
  const imageCount = ready.reduce((s, f) => s + (f.image ? 1 : 0) + (f.pageImages?.length ?? 0), 0);

  const analyse = async () => {
    if (!user) return;
    setStep('analyzing');
    setWarning(null);
    try {
      const res = await postJSON<{ title: string; subject: string; topics: StudyTopic[]; imageNotes: string; warning: string | null }>('/api/study/prep/analyze', {
        texts: [
          ...ready.filter(f => f.text).map(f => ({ name: f.name, text: f.text })),
          ...(notes.trim() ? [{ name: 'Pasted notes', text: notes }] : []),
        ],
        images: ready.flatMap(f => [f.image, ...(f.pageImages ?? [])]).filter(Boolean),
        subject,
        examTitle: title,
        level: profile?.level,
        language: readLanguage(),
      });
      setTopics(res.topics);
      setImageNotes(res.imageNotes);
      setWarning(res.warning);
      if (!title.trim()) setTitle(res.title);
      if (!subject.trim()) setSubject(res.subject);
      setStep('review');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not analyse your material.');
      setStep('details');
    }
  };

  const create = async () => {
    if (!user || creating) return;
    setCreating(true);
    try {
      await assertSparks(user.uid, 'examPrep');
      const ordered = topics.map((t, i) => ({ ...t, order: i }));
      const material = [
        ...ready.filter(f => f.text).map(f => `=== ${f.name} ===\n${f.text}`),
        notes.trim() ? `=== Pasted notes ===\n${notes}` : '',
        imageNotes ? `=== From your photos ===\n${imageNotes}` : '',
      ].filter(Boolean).join('\n\n');
      const id = await createPrep(user.uid, {
        ownerId: user.uid,
        title: title.trim() || 'My exam',
        subject: subject.trim(),
        examDate,
        targetGrade: target,
        targetScore: scoreForGrade(scale, target),
        gradeScale: scale,
        level: profile?.level ?? '',
        language: readLanguage(),
        minutesPerDay: minutes,
        sourceNames: [...ready.map(f => f.name), ...(notes.trim() ? ['Pasted notes'] : [])],
        sourceChars: material.length,
        topics: ordered,
        plan: buildSchedule(ordered, examDate, { minutesPerDay: minutes }),
        mastery: {},
        completed: {},
        streak: 0,
        studyDays: [],
      }, material);
      await chargeSparks(user.uid, 'examPrep', `Exam prep: ${title}`).catch(() => null);
      toast.success('Your plan is ready.');
      router.push(`/dashboard/studio/exam-prep/${id}`);
    } catch (e) {
      if (e instanceof InsufficientSparks) toast.error(e.message, { action: { label: 'Get Sparks', onClick: () => router.push('/dashboard/student/billing') } });
      else toast.error(e instanceof Error ? e.message : 'Could not create the plan.');
      setCreating(false);
    }
  };

  const daysLeft = daysBetween(isoDay(), examDate);
  const steps: { id: Step; label: string }[] = [
    { id: 'material', label: 'Material' }, { id: 'details', label: 'Exam' }, { id: 'analyzing', label: 'Analyse' }, { id: 'review', label: 'Topics' },
  ];
  const stepIdx = steps.findIndex(s => s.id === step);

  return (
    <DashPage>
      <div className="max-w-4xl mx-auto w-full space-y-5">
      <DashHeader eyebrow="New exam prep" title="Your notes in." accent="Your plan out." />

      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 flex-1">
            <span className={`w-7 h-7 rounded-full grid place-items-center text-[12px] font-bold shrink-0 ${i < stepIdx ? 'bg-primary text-primary-foreground' : i === stepIdx ? 'bg-primary/15 text-primary ring-2 ring-primary' : 'bg-muted text-muted-foreground'}`}>
              {i < stepIdx ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
            </span>
            <span className={`text-[13px] font-semibold hidden sm:inline ${i <= stepIdx ? 'text-foreground' : 'text-muted-foreground'}`}>{s.label}</span>
            {i < steps.length - 1 && <span className={`h-px flex-1 ${i < stepIdx ? 'bg-primary' : 'bg-border'}`} />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 'material' && (
          <motion.div key="m" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <Panel>
              <input ref={inputRef} type="file" multiple accept="application/pdf,image/*,.txt,.md" className="hidden"
                onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
                onClick={() => inputRef.current?.click()}
                className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/40'}`}
              >
                <UploadCloud className="w-10 h-10 mx-auto text-primary mb-3" />
                <p className="font-semibold text-foreground">Drop your notes, slides, PDFs, past papers or photos</p>
                <p className="text-[13px] text-muted-foreground mt-1">or click to choose · up to 20 files · scanned pages are read too</p>
              </div>

              {files.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {files.map(f => (
                    <li key={f.key} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                      <span className="w-8 h-8 rounded-lg bg-muted grid place-items-center shrink-0">
                        {f.file?.kind === 'image' ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium text-foreground truncate">{f.name}</p>
                        <p className="text-[12px] text-muted-foreground">
                          {f.status === 'reading' ? `Reading… ${f.progress ?? ''}`
                            : f.status === 'error' ? <span className="text-rose-600">{f.error}</span>
                            : f.file?.kind === 'pdf' ? `${f.file.pages} pages · ${(f.file.text?.length ?? 0).toLocaleString()} characters${f.file.pageImages?.length ? ` · ${f.file.pageImages.length} scanned pages` : ''}`
                            : f.file?.kind === 'image' ? 'Photo — ET AI will read it' : `${(f.file?.text?.length ?? 0).toLocaleString()} characters`}
                        </p>
                      </div>
                      {f.status === 'reading' ? <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        : f.status === 'ready' ? <CheckCircle2 className="w-4 h-4 text-success" /> : null}
                      <button onClick={() => setFiles(prev => prev.filter(x => x.key !== f.key))} className="text-muted-foreground hover:text-rose-600" aria-label="Remove"><X className="w-4 h-4" /></button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-5">
                <label className="text-[13px] font-semibold text-foreground inline-flex items-center gap-1.5 mb-2"><ClipboardPaste className="w-4 h-4 text-primary" /> Or paste notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5} placeholder="Paste your class notes, the syllabus, or a list of topics…"
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-[14px] outline-none focus:border-primary resize-y" />
              </div>

              <div className="mt-5 flex items-center justify-between">
                <p className="text-[12px] text-muted-foreground">{textChars.toLocaleString()} characters{imageCount ? ` · ${imageCount} images` : ''}</p>
                <button disabled={!hasMaterial || reading} onClick={() => setStep('details')}
                  className="h-11 px-5 rounded-full bg-primary text-primary-foreground font-semibold text-sm inline-flex items-center gap-2 disabled:opacity-40">
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </Panel>
          </motion.div>
        )}

        {step === 'details' && (
          <motion.div key="d" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <Panel>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Exam name (optional)">
                  <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. SPM Additional Mathematics — final paper" className="input-ps" />
                </Field>
                <Field label="Subject (optional)">
                  <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="ET AI will work it out" className="input-ps" />
                </Field>
                <Field label="Exam date">
                  <input type="date" value={examDate} min={addDays(isoDay(), 1)} onChange={e => setExamDate(e.target.value)} className="input-ps" />
                  <p className="text-[12px] text-muted-foreground mt-1">{daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} to prepare` : 'Pick a future date'}</p>
                </Field>
                <Field label="Time you can give each day">
                  <div className="flex gap-1.5">
                    {[15, 30, 45, 60, 90].map(m => (
                      <button key={m} onClick={() => setMinutes(m)} className={`h-10 flex-1 rounded-xl border text-[13px] font-semibold ${minutes === m ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}>{m}m</button>
                    ))}
                  </div>
                </Field>
                <Field label="Grading system">
                  <select value={scale} onChange={e => setScale(e.target.value as GradeScaleId)} className="input-ps">
                    {Object.entries(GRADE_SCALES).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
                  </select>
                </Field>
                <Field label="Grade you’re aiming for">
                  <div className="flex flex-wrap gap-1.5">
                    {GRADE_SCALES[scale].grades.slice(0, 7).map(g => (
                      <button key={g.grade} onClick={() => setTarget(g.grade)}
                        className={`h-10 min-w-11 px-3 rounded-xl border text-[14px] font-bold ${target === g.grade ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>{g.grade}</button>
                    ))}
                  </div>
                </Field>
              </div>
              <div className="mt-6 flex items-center justify-between">
                <button onClick={() => setStep('material')} className="h-11 px-4 rounded-full border border-border text-sm font-semibold inline-flex items-center gap-1.5"><ArrowLeft className="w-4 h-4" /> Back</button>
                <button disabled={daysLeft < 1} onClick={analyse} className="h-11 px-5 rounded-full bg-primary text-primary-foreground font-semibold text-sm inline-flex items-center gap-2 disabled:opacity-40">
                  <Sparkles className="w-4 h-4" /> Analyse my material
                </button>
              </div>
            </Panel>
          </motion.div>
        )}

        {step === 'analyzing' && (
          <motion.div key="a" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Panel className="py-12">
              <div className="max-w-sm mx-auto text-center">
                <div className="relative w-20 h-20 mx-auto mb-6">
                  {[0, 1, 2].map(i => (
                    <motion.span key={i} className="absolute inset-0 rounded-full border-2 border-primary/40"
                      animate={{ scale: [1, 1.6], opacity: [0.6, 0] }} transition={{ repeat: Infinity, duration: 2, delay: i * 0.6 }} />
                  ))}
                  <span className="absolute inset-0 rounded-full bg-primary/10 grid place-items-center"><Sparkles className="w-8 h-8 text-primary" /></span>
                </div>
                <p className="font-heading text-xl text-foreground mb-5">ET AI is reading everything</p>
                <ul className="space-y-2.5 text-left">
                  {ANALYSE_STAGES.map((s, i) => (
                    <li key={s} className="flex items-center gap-2.5 text-sm">
                      {i < stage ? <CheckCircle2 className="w-4 h-4 text-success" /> : i === stage ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <span className="w-4 h-4 rounded-full border border-border" />}
                      <span className={i <= stage ? 'text-foreground' : 'text-muted-foreground'}>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>
          </motion.div>
        )}

        {step === 'review' && (
          <motion.div key="r" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Panel>
              <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
                <div>
                  <p className="text-[15px] font-semibold text-foreground">{topics.length} topics found</p>
                  <p className="text-[13px] text-muted-foreground">Rename, reorder, remove or re-weight them. Stars = how much the exam leans on it.</p>
                </div>
                <input value={title} onChange={e => setTitle(e.target.value)} className="input-ps sm:w-72" aria-label="Exam name" />
              </div>
              {warning && <p className="mb-3 text-[13px] rounded-xl bg-[var(--ps-cyan-soft)] border border-[var(--ps-cyan-border)] text-[var(--ps-cyan-text)] px-3 py-2">{warning}</p>}
              <ul className="space-y-2">
                {topics.map((t, i) => (
                  <motion.li key={t.id} layout className="rounded-xl border border-border px-3 py-2.5 flex items-start gap-2.5">
                    <span className="flex flex-col pt-1.5">
                      <button disabled={i === 0} onClick={() => setTopics(ts => { const c = [...ts]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; return c; })} className="text-muted-foreground disabled:opacity-30" aria-label="Move up"><GripVertical className="w-4 h-4" /></button>
                    </span>
                    <span className="w-6 h-6 rounded-full bg-muted text-[12px] font-bold grid place-items-center shrink-0 mt-1.5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <input value={t.title} onChange={e => setTopics(ts => ts.map(x => (x.id === t.id ? { ...x, title: e.target.value } : x)))}
                        className="w-full bg-transparent font-semibold text-[15px] text-foreground outline-none border-b border-transparent focus:border-primary py-1" />
                      <p className="text-[12px] text-muted-foreground line-clamp-2">{t.summary}</p>
                    </div>
                    <span className="flex items-center gap-0.5 pt-1.5" aria-label={`Weight ${t.weight} of 5`}>
                      {[1, 2, 3, 4, 5].map(w => (
                        <button key={w} onClick={() => setTopics(ts => ts.map(x => (x.id === t.id ? { ...x, weight: w } : x)))}>
                          <Star className={`w-4 h-4 ${w <= t.weight ? 'fill-[var(--ps-cyan-text)] text-[var(--ps-cyan-text)]' : 'text-muted-foreground/40'}`} />
                        </button>
                      ))}
                    </span>
                    <button onClick={() => setTopics(ts => ts.filter(x => x.id !== t.id))} className="text-muted-foreground hover:text-rose-600 pt-1.5" aria-label="Remove topic"><Trash2 className="w-4 h-4" /></button>
                  </motion.li>
                ))}
              </ul>
              <button onClick={() => setTopics(ts => [...ts, { id: `t${Date.now()}`, title: 'New topic', summary: '', keyPoints: [], weight: 3, order: ts.length }])}
                className="mt-3 h-9 px-3.5 rounded-full border border-dashed border-border text-[13px] font-semibold inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"><Plus className="w-4 h-4" /> Add a topic</button>

              <div className="mt-6 rounded-2xl bg-muted/50 border border-border p-4 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px] text-[13px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{daysLeft} days</span> to {examDate} · target <span className="font-semibold text-foreground">{target}</span> ({scoreForGrade(scale, target)}%) · {minutes} min/day
                </div>
                <span className="text-[12px] text-muted-foreground inline-flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-[var(--ps-cyan-text)]" /> {STUDY_COSTS.examPrep} Sparks</span>
                <button disabled={!topics.length || creating} onClick={create}
                  className="h-11 px-5 rounded-full bg-primary text-primary-foreground font-semibold text-sm inline-flex items-center gap-2 disabled:opacity-50">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Build my plan
                </button>
              </div>
            </Panel>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
      <style jsx global>{`
        .input-ps { width: 100%; height: 2.5rem; border-radius: 0.75rem; border: 1px solid var(--border); background: var(--background); padding: 0 0.875rem; font-size: 14px; outline: none; }
        .input-ps:focus { border-color: var(--primary); box-shadow: 0 0 0 4px color-mix(in oklab, var(--primary) 12%, transparent); }
      `}</style>
    </DashPage>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[13px] font-semibold text-foreground mb-1.5">{label}</span>
      {children}
    </label>
  );
}
