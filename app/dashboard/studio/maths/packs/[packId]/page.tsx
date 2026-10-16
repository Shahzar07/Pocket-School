'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { ArrowLeft, Shuffle, Gift, Lock, Loader2, Sparkles, Zap, ChevronRight, Wand2, RefreshCw } from 'lucide-react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { DashPage, Panel, PanelHeader, Segmented } from '@/components/dash-ui';
import { MasteryBar } from '@/components/study/mastery-bar';
import { ExercisesView } from '@/components/study/exercises-view';
import { getPack, packTopics, isFreeTopic, type PackQuestion } from '@/lib/study/exam-packs';
import { getPackProgress, savePackProgress, getPackSet, savePackSet, assertSparks, chargeSparks, blendMastery, recordStudyDay, InsufficientSparks, type PackProgress } from '@/lib/study/db';
import { gradeFor, weightedMastery, GRADE_SCALES } from '@/lib/study/grades';
import { postJSON } from '@/lib/authed-fetch';
import { readLanguage } from '@/lib/languages';
import { STUDY_COSTS } from '@/lib/sparks';
import type { Difficulty } from '@/lib/study/types';

export default function PackPage({ params }: { params: Promise<{ packId: string }> }) {
  const { packId } = use(params);
  const pack = getPack(packId);
  const { user, profile } = useAuthSTORE();
  const uid = user?.uid;
  const [progress, setProgress] = useState<PackProgress>({ mastery: {}, setsDone: 0 });
  const [topicId, setTopicId] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('similar');
  const [questions, setQuestions] = useState<PackQuestion[] | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'generating' | 'ready'>('idle');

  useEffect(() => { if (uid && pack) getPackProgress(uid, pack.id).then(setProgress).catch(() => {}); }, [uid, pack]);

  const topics = useMemo(() => (pack ? packTopics(pack) : []), [pack]);
  const topic = topics.find(tp => tp.id === topicId) ?? null;
  const setKey = topic ? `${topic.id}__${difficulty}` : null;

  useEffect(() => {
    if (!uid || !pack || !setKey) return;
    let cancelled = false;
    setState('loading');
    setQuestions(null);
    getPackSet<PackQuestion[]>(uid, pack.id, setKey).then(q => {
      if (cancelled) return;
      if (q?.length) { setQuestions(q); setState('ready'); } else setState('idle');
    }).catch(() => !cancelled && setState('idle'));
    return () => { cancelled = true; };
  }, [uid, pack, setKey]);

  const generate = useCallback(async () => {
    if (!uid || !pack || !topic || !setKey) return;
    const free = isFreeTopic(pack, topic.id);
    try { if (!free) await assertSparks(uid, 'packSet'); } catch (e) {
      if (e instanceof InsufficientSparks) return void toast.error(e.message, { action: { label: 'Get Sparks', onClick: () => { location.href = '/dashboard/student/billing'; } } });
    }
    setState('generating');
    try {
      const res = await postJSON<{ questions: PackQuestion[] }>('/api/study/pack/questions', { packId: pack.id, topicId: topic.id, difficulty, language: readLanguage() });
      await savePackSet(uid, pack.id, setKey, res.questions);
      if (!free) await chargeSparks(uid, 'packSet', `${pack.name}: ${topic.title}`).catch(() => null);
      setQuestions(res.questions);
      setState('ready');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create questions.');
      setState('idle');
    }
  }, [uid, pack, topic, setKey, difficulty]);

  if (!pack) return <DashPage><Panel><p>Unknown exam pack.</p></Panel></DashPage>;

  const tried = topics.filter(tp => progress.mastery[tp.id] !== undefined);
  // Estimate from what's been practised, and say how much that covers.
  const estimate = tried.length ? weightedMastery(tried, progress.mastery) : null;
  const coverage = Math.round((tried.length / topics.length) * 100);
  const target = 80;

  const randomTopic = () => {
    const pool = topics.filter(tp => (progress.mastery[tp.id] ?? 0) < target);
    const pick = (pool.length ? pool : topics)[Math.floor(Math.random() * (pool.length || topics.length))];
    setTopicId(pick.id);
  };

  const finish = async (score: number) => {
    if (!uid || !topic) return;
    const next: PackProgress = {
      mastery: { ...progress.mastery, [topic.id]: blendMastery(progress.mastery[topic.id], score, 0.45) },
      setsDone: progress.setsDone + 1,
      lastTopic: topic.id,
    };
    setProgress(next);
    await savePackProgress(uid, pack.id, next);
    recordStudyDay(uid, 4).catch(() => {});
    toast.success(`${topic.title}: mastery ${next.mastery[topic.id]}%`);
  };

  return (
    <DashPage>
      <Link href="/dashboard/studio/maths/packs" className="text-[13px] font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> All exam packs</Link>

      <div className="grid lg:grid-cols-12 gap-5">
        <Panel className="lg:col-span-5 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: pack.accent }} />
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] mt-1" style={{ color: pack.accent }}>{pack.board} · {pack.level}</p>
          <h1 className="font-heading text-[28px] leading-tight tracking-[-0.03em] mt-1">{pack.name}</h1>
          <p className="text-[14px] text-muted-foreground mt-1.5">Hello, {profile?.name?.split(' ')[0] ?? 'there'} 👋 Let&apos;s win this.</p>
          <button onClick={randomTopic} className="mt-5 w-full rounded-2xl border border-dashed border-border py-6 hover:border-primary/50 hover:bg-primary/[0.03] transition-colors">
            <Shuffle className="w-5 h-5 mx-auto text-primary mb-1.5" />
            <span className="font-semibold">Open a random topic</span>
            <span className="block text-[12px] text-muted-foreground">Picks one you haven&apos;t mastered yet</span>
          </button>
        </Panel>
        <Panel className="lg:col-span-7">
          <div className="grid sm:grid-cols-[auto_1fr] gap-6 items-center">
            <div className="text-center">
              <p className="text-[13px] font-semibold text-muted-foreground">Estimated {GRADE_SCALES[pack.scale].label} grade</p>
              <motion.p key={estimate ?? 'x'} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="font-heading text-[88px] leading-none mt-1 bg-gradient-to-b from-emerald-500 to-emerald-700 bg-clip-text text-transparent">{estimate === null ? '—' : gradeFor(pack.scale, estimate)}</motion.p>
            </div>
            <div>
              <MasteryBar value={estimate ?? 0} target={target} initial={profile?.name ?? 'Me'} />
              <p className="text-[13px] text-muted-foreground">{estimate === null ? 'Practise any topic to get your first estimate.' : `Based on ${tried.length} of ${topics.length} topics (${coverage}% of the syllabus). It firms up as you cover more.`}</p>
              <p className="text-[12px] text-muted-foreground mt-2">{progress.setsDone} question set{progress.setsDone === 1 ? '' : 's'} completed</p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid lg:grid-cols-12 gap-5 items-start">
        <Panel className="lg:col-span-4 lg:sticky lg:top-4 max-h-[80vh] overflow-y-auto">
          <PanelHeader title="Syllabus" />
          <div className="space-y-4">
            {pack.units.map(u => (
              <div key={u.id}>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-1.5">{u.title}</p>
                <ul className="space-y-0.5">
                  {u.topics.map(tp => {
                    const m = progress.mastery[tp.id];
                    const free = isFreeTopic(pack, tp.id);
                    return (
                      <li key={tp.id}>
                        <button onClick={() => setTopicId(tp.id)}
                          className={`w-full text-left rounded-xl px-2.5 py-2 flex items-center gap-2.5 transition-colors ${topicId === tp.id ? 'bg-primary/10' : 'hover:bg-muted/60'}`}>
                          <span className={`w-8 text-[11px] font-bold tabular-nums text-right ${m === undefined ? 'text-muted-foreground/50' : m >= target ? 'text-emerald-600' : 'text-primary'}`}>{m === undefined ? '—' : `${m}%`}</span>
                          <span className="flex-1 text-[13px] text-foreground leading-snug">{tp.title}</span>
                          {free ? <Gift className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="lg:col-span-8 min-h-[420px]">
          {!topic ? (
            <div className="text-center py-16">
              <Wand2 className="w-8 h-8 mx-auto text-primary mb-3" />
              <p className="font-heading text-xl">Pick a topic to practise</p>
              <p className="text-[13px] text-muted-foreground mt-1">Five exam-style questions per set, each with a full worked solution. Stuck? Work through any question with ET AI.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{topic.unit}</p>
                  <p className="font-heading text-[24px] leading-tight">{topic.title}</p>
                </div>
                <Segmented options={[{ id: 'easier', label: 'Warm-up' }, { id: 'similar', label: 'Exam level' }, { id: 'harder', label: 'Hardest' }] as const} value={difficulty} onChange={setDifficulty} />
              </div>
              <AnimatePresence mode="wait">
                {state === 'loading' && <motion.div key="l" className="h-40 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></motion.div>}
                {state === 'idle' && (
                  <motion.div key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10">
                    {isFreeTopic(pack, topic.id)
                      ? <p className="text-[13px] font-semibold text-emerald-700 inline-flex items-center gap-1.5 mb-3"><Gift className="w-4 h-4" /> This topic is free</p>
                      : <p className="text-[13px] text-muted-foreground inline-flex items-center gap-1.5 mb-3"><Lock className="w-4 h-4" /> {STUDY_COSTS.packSet} Sparks per set of 5</p>}
                    <div><button onClick={generate} className="h-11 px-5 rounded-full bg-primary text-primary-foreground font-semibold text-sm inline-flex items-center gap-2">
                      <Sparkles className="w-4 h-4" /> Get 5 exam-style questions {!isFreeTopic(pack, topic.id) && <span className="text-[12px] opacity-80 inline-flex items-center gap-0.5"><Zap className="w-3 h-3" />{STUDY_COSTS.packSet}</span>}
                    </button></div>
                  </motion.div>
                )}
                {state === 'generating' && (
                  <motion.div key="g" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-14">
                    <Loader2 className="w-7 h-7 animate-spin text-primary mx-auto mb-3" />
                    <p className="font-semibold">Writing questions in the {pack.board} style…</p>
                    <p className="text-[13px] text-muted-foreground mt-1">Each one is solved and checked before you see it.</p>
                  </motion.div>
                )}
                {state === 'ready' && questions && (
                  <motion.div key={setKey} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <ExercisesView
                      key={setKey}
                      exercises={questions.map(q => ({ prompt: `${q.paper ? `*${q.paper}* · ` : ''}${q.question}`, hint: '', solution: q.solution, answer: q.answer, marks: q.marks }))}
                      onComplete={finish}
                      extraAction={(_, i) => (
                        <Link href={`/dashboard/studio/maths?problem=${encodeURIComponent(questions[i].question)}`}
                          className="h-9 px-3.5 rounded-full border border-primary/30 text-primary text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-primary/5">
                          Work through it with ET AI <ChevronRight className="w-4 h-4" />
                        </Link>
                      )}
                    />
                    <button onClick={generate} className="mt-4 text-[12px] font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" /> New set of questions</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </Panel>
      </div>
    </DashPage>
  );
}
