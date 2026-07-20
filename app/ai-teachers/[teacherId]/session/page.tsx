'use client';

/**
 * Live AI teacher session — an interactive classroom.
 * Layout: teacher stage (talking view) on top on mobile / left on desktop;
 * beneath it a tabbed panel with the live Chat, the WORKBOARD (quizzes and
 * practice problems the teacher assigns, checked in real time) and Notes.
 * Replies stream token-by-token and are spoken with the human AI voice.
 */

import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, X, Send, Loader2, Volume2, VolumeX, Globe, Sparkles,
  MessageSquare, ClipboardList, StickyNote, CheckCircle2, XCircle,
  Lightbulb, PenSquare, BookOpen, Wand2,
} from 'lucide-react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { AI_TEACHERS } from '@/lib/ai-teachers';
import { MathMarkdown } from '@/components/math-markdown';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' }, { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'es', label: 'Español', flag: '🇪🇸' }, { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' }, { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'zh', label: '中文', flag: '🇨🇳' }, { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ur', label: 'اردو', flag: '🇵🇰' }, { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' }, { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' }, { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'sw', label: 'Kiswahili', flag: '🇰🇪' },
];

type Msg = { role: 'user' | 'model'; text: string };

interface QuizItem {
  kind: 'quiz';
  id: number;
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
  chosen?: string;
}
interface ProblemItem {
  kind: 'problem';
  id: number;
  prompt: string;
  hint?: string;
  solution?: string;
  submitted?: boolean;
  showHint?: boolean;
}
type BoardItem = QuizItem | ProblemItem;

/** Pull ```QUIZ / ```PROBLEM blocks out of a reply; returns cleaned prose +
 * parsed board items. Tolerates malformed JSON by leaving text untouched. */
function extractBoardItems(text: string, nextId: () => number): { prose: string; items: BoardItem[] } {
  const items: BoardItem[] = [];
  const prose = text.replace(/```(QUIZ|PROBLEM)\s*\n?([\s\S]*?)```/g, (full, kind: string, body: string) => {
    try {
      const data = JSON.parse(body.trim());
      if (kind === 'QUIZ' && data.question && Array.isArray(data.options)) {
        items.push({ kind: 'quiz', id: nextId(), question: data.question, options: data.options.map(String), answer: String(data.answer ?? ''), explanation: data.explanation });
        return '';
      }
      if (kind === 'PROBLEM' && data.prompt) {
        items.push({ kind: 'problem', id: nextId(), prompt: data.prompt, hint: data.hint, solution: data.solution });
        return '';
      }
    } catch { /* leave malformed block visible */ }
    return full;
  }).replace(/\n{3,}/g, '\n\n').trim();
  return { prose, items };
}

const QUICK_ACTIONS = [
  { icon: <ClipboardList className="w-3.5 h-3.5" />, label: 'Quiz me', prompt: 'Give me a short quiz on what we just covered (or your subject if we just started).' },
  { icon: <PenSquare className="w-3.5 h-3.5" />, label: 'Practice problem', prompt: 'Give me one practice problem to solve on the board.' },
  { icon: <Lightbulb className="w-3.5 h-3.5" />, label: 'Explain simpler', prompt: 'Explain that again more simply, with an everyday example.' },
  { icon: <BookOpen className="w-3.5 h-3.5" />, label: 'New topic', prompt: 'Suggest three topics you could teach me right now, briefly.' },
];

export default function TeacherSessionPage({ params }: { params: Promise<{ teacherId: string }> }) {
  const { teacherId } = use(params);
  const router = useRouter();
  const { user, loading } = useAuthSTORE();
  const teacher = AI_TEACHERS.find((t) => t.id === teacherId);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [board, setBoard] = useState<BoardItem[]>([]);
  const [tab, setTab] = useState<'chat' | 'board' | 'notes'>('chat');
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [lang, setLang] = useState('en');
  const [langOpen, setLangOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [score, setScore] = useState({ right: 0, total: 0 });

  const endRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const greeted = useRef(false);
  const idCounter = useRef(0);
  const nextId = () => ++idCounter.current;
  const boardBadge = useRef(0); // unseen board items while on another tab
  const [unseenBoard, setUnseenBoard] = useState(0);

  /* ── boot ── */
  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(`/ai-teachers/${teacherId}/session`)}`);
  }, [loading, user, router, teacherId]);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('pocket-school-lang') : null;
    if (stored) setLang(stored);
    const savedNotes = typeof window !== 'undefined' ? localStorage.getItem(`ps-notes-${teacherId}`) : null;
    if (savedNotes) setNotes(savedNotes);
  }, [teacherId]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; if (audioRef.current) audioRef.current.pause(); };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamingText, thinking]);

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem(`ps-notes-${teacherId}`, notes);
  }, [notes, teacherId]);

  /* ── voice ── */
  const speak = async (text: string) => {
    if (!voiceOn || !text.trim()) return;
    const clean = text.replace(/\$\$?[^$]*\$\$?/g, ' ').replace(/[*#`_>|]/g, '').slice(0, 1200);
    try {
      setSpeaking(true);
      const res = await fetch('/api/ai/audio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: clean, voice: 'Kore' }),
      });
      const type = res.headers.get('content-type') ?? '';
      if (res.ok && type.includes('audio')) {
        const url = URL.createObjectURL(await res.blob());
        if (audioRef.current) audioRef.current.pause();
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
        audio.onerror = () => setSpeaking(false);
        audio.play().catch(() => setSpeaking(false));
        return;
      }
    } catch { /* fall through */ }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(clean);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
    } else setSpeaking(false);
  };

  /* ── streaming ask ── */
  const ask = async (text: string, history: Msg[]) => {
    setThinking(true);
    setStreamingText('');
    let full = '';
    try {
      const res = await fetch('/api/ai/tutor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          mode: 'college',
          persona: teacher ? `${teacher.name}, ${teacher.title}` : undefined,
          lessonContext: teacher ? `Subjects: ${teacher.subjects.join(', ')}` : undefined,
          language: lang,
          workboard: true,
          stream: true,
          history: history.map(m => ({ role: m.role, text: m.text })),
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        // Hide raw board blocks from the live stream view.
        setStreamingText(full.replace(/```(QUIZ|PROBLEM)[\s\S]*?(```|$)/g, '\n📋 *adding to your board…*\n'));
      }

      const { prose, items } = extractBoardItems(full, nextId);
      if (items.length) {
        setBoard(prev => [...prev, ...items]);
        if (tab !== 'board') { boardBadge.current += items.length; setUnseenBoard(boardBadge.current); }
      }
      const finalText = prose || (items.length ? 'I put something on your board — take a look! 📋' : '…');
      setMessages(prev => [...prev, { role: 'model', text: finalText }]);
      speak(prose);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'model', text: `Sorry — ${e?.message || 'connection error'}. Try again.` }]);
    } finally {
      setThinking(false);
      setStreamingText(null);
    }
  };

  /* greet */
  useEffect(() => {
    if (greeted.current || !teacher || !user || loading) return;
    greeted.current = true;
    ask(`Greet me warmly as ${teacher.name} in 2 short sentences, then ask what I'd like to learn today. Do not add a quiz yet.`, []);
  }, [teacher, user, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = (text?: string) => {
    const t = (text ?? input).trim();
    if (!t || thinking) return;
    const next = [...messages, { role: 'user' as const, text: t }];
    setMessages(next);
    setInput('');
    setTab('chat');
    ask(t, next);
  };

  /* board interactions */
  const answerQuiz = (id: number, option: string) => {
    setBoard(prev => prev.map(b => (b.kind === 'quiz' && b.id === id && !b.chosen) ? { ...b, chosen: option } : b));
    const item = board.find(b => b.id === id) as QuizItem | undefined;
    if (item && !item.chosen) {
      const correct = option.trim().toLowerCase() === item.answer.trim().toLowerCase();
      setScore(s => ({ right: s.right + (correct ? 1 : 0), total: s.total + 1 }));
      if (!correct) {
        // Ask the teacher to re-teach the missed concept, in real time.
        const followUp = `On the quiz "${item.question}" I chose "${option}" but the correct answer was "${item.answer}". Briefly explain why my choice is wrong and how to think about it correctly.`;
        const next = [...messages, { role: 'user' as const, text: followUp }];
        setMessages(next);
        ask(followUp, next);
      }
    }
  };

  const checkProblem = (id: number, answer: string) => {
    const item = board.find(b => b.id === id) as ProblemItem | undefined;
    if (!item || !answer.trim()) return;
    setBoard(prev => prev.map(b => b.id === id ? { ...b, submitted: true } : b));
    const msg = `Please check my answer.\nProblem: "${item.prompt}"\nMy answer / working: "${answer}"\nMark it, show exactly where I went wrong if incorrect, re-teach that step, and give me one similar follow-up problem.`;
    const next = [...messages, { role: 'user' as const, text: msg }];
    setMessages(next);
    setTab('chat');
    ask(msg, next);
  };

  if (!teacher) {
    return (
      <div className="fixed inset-0 bg-[#0A0A0F] text-white flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-lg mb-4">Teacher not found.</p>
          <Link href="/ai-teachers" className="text-blue-400 underline">Back to AI Teachers</Link>
        </div>
      </div>
    );
  }
  if (loading || !user) {
    return (
      <div className="fixed inset-0 bg-[#0A0A0F] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const accent = teacher.accentColor;

  return (
    <div className="fixed inset-0 bg-[#07070E] text-white overflow-hidden flex flex-col">
      {/* ── Top bar ── */}
      <header className="h-12 px-3 sm:px-5 flex items-center justify-between border-b border-white/[0.06] shrink-0 bg-[#0D0D18] z-20">
        <Link href="/ai-teachers" className="flex items-center gap-2 text-sm font-semibold text-white/60 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /><span className="hidden sm:inline">AI Teachers</span>
        </Link>
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-[11px] font-bold tracking-widest uppercase text-white/80 truncate">Live · {teacher.name}</span>
          {score.total > 0 && (
            <span className="hidden sm:inline text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">
              {score.right}/{score.total} correct
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <div className="relative">
            <button onClick={() => setLangOpen(o => !o)} className="flex items-center gap-1 text-white/70 hover:text-white text-xs px-2 py-1.5 rounded-lg hover:bg-white/5" title="Language">
              <Globe className="w-4 h-4" /> {LANGUAGES.find(l => l.code === lang)?.flag}
            </button>
            {langOpen && (
              <div className="absolute top-full right-0 mt-1 w-40 max-h-64 overflow-y-auto rounded-xl bg-[#15161c] border border-white/10 shadow-2xl py-1 z-40">
                {LANGUAGES.map(l => (
                  <button key={l.code} onClick={() => { setLang(l.code); setLangOpen(false); localStorage.setItem('pocket-school-lang', l.code); }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left ${l.code === lang ? 'bg-white/10 font-semibold' : 'text-white/70 hover:bg-white/5'}`}>
                    <span>{l.flag}</span> {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => { setVoiceOn(v => !v); if (voiceOn && audioRef.current) audioRef.current.pause(); }}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/5" title={voiceOn ? 'Mute voice' : 'Unmute voice'}>
            {voiceOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <Link href="/ai-teachers" className="flex items-center gap-1.5 text-xs font-semibold text-white/50 hover:text-white/90 px-2.5 py-1 rounded-full hover:bg-white/[0.07]" title="End session">
            <X className="w-3.5 h-3.5" /><span className="hidden sm:inline">End</span>
          </Link>
        </div>
      </header>

      {/* ── Body: stacked on mobile (stage on top), side-by-side on desktop ── */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row">

        {/* Teacher stage — the talking view */}
        <div className="relative shrink-0 lg:shrink lg:w-[36%] h-[30dvh] lg:h-auto flex items-center justify-center border-b lg:border-b-0 lg:border-r border-white/[0.06] overflow-hidden">
          <div className="absolute inset-0 opacity-40" style={{ background: `radial-gradient(ellipse 70% 60% at 50% 45%, ${accent}45, transparent)` }} />
          <div className="relative text-center px-4">
            <motion.div
              animate={speaking ? { scale: [1, 1.05, 1] } : thinking ? { scale: [1, 1.02, 1] } : { scale: 1 }}
              transition={{ repeat: (speaking || thinking) ? Infinity : 0, duration: speaking ? 0.65 : 1.4 }}
              className="w-24 h-24 sm:w-32 sm:h-32 lg:w-48 lg:h-48 rounded-full mx-auto mb-2 lg:mb-5 overflow-hidden shadow-2xl ring-2"
              style={{ boxShadow: `0 0 70px -12px ${accent}`, borderColor: accent }}
            >
              <img src={teacher.avatarUrl} alt={teacher.name} className="w-full h-full object-cover" style={{ background: `${accent}22` }} />
            </motion.div>
            <h2 className="font-heading text-base sm:text-lg lg:text-2xl leading-tight">{teacher.name}</h2>
            <p className="hidden lg:block text-sm text-white/50 mt-1 max-w-xs mx-auto">{teacher.title}</p>
            {/* Speaking / thinking indicator */}
            <div className="h-6 mt-1.5 lg:mt-3 flex items-center justify-center gap-1">
              {speaking && [0, 1, 2, 3, 4].map(i => (
                <motion.span key={i} className="w-1 rounded-full" style={{ background: accent }}
                  animate={{ height: [5, 16, 5] }} transition={{ repeat: Infinity, duration: 0.55, delay: i * 0.1 }} />
              ))}
              {!speaking && thinking && (
                <span className="text-[11px] text-white/50 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> thinking…
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Chat / Board / Notes panel */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Tabs */}
          <div className="flex items-center border-b border-white/[0.06] bg-[#0B0B14] shrink-0">
            {([
              { id: 'chat', label: 'Chat', icon: <MessageSquare className="w-3.5 h-3.5" /> },
              { id: 'board', label: 'Workboard', icon: <ClipboardList className="w-3.5 h-3.5" />, badge: unseenBoard },
              { id: 'notes', label: 'Notes', icon: <StickyNote className="w-3.5 h-3.5" /> },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); if (t.id === 'board') { boardBadge.current = 0; setUnseenBoard(0); } }}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-colors border-b-2 ${
                  tab === t.id ? 'text-white' : 'text-white/40 hover:text-white/70 border-transparent'
                }`}
                style={tab === t.id ? { borderColor: accent } : undefined}
              >
                {t.icon} {t.label}
                {'badge' in t && t.badge ? (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full text-black" style={{ background: accent }}>{t.badge}</span>
                ) : null}
              </button>
            ))}
            {score.total > 0 && (
              <span className="ml-auto mr-3 sm:hidden text-[10px] font-bold text-emerald-300">{score.right}/{score.total}</span>
            )}
          </div>

          {/* Panel body */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {tab === 'chat' && (
              <div className="px-3 sm:px-6 py-4 space-y-3.5">
                {messages.map((m, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
                    className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.role === 'model' && <img src={teacher.avatarUrl} alt="" className="w-7 h-7 rounded-full bg-white/10 shrink-0 mt-0.5" />}
                    <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === 'user' ? 'bg-white/10 rounded-br-md' : 'bg-white/[0.04] border border-white/10 rounded-bl-md'}`}>
                      {m.role === 'model'
                        ? <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-p:text-white/85"><MathMarkdown>{m.text}</MathMarkdown></div>
                        : <p className="whitespace-pre-wrap">{m.text}</p>}
                    </div>
                  </motion.div>
                ))}
                {/* Live streaming bubble */}
                {streamingText !== null && (
                  <div className="flex gap-2.5">
                    <img src={teacher.avatarUrl} alt="" className="w-7 h-7 rounded-full bg-white/10 shrink-0 mt-0.5" />
                    <div className="max-w-[85%] rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm bg-white/[0.04] border border-white/10">
                      {streamingText
                        ? <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-p:text-white/85"><MathMarkdown>{streamingText}</MathMarkdown></div>
                        : <span className="flex gap-1 items-center h-4">
                            {[0, 1, 2].map(d => (
                              <motion.span key={d} className="w-1.5 h-1.5 rounded-full" style={{ background: accent }}
                                animate={{ opacity: [0.25, 1, 0.25] }} transition={{ repeat: Infinity, duration: 1, delay: d * 0.18 }} />
                            ))}
                          </span>}
                      {streamingText && <motion.span className="inline-block w-1.5 h-4 ml-0.5 align-middle" style={{ background: accent }} animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.7 }} />}
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            )}

            {tab === 'board' && (
              <div className="px-3 sm:px-6 py-4 space-y-3.5">
                {board.length === 0 && (
                  <div className="text-center py-14 text-white/40 text-sm">
                    <ClipboardList className="w-8 h-8 mx-auto mb-3 opacity-50" />
                    Ask for a quiz or a practice problem —<br />everything {teacher.name.split(' ')[0]} assigns lands here.
                    <div className="mt-4">
                      <button onClick={() => send('Give me a short quiz to start.')}
                        className="text-xs font-bold px-4 py-2 rounded-full text-black hover:scale-105 transition-transform" style={{ background: accent }}>
                        <Wand2 className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />Start a quiz
                      </button>
                    </div>
                  </div>
                )}
                <AnimatePresence>
                  {board.map(item => (
                    <motion.div key={item.id} initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                      {item.kind === 'quiz'
                        ? <QuizCard item={item} accent={accent} onAnswer={answerQuiz} />
                        : <ProblemCard item={item} accent={accent} onCheck={checkProblem} />}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {tab === 'notes' && (
              <div className="px-3 sm:px-6 py-4 h-full flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest text-white/50">My session notes</p>
                  <button
                    onClick={() => send('Summarise the key points of our session so far as short revision notes I can copy.')}
                    className="text-[11px] font-semibold flex items-center gap-1.5 text-white/70 hover:text-white"
                  >
                    <Sparkles className="w-3.5 h-3.5" style={{ color: accent }} /> Summarise session
                  </button>
                </div>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Jot down anything — saved automatically on this device."
                  className="flex-1 min-h-[200px] w-full resize-none rounded-2xl bg-white/[0.04] border border-white/10 p-4 text-sm outline-none focus:border-white/25 placeholder:text-white/25 leading-relaxed"
                />
              </div>
            )}
          </div>

          {/* Quick actions + composer */}
          <div className="border-t border-white/[0.06] bg-[#0B0B14] shrink-0">
            <div className="flex gap-1.5 px-3 pt-2 overflow-x-auto no-scrollbar">
              {QUICK_ACTIONS.map(a => (
                <button key={a.label} onClick={() => send(a.prompt)} disabled={thinking}
                  className="flex items-center gap-1.5 shrink-0 text-[11px] font-semibold text-white/60 hover:text-white border border-white/10 hover:border-white/25 rounded-full px-3 py-1.5 transition-colors disabled:opacity-40">
                  {a.icon} {a.label}
                </button>
              ))}
            </div>
            <div className="p-3">
              <div className="flex items-end gap-2 max-w-3xl mx-auto">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder={`Ask ${teacher.name.split(' ')[0]} anything…`}
                  rows={1}
                  className="flex-1 resize-none max-h-28 rounded-2xl bg-white/[0.05] border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-white/25 placeholder:text-white/30"
                />
                <button onClick={() => send()} disabled={thinking || !input.trim()}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-black disabled:opacity-30 shrink-0 hover:scale-105 transition-transform"
                  style={{ background: accent }}>
                  {thinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ── Board cards ────────────────────────────────────────────── */

function QuizCard({ item, accent, onAnswer }: { item: QuizItem; accent: string; onAnswer: (id: number, option: string) => void }) {
  const answered = !!item.chosen;
  const isCorrect = (o: string) => o.trim().toLowerCase() === item.answer.trim().toLowerCase();
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <ClipboardList className="w-3.5 h-3.5" style={{ color: accent }} />
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Quiz</span>
        {answered && (isCorrect(item.chosen!) ?
          <span className="text-[10px] font-bold text-emerald-300 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Correct</span> :
          <span className="text-[10px] font-bold text-red-300 flex items-center gap-1"><XCircle className="w-3 h-3" /> Not quite</span>)}
      </div>
      <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 mb-3"><MathMarkdown>{item.question}</MathMarkdown></div>
      <div className="space-y-1.5">
        {item.options.map((o, i) => {
          const chosen = item.chosen === o;
          const showState = answered && (chosen || isCorrect(o));
          return (
            <button key={i} onClick={() => !answered && onAnswer(item.id, o)} disabled={answered}
              className={`w-full text-left text-sm rounded-xl px-3 py-2 border transition-colors ${
                showState
                  ? isCorrect(o) ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200' : 'border-red-400/60 bg-red-500/10 text-red-200'
                  : 'border-white/10 bg-white/[0.02] text-white/80 hover:border-white/30'
              } ${answered ? 'cursor-default' : ''}`}>
              {String.fromCharCode(65 + i)}. {o}
            </button>
          );
        })}
      </div>
      {answered && item.explanation && (
        <p className="mt-3 text-xs text-white/60 italic border-l-2 pl-3" style={{ borderColor: accent }}>{item.explanation}</p>
      )}
    </div>
  );
}

function ProblemCard({ item, accent, onCheck }: { item: ProblemItem; accent: string; onCheck: (id: number, answer: string) => void }) {
  const [answer, setAnswer] = useState('');
  const [hintShown, setHintShown] = useState(false);
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <PenSquare className="w-3.5 h-3.5" style={{ color: accent }} />
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Practice problem</span>
        {item.submitted && <span className="text-[10px] font-bold text-sky-300">Checking in chat →</span>}
      </div>
      <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 mb-3"><MathMarkdown>{item.prompt}</MathMarkdown></div>
      <textarea
        value={answer}
        onChange={e => setAnswer(e.target.value)}
        placeholder="Write your answer / working here…"
        rows={2}
        className="w-full resize-none rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2 text-sm outline-none focus:border-white/25 placeholder:text-white/25"
      />
      <div className="flex items-center gap-2 mt-2.5">
        <button onClick={() => onCheck(item.id, answer)} disabled={!answer.trim()}
          className="text-xs font-bold px-4 py-2 rounded-full text-black disabled:opacity-40 hover:scale-105 transition-transform" style={{ background: accent }}>
          Check my answer
        </button>
        {item.hint && (
          <button onClick={() => setHintShown(h => !h)} className="text-[11px] font-semibold text-white/50 hover:text-white flex items-center gap-1">
            <Lightbulb className="w-3.5 h-3.5" /> {hintShown ? 'Hide hint' : 'Hint'}
          </button>
        )}
      </div>
      {hintShown && item.hint && (
        <p className="mt-2 text-xs text-amber-200/80 border-l-2 border-amber-400/50 pl-3">{item.hint}</p>
      )}
    </div>
  );
}
