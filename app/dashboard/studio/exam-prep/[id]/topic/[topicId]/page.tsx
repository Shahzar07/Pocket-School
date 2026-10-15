'use client';

import { Suspense, use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import {
  ArrowLeft, BookOpen, Layers, ListChecks, CheckCircle2, PenLine, Headphones, MessageCircle, Sparkles, Loader2, Zap, RefreshCw, Send,
} from 'lucide-react';
import { useExamPrep } from '@/hooks/use-exam-prep';
import { DashPage, Panel, Segmented } from '@/components/dash-ui';
import { MathMarkdown } from '@/components/math-markdown';
import { LessonView } from '@/components/study/lesson-view';
import { FlashcardsView } from '@/components/study/flashcards-view';
import { QuizView, TrueFalseView } from '@/components/study/quiz-view';
import { ExercisesView } from '@/components/study/exercises-view';
import { PodcastPlayer } from '@/components/study/podcast-player';
import { postJSON } from '@/lib/authed-fetch';
import { streamText } from '@/lib/study/client';
import { assertSparks, assetId, chargeSparks, completeItem, getAsset, saveAsset, InsufficientSparks } from '@/lib/study/db';
import { STUDY_COSTS } from '@/lib/sparks';
import type { AssetType, Difficulty, ExamPrep, Exercise, Flashcard, LessonAsset, PodcastAsset, PodcastStyle, QuizQuestion, StudyTopic, TrueFalseItem } from '@/lib/study/types';

type Tab = AssetType | 'chat';

const TABS: { id: Tab; label: string; icon: typeof BookOpen; blurb: string }[] = [
  { id: 'lesson', label: 'Lesson', icon: BookOpen, blurb: 'A clear, teacher-written lesson from your notes, with a worked example and how it’s examined.' },
  { id: 'flashcards', label: 'Flashcards', icon: Layers, blurb: 'Every key fact, definition and formula as a flip card. Cards you miss come back round.' },
  { id: 'quiz', label: 'Quiz', icon: ListChecks, blurb: 'Seven questions that test understanding, with the reason for every answer.' },
  { id: 'truefalse', label: 'True or false', icon: CheckCircle2, blurb: 'Ten quick statements — the false ones are wrong the way students get it wrong.' },
  { id: 'exercises', label: 'Exercises', icon: PenLine, blurb: 'Exam-style questions with full worked solutions. Mark yourself honestly.' },
  { id: 'podcast', label: 'Podcast', icon: Headphones, blurb: 'Revise on the go with a two-voice episode about this topic.' },
  { id: 'chat', label: 'Ask ET', icon: MessageCircle, blurb: 'Ask anything — ET answers from your own material first.' },
];

/** How much each activity moves mastery, and from what score. */
const MASTERY_WEIGHT: Partial<Record<AssetType, number>> = { lesson: 0.25, flashcards: 0.3, quiz: 0.45, truefalse: 0.3, exercises: 0.45, podcast: 0.15 };

const PODCAST_STYLES: { id: PodcastStyle; label: string }[] = [
  { id: 'dialogue', label: 'Conversation' }, { id: 'recap', label: 'Quick recap' }, { id: 'qa', label: 'Quiz show' }, { id: 'simple', label: 'Explain simply' }, { id: 'deepdive', label: 'Deep dive' },
];

export default function TopicPage(props: { params: Promise<{ id: string; topicId: string }> }) {
  return <Suspense fallback={<DashPage><div className="h-64 rounded-2xl bg-muted animate-pulse" /></DashPage>}><TopicInner {...props} /></Suspense>;
}

function TopicInner({ params }: { params: Promise<{ id: string; topicId: string }> }) {
  const { id, topicId } = use(params);
  const search = useSearchParams();
  const fromItem = search.get('item');
  const { prep, loading, uid, merge, loadMaterial } = useExamPrep(id);
  const allTopics = topicId === 'all';
  const [tab, setTab] = useState<Tab>(allTopics ? 'chat' : ((search.get('tab') as Tab) || 'lesson'));
  const [difficulty, setDifficulty] = useState<Difficulty>('similar');
  const [style, setStyle] = useState<PodcastStyle>('dialogue');
  // Data is tagged with the asset it belongs to, so switching tabs can never
  // hand one format's data to another format's view for a frame.
  const [loaded, setLoaded] = useState<{ key: string; data: unknown } | null>(null);
  // Starts as 'loading' so nothing auto-generates before the cache is checked.
  const [state, setState] = useState<'idle' | 'loading' | 'generating' | 'ready' | 'error'>('loading');
  const [checkedKey, setCheckedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoStarted = useRef(false);

  const topic: StudyTopic | undefined = prep?.topics.find(t => t.id === topicId);
  const variant = tab === 'quiz' || tab === 'exercises' ? difficulty : tab === 'podcast' ? style : 'default';
  const key = topic && tab !== 'chat' ? assetId(topic.id, tab, variant) : null;

  // Look for a cached version whenever the tab or variant changes.
  useEffect(() => {
    if (!uid || !prep || !key) return;
    let cancelled = false;
    setState('loading');
    setError(null);
    getAsset(uid, prep.id, key).then(d => {
      if (cancelled) return;
      if (d) { setLoaded({ key, data: d }); setState('ready'); } else setState('idle');
      setCheckedKey(key);
    }).catch(() => { if (!cancelled) { setState('idle'); setCheckedKey(key); } });
    return () => { cancelled = true; };
  }, [uid, prep?.id, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const generate = useCallback(async () => {
    if (!uid || !prep || !topic || tab === 'chat' || !key) return;
    setState('generating');
    setError(null);
    try {
      await assertSparks(uid, tab);
      const material = await loadMaterial();
      const out = await postJSON<unknown>('/api/study/prep/asset', {
        type: tab, topic, subject: prep.subject, material, level: prep.level, language: prep.language, difficulty, style,
      });
      const payload = tab === 'podcast' ? { ...(out as PodcastAsset), style } : out;
      await saveAsset(uid, prep.id, key, { type: tab, topicId: topic.id, variant, data: payload });
      await chargeSparks(uid, tab, `${topic.title} — ${tab}`).catch(() => null);
      setLoaded({ key, data: payload });
      setState('ready');
    } catch (e) {
      if (e instanceof InsufficientSparks) {
        toast.error(e.message, { action: { label: 'Get Sparks', onClick: () => { location.href = '/dashboard/student/billing'; } } });
        setState('idle');
      } else {
        setError(e instanceof Error ? e.message : 'Could not create this.');
        setState('error');
      }
    }
  }, [uid, prep, topic, tab, key, variant, difficulty, style, loadMaterial]);

  // Coming from a plan item: start straight away — the student already chose it.
  useEffect(() => {
    if (fromItem && state === 'idle' && checkedKey === key && key && !autoStarted.current) {
      autoStarted.current = true;
      void generate();
    }
  }, [fromItem, state, checkedKey, key, generate]);

  const finish = async (score: number) => {
    if (!uid || !prep || !topic || tab === 'chat') return;
    const itemId = fromItem && fromItem.startsWith(`${topic.id}:${tab}`) ? fromItem : `${topic.id}:${tab}`;
    const patch = await completeItem(uid, prep, itemId, { topicId: topic.id, score, weight: MASTERY_WEIGHT[tab] });
    merge(patch);
    const m = patch.mastery?.[topic.id];
    toast.success(m !== undefined ? `Saved — ${topic.title} mastery is now ${m}%.` : 'Saved.');
  };

  if (loading || !prep) return <DashPage><div className="h-64 rounded-2xl bg-muted animate-pulse" /></DashPage>;
  if (!topic && !allTopics) return <DashPage><Panel><p>Topic not found.</p></Panel></DashPage>;

  const meta = TABS.find(t => t.id === tab)!;
  const mastery = topic ? prep.mastery?.[topic.id] ?? 0 : null;
  const doneHere = topic ? !!prep.completed?.[`${topic.id}:${tab}`] : false;

  return (
    <DashPage>
      <Link href={`/dashboard/studio/exam-prep/${prep.id}`} className="text-[13px] font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> {prep.title}</Link>

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{allTopics ? 'All topics' : `Topic ${(topic?.order ?? 0) + 1} of ${prep.topics.length}`}</p>
            <h1 className="font-heading text-[28px] leading-tight tracking-[-0.03em] text-foreground mt-1">{allTopics ? 'Ask ET about your notes' : topic!.title}</h1>
            {topic && <p className="text-[14px] text-muted-foreground mt-1 max-w-2xl">{topic.summary}</p>}
          </div>
          {mastery !== null && (
            <div className="text-right">
              <p className="font-heading text-[34px] leading-none text-foreground tabular-nums">{mastery}%</p>
              <p className="text-[12px] text-muted-foreground mt-1">mastery · target {prep.targetScore}%</p>
            </div>
          )}
        </div>
        {topic && topic.keyPoints.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {topic.keyPoints.map((k, i) => <span key={i} className="text-[12px] px-2.5 py-1 rounded-full bg-muted text-foreground [&_p]:inline [&_p]:my-0"><MathMarkdown>{k}</MathMarkdown></span>)}
          </div>
        )}
      </Panel>

      {!allTopics && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {TABS.map(t => {
            const done = topic && t.id !== 'chat' && !!prep.completed?.[`${topic.id}:${t.id}`];
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`shrink-0 h-10 px-4 rounded-full text-[13px] font-semibold inline-flex items-center gap-1.5 border transition-colors ${tab === t.id ? 'bg-foreground text-background border-foreground' : 'border-border bg-card hover:border-primary/40'}`}>
                <t.icon className="w-4 h-4" /> {t.label} {done && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
              </button>
            );
          })}
        </div>
      )}

      <Panel className="min-h-[360px]">
        {tab === 'chat' ? (
          <TopicChat prep={prep} topic={topic ?? null} loadMaterial={loadMaterial} />
        ) : (
          <>
            {(tab === 'quiz' || tab === 'exercises' || tab === 'podcast') && (
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                {tab === 'podcast'
                  ? <div className="flex gap-1.5 overflow-x-auto no-scrollbar">{PODCAST_STYLES.map(s => (
                      <button key={s.id} onClick={() => setStyle(s.id)} className={`shrink-0 h-8 px-3 rounded-full text-[12px] font-semibold border ${style === s.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}>{s.label}</button>
                    ))}</div>
                  : <Segmented options={[{ id: 'easier', label: 'Easier' }, { id: 'similar', label: 'Exam level' }, { id: 'harder', label: 'Harder' }] as const} value={difficulty} onChange={setDifficulty} />}
                {state === 'ready' && (
                  <button onClick={generate} className="text-[12px] font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" /> New set · {STUDY_COSTS[tab as keyof typeof STUDY_COSTS]} Sparks</button>
                )}
              </div>
            )}

            {state === 'loading' && <div className="h-48 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}

            {(state === 'idle' || state === 'error') && (
              <div className="max-w-md mx-auto text-center py-10">
                <span className="w-14 h-14 rounded-2xl bg-primary/10 text-primary grid place-items-center mx-auto mb-4"><meta.icon className="w-6 h-6" /></span>
                <p className="font-heading text-xl text-foreground">{meta.label}</p>
                <p className="text-[14px] text-muted-foreground mt-1.5">{meta.blurb}</p>
                {error && <p className="mt-3 text-[13px] text-rose-600">{error}</p>}
                <button onClick={generate} className="mt-5 h-11 px-5 rounded-full bg-primary text-primary-foreground font-semibold text-sm inline-flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> {error ? 'Try again' : `Create ${meta.label.toLowerCase()}`}
                  <span className="text-[12px] opacity-80 inline-flex items-center gap-0.5"><Zap className="w-3 h-3" />{STUDY_COSTS[tab as keyof typeof STUDY_COSTS]}</span>
                </button>
                <p className="text-[12px] text-muted-foreground mt-2">Made once from your notes, then saved here.</p>
              </div>
            )}

            {state === 'generating' && (
              <div className="max-w-md mx-auto text-center py-12">
                <motion.span className="w-14 h-14 rounded-2xl bg-primary/10 text-primary grid place-items-center mx-auto mb-4"
                  animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.4 }}><Sparkles className="w-6 h-6" /></motion.span>
                <p className="font-semibold text-foreground">ET is writing your {meta.label.toLowerCase()}…</p>
                <p className="text-[13px] text-muted-foreground mt-1">Using your notes for {topic?.title}.</p>
              </div>
            )}

            {state === 'ready' && loaded && loaded.key === key && (
              <motion.div key={key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                {tab === 'lesson' && <LessonView lesson={loaded.data as LessonAsset} done={doneHere} onComplete={() => finish(60)} />}
                {tab === 'flashcards' && <FlashcardsView cards={(loaded.data as { cards: Flashcard[] }).cards} onComplete={finish} />}
                {tab === 'quiz' && <QuizView questions={(loaded.data as { questions: QuizQuestion[] }).questions} onComplete={finish} />}
                {tab === 'truefalse' && <TrueFalseView items={(loaded.data as { items: TrueFalseItem[] }).items} onComplete={finish} />}
                {tab === 'exercises' && <ExercisesView exercises={(loaded.data as { exercises: Exercise[] }).exercises} onComplete={finish} />}
                {tab === 'podcast' && <PodcastPlayer key={key} podcast={loaded.data as PodcastAsset} onComplete={() => finish(55)} />}
              </motion.div>
            )}
          </>
        )}
      </Panel>
    </DashPage>
  );
}

function TopicChat({ prep, topic, loadMaterial }: { prep: ExamPrep; topic: StudyTopic | null; loadMaterial: () => Promise<string> }) {
  const storeKey = `ps-prepchat-${prep.id}-${topic?.id ?? 'all'}`;
  const [messages, setMessages] = useState<{ role: 'student' | 'tutor'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(storeKey) ?? '[]'); if (Array.isArray(s)) setMessages(s); } catch { /* fresh */ }
  }, [storeKey]);
  useEffect(() => { try { localStorage.setItem(storeKey, JSON.stringify(messages.slice(-40))); } catch { /* full */ } }, [messages, storeKey]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages, streaming]);

  const send = async (text?: string) => {
    const t = (text ?? input).trim();
    if (!t || streaming !== null) return;
    setInput('');
    const history = messages;
    setMessages(m => [...m, { role: 'student', text: t }]);
    setStreaming('');
    try {
      const full = await streamText('/api/study/prep/chat', {
        message: t, history, topic, subject: prep.subject, material: await loadMaterial(), level: prep.level, language: prep.language,
      }, setStreaming);
      setMessages(m => [...m, { role: 'tutor', text: full }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ET is unavailable.');
    } finally { setStreaming(null); }
  };

  const starters = topic
    ? [`Explain ${topic.title} simply`, 'What’s most likely to come up in the exam?', 'Give me a worked example', 'What mistakes do students make here?']
    : ['Summarise everything I need to know', 'Which topics are hardest?', 'Make me a one-page cheat sheet', 'What should I revise tonight?'];

  return (
    <div className="flex flex-col h-[560px]">
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 && streaming === null && (
          <div className="text-center py-8">
            <p className="font-heading text-xl text-foreground">Talk to your notes</p>
            <p className="text-[13px] text-muted-foreground mt-1">ET answers from your own material first, and tells you when it doesn&apos;t cover something.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {starters.map(s => <button key={s} onClick={() => send(s)} className="text-[13px] px-3 py-1.5 rounded-full border border-border hover:border-primary/50 hover:bg-primary/5">{s}</button>)}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'student' ? 'justify-end' : 'gap-2.5'}`}>
            {m.role === 'tutor' && <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-[11px] font-bold grid place-items-center shrink-0">ET</span>}
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] ${m.role === 'student' ? 'bg-foreground text-background rounded-tr-md whitespace-pre-wrap' : 'bg-primary/[0.06] border border-primary/15 rounded-tl-md'}`}>
              {m.role === 'tutor' ? <div className="prose prose-sm max-w-none [&_p]:my-1"><MathMarkdown>{m.text}</MathMarkdown></div> : m.text}
            </div>
          </div>
        ))}
        {streaming !== null && (
          <div className="flex gap-2.5">
            <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-[11px] font-bold grid place-items-center shrink-0">ET</span>
            <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-primary/[0.06] border border-primary/15 px-4 py-2.5 text-[14px]">
              {streaming ? <div className="prose prose-sm max-w-none [&_p]:my-1"><MathMarkdown>{streaming}</MathMarkdown></div> : <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="mt-3 flex items-end gap-2">
        <textarea value={input} onChange={e => setInput(e.target.value)} rows={1}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={topic ? `Ask about ${topic.title}…` : 'Ask anything about your material…'}
          className="flex-1 resize-none max-h-32 rounded-2xl border border-border bg-background px-4 py-2.5 text-[14px] outline-none focus:border-primary" />
        <button onClick={() => send()} disabled={!input.trim() || streaming !== null} aria-label="Send"
          className="w-10 h-10 rounded-full bg-primary text-primary-foreground grid place-items-center disabled:opacity-40">
          {streaming !== null ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
