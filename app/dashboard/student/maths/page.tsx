'use client';

/**
 * ET Maths — snap or type a problem, then either be guided through it one
 * step at a time (the student does the thinking) or see a full worked
 * solution. Every problem is solved once, up front, by a reasoning model and
 * double-checked; the conversation then runs against that answer key, so
 * replies are fast and the maths stays right.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import {
  Camera, ImagePlus, Sparkles, Lightbulb, RefreshCw, Wand2, CheckCircle2, XCircle,
  CircleDot, Send, Loader2, Plus, ChevronRight, Flag, History, Trash2, Eye, Target,
  TrendingUp, TrendingDown, ListChecks, MessageCircleQuestion, BookOpen, Star, Zap,
} from 'lucide-react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { DashPage, DashHeader, Panel, PanelHeader, Segmented } from '@/components/dash-ui';
import { MathMarkdown } from '@/components/math-markdown';
import { MathInput } from '@/components/study/math-input';
import { ScanCropper } from '@/components/study/scan-cropper';
import dynamic from 'next/dynamic';
// The maths engine behind the graph is large; load it only when a graph shows.
const FunctionPlot = dynamic(() => import('@/components/study/function-plot').then(m => m.FunctionPlot), {
  ssr: false,
  loading: () => <div className="h-[300px] rounded-2xl bg-muted animate-pulse" />,
});
import { compressImage } from '@/lib/study/files';
import { postJSON } from '@/lib/authed-fetch';
import { streamText, parseTutorReply, type Verdict } from '@/lib/study/client';
import { assertSparks, chargeSparks, saveMathSession, listMathSessions, deleteMathSession, recordStudyDay, InsufficientSparks } from '@/lib/study/db';
import { readLanguage } from '@/lib/languages';
import { STUDY_COSTS } from '@/lib/sparks';
import type { MathMessage, MathMode, MathSession, MathSolution } from '@/lib/study/types';

type Phase = 'input' | 'crop' | 'pick' | 'solving' | 'session';
type TutorAction = 'start' | 'step' | 'hint' | 'explain_again' | 'simpler' | 'reveal_step' | 'why' | 'check' | 'explain_step';

const EXAMPLES = [
  'Solve $2x^2 - 5x - 3 = 0$',
  'Differentiate $y = x^3 \\sin x$',
  'Solve simultaneously: $2x + y = 7$ and $x - y = 2$',
  'Simplify $\\dfrac{x^2 - 9}{x^2 + 5x + 6}$',
  'A triangle has sides 7 cm, 8 cm and 9 cm. Find its largest angle.',
  'Find $\\int_0^2 (3x^2 - 2x)\\,dx$',
];

const SOLVING_STAGES = ['Reading the question', 'Choosing a method', 'Working it out', 'Double-checking the answer'];

const VERDICT_STYLE: Record<Exclude<Verdict, 'none'>, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  correct: { label: 'Correct', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  partly: { label: 'Nearly', cls: 'text-amber-700 bg-amber-50 border-amber-200', icon: CircleDot },
  wrong: { label: 'Not quite', cls: 'text-rose-700 bg-rose-50 border-rose-200', icon: XCircle },
};

export default function MathsTutorPage() {
  const { user, profile } = useAuthSTORE();
  const [phase, setPhase] = useState<Phase>('input');
  const [mode, setMode] = useState<MathMode>('guide');
  const [problem, setProblem] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [readChoices, setReadChoices] = useState<string[]>([]);
  const [readNote, setReadNote] = useState<string | null>(null);
  const [session, setSession] = useState<MathSession | null>(null);
  const [streamRaw, setStreamRaw] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [solveError, setSolveError] = useState<string | null>(null);
  const [stage, setStage] = useState(0);
  const [reply, setReply] = useState('');
  const [revealed, setRevealed] = useState(1);
  const [showAnswer, setShowAnswer] = useState(false);
  const [history, setHistory] = useState<MathSession[]>([]);
  const [celebrate, setCelebrate] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef<MathSession | null>(null);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const uid = user?.uid;
  const level = profile?.level ?? undefined;

  /* ── History ──────────────────────────────────────────────── */
  const loadHistory = useCallback(async () => {
    if (!uid) return;
    try { setHistory(await listMathSessions(uid, 20)); } catch { /* first visit, rules not ready — leave empty */ }
  }, [uid]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Arriving from an exam pack ("work through it with ET"): pre-fill the problem.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('problem');
    if (p) { setProblem(p); setMode('guide'); }
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [session?.messages.length]);
  useEffect(() => { if (streamRaw) endRef.current?.scrollIntoView({ block: 'end' }); }, [streamRaw]);

  // Cycle the "working it out" stages while the solver thinks.
  useEffect(() => {
    if (phase !== 'solving') return;
    setStage(0);
    const t = setInterval(() => setStage(s => Math.min(SOLVING_STAGES.length - 1, s + 1)), 2600);
    return () => clearInterval(t);
  }, [phase]);

  /* ── Photo → problem ──────────────────────────────────────── */
  const onPhoto = async (file?: File | null) => {
    if (!file) return;
    try {
      setPhoto(await compressImage(file, 2000, 0.88));
      setPhase('crop');
    } catch {
      toast.error("That image couldn't be opened. Try a JPG or PNG.");
    }
  };

  const readPhoto = async (cropped: string) => {
    setReading(true);
    try {
      const res = await postJSON<{ problems: { text: string }[]; confidence: string; note: string | null }>('/api/study/math/read', { image: cropped });
      setReadNote(res.confidence === 'low' || res.note ? (res.note || 'Some of it was hard to read — check it below.') : null);
      if (res.problems.length > 1) {
        setReadChoices(res.problems.map(p => p.text));
        setPhase('pick');
      } else {
        setProblem(res.problems[0].text);
        setPhase('input');
        toast.success('Got it — check the problem, then start.');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not read the photo.');
    } finally {
      setReading(false);
    }
  };

  /* ── Solve ────────────────────────────────────────────────── */
  const solve = async (text: string, chosenMode: MathMode = mode) => {
    if (!uid || !text.trim()) return;
    setSolveError(null);
    try {
      await assertSparks(uid, 'mathSolve');
    } catch (e) {
      if (e instanceof InsufficientSparks) { toast.error(e.message, { action: { label: 'Get Sparks', onClick: () => { location.href = '/dashboard/student/billing'; } } }); return; }
    }
    abortRef.current?.abort();
    setPhase('solving');
    setCelebrate(false);
    setShowAnswer(false);
    try {
      const solution = await postJSON<MathSolution>('/api/study/math/solve', { problem: text, level, language: readLanguage() });
      await chargeSparks(uid, 'mathSolve', solution.topic).catch(() => null);
      const fresh: MathSession = { id: '', problem: text, solution, mode: chosenMode, messages: [], stepsDone: 0, solved: false };
      fresh.id = await saveMathSession(uid, fresh).catch(() => '');
      setSession(fresh);
      sessionRef.current = fresh;
      setRevealed(1);
      setPhase('session');
      if (chosenMode === 'guide') void tutor('start', '', fresh);
      loadHistory();
    } catch (e) {
      setSolveError(e instanceof Error ? e.message : 'Could not solve that problem.');
      setPhase('input');
    }
  };

  /* ── Tutor turn ───────────────────────────────────────────── */
  const persist = (s: MathSession) => { if (uid && s.id) saveMathSession(uid, s).catch(() => {}); };

  const tutor = async (action: TutorAction, input = '', base?: MathSession, stepIndex?: number) => {
    const s0 = base ?? sessionRef.current;
    if (!s0?.solution || busy) return;
    const solution = s0.solution;
    setBusy(true);

    // Exact check for numeric final answers — the model is told the result.
    let numericCheck: 'match' | 'nomatch' | undefined;
    if (action === 'check' && solution.checkValues?.length) {
      // Every value the student gives must be right, and every value in the
      // key must be given — "3" alone is not the answer to a quadratic.
      const { numericValues } = await import('@/lib/study/math-expr');
      const given = numericValues(input);
      if (given.length) {
        const near = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
        const allRight = given.every(g => solution.checkValues!.some(c => near(g, c)));
        const complete = solution.checkValues.every(c => given.some(g => near(g, c)));
        numericCheck = allRight && complete ? 'match' : 'nomatch';
      }
    }

    const studentMsg: MathMessage | null = input.trim() ? { role: 'student', text: input.trim() } : null;
    let s: MathSession = studentMsg ? { ...s0, messages: [...s0.messages, studentMsg] } : s0;
    setSession(s);
    sessionRef.current = s;

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStreamRaw('');
    try {
      const raw = await streamText('/api/study/math/tutor', {
        action,
        input,
        stepIndex,
        solution,
        mode: s.mode,
        stepsDone: s.stepsDone,
        level,
        language: readLanguage(),
        numericCheck,
        history: s0.messages.slice(-10),
      }, setStreamRaw, ctrl.signal);

      const parsed = parseTutorReply(raw);
      const total = solution.steps.length;
      let stepsDone = s.stepsDone;
      if (parsed.done !== null) stepsDone = Math.max(stepsDone, Math.min(total, parsed.done));
      if (action === 'reveal_step') stepsDone = Math.max(stepsDone, Math.min(total, s.stepsDone + 1));
      if (action === 'check' && (numericCheck === 'match' || parsed.verdict === 'correct')) stepsDone = total;
      const tutorMsg: MathMessage = { role: 'tutor', text: parsed.text || '…', verdict: parsed.verdict === 'none' ? undefined : parsed.verdict };
      const nowSolved = stepsDone >= total;
      s = { ...s, messages: [...s.messages, tutorMsg], stepsDone, solved: s.solved || nowSolved };
      if (nowSolved && !s0.solved && uid) {
        setCelebrate(true);
        recordStudyDay(uid, 5).catch(() => {});
      }
      setSession(s);
      sessionRef.current = s;
      persist(s);
      if (nowSolved && !s0.solved) setTimeout(loadHistory, 600);
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') toast.error(e instanceof Error ? e.message : 'ET is unavailable right now.');
    } finally {
      setStreamRaw(null);
      setBusy(false);
    }
  };

  const sendReply = (kind?: 'check') => {
    const t = reply.trim();
    if (!t || busy) return;
    setReply('');
    if (kind === 'check') return tutor('check', t);
    if (session?.mode === 'solve' || /\?\s*$/.test(t)) return tutor('why', t);
    return tutor('step', t);
  };

  const practice = async (difficulty: 'easier' | 'similar' | 'harder') => {
    const sol = session?.solution;
    if (!sol || busy) return;
    setBusy(true);
    try {
      const res = await postJSON<{ problem: string }>('/api/study/math/similar', { problem: sol.problem, topic: sol.topic, difficulty, level, language: readLanguage() });
      setProblem(res.problem);
      setBusy(false);
      await solve(res.problem, session?.mode ?? mode);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not make a practice problem.');
      setBusy(false);
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    setSession(null);
    sessionRef.current = null;
    setProblem('');
    setReadNote(null);
    setPhase('input');
    setCelebrate(false);
  };

  const openFromHistory = (h: MathSession) => {
    abortRef.current?.abort();
    setSession(h);
    sessionRef.current = h;
    setMode(h.mode);
    setRevealed(h.solution?.steps.length ?? 1);
    setShowAnswer(h.solved);
    setCelebrate(false);
    setPhase('session');
  };

  const switchMode = (m: MathMode) => {
    if (!session) { setMode(m); return; }
    const s = { ...session, mode: m };
    setSession(s);
    sessionRef.current = s;
    setMode(m);
    persist(s);
    if (m === 'guide' && !s.messages.length) void tutor('start', '', s);
  };

  const report = async (reason: string) => {
    if (!uid || !session) return;
    setReportOpen(false);
    try {
      await addDoc(collection(db, 'ai_reports'), {
        uid, kind: 'maths', reason, problem: session.problem.slice(0, 2000),
        finalAnswer: session.solution?.finalAnswer ?? null, createdAt: serverTimestamp(),
      });
      toast.success('Thanks — our team will review this problem.');
    } catch {
      toast.error('Could not send the report.');
    }
  };

  const sol = session?.solution ?? null;
  const live = streamRaw !== null ? parseTutorReply(streamRaw) : null;
  const pct = sol ? Math.round((session!.stepsDone / sol.steps.length) * 100) : 0;
  const lastVerdict = useMemo(() => [...(session?.messages ?? [])].reverse().find(m => m.role === 'tutor')?.verdict, [session?.messages]);

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <DashPage>
      <DashHeader
        eyebrow="ET Maths"
        title="Stuck on a problem?"
        accent="Snap it."
        description="Scan or type any maths problem. ET guides you one step at a time — you do the thinking — or shows a full worked solution."
        actions={phase === 'session' ? (
          <button onClick={reset} className="h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-1.5 hover:opacity-90">
            <Plus className="w-4 h-4" /> New problem
          </button>
        ) : undefined}
      />

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />

      <div className="grid lg:grid-cols-12 gap-5 items-start">
        {/* ── Main column ── */}
        <div className="lg:col-span-8 space-y-5 min-w-0">
          <AnimatePresence mode="wait">
            {phase === 'input' && (
              <motion.div key="input" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                <Panel>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <Segmented
                      options={[{ id: 'guide', label: 'Guide me step by step' }, { id: 'solve', label: 'Show full solution' }] as const}
                      value={mode}
                      onChange={setMode}
                    />
                    <span className="text-[12px] text-muted-foreground inline-flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-amber-500" /> {STUDY_COSTS.mathSolve} Spark per problem</span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 mb-4">
                    <button onClick={() => cameraRef.current?.click()}
                      className="group rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-transparent p-4 text-left hover:border-primary/50 transition-colors">
                      <span className="w-10 h-10 rounded-xl bg-primary text-primary-foreground grid place-items-center mb-3 group-hover:scale-105 transition-transform"><Camera className="w-5 h-5" /></span>
                      <p className="font-semibold text-foreground">Scan a problem</p>
                      <p className="text-[13px] text-muted-foreground">Take a photo — printed or handwritten.</p>
                    </button>
                    <button onClick={() => fileRef.current?.click()}
                      className="group rounded-2xl border border-border p-4 text-left hover:border-primary/50 transition-colors">
                      <span className="w-10 h-10 rounded-xl bg-muted text-foreground grid place-items-center mb-3 group-hover:scale-105 transition-transform"><ImagePlus className="w-5 h-5" /></span>
                      <p className="font-semibold text-foreground">Upload a screenshot</p>
                      <p className="text-[13px] text-muted-foreground">From a worksheet, PDF or past paper.</p>
                    </button>
                  </div>

                  <div className="flex items-center gap-3 my-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <span className="h-px flex-1 bg-border" /> or type it <span className="h-px flex-1 bg-border" />
                  </div>

                  {readNote && (
                    <p className="mb-3 text-[13px] rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2">{readNote}</p>
                  )}
                  <MathInput
                    value={problem}
                    onChange={setProblem}
                    onSubmit={() => solve(problem)}
                    placeholder="e.g. Solve 3x² − 12 = 0, or paste a word problem…"
                  />
                  {solveError && (
                    <p className="mt-3 text-[13px] rounded-xl bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2">{solveError}</p>
                  )}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      {EXAMPLES.slice(0, 4).map(ex => (
                        <button key={ex} onClick={() => setProblem(ex)}
                          className="text-[12px] px-3 py-1.5 rounded-full border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors max-w-[260px] truncate">
                          <span className="[&_p]:inline [&_.katex]:text-[12px]"><MathMarkdown>{ex}</MathMarkdown></span>
                        </button>
                      ))}
                    </div>
                    <button onClick={() => solve(problem)} disabled={!problem.trim()}
                      className="h-11 px-6 rounded-full bg-primary text-primary-foreground font-semibold inline-flex items-center gap-2 hover:opacity-90 disabled:opacity-40 shadow-sm">
                      <Sparkles className="w-4 h-4" /> {mode === 'guide' ? 'Start with ET' : 'Solve it'}
                    </button>
                  </div>
                </Panel>
              </motion.div>
            )}

            {phase === 'crop' && photo && (
              <motion.div key="crop" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Panel>
                  <PanelHeader title="Frame the problem" />
                  <ScanCropper image={photo} busy={reading} onCancel={() => setPhase('input')} onDone={readPhoto} />
                </Panel>
              </motion.div>
            )}

            {phase === 'pick' && (
              <motion.div key="pick" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Panel>
                  <PanelHeader title="I found several problems — which one?" />
                  <div className="space-y-2">
                    {readChoices.map((c, i) => (
                      <button key={i} onClick={() => { setProblem(c); setPhase('input'); }}
                        className="w-full text-left rounded-xl border border-border p-3.5 hover:border-primary/50 hover:bg-primary/5 transition-colors flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-muted text-[12px] font-bold grid place-items-center shrink-0">{i + 1}</span>
                        <span className="prose prose-sm max-w-none [&_p]:my-0"><MathMarkdown>{c}</MathMarkdown></span>
                      </button>
                    ))}
                  </div>
                </Panel>
              </motion.div>
            )}

            {phase === 'solving' && (
              <motion.div key="solving" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Panel className="py-10">
                  <div className="max-w-sm mx-auto text-center">
                    <motion.div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 grid place-items-center mb-5"
                      animate={{ rotate: [0, 6, -6, 0] }} transition={{ repeat: Infinity, duration: 2.4 }}>
                      <Sparkles className="w-7 h-7 text-primary" />
                    </motion.div>
                    <p className="font-heading text-xl text-foreground mb-1">ET is working it out</p>
                    <p className="text-[13px] text-muted-foreground mb-6">Solving it properly first, so every hint is right.</p>
                    <ul className="space-y-2 text-left">
                      {SOLVING_STAGES.map((st, i) => (
                        <li key={st} className="flex items-center gap-2.5 text-sm">
                          {i < stage ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            : i === stage ? <Loader2 className="w-4 h-4 text-primary animate-spin" />
                            : <span className="w-4 h-4 rounded-full border border-border" />}
                          <span className={i <= stage ? 'text-foreground' : 'text-muted-foreground'}>{st}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Panel>
              </motion.div>
            )}

            {phase === 'session' && session && sol && (
              <motion.div key={`s-${session.id || 'new'}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
                {/* Problem */}
                <Panel>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{sol.topic}</span>
                    {sol.level && <span className="text-[11px] text-muted-foreground">· {sol.level}</span>}
                    <span className="ml-auto"><Segmented
                      options={[{ id: 'guide', label: 'Guided' }, { id: 'solve', label: 'Worked solution' }] as const}
                      value={session.mode}
                      onChange={switchMode}
                    /></span>
                  </div>
                  <div className="prose max-w-none text-[17px] leading-relaxed text-foreground [&_p]:my-1"><MathMarkdown>{sol.problem}</MathMarkdown></div>
                  {sol.method && <p className="mt-3 text-[13px] text-muted-foreground"><span className="font-semibold text-foreground">Method: </span>{session.mode === 'solve' || session.solved ? sol.method : 'revealed as you go'}</p>}
                </Panel>

                {/* Guided progress */}
                {session.mode === 'guide' && (
                  <Panel>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[15px] font-semibold text-foreground inline-flex items-center gap-2"><ListChecks className="w-4 h-4 text-primary" /> Your working</p>
                      <span className="text-[13px] font-semibold tabular-nums text-muted-foreground">Step {Math.min(session.stepsDone + 1, sol.steps.length)} of {sol.steps.length}</span>
                    </div>
                    <div className="flex gap-1.5 mb-4">
                      {sol.steps.map((_, i) => (
                        <motion.span key={i} className={`h-1.5 flex-1 rounded-full ${i < session.stepsDone ? 'bg-primary' : i === session.stepsDone ? 'bg-primary/30' : 'bg-muted'}`}
                          animate={i === session.stepsDone && !session.solved ? { opacity: [0.5, 1, 0.5] } : { opacity: 1 }}
                          transition={{ repeat: i === session.stepsDone ? Infinity : 0, duration: 1.6 }} />
                      ))}
                    </div>
                    {session.stepsDone === 0 ? (
                      <p className="text-[13px] text-muted-foreground">Each step you get right is written up here, like a clean copy of your working.</p>
                    ) : (
                      <ol className="space-y-2">
                        {sol.steps.slice(0, session.stepsDone).map((st, i) => (
                          <motion.li key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                            className="flex gap-3 items-start rounded-xl bg-muted/40 border border-border px-3 py-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-1" />
                            <div className="min-w-0">
                              <p className="text-[12px] font-semibold text-muted-foreground">{st.title}</p>
                              <div className="text-[15px] overflow-x-auto [&_p]:my-0"><MathMarkdown>{st.result}</MathMarkdown></div>
                            </div>
                          </motion.li>
                        ))}
                      </ol>
                    )}
                  </Panel>
                )}

                {/* Worked solution */}
                {session.mode === 'solve' && (
                  <Panel>
                    <PanelHeader title="Worked solution" meta={<span className="text-[12px] text-muted-foreground tabular-nums">{Math.min(revealed, sol.steps.length)}/{sol.steps.length} steps</span>} />
                    <ol className="space-y-3">
                      {sol.steps.slice(0, revealed).map((st, i) => (
                        <motion.li key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                          className="rounded-2xl border border-border p-4">
                          <div className="flex items-start gap-3">
                            <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-[13px] font-bold grid place-items-center shrink-0">{i + 1}</span>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-foreground">{st.title}</p>
                              <div className="text-[14px] text-muted-foreground leading-relaxed [&_p]:my-1"><MathMarkdown>{st.explanation}</MathMarkdown></div>
                              <div className="mt-2 rounded-xl bg-muted/50 px-3 py-2 overflow-x-auto text-[16px] [&_p]:my-0"><MathMarkdown>{st.result}</MathMarkdown></div>
                              <button onClick={() => tutor('explain_step', '', undefined, i)} disabled={busy}
                                className="mt-2 text-[12px] font-semibold text-primary inline-flex items-center gap-1 hover:underline disabled:opacity-50">
                                <MessageCircleQuestion className="w-3.5 h-3.5" /> Explain this step more
                              </button>
                            </div>
                          </div>
                        </motion.li>
                      ))}
                    </ol>
                    {revealed < sol.steps.length ? (
                      <div className="flex gap-2 mt-4">
                        <button onClick={() => setRevealed(r => r + 1)} className="h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-1.5">
                          Next step <ChevronRight className="w-4 h-4" />
                        </button>
                        <button onClick={() => setRevealed(sol.steps.length)} className="h-10 px-4 rounded-full border border-border text-sm font-semibold">Show all</button>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700 mb-1">Final answer</p>
                        <div className="text-[18px] text-emerald-950 overflow-x-auto [&_p]:my-0"><MathMarkdown>{sol.finalAnswer}</MathMarkdown></div>
                      </div>
                    )}
                  </Panel>
                )}

                {/* Conversation */}
                <Panel>
                  <PanelHeader title={session.mode === 'guide' ? 'Work it out with ET' : 'Questions about the solution'} />
                  <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                    {session.messages.length === 0 && streamRaw === null && (
                      <p className="text-[13px] text-muted-foreground">
                        {session.mode === 'guide' ? 'ET will ask you for the first step.' : 'Ask about any step — "why do we divide here?"'}
                      </p>
                    )}
                    {session.messages.map((m, i) => <Bubble key={i} m={m} />)}
                    {live && (
                      <div className="flex gap-2.5">
                        <EtAvatar />
                        <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-primary/[0.06] border border-primary/15 px-4 py-2.5 text-[14px]">
                          {live.text
                            ? <div className="prose prose-sm max-w-none [&_p]:my-1"><MathMarkdown>{live.text}</MathMarkdown></div>
                            : <TypingDots />}
                        </div>
                      </div>
                    )}
                    <div ref={endRef} />
                  </div>

                  {celebrate && (
                    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                      className="mt-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-primary/10 border border-emerald-200 p-4 flex flex-wrap items-center gap-3">
                      <span className="text-2xl">🎉</span>
                      <div className="flex-1 min-w-[180px]">
                        <p className="font-semibold text-emerald-900">Solved it — nicely done.</p>
                        <p className="text-[13px] text-emerald-800/80 inline-flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> +5 stars · keep your streak going</p>
                      </div>
                      <button onClick={() => practice('similar')} disabled={busy} className="h-9 px-3.5 rounded-full border border-border bg-card text-[13px] font-semibold">Try a similar one</button>
                      <button onClick={() => practice('harder')} disabled={busy} className="h-9 px-3.5 rounded-full bg-primary text-primary-foreground text-[13px] font-semibold inline-flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Harder</button>
                    </motion.div>
                  )}

                  {/* Action chips */}
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar mt-4 pb-0.5">
                    {(session.mode === 'guide' && !session.solved ? [
                      { a: 'hint' as const, label: 'Hint', icon: Lightbulb },
                      { a: 'explain_again' as const, label: 'Explain again', icon: RefreshCw },
                      { a: 'simpler' as const, label: 'Simpler', icon: TrendingDown },
                      { a: 'reveal_step' as const, label: 'Show this step', icon: Eye },
                    ] : [
                      { a: 'simpler' as const, label: 'Explain simply', icon: TrendingDown },
                    ]).map(({ a, label, icon: I }) => (
                      <button key={a} onClick={() => tutor(a)} disabled={busy}
                        className="shrink-0 h-8 px-3 rounded-full border border-border text-[12px] font-semibold text-foreground inline-flex items-center gap-1.5 hover:border-primary/50 hover:bg-primary/5 disabled:opacity-40">
                        <I className="w-3.5 h-3.5 text-primary" /> {label}
                      </button>
                    ))}
                    <button onClick={() => practice('easier')} disabled={busy}
                      className="shrink-0 h-8 px-3 rounded-full border border-border text-[12px] font-semibold inline-flex items-center gap-1.5 hover:border-primary/50 hover:bg-primary/5 disabled:opacity-40">
                      <Wand2 className="w-3.5 h-3.5 text-primary" /> Easier one
                    </button>
                    <button onClick={() => practice('harder')} disabled={busy}
                      className="shrink-0 h-8 px-3 rounded-full border border-border text-[12px] font-semibold inline-flex items-center gap-1.5 hover:border-primary/50 hover:bg-primary/5 disabled:opacity-40">
                      <TrendingUp className="w-3.5 h-3.5 text-primary" /> Harder one
                    </button>
                  </div>

                  {/* Composer */}
                  <div className="mt-3 flex items-end gap-2">
                    <textarea
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                      rows={1}
                      placeholder={session.mode === 'guide' && !session.solved ? 'Type your next step — or ask a question…' : 'Ask ET anything about this problem…'}
                      className="flex-1 resize-none max-h-32 rounded-2xl border border-border bg-background px-4 py-2.5 text-[14px] outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                    />
                    {session.mode === 'guide' && !session.solved && (
                      <button onClick={() => sendReply('check')} disabled={busy || !reply.trim()} title="Check this as my final answer"
                        className="h-10 px-3.5 rounded-full border border-border text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-muted disabled:opacity-40 shrink-0">
                        <Target className="w-4 h-4 text-primary" /> <span className="hidden sm:inline">Final answer</span>
                      </button>
                    )}
                    <button onClick={() => sendReply()} disabled={busy || !reply.trim()} aria-label="Send"
                      className="w-10 h-10 rounded-full bg-primary text-primary-foreground grid place-items-center disabled:opacity-40 shrink-0 hover:opacity-90">
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                  {lastVerdict && session.mode === 'guide' && !session.solved && (
                    <p className="mt-2 text-[12px] text-muted-foreground">Tip: write the line of working you&apos;d write on paper, e.g. <span className="font-mono">2x = 8</span>.</p>
                  )}
                </Panel>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Side column ── */}
        <div className="lg:col-span-4 space-y-5 min-w-0">
          {phase === 'session' && sol?.graph && (
            <Panel padded={false} className="overflow-hidden">
              <div className="px-5 pt-4 pb-2"><p className="text-[15px] font-semibold text-foreground">Graph</p></div>
              <div className="px-3 pb-3">
                <FunctionPlot functions={sol.graph.functions} points={session?.mode === 'solve' || session?.solved ? sol.graph.points : []} xMin={sol.graph.xMin} xMax={sol.graph.xMax} height={300} />
              </div>
            </Panel>
          )}

          {phase === 'session' && sol && session?.mode === 'guide' && (
            <Panel>
              <PanelHeader title="Progress" meta={<span className="text-[13px] font-semibold tabular-nums text-primary">{pct}%</span>} />
              <div className="h-2 rounded-full bg-muted overflow-hidden mb-4">
                <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 140, damping: 22 }} />
              </div>
              {session.solved || showAnswer ? (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700 mb-1">Final answer</p>
                  <div className="text-[16px] overflow-x-auto [&_p]:my-0"><MathMarkdown>{sol.finalAnswer}</MathMarkdown></div>
                </div>
              ) : (
                <button onClick={() => { if (confirm('See the final answer now? Working it out yourself is how it sticks.')) setShowAnswer(true); }}
                  className="w-full h-10 rounded-xl border border-dashed border-border text-[13px] font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 inline-flex items-center justify-center gap-1.5">
                  <Eye className="w-4 h-4" /> Reveal the final answer
                </button>
              )}
            </Panel>
          )}

          {phase === 'session' && sol && (session?.mode === 'solve' || session?.solved) && sol.commonMistakes.length > 0 && (
            <Panel>
              <PanelHeader title="Watch out for" />
              <ul className="space-y-2">
                {sol.commonMistakes.map((m, i) => (
                  <li key={i} className="flex gap-2 text-[13px] text-foreground"><span className="text-amber-500 mt-0.5">▲</span><span className="[&_p]:my-0"><MathMarkdown>{m}</MathMarkdown></span></li>
                ))}
              </ul>
            </Panel>
          )}

          {phase !== 'session' && (
            <Panel>
              <PanelHeader title="How ET teaches" />
              <ul className="space-y-3 text-[13px]">
                {[
                  { icon: Camera, t: 'Snap or type', d: 'Printed, handwritten or a screenshot.' },
                  { icon: Sparkles, t: 'Solved and checked first', d: 'So every hint and verdict is right.' },
                  { icon: Lightbulb, t: 'You take each step', d: 'Hints when stuck — never just the answer.' },
                  { icon: TrendingUp, t: 'Then practise', d: 'Easier, similar or harder — your call.' },
                ].map(({ icon: I, t, d }) => (
                  <li key={t} className="flex gap-3">
                    <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0"><I className="w-4 h-4" /></span>
                    <span><span className="font-semibold text-foreground block">{t}</span><span className="text-muted-foreground">{d}</span></span>
                  </li>
                ))}
              </ul>
              <Link href="/dashboard/student/maths/packs" className="mt-4 flex items-center justify-between rounded-xl bg-primary/10 text-primary px-3 py-2.5 text-[13px] font-semibold hover:bg-primary/15">
                <span className="inline-flex items-center gap-2"><Target className="w-4 h-4" /> SPM · IGCSE · A Level · IB exam packs</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
              <Link href="/dashboard/student/maths/lab" className="mt-2 flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5 text-[13px] font-semibold hover:bg-muted">
                <span className="inline-flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /> Graphing calculator &amp; Maths Lab</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </Panel>
          )}

          <Panel>
            <PanelHeader title="Recent problems" meta={<History className="w-4 h-4 text-muted-foreground" />} />
            {history.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Problems you work on are saved here.</p>
            ) : (
              <ul className="space-y-1 -mx-2">
                {history.map(h => (
                  <li key={h.id} className="group flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-muted/60">
                    <button onClick={() => openFromHistory(h)} className="flex-1 min-w-0 text-left">
                      <p className="text-[13px] font-medium text-foreground truncate">{h.solution?.topic ?? 'Problem'}</p>
                      <p className="text-[12px] text-muted-foreground truncate">{h.problem.replace(/\$+/g, '').slice(0, 70)}</p>
                    </button>
                    {h.solved ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <CircleDot className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <button aria-label="Delete" onClick={async () => { if (uid) { await deleteMathSession(uid, h.id).catch(() => {}); loadHistory(); } }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-600 transition-opacity">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {phase === 'session' && (
            <div className="relative">
              <button onClick={() => setReportOpen(o => !o)} className="text-[12px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5" /> Something wrong with this problem?
              </button>
              {reportOpen && (
                <div className="mt-2 rounded-xl border border-border bg-card shadow-[var(--shadow-card)] p-2 space-y-1">
                  {['The answer is wrong', 'The photo was misread', 'The graph is wrong', 'An explanation is confusing'].map(r => (
                    <button key={r} onClick={() => report(r)} className="w-full text-left text-[13px] px-3 py-2 rounded-lg hover:bg-muted">{r}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashPage>
  );
}

function EtAvatar() {
  return <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-[11px] font-bold grid place-items-center shrink-0 mt-0.5">ET</span>;
}

function TypingDots() {
  return (
    <span className="flex gap-1 items-center h-5">
      {[0, 1, 2].map(d => (
        <motion.span key={d} className="w-1.5 h-1.5 rounded-full bg-primary"
          animate={{ opacity: [0.25, 1, 0.25] }} transition={{ repeat: Infinity, duration: 1, delay: d * 0.18 }} />
      ))}
    </span>
  );
}

function Bubble({ m }: { m: MathMessage }) {
  if (m.role === 'student') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-foreground text-background px-4 py-2.5 text-[14px] whitespace-pre-wrap">{m.text}</div>
      </div>
    );
  }
  const v = m.verdict ? VERDICT_STYLE[m.verdict as keyof typeof VERDICT_STYLE] : null;
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2.5">
      <EtAvatar />
      <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-primary/[0.06] border border-primary/15 px-4 py-2.5 text-[14px]">
        {v && (
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border mb-1.5 ${v.cls}`}>
            <v.icon className="w-3 h-3" /> {v.label}
          </span>
        )}
        <div className="prose prose-sm max-w-none [&_p]:my-1"><MathMarkdown>{m.text}</MathMarkdown></div>
      </div>
    </motion.div>
  );
}
