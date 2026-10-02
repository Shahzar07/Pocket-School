'use client';

/**
 * Oral exam with ET. The examiner speaks each question (sentence by sentence
 * as it's written, so there's no dead air), the student answers out loud —
 * or types — and the transcript is graded on a four-part rubric.
 */

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { ArrowLeft, Mic, Square, Loader2, Keyboard, Send, Sparkles, Zap, Volume2, GraduationCap, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useExamPrep } from '@/hooks/use-exam-prep';
import { DashPage, Panel, PanelHeader } from '@/components/dash-ui';
import { postJSON } from '@/lib/authed-fetch';
import { streamText } from '@/lib/study/client';
import { Speaker, SentenceStream } from '@/lib/speech';
import { RECOGNITION_LANG } from '@/lib/languages';
import { assertSparks, chargeSparks, saveAttempt, updatePrep, blendMastery, recordStudyDay, InsufficientSparks } from '@/lib/study/db';
import { gradeFor } from '@/lib/study/grades';
import { STUDY_COSTS } from '@/lib/sparks';

type Phase = 'setup' | 'exam' | 'grading' | 'results';
type Line = { role: 'examiner' | 'student'; text: string };
interface Grade { criteria: { name: string; score: number; comment: string }[]; percent: number; summary: string; strengths: string[]; gaps: { topic: string; severity: string; issue: string; fix: string }[] }

interface Rec { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; abort(): void; onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null }

function makeRecognizer(): Rec | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return C ? new C() : null;
}

export default function OralExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { prep, uid, merge } = useExamPrep(id);
  const [phase, setPhase] = useState<Phase>('setup');
  const [total, setTotal] = useState(5);
  const [lines, setLines] = useState<Line[]>([]);
  const [live, setLive] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const [grade, setGrade] = useState<Grade | null>(null);
  const [canListen, setCanListen] = useState(true);
  const speaker = useRef<Speaker | null>(null);
  const rec = useRef<Rec | null>(null);
  const finalText = useRef('');
  const linesRef = useRef<Line[]>([]);
  const charged = useRef(false);
  useEffect(() => { linesRef.current = lines; }, [lines]);
  useEffect(() => { setCanListen(!!makeRecognizer()); }, []);
  useEffect(() => () => { speaker.current?.stop(); rec.current?.abort(); }, []);

  if (!prep) return <DashPage><div className="h-64 rounded-2xl bg-muted animate-pulse" /></DashPage>;

  const answered = lines.filter(l => l.role === 'student').length;
  const examinerBusy = live !== null || speaking;

  const examinerTurn = async (history: Line[]) => {
    if (!speaker.current) speaker.current = new Speaker({ voice: 'Charon', style: 'Calm, clear and professional, like a kind examiner.', lang: RECOGNITION_LANG[prep.language] ?? 'en-GB', onSpeakingChange: setSpeaking });
    const sp = speaker.current;
    const turn = sp.begin();
    const sentences = new SentenceStream(s => sp.enqueue(s, turn));
    let spoken = 0;
    setLive('');
    try {
      const text = await streamText('/api/study/prep/oral', {
        transcript: history, topics: prep.topics, subject: prep.subject, questionNumber: Math.min(total, history.filter(l => l.role === 'student').length + 1), totalQuestions: total, level: prep.level, language: prep.language,
      }, full => {
        // Speak each sentence as soon as it's written — no dead air.
        sentences.push(full.slice(spoken));
        spoken = full.length;
        setLive(full);
      }, undefined);
      sentences.flush();
      setLines(l => [...l, { role: 'examiner', text: text.trim() }]);
      if (!charged.current && uid) { charged.current = true; chargeSparks(uid, 'oral', `Oral exam — ${prep.title}`).catch(() => null); }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'The examiner is unavailable.');
    } finally { setLive(null); }
  };

  const start = async () => {
    if (!uid) return;
    try { await assertSparks(uid, 'oral'); } catch (e) {
      if (e instanceof InsufficientSparks) return void toast.error(e.message, { action: { label: 'Get Sparks', onClick: () => { location.href = '/dashboard/student/billing'; } } });
    }
    setLines([]);
    setPhase('exam');
    await examinerTurn([]);
  };

  const submitAnswer = async (text: string) => {
    const t = text.trim();
    if (!t) return;
    speaker.current?.stop();
    const next = [...linesRef.current, { role: 'student' as const, text: t }];
    setLines(next);
    setHeard(''); setTyped('');
    await examinerTurn(next);
    if (next.filter(l => l.role === 'student').length >= total) {
      // Let the closing words finish, then grade.
      await speaker.current?.whenIdle();
      void finish(linesRef.current);
    }
  };

  const listen = () => {
    const r = makeRecognizer();
    if (!r) { setTyping(true); return; }
    speaker.current?.stop();
    finalText.current = '';
    setHeard('');
    r.lang = RECOGNITION_LANG[prep.language] ?? 'en-GB';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText.current += ' ' + res[0].transcript;
        else interim += res[0].transcript;
      }
      setHeard((finalText.current + ' ' + interim).trim());
    };
    r.onerror = e => { if (e.error === 'not-allowed') { toast.error('Microphone blocked — you can type your answers instead.'); setTyping(true); } };
    r.onend = () => setListening(false);
    rec.current = r;
    try { r.start(); setListening(true); } catch { setTyping(true); }
  };

  const stopListening = () => {
    rec.current?.stop();
    setListening(false);
    // Give the recogniser a beat to deliver its last final result.
    setTimeout(() => { void submitAnswer(finalText.current || heard); }, 350);
  };

  async function finish(transcript: Line[]) {
    if (!uid) return;
    speaker.current?.stop();
    rec.current?.abort();
    setPhase('grading');
    try {
      const g = await postJSON<Grade>('/api/study/prep/oral-grade', { transcript, topics: prep!.topics, subject: prep!.subject, language: prep!.language });
      setGrade(g);
      setPhase('results');
      const gradeLetter = gradeFor(prep!.gradeScale, g.percent);
      await saveAttempt(uid, prep!.id, {
        kind: 'oral', score: g.percent, max: 100, percent: g.percent, grade: gradeLetter, summary: g.summary, transcript,
        gaps: g.gaps.map(x => ({ topicId: prep!.topics.find(t => t.title.toLowerCase() === x.topic.toLowerCase())?.id ?? '', topic: x.topic, severity: (['weakest', 'attention', 'minor'].includes(x.severity) ? x.severity : 'attention') as 'weakest' | 'attention' | 'minor', issue: x.issue, fix: x.fix })),
      });
      // Oral evidence is broad but light: nudge every topic, more for named gaps.
      const mastery = { ...prep!.mastery };
      for (const t of prep!.topics) {
        const gap = g.gaps.some(x => x.topic.toLowerCase().includes(t.title.toLowerCase()) || t.title.toLowerCase().includes(x.topic.toLowerCase()));
        mastery[t.id] = blendMastery(mastery[t.id], gap ? Math.max(0, g.percent - 25) : g.percent, 0.15);
      }
      await updatePrep(uid, prep!.id, { mastery });
      merge({ mastery });
      recordStudyDay(uid, 8).catch(() => {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not grade the exam.');
      setPhase('exam');
    }
  }

  return (
    <DashPage>
      <Link href={`/dashboard/student/exam-prep/${prep.id}`} className="text-[13px] font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> {prep.title}</Link>

      {phase === 'setup' && (
        <div className="max-w-2xl mx-auto w-full">
          <Panel>
            <span className="w-12 h-12 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-4"><Mic className="w-6 h-6" /></span>
            <h1 className="font-heading text-[30px] leading-tight tracking-[-0.03em]">Oral exam with ET</h1>
            <p className="text-[14px] text-muted-foreground mt-1">ET asks questions out loud, probes when an answer is thin, and grades how well you know it and how clearly you explain it. The best practice there is for explaining under pressure.</p>
            <p className="text-[13px] font-semibold mt-6 mb-2">Number of questions</p>
            <div className="flex gap-2">
              {[3, 5, 8].map(n => <button key={n} onClick={() => setTotal(n)} className={`h-11 flex-1 rounded-xl border text-[14px] font-semibold ${total === n ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}>{n}</button>)}
            </div>
            {!canListen && <p className="mt-4 text-[13px] rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2">This browser can&apos;t transcribe speech — you&apos;ll type your answers. Chrome, Edge or Safari support speaking.</p>}
            <button onClick={start} className="mt-6 w-full h-12 rounded-full bg-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" /> Begin the exam <span className="text-[12px] opacity-80 inline-flex items-center gap-0.5"><Zap className="w-3 h-3" />{STUDY_COSTS.oral}</span>
            </button>
          </Panel>
        </div>
      )}

      {phase === 'exam' && (
        <div className="grid lg:grid-cols-12 gap-5 items-start">
          <Panel className="lg:col-span-5 text-center lg:sticky lg:top-4">
            <div className="relative w-36 h-36 mx-auto my-4">
              {[0, 1, 2].map(i => (
                <motion.span key={i} className="absolute inset-0 rounded-full border-2 border-primary/40"
                  animate={speaking || listening ? { scale: [1, 1.35 + i * 0.12], opacity: [0.5, 0] } : { scale: 1, opacity: 0.15 }}
                  transition={{ repeat: speaking || listening ? Infinity : 0, duration: 1.6, delay: i * 0.4 }} />
              ))}
              <span className={`absolute inset-0 rounded-full grid place-items-center text-white text-3xl font-bold ${listening ? 'bg-rose-500' : 'bg-primary'}`}>
                {listening ? <Mic className="w-10 h-10" /> : speaking ? <Volume2 className="w-10 h-10" /> : live !== null ? <Loader2 className="w-10 h-10 animate-spin" /> : 'ET'}
              </span>
            </div>
            <p className="font-semibold text-foreground">{listening ? 'Listening — answer out loud' : speaking ? 'ET is asking…' : live !== null ? 'ET is thinking…' : 'Your turn'}</p>
            <p className="text-[12px] text-muted-foreground mt-1 tabular-nums">Answered {answered} of {total}</p>
            <div className="flex gap-1 justify-center mt-3">{Array.from({ length: total }, (_, i) => <span key={i} className={`h-1.5 w-8 rounded-full ${i < answered ? 'bg-primary' : 'bg-muted'}`} />)}</div>

            {!typing ? (
              <div className="mt-6 flex flex-col items-center gap-3">
                {listening ? (
                  <button onClick={stopListening} className="h-12 px-6 rounded-full bg-rose-600 text-white font-semibold inline-flex items-center gap-2"><Square className="w-4 h-4" /> I&apos;ve finished my answer</button>
                ) : (
                  <button onClick={listen} disabled={examinerBusy && !speaking} className="h-12 px-6 rounded-full bg-primary text-primary-foreground font-semibold inline-flex items-center gap-2 disabled:opacity-40"><Mic className="w-4 h-4" /> {speaking ? 'Interrupt and answer' : 'Answer'}</button>
                )}
                <button onClick={() => setTyping(true)} className="text-[12px] font-semibold text-muted-foreground inline-flex items-center gap-1"><Keyboard className="w-3.5 h-3.5" /> Type instead</button>
              </div>
            ) : (
              <div className="mt-6 text-left">
                <textarea value={typed} onChange={e => setTyped(e.target.value)} rows={4} placeholder="Type your answer…" className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-[14px] outline-none focus:border-primary" />
                <div className="flex justify-between mt-2">
                  {canListen ? <button onClick={() => setTyping(false)} className="text-[12px] font-semibold text-muted-foreground inline-flex items-center gap-1"><Mic className="w-3.5 h-3.5" /> Speak instead</button> : <span />}
                  <button onClick={() => submitAnswer(typed)} disabled={!typed.trim() || live !== null} className="h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-40"><Send className="w-4 h-4" /> Submit answer</button>
                </div>
              </div>
            )}
            {answered >= 2 && answered < total && (
              <button onClick={() => finish(linesRef.current)} className="mt-6 text-[12px] font-semibold text-muted-foreground hover:text-foreground underline">End the exam now and grade it</button>
            )}
          </Panel>
          <Panel className="lg:col-span-7">
            <PanelHeader title="Transcript" />
            <div className="space-y-3 min-h-[300px]">
              {lines.map((l, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={`flex ${l.role === 'student' ? 'justify-end' : 'gap-2.5'}`}>
                  {l.role === 'examiner' && <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-[11px] font-bold grid place-items-center shrink-0">ET</span>}
                  <p className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed ${l.role === 'student' ? 'bg-foreground text-background rounded-tr-md' : 'bg-primary/[0.06] border border-primary/15 rounded-tl-md'}`}>{l.text}</p>
                </motion.div>
              ))}
              <AnimatePresence>
                {live !== null && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-2.5">
                    <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-[11px] font-bold grid place-items-center shrink-0">ET</span>
                    <p className="max-w-[85%] rounded-2xl rounded-tl-md bg-primary/[0.06] border border-primary/15 px-4 py-2.5 text-[14px]">{live || <Loader2 className="w-4 h-4 animate-spin text-primary" />}</p>
                  </motion.div>
                )}
                {listening && heard && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ml-auto max-w-[85%] rounded-2xl rounded-tr-md bg-foreground/80 text-background px-4 py-2.5 text-[14px] italic">{heard}</motion.p>
                )}
              </AnimatePresence>
            </div>
          </Panel>
        </div>
      )}

      {phase === 'grading' && (
        <Panel className="py-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="font-heading text-xl">Grading your oral exam…</p>
          <p className="text-[13px] text-muted-foreground mt-1">Knowledge, reasoning, terminology and clarity.</p>
        </Panel>
      )}

      {phase === 'results' && grade && (
        <div className="grid lg:grid-cols-12 gap-5">
          <Panel className="lg:col-span-4 text-center">
            <GraduationCap className="w-7 h-7 text-primary mx-auto" />
            <motion.p initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-heading text-[96px] leading-none mt-2 bg-gradient-to-b from-primary to-emerald-600 bg-clip-text text-transparent">{gradeFor(prep.gradeScale, grade.percent)}</motion.p>
            <p className="font-semibold text-[18px] tabular-nums">{grade.percent}%</p>
            <p className="text-[14px] text-muted-foreground mt-3">{grade.summary}</p>
            <Link href={`/dashboard/student/exam-prep/${prep.id}`} className="mt-5 inline-flex h-10 px-4 rounded-full border border-border text-sm font-semibold items-center">Back to my plan</Link>
          </Panel>
          <div className="lg:col-span-8 space-y-5">
            <Panel>
              <PanelHeader title="Rubric" />
              <ul className="space-y-4">
                {grade.criteria.map(c => (
                  <li key={c.name}>
                    <div className="flex justify-between text-[14px]"><span className="font-semibold">{c.name}</span><span className="tabular-nums font-semibold">{c.score}/10</span></div>
                    <div className="h-2 rounded-full bg-muted mt-1.5 overflow-hidden"><motion.div className="h-full bg-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${c.score * 10}%` }} /></div>
                    <p className="text-[13px] text-muted-foreground mt-1">{c.comment}</p>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel>
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-emerald-700 mb-2">Strengths</p>
                  <ul className="space-y-1.5">{grade.strengths.map((s, i) => <li key={i} className="flex gap-2 text-[14px]"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />{s}</li>)}</ul>
                </div>
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-rose-600 mb-2">Work on</p>
                  <ul className="space-y-2">{grade.gaps.map((g, i) => <li key={i} className="flex gap-2 text-[14px]"><AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" /><span><span className="font-semibold">{g.topic}:</span> {g.fix}</span></li>)}</ul>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      )}
    </DashPage>
  );
}
