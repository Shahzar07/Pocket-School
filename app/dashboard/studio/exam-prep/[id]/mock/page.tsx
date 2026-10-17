'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import {
  ArrowLeft, Clock, Flag, Loader2, GraduationCap, CheckCircle2, XCircle, ChevronDown, Sparkles, Zap, Target, AlertTriangle, BookOpen, RotateCcw,
} from 'lucide-react';
import { useExamPrep } from '@/hooks/use-exam-prep';
import { DashPage, Panel, PanelHeader } from '@/components/dash-ui';
import { MathMarkdown } from '@/components/math-markdown';
import { HandwritingCapture } from '@/components/handwriting-capture';
import { postJSON } from '@/lib/authed-fetch';
import { assertSparks, chargeSparks, completeItem, blendMastery, saveAttempt, updatePrep, recordStudyDay, InsufficientSparks } from '@/lib/study/db';
import { gradeFor } from '@/lib/study/grades';
import { STUDY_COSTS } from '@/lib/sparks';
import type { KnowledgeGap, MarkedAnswer, MockQuestion } from '@/lib/study/types';

type Phase = 'setup' | 'generating' | 'taking' | 'marking' | 'results';
interface Result { marked: MarkedAnswer[]; score: number; max: number; percent: number; summary: string; gaps: KnowledgeGap[]; topicScores: Record<string, number> }

const LENGTHS = [20, 30, 45, 60];

export default function MockExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { prep, uid, merge, loadMaterial } = useExamPrep(id);
  const [phase, setPhase] = useState<Phase>('setup');
  const [minutes, setMinutes] = useState(30);
  const [focusWeak, setFocusWeak] = useState(true);
  const [questions, setQuestions] = useState<MockQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [current, setCurrent] = useState(0);
  const [endsAt, setEndsAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<Result | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const startedAt = useRef(0);
  const submitted = useRef(false);
  const draftKey = `ps-mock-${id}`;

  const weak = useMemo(() => prep ? [...prep.topics].sort((a, b) => (prep.mastery?.[a.id] ?? 0) - (prep.mastery?.[b.id] ?? 0)).slice(0, 3).map(t => t.title) : [], [prep]);

  // Restore an exam in progress after an accidental refresh.
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(draftKey) ?? 'null');
      if (d?.questions?.length && d.endsAt > Date.now()) {
        setQuestions(d.questions); setAnswers(d.answers ?? {}); setEndsAt(d.endsAt); startedAt.current = d.startedAt; setPhase('taking');
      }
    } catch { /* none */ }
  }, [draftKey]);
  useEffect(() => {
    if (phase !== 'taking') return;
    try { localStorage.setItem(draftKey, JSON.stringify({ questions, answers, endsAt, startedAt: startedAt.current })); } catch { /* full */ }
  }, [phase, questions, answers, endsAt, draftKey]);

  useEffect(() => {
    if (phase !== 'taking') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const remaining = Math.max(0, Math.round((endsAt - now) / 1000));
  useEffect(() => {
    if (phase === 'taking' && endsAt && remaining === 0 && !submitted.current) {
      toast('Time’s up — handing in your paper.');
      void submit();
    }
  }, [remaining, phase, endsAt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!prep) return <DashPage><div className="h-64 rounded-2xl bg-muted animate-pulse" /></DashPage>;

  const start = async () => {
    if (!uid) return;
    try { await assertSparks(uid, 'mock'); } catch (e) {
      if (e instanceof InsufficientSparks) return void toast.error(e.message, { action: { label: 'Get Sparks', onClick: () => { location.href = '/dashboard/student/billing'; } } });
    }
    setPhase('generating');
    try {
      const res = await postJSON<{ questions: MockQuestion[]; minutes: number }>('/api/study/prep/mock', {
        topics: prep.topics, subject: prep.subject, material: await loadMaterial(), minutes, level: prep.level, language: prep.language, focus: focusWeak ? weak : [],
      });
      await chargeSparks(uid, 'mock', `Mock exam — ${prep.title}`).catch(() => null);
      setQuestions(res.questions);
      setAnswers({}); setFlags({}); setCurrent(0);
      submitted.current = false;
      startedAt.current = Date.now();
      setEndsAt(Date.now() + res.minutes * 60_000);
      setPhase('taking');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not set the paper.');
      setPhase('setup');
    }
  };

  async function submit() {
    if (!uid || submitted.current) return;
    submitted.current = true;
    setPhase('marking');
    try {
      const res = await postJSON<Result>('/api/study/prep/mark', { questions, answers, topics: prep!.topics, subject: prep!.subject, language: prep!.language });
      setResult(res);
      setPhase('results');
      try { localStorage.removeItem(draftKey); } catch { /* noop */ }
      const grade = gradeFor(prep!.gradeScale, res.percent);
      await saveAttempt(uid, prep!.id, {
        kind: 'mock', score: res.score, max: res.max, percent: res.percent, grade, marked: res.marked, gaps: res.gaps, summary: res.summary,
        durationSec: Math.round((Date.now() - startedAt.current) / 1000),
      });
      // A mock is the strongest evidence there is — it moves mastery most.
      const mastery = { ...prep!.mastery };
      for (const [tid, pct] of Object.entries(res.topicScores)) mastery[tid] = blendMastery(mastery[tid], pct, 0.5);
      await updatePrep(uid, prep!.id, { mastery });
      const patch = await completeItem(uid, { ...prep!, mastery }, 'final:mock');
      merge({ ...patch, mastery });
      await recordStudyDay(uid, 10).catch(() => {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Marking failed — your answers are kept, try again.');
      submitted.current = false;
      setPhase('taking');
    }
  }

  const q = questions[current];
  const answeredCount = questions.filter(x => (answers[x.id] ?? '').trim()).length;
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0'), ss = String(remaining % 60).padStart(2, '0');

  return (
    <DashPage>
      <Link href={`/dashboard/studio/exam-prep/${prep.id}`} className="text-[13px] font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> {prep.title}</Link>

      {phase === 'setup' && (
        <div className="max-w-2xl mx-auto w-full">
          <Panel>
            <span className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 grid place-items-center mb-4"><GraduationCap className="w-6 h-6" /></span>
            <h1 className="font-heading text-[30px] leading-tight tracking-[-0.03em]">Mock exam</h1>
            <p className="text-[14px] text-muted-foreground mt-1">A timed paper in the style of the real exam, built from your topics and material, then marked against a mark scheme — with method marks for good working.</p>
            <p className="text-[13px] font-semibold mt-6 mb-2">Length</p>
            <div className="flex gap-2">
              {LENGTHS.map(m => <button key={m} onClick={() => setMinutes(m)} className={`h-11 flex-1 rounded-xl border text-[14px] font-semibold ${minutes === m ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}>{m} min</button>)}
            </div>
            <label className="mt-5 flex items-start gap-3 rounded-xl border border-border p-3 cursor-pointer">
              <input type="checkbox" checked={focusWeak} onChange={e => setFocusWeak(e.target.checked)} className="mt-1 accent-[var(--primary)]" />
              <span><span className="block text-[14px] font-semibold">Extra questions on my weakest topics</span><span className="text-[13px] text-muted-foreground">{weak.join(', ')}</span></span>
            </label>
            <ul className="mt-5 space-y-1.5 text-[13px] text-muted-foreground">
              <li className="flex gap-2"><Clock className="w-4 h-4" /> The timer starts as soon as the paper appears and hands in automatically.</li>
              <li className="flex gap-2"><Flag className="w-4 h-4" /> Flag questions to come back to. A refresh won&apos;t lose your answers.</li>
            </ul>
            <button onClick={start} className="mt-6 w-full h-12 rounded-full bg-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" /> Start the exam <span className="text-[12px] opacity-80 inline-flex items-center gap-0.5"><Zap className="w-3 h-3" />{STUDY_COSTS.mock}</span>
            </button>
          </Panel>
        </div>
      )}

      {(phase === 'generating' || phase === 'marking') && (
        <Panel className="py-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="font-heading text-xl">{phase === 'generating' ? 'Setting your paper…' : 'Marking your paper…'}</p>
          <p className="text-[13px] text-muted-foreground mt-1">{phase === 'generating' ? 'Writing questions and a mark scheme from your topics.' : 'Checking every answer against the mark scheme, with method marks.'}</p>
        </Panel>
      )}

      {phase === 'taking' && q && (
        <div className="grid lg:grid-cols-12 gap-5 items-start">
          <Panel className="lg:col-span-9">
            <div className="flex items-center justify-between gap-3 mb-4">
              <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Question {current + 1} of {questions.length} · {q.marks} mark{q.marks === 1 ? '' : 's'}</span>
              <button onClick={() => setFlags(f => ({ ...f, [q.id]: !f[q.id] }))} className={`h-8 px-3 rounded-full text-[12px] font-semibold inline-flex items-center gap-1.5 border ${flags[q.id] ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-border'}`}><Flag className="w-3.5 h-3.5" /> {flags[q.id] ? 'Flagged' : 'Flag'}</button>
            </div>
            <div className="text-[17px] leading-relaxed text-foreground [&_p]:my-1.5"><MathMarkdown>{q.question}</MathMarkdown></div>
            {q.type === 'mcq' && q.options ? (
              <div className="mt-5 space-y-2">
                {q.options.map((o, k) => (
                  <button key={k} onClick={() => setAnswers(a => ({ ...a, [q.id]: o }))}
                    className={`w-full text-left rounded-2xl border px-4 py-3 flex items-center gap-3 ${answers[q.id] === o ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                    <span className={`w-7 h-7 rounded-full grid place-items-center text-[13px] font-bold ${answers[q.id] === o ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{String.fromCharCode(65 + k)}</span>
                    <span className="[&_p]:my-0"><MathMarkdown>{o}</MathMarkdown></span>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <textarea value={answers[q.id] ?? ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} rows={q.type === 'structured' ? 9 : 4}
                  placeholder="Write your answer. Show your working — method marks count." className="mt-5 w-full rounded-2xl border border-border bg-background px-4 py-3 text-[15px] leading-relaxed outline-none focus:border-primary resize-y" />
                <div className="mt-3">
                  <HandwritingCapture onText={text => setAnswers(a => ({ ...a, [q.id]: a[q.id]?.trim() ? `${a[q.id].trim()}\n${text}` : text }))} />
                </div>
              </>
            )}
            <div className="mt-5 flex items-center justify-between">
              <button disabled={current === 0} onClick={() => setCurrent(c => c - 1)} className="h-10 px-4 rounded-full border border-border text-sm font-semibold disabled:opacity-40">Previous</button>
              {current < questions.length - 1
                ? <button onClick={() => setCurrent(c => c + 1)} className="h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-semibold">Next</button>
                : <button onClick={() => { if (answeredCount < questions.length && !confirm(`${questions.length - answeredCount} unanswered. Hand in anyway?`)) return; void submit(); }} className="h-10 px-5 rounded-full bg-foreground text-background text-sm font-semibold">Hand in</button>}
            </div>
          </Panel>
          <div className="lg:col-span-3 space-y-4 lg:sticky lg:top-4">
            <Panel>
              <div className={`flex items-center gap-2 font-heading text-[34px] tabular-nums ${remaining < 120 ? 'text-rose-600' : 'text-foreground'}`}><Clock className="w-6 h-6" /> {mm}:{ss}</div>
              <p className="text-[12px] text-muted-foreground">{answeredCount}/{questions.length} answered</p>
              <div className="grid grid-cols-5 gap-1.5 mt-4">
                {questions.map((x, i) => (
                  <button key={x.id} onClick={() => setCurrent(i)}
                    className={`h-9 rounded-lg text-[13px] font-bold tabular-nums relative ${i === current ? 'ring-2 ring-primary' : ''} ${(answers[x.id] ?? '').trim() ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    {i + 1}{flags[x.id] && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400" />}
                  </button>
                ))}
              </div>
              <button onClick={() => { if (confirm('Hand in your paper now?')) void submit(); }} className="mt-4 w-full h-10 rounded-full border border-border text-sm font-semibold">Hand in early</button>
            </Panel>
          </div>
        </div>
      )}

      {phase === 'results' && result && (
        <div className="space-y-5">
          <div className="grid lg:grid-cols-12 gap-5">
            <Panel className="lg:col-span-4 text-center">
              <p className="text-[13px] font-semibold text-muted-foreground">Your grade</p>
              <motion.p initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 14 }}
                className="font-heading text-[104px] leading-none mt-2 bg-gradient-to-b from-primary to-emerald-600 bg-clip-text text-transparent">{gradeFor(prep.gradeScale, result.percent)}</motion.p>
              <p className="font-semibold text-[18px] tabular-nums mt-2">{result.score} / {result.max} · {result.percent}%</p>
              <p className={`text-[13px] mt-1 inline-flex items-center gap-1 ${result.percent >= prep.targetScore ? 'text-emerald-700' : 'text-muted-foreground'}`}><Target className="w-3.5 h-3.5" /> {result.percent >= prep.targetScore ? `At or above your ${prep.targetGrade} target` : `${prep.targetScore - result.percent}% below your ${prep.targetGrade} target`}</p>
            </Panel>
            <Panel className="lg:col-span-8">
              <PanelHeader title="Examiner’s summary" />
              <p className="text-[15px] leading-relaxed text-foreground">{result.summary}</p>
              {result.gaps.length > 0 && (
                <>
                  <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground mt-5 mb-2">What to work on</p>
                  <ul className="space-y-2">
                    {result.gaps.map((g, i) => (
                      <li key={i} className="rounded-xl border border-border p-3 flex gap-3">
                        <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${g.severity === 'weakest' ? 'text-rose-500' : g.severity === 'attention' ? 'text-amber-500' : 'text-muted-foreground'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-semibold">{g.topic} <span className="text-[11px] font-bold uppercase text-muted-foreground ml-1">{g.severity === 'weakest' ? 'weakest area' : g.severity === 'attention' ? 'needs attention' : 'minor'}</span></p>
                          <p className="text-[13px] text-muted-foreground">{g.issue}</p>
                          <p className="text-[13px] text-foreground mt-1"><span className="font-semibold">Next: </span>{g.fix}</p>
                        </div>
                        {prep.topics.some(t => t.id === g.topicId) && (
                          <Link href={`/dashboard/studio/exam-prep/${prep.id}/topic/${g.topicId}?tab=exercises`} className="self-center h-8 px-3 rounded-full bg-primary/10 text-primary text-[12px] font-semibold inline-flex items-center gap-1 shrink-0"><BookOpen className="w-3.5 h-3.5" /> Practise</Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Panel>
          </div>
          <Panel>
            <PanelHeader title="Question by question" meta={<button onClick={() => { setPhase('setup'); setResult(null); }} className="text-[13px] font-semibold text-primary inline-flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5" /> New paper</button>} />
            <ul className="space-y-2">
              {questions.map((x, i) => {
                const m = result.marked[i];
                const full = m && m.awarded === m.marks, zero = m && m.awarded === 0;
                return (
                  <li key={x.id} className="rounded-2xl border border-border">
                    <button onClick={() => setOpen(o => ({ ...o, [x.id]: !o[x.id] }))} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                      {full ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : zero ? <XCircle className="w-5 h-5 text-rose-500 shrink-0" /> : <span className="w-5 h-5 rounded-full border-2 border-amber-400 shrink-0" />}
                      <span className="flex-1 min-w-0 text-[14px] line-clamp-1 [&_p]:inline [&_p]:my-0"><MathMarkdown>{`${i + 1}. ${x.question}`}</MathMarkdown></span>
                      <span className="text-[13px] font-bold tabular-nums">{m?.awarded ?? 0}/{x.marks}</span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${open[x.id] ? 'rotate-180' : ''}`} />
                    </button>
                    {open[x.id] && (
                      <div className="px-4 pb-4 space-y-3 text-[14px]">
                        <div className="[&_p]:my-1"><MathMarkdown>{x.question}</MathMarkdown></div>
                        <div className="rounded-xl bg-muted/50 p-3"><p className="text-[11px] font-bold uppercase text-muted-foreground mb-1">Your answer</p><div className="whitespace-pre-wrap">{answers[x.id] || <span className="text-muted-foreground">No answer</span>}</div></div>
                        <div className="rounded-xl bg-primary/[0.05] border border-primary/15 p-3"><p className="text-[11px] font-bold uppercase text-primary mb-1">Feedback</p><div className="[&_p]:my-1"><MathMarkdown>{m?.feedback ?? ''}</MathMarkdown></div></div>
                        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3"><p className="text-[11px] font-bold uppercase text-emerald-700 mb-1">Model answer</p><div className="[&_p]:my-1"><MathMarkdown>{x.answer}</MathMarkdown></div>
                          {x.markScheme && <details className="mt-2"><summary className="text-[12px] font-semibold cursor-pointer">Mark scheme</summary><div className="mt-1 text-[13px] [&_p]:my-1"><MathMarkdown>{x.markScheme}</MathMarkdown></div></details>}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      )}
    </DashPage>
  );
}
