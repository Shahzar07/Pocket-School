'use client';

/**
 * AI Studio — POCO.
 * A Claude-style conversational studio: one thread where POCO both tutors
 * (Socratic chat) and generates any of the 12 study formats as rich turns.
 * Warm charcoal palette, skills composer, session recents, persistent library.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { MathMarkdown } from '@/components/math-markdown';
import {
  Sparkles, ArrowUp, ArrowLeft, Library, MessageSquare,
  FileText, ClipboardList, Network, BookMarked,
  Presentation, Image as ImageIcon, Calculator, FlipHorizontal,
  Loader2, Save, Trash2, Copy, Plus, ChevronRight, User as UserIcon,
  GraduationCap, Building2, Scale, Baby, RefreshCw, X, Menu,
  Video, Headphones, Asterisk,
} from 'lucide-react';
import { MindmapRenderer } from '@/components/mindmap-renderer';
import { InfographicRenderer } from '@/components/infographic-renderer';
import { VideoStoryboard } from '@/components/video-storyboard';
import { VideoPlayer } from '@/components/video-player';
import { SmartAudioPlayer } from '@/components/smart-audio-player';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  getAiGenerations, deleteAiGeneration, saveAiGeneration, type AiGeneration,
} from '@/lib/db';

type FormatId = 'text' | 'flashcards' | 'quiz' | 'slides' | 'notes' | 'summary' | 'problems' | 'glossary' | 'mindmap' | 'infographic' | 'videoScript' | 'audioScript';

const FORMATS: { id: FormatId; label: string; desc: string; icon: React.ReactNode }[] = [
  { id: 'text', label: 'Full Lesson', desc: 'Complete written lesson', icon: <FileText className="w-4 h-4" /> },
  { id: 'flashcards', label: 'Flashcards', desc: 'Quick recall cards', icon: <FlipHorizontal className="w-4 h-4" /> },
  { id: 'quiz', label: 'Quiz', desc: 'Test your knowledge', icon: <ClipboardList className="w-4 h-4" /> },
  { id: 'slides', label: 'Slides', desc: 'Presentation deck', icon: <Presentation className="w-4 h-4" /> },
  { id: 'notes', label: 'Study Notes', desc: 'Concise key points', icon: <BookMarked className="w-4 h-4" /> },
  { id: 'summary', label: 'Summary', desc: 'TL;DR overview', icon: <FileText className="w-4 h-4" /> },
  { id: 'problems', label: 'Practice Problems', desc: 'Worked exercises', icon: <Calculator className="w-4 h-4" /> },
  { id: 'glossary', label: 'Glossary', desc: 'Key terms defined', icon: <BookMarked className="w-4 h-4" /> },
  { id: 'mindmap', label: 'Mind Map', desc: 'Visual concept map', icon: <Network className="w-4 h-4" /> },
  { id: 'infographic', label: 'Infographic', desc: 'Scannable visual facts', icon: <ImageIcon className="w-4 h-4" /> },
  { id: 'videoScript', label: 'Video', desc: 'Playable video lesson', icon: <Video className="w-4 h-4" /> },
  { id: 'audioScript', label: 'Audio', desc: 'AI-voiced summary', icon: <Headphones className="w-4 h-4" /> },
];

const LEVELS = ['Primary', 'GCSE', 'A-Level', 'University', 'Professional'];

const CHAT_MODES: { id: 'k12' | 'college' | 'professional' | 'legal'; label: string; icon: React.ReactNode }[] = [
  { id: 'k12', label: 'K-12', icon: <Baby className="w-3.5 h-3.5" /> },
  { id: 'college', label: 'College', icon: <GraduationCap className="w-3.5 h-3.5" /> },
  { id: 'professional', label: 'Professional', icon: <Building2 className="w-3.5 h-3.5" /> },
  { id: 'legal', label: 'Legal', icon: <Scale className="w-3.5 h-3.5" /> },
];

const SUGGESTIONS = [
  { label: 'Make a video on photosynthesis', format: 'videoScript' as FormatId, text: 'Photosynthesis' },
  { label: 'Quiz me on the French Revolution', format: 'quiz' as FormatId, text: 'The French Revolution' },
  { label: 'Explain quadratic equations', format: null, text: 'Can you explain how to solve quadratic equations?' },
  { label: 'Flashcards for the periodic table', format: 'flashcards' as FormatId, text: 'The periodic table — first 20 elements' },
];

type Turn =
  | { kind: 'user'; text: string; skill?: FormatId }
  | { kind: 'chat'; text: string }
  | { kind: 'gen'; format: FormatId; data: any; prompt: string; saved?: boolean };

interface Chat { id: number; title: string; turns: Turn[] }

/* Warm charcoal palette with a soothing golden-yellow accent */
const C = {
  bg: 'bg-[#1A1918]',
  surface: 'bg-[#242220]',
  surfaceHover: 'hover:bg-[#2B2927]',
  raised: 'bg-[#2B2927]',
  border: 'border-[#3A3733]',
  borderSoft: 'border-[#2E2B28]',
  text: 'text-[#EDEAE4]',
  dim: 'text-[#A8A296]',
  faint: 'text-[#6E695F]',
  accent: '#E8C15E',
  accentInk: '#1A1918',
};

/* Rotating status lines POCO shows while working. */
const THINKING_PHRASES = [
  'Searching and thinking the best solutions for you…',
  'Good question — connecting the dots…',
  'Reasoning it through, step by step…',
  'Almost there — sharpening the answer…',
];
const CREATING_PHRASES = [
  'Welcome, future champ — POCO is on it ✨',
  'Searching and thinking the best solutions for you…',
  'Good idea — there you got! Drafting it now…',
  'Sketching the big picture…',
  'Cooking something brilliant for you…',
  'Polishing every detail…',
];

function PocoWorking({ creating }: { creating: boolean }) {
  const phrases = creating ? CREATING_PHRASES : THINKING_PHRASES;
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % phrases.length), 2400);
    return () => clearInterval(t);
  }, [phrases.length]);
  return (
    <div className="flex gap-3">
      <motion.div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1"
        style={{ background: C.accent }}
        animate={{ rotate: 360, scale: [1, 1.08, 1] }}
        transition={{ rotate: { repeat: Infinity, duration: 3.5, ease: 'linear' }, scale: { repeat: Infinity, duration: 1.6 } }}
      >
        <Asterisk className="w-4 h-4" style={{ color: C.accentInk }} />
      </motion.div>
      <div className="flex items-center gap-2.5 py-2 min-h-[36px]">
        <span className="flex gap-1">
          {[0, 1, 2].map(d => (
            <motion.span key={d} className="w-1.5 h-1.5 rounded-full" style={{ background: C.accent }}
              animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
              transition={{ repeat: Infinity, duration: 1.1, delay: d * 0.18 }} />
          ))}
        </span>
        <AnimatePresence mode="wait">
          <motion.span
            key={idx}
            initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
            transition={{ duration: 0.35 }}
            className="text-sm text-[#A8A296]"
          >
            {phrases[idx]}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function AiStudio() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'chat' | 'library'>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Conversations (session-scoped, like Claude's recents)
  const [chats, setChats] = useState<Chat[]>([{ id: 1, title: 'New chat', turns: [] }]);
  const [activeChatId, setActiveChatId] = useState(1);
  const chat = chats.find(c => c.id === activeChatId) ?? chats[0];

  // Composer
  const [input, setInput] = useState('');
  const [skill, setSkill] = useState<FormatId | null>(null);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState('GCSE');
  const [chatMode, setChatMode] = useState<'k12' | 'college' | 'professional' | 'legal'>('college');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);

  // Library
  const [library, setLibrary] = useState<AiGeneration[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => onAuthStateChanged(auth, u => setUser(u)), []);
  useEffect(() => { if (view === 'library' && user) loadLibrary(); }, [view, user]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat.turns.length, busy]);

  const loadLibrary = async () => {
    if (!user) return;
    setLibraryLoading(true);
    try { setLibrary(await getAiGenerations(user.uid)); }
    catch { setLibrary([]); }
    finally { setLibraryLoading(false); }
  };

  const pushTurns = useCallback((chatId: number, ...turns: Turn[]) => {
    setChats(prev => prev.map(c => {
      if (c.id !== chatId) return c;
      const firstUser = c.turns.length === 0 && turns[0]?.kind === 'user';
      return {
        ...c,
        title: firstUser ? (turns[0] as { text: string }).text.slice(0, 42) : c.title,
        turns: [...c.turns, ...turns],
      };
    }));
  }, []);

  const newChat = () => {
    const id = Math.max(...chats.map(c => c.id)) + 1;
    setChats(prev => [...prev, { id, title: 'New chat', turns: [] }]);
    setActiveChatId(id);
    setView('chat');
    setSkill(null);
    setSidebarOpen(false);
  };

  /* ── Generation turn ── */
  const runGeneration = async (chatId: number, format: FormatId, topic: string) => {
    const lang = (typeof window !== 'undefined' && localStorage.getItem('pocket-school-lang')) || 'en';
    const prompt = `Topic: ${topic}\nSubject: ${subject || 'general'}\nLevel: ${level}`;
    const res = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: prompt, format, language: lang !== 'en' ? lang : undefined }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Generation failed (${res.status})`);
    }
    const data = await res.json();
    pushTurns(chatId, { kind: 'gen', format, data: data.result, prompt });
  };

  /* ── Tutor turn ── */
  const runTutor = async (chatId: number, message: string, history: Turn[]) => {
    const chatTurns = history
      .filter((t): t is Extract<Turn, { kind: 'user' | 'chat' }> => t.kind === 'user' || t.kind === 'chat')
      .map(t => ({ role: t.kind === 'user' ? 'user' : 'model', text: t.text }));
    const res = await fetch('/api/ai/tutor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, mode: chatMode, history: chatTurns }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `POCO hit an error (${res.status})`);
    }
    const data = await res.json();
    pushTurns(chatId, { kind: 'chat', text: data.reply || '…' });
  };

  const submit = async (overrideText?: string, overrideSkill?: FormatId | null) => {
    const text = (overrideText ?? input).trim();
    const useSkill = overrideSkill !== undefined ? overrideSkill : skill;
    if (!text || busy) return;
    const chatId = activeChatId;
    const historySnapshot = chat.turns;
    setInput('');
    setBusy(true);
    setView('chat');
    pushTurns(chatId, { kind: 'user', text, skill: useSkill ?? undefined });
    try {
      if (useSkill) await runGeneration(chatId, useSkill, text);
      else await runTutor(chatId, text, historySnapshot);
    } catch (e: any) {
      pushTurns(chatId, { kind: 'chat', text: `Sorry — ${e?.message || 'something went wrong'}. Try again.` });
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async (turnIndex: number) => {
    const genTurn = chat.turns[turnIndex];
    if (genTurn?.kind !== 'gen' || busy) return;
    // Find the user turn that produced it
    const userTurn = [...chat.turns.slice(0, turnIndex)].reverse().find(t => t.kind === 'user') as Extract<Turn, { kind: 'user' }> | undefined;
    if (!userTurn) return;
    setBusy(true);
    try { await runGeneration(activeChatId, genTurn.format, userTurn.text); }
    catch (e: any) { toast.error(e?.message || 'Regeneration failed.'); }
    finally { setBusy(false); }
  };

  const saveGen = async (turnIndex: number) => {
    const t = chat.turns[turnIndex];
    if (t?.kind !== 'gen') return;
    if (!user) { toast.error('Sign in to save.'); return; }
    setSaving(turnIndex);
    try {
      await saveAiGeneration(user.uid, {
        type: t.format,
        prompt: t.prompt,
        result: typeof t.data === 'string' ? t.data : JSON.stringify(t.data),
        ...(subject ? { subject } : {}),
        ...(level ? { level } : {}),
      });
      setChats(prev => prev.map(c => c.id !== activeChatId ? c : {
        ...c, turns: c.turns.map((x, i) => i === turnIndex && x.kind === 'gen' ? { ...x, saved: true } : x),
      }));
      toast.success('Saved to your library.');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save.');
    } finally {
      setSaving(null);
    }
  };

  const copyGen = async (t: Extract<Turn, { kind: 'gen' }>) => {
    const text = typeof t.data === 'string' ? t.data : JSON.stringify(t.data, null, 2);
    try { await navigator.clipboard.writeText(text); toast.success('Copied.'); }
    catch { toast.error('Failed to copy.'); }
  };

  const removeFromLibrary = async (item: AiGeneration) => {
    if (!user || !confirm('Delete this saved generation?')) return;
    try {
      await deleteAiGeneration(user.uid, item.id);
      setLibrary(l => l.filter(x => x.id !== item.id));
      toast.success('Deleted.');
    } catch (e: any) { toast.error(e?.message || 'Failed.'); }
  };

  const activeFormat = skill ? FORMATS.find(f => f.id === skill) : null;
  const empty = chat.turns.length === 0;

  return (
    <div className={`flex h-screen ${C.bg} ${C.text} overflow-hidden`} style={{ colorScheme: 'dark' }}>

      {/* ── Sidebar ── */}
      <aside className={`${sidebarOpen ? 'flex' : 'hidden'} lg:flex w-[264px] shrink-0 flex-col border-r ${C.borderSoft} bg-[#1F1E1C] absolute lg:static inset-y-0 left-0 z-40`}>
        <div className="p-3">
          <Link href="/" className="flex items-center gap-2.5 px-2 py-2 mb-1">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: C.accent }}>
              <Asterisk className="w-5 h-5 text-[#1A1918]" />
            </div>
            <div>
              <p className="text-[15px] font-bold leading-tight">POCO</p>
              <p className={`text-[10px] ${C.faint} tracking-[0.2em] uppercase leading-tight`}>AI Studio</p>
            </div>
          </Link>

          <button
            onClick={newChat}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold border ${C.border} ${C.surfaceHover} transition-colors`}
          >
            <Plus className="w-4 h-4" style={{ color: C.accent }} /> New chat
          </button>

          <nav className="mt-4 space-y-0.5">
            <button
              onClick={() => { setView('chat'); setSidebarOpen(false); }}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors ${view === 'chat' ? `${C.raised} ${C.text}` : `${C.dim} ${C.surfaceHover}`}`}
            >
              <MessageSquare className="w-4 h-4" /> Chats
            </button>
            <button
              onClick={() => { setView('library'); setSidebarOpen(false); }}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors ${view === 'library' ? `${C.raised} ${C.text}` : `${C.dim} ${C.surfaceHover}`}`}
            >
              <Library className="w-4 h-4" /> Library
            </button>
            <Link href="/ai-teachers" className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm ${C.dim} ${C.surfaceHover} transition-colors group`}>
              <span className="flex items-center gap-2.5"><UserIcon className="w-4 h-4" /> AI Teachers</span>
              <ChevronRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
            </Link>
          </nav>
        </div>

        {/* Recents */}
        <div className="flex-1 overflow-y-auto px-3 pb-2">
          <p className={`px-3 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] ${C.faint}`}>Recents</p>
          <div className="space-y-0.5">
            {[...chats].reverse().map(c => (
              <button
                key={c.id}
                onClick={() => { setActiveChatId(c.id); setView('chat'); setSidebarOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-[13px] truncate transition-colors ${c.id === activeChatId && view === 'chat' ? `${C.raised} ${C.text}` : `${C.dim} ${C.surfaceHover}`}`}
              >
                {c.title}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className={`p-3 border-t ${C.borderSoft} space-y-1`}>
          {user ? (
            <div className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl ${C.surface}`}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-[#1A1918] shrink-0" style={{ background: C.accent }}>
                {(user.email ?? 'U').slice(0, 2).toUpperCase()}
              </div>
              <span className={`text-xs ${C.dim} truncate`}>{user.email}</span>
            </div>
          ) : (
            <Link href="/login" className={`flex items-center gap-2 text-xs ${C.dim} hover:text-white px-2.5 py-2`}>
              <UserIcon className="w-3.5 h-3.5" /> Sign in to save
            </Link>
          )}
          <Link href="/" className={`flex items-center gap-2 text-xs ${C.faint} hover:text-white px-2.5 py-1.5 transition-colors`}>
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Pocket School
          </Link>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className={`lg:hidden flex items-center gap-3 px-4 py-3 border-b ${C.borderSoft}`}>
          <button onClick={() => setSidebarOpen(true)} className={C.dim}><Menu className="w-5 h-5" /></button>
          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: C.accent }}>
            <Asterisk className="w-4 h-4 text-[#1A1918]" />
          </div>
          <span className="text-sm font-bold">POCO</span>
        </div>

        {view === 'library' ? (
          <LibraryView
            user={user} library={library} loading={libraryLoading}
            onDelete={removeFromLibrary} onNew={newChat}
          />
        ) : (
          <>
            {/* Thread */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-4">
                {empty ? (
                  <div className="flex flex-col items-center justify-center text-center pt-[14vh]">
                    <motion.div
                      initial={{ scale: 0.6, opacity: 0, rotate: -30 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      transition={{ type: 'spring', damping: 14 }}
                      className="w-14 h-14 rounded-full flex items-center justify-center mb-6"
                      style={{ background: C.accent, boxShadow: '0 0 48px rgba(232,193,94,0.35)' }}
                    >
                      <Asterisk className="w-8 h-8 text-[#1A1918]" />
                    </motion.div>
                    <h1 className="font-heading text-3xl sm:text-[2.6rem] leading-tight tracking-tight mb-3">
                      Hi, I&apos;m <span style={{ color: C.accent }}>POCO</span>.
                    </h1>
                    <p className={`${C.dim} text-base sm:text-lg max-w-md`}>
                      Ask me anything, or pick a skill and I&apos;ll turn any topic into a lesson, quiz, video, audio and more.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-2.5 mt-10 w-full max-w-xl">
                      {SUGGESTIONS.map(s => (
                        <button
                          key={s.label}
                          onClick={() => { setSkill(s.format); submit(s.text, s.format); }}
                          className={`text-left px-4 py-3 rounded-2xl border ${C.border} ${C.surfaceHover} text-sm ${C.dim} hover:text-white transition-all flex items-center gap-2.5`}
                        >
                          {s.format
                            ? <span style={{ color: C.accent }}>{FORMATS.find(f => f.id === s.format)?.icon}</span>
                            : <MessageSquare className="w-4 h-4" style={{ color: C.accent }} />}
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-7">
                    {chat.turns.map((t, i) => {
                      if (t.kind === 'user') {
                        return (
                          <div key={i} className="flex justify-end">
                            <div className={`max-w-[85%] rounded-2xl rounded-br-md px-4 py-3 ${C.raised}`}>
                              {t.skill && (
                                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-1.5 px-2 py-0.5 rounded-full" style={{ background: 'rgba(232,193,94,0.18)', color: C.accent }}>
                                  {FORMATS.find(f => f.id === t.skill)?.icon}
                                  {FORMATS.find(f => f.id === t.skill)?.label}
                                </span>
                              )}
                              <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{t.text}</p>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={i} className="flex gap-3">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1" style={{ background: C.accent }}>
                            <Asterisk className="w-4 h-4 text-[#1A1918]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            {t.kind === 'chat' ? (
                              <div className="prose prose-sm prose-invert max-w-none prose-headings:font-heading prose-p:text-[#D8D4CC] prose-p:text-[15px] prose-p:leading-relaxed prose-strong:text-white prose-li:text-[#D8D4CC] prose-a:text-[#EAD28A] prose-code:text-[#F0DCA0]">
                                <MathMarkdown>{t.text}</MathMarkdown>
                              </div>
                            ) : (
                              <div>
                                <div className={`rounded-2xl border ${C.borderSoft} ${C.surface} overflow-hidden`}>
                                  <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${C.borderSoft}`}>
                                    <span style={{ color: C.accent }}>{FORMATS.find(f => f.id === t.format)?.icon}</span>
                                    <span className={`text-[11px] font-bold uppercase tracking-[0.15em] ${C.dim}`}>
                                      {FORMATS.find(f => f.id === t.format)?.label}
                                    </span>
                                  </div>
                                  <div className="p-4 sm:p-5">
                                    <GenerationOutput format={t.format} data={t.data} />
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 mt-2">
                                  <button onClick={() => copyGen(t)} className={`p-1.5 rounded-lg ${C.faint} hover:text-white ${C.surfaceHover} transition-colors`} title="Copy">
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => regenerate(i)} disabled={busy} className={`p-1.5 rounded-lg ${C.faint} hover:text-white ${C.surfaceHover} transition-colors`} title="Regenerate">
                                    <RefreshCw className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => saveGen(i)}
                                    disabled={saving === i || t.saved}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${t.saved ? 'text-emerald-400' : `${C.faint} hover:text-white ${C.surfaceHover}`}`}
                                  >
                                    <Save className="w-3.5 h-3.5" />
                                    {saving === i ? 'Saving…' : t.saved ? 'Saved' : 'Save to library'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {busy && <PocoWorking creating={!!skill} />}
                    <div ref={endRef} />
                  </div>
                )}
              </div>
            </div>

            {/* ── Composer ── */}
            <div className="shrink-0 px-4 sm:px-6 pb-5 pt-2">
              <div className="max-w-3xl mx-auto">
                <div className={`rounded-3xl border ${C.border} ${C.surface} shadow-[0_8px_40px_rgba(0,0,0,0.35)] focus-within:border-[#E8C15E]/50 transition-colors`}>
                  {/* Selected skill chip */}
                  {activeFormat && (
                    <div className="px-4 pt-3 -mb-1">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(232,193,94,0.18)', color: C.accent }}>
                        {activeFormat.icon} {activeFormat.label}
                        <button onClick={() => setSkill(null)} className="hover:text-white ml-0.5" title="Back to chat mode"><X className="w-3 h-3" /></button>
                      </span>
                    </div>
                  )}
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
                    }}
                    placeholder={activeFormat ? `What topic should the ${activeFormat.label.toLowerCase()} cover?` : 'Ask POCO anything…'}
                    rows={2}
                    disabled={busy}
                    className={`w-full bg-transparent outline-none resize-none px-4 pt-3 pb-1 text-[15px] ${C.text} placeholder:text-[#6E695F]`}
                  />
                  <div className="flex items-center gap-1.5 px-3 pb-3 flex-wrap">
                    {/* Skills picker */}
                    <div className="relative">
                      <button
                        onClick={() => setSkillsOpen(o => !o)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${C.border} ${C.dim} hover:text-white ${C.surfaceHover} transition-colors`}
                      >
                        <Sparkles className="w-3.5 h-3.5" style={{ color: C.accent }} /> Skills
                      </button>
                      <AnimatePresence>
                        {skillsOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: 6, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 6, scale: 0.98 }}
                            transition={{ duration: 0.12 }}
                            className={`absolute bottom-full mb-2 left-0 w-[290px] sm:w-[330px] rounded-2xl border ${C.border} bg-[#242220] shadow-2xl p-2 z-30`}
                          >
                            <p className={`px-2 pt-1 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] ${C.faint}`}>POCO&apos;s skills</p>
                            <div className="grid grid-cols-2 gap-1 max-h-72 overflow-y-auto">
                              <button
                                onClick={() => { setSkill(null); setSkillsOpen(false); inputRef.current?.focus(); }}
                                className={`flex items-start gap-2 p-2 rounded-xl text-left transition-colors ${!skill ? C.raised : C.surfaceHover}`}
                              >
                                <MessageSquare className="w-4 h-4 mt-0.5 shrink-0" style={{ color: C.accent }} />
                                <span>
                                  <span className="block text-xs font-semibold">Tutor chat</span>
                                  <span className={`block text-[10px] ${C.faint}`}>Socratic guidance</span>
                                </span>
                              </button>
                              {FORMATS.map(f => (
                                <button
                                  key={f.id}
                                  onClick={() => { setSkill(f.id); setSkillsOpen(false); inputRef.current?.focus(); }}
                                  className={`flex items-start gap-2 p-2 rounded-xl text-left transition-colors ${skill === f.id ? C.raised : C.surfaceHover}`}
                                >
                                  <span className="mt-0.5 shrink-0" style={{ color: C.accent }}>{f.icon}</span>
                                  <span>
                                    <span className="block text-xs font-semibold">{f.label}</span>
                                    <span className={`block text-[10px] ${C.faint}`}>{f.desc}</span>
                                  </span>
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Filters */}
                    <input
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      placeholder="Subject"
                      className={`w-24 sm:w-28 px-3 py-1.5 rounded-full text-xs border ${C.border} bg-transparent outline-none ${C.dim} placeholder:text-[#6E695F] focus:text-white transition-colors`}
                    />
                    <select
                      value={level}
                      onChange={e => setLevel(e.target.value)}
                      className={`px-2.5 py-1.5 rounded-full text-xs border ${C.border} bg-[#242220] outline-none ${C.dim} cursor-pointer`}
                    >
                      {LEVELS.map(l => <option key={l}>{l}</option>)}
                    </select>
                    {!skill && (
                      <select
                        value={chatMode}
                        onChange={e => setChatMode(e.target.value as typeof chatMode)}
                        className={`px-2.5 py-1.5 rounded-full text-xs border ${C.border} bg-[#242220] outline-none ${C.dim} cursor-pointer`}
                        title="Tutor mode"
                      >
                        {CHAT_MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                      </select>
                    )}

                    <span className="flex-1" />
                    <button
                      onClick={() => submit()}
                      disabled={busy || !input.trim()}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[#1A1918] disabled:opacity-30 transition-all hover:scale-105 active:scale-95"
                      style={{ background: C.accent }}
                      title="Send"
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                </div>
                <p className={`text-center text-[10px] ${C.faint} mt-2`}>
                  POCO can make mistakes — double-check important answers. {activeFormat ? `Skill: ${activeFormat.label} · ` : ''}{level}
                </p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

/* ─── Library view ─────────────────────────────────────────── */

function LibraryView({ user, library, loading, onDelete, onNew }: {
  user: User | null; library: AiGeneration[]; loading: boolean;
  onDelete: (item: AiGeneration) => void; onNew: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10">
        <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h2 className="font-heading text-3xl sm:text-4xl tracking-tight">Library</h2>
            <p className={`${C.dim} mt-1 text-sm`}>Everything you&apos;ve saved — revisit anytime.</p>
          </div>
          <button
            onClick={onNew}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-[#1A1918] text-sm font-semibold transition-transform hover:scale-105"
            style={{ background: C.accent }}
          >
            <Plus className="w-4 h-4" /> New chat
          </button>
        </div>

        {!user && (
          <div className="text-center py-24">
            <Library className={`w-8 h-8 mx-auto mb-4 ${C.faint}`} />
            <p className={`text-sm ${C.dim} mb-3`}>Sign in to save generations to your library.</p>
            <Link href="/login" className="text-sm font-semibold hover:underline" style={{ color: C.accent }}>Sign in</Link>
          </div>
        )}

        {user && loading && (
          <div className="grid sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className={`h-32 ${C.surface} animate-pulse rounded-2xl`} />)}
          </div>
        )}

        {user && !loading && library.length === 0 && (
          <div className="text-center py-24">
            <Sparkles className={`w-8 h-8 mx-auto mb-4 ${C.faint}`} />
            <p className={`text-sm ${C.dim}`}>Nothing saved yet — generate something with POCO and hit &ldquo;Save to library&rdquo;.</p>
          </div>
        )}

        {user && !loading && library.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-4">
            {library.map((item, i) => {
              const fmt = FORMATS.find(f => f.id === item.type);
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`${C.surface} border ${C.borderSoft} rounded-2xl p-5 hover:border-[#4A463F] transition-colors`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {fmt && <span style={{ color: C.accent }}>{fmt.icon}</span>}
                      <span className={`text-[11px] font-bold uppercase tracking-[0.15em] ${C.dim}`}>{fmt?.label ?? item.type}</span>
                    </div>
                    <button onClick={() => onDelete(item)} className={`${C.faint} hover:text-red-400 transition-colors`} title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm font-semibold mb-2">{item.prompt.split('\n')[0].replace(/^Topic:\s*/i, '')}</p>
                  <p className={`text-xs ${C.dim} line-clamp-3 whitespace-pre-wrap`}>
                    {(typeof item.result === 'string' ? item.result : JSON.stringify(item.result)).slice(0, 300)}
                    {item.result.length > 300 ? '…' : ''}
                  </p>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Generation output renderer ───────────────────────────── */

const PROSE_CLASSES = 'prose prose-sm prose-invert max-w-none prose-headings:font-heading prose-headings:text-white prose-p:text-[#D8D4CC] prose-strong:text-white prose-li:text-[#D8D4CC] prose-a:text-[#EAD28A] prose-blockquote:border-l-[#E8C15E] prose-blockquote:text-[#A8A296] prose-hr:border-[#3A3733] prose-code:text-[#F0DCA0]';

function GenerationOutput({ format, data }: { format: FormatId; data: any }) {
  if (format === 'flashcards' && Array.isArray(data)) {
    return (
      <div className="grid sm:grid-cols-2 gap-3">
        {data.map((card: any, i: number) => (
          <div key={i} className="rounded-xl bg-[#1F1E1C] border border-[#2E2B28] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#EAD28A' }}>Question</p>
            <p className="text-sm text-white mb-3">{card.question}</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400 mb-2">Answer</p>
            <p className="text-sm text-[#D8D4CC]">{card.answer}</p>
          </div>
        ))}
      </div>
    );
  }
  if (format === 'quiz' && Array.isArray(data)) {
    return (
      <div className="space-y-4">
        {data.map((q: any, i: number) => (
          <div key={i} className="rounded-xl bg-[#1F1E1C] border border-[#2E2B28] p-4">
            <p className="text-sm font-semibold text-white mb-3">{i + 1}. {q.question}</p>
            <ul className="space-y-1.5 mb-3">
              {q.options?.map((opt: string, j: number) => (
                <li key={j} className={`text-sm rounded-lg px-3 py-2 ${q.answer === String.fromCharCode(65 + j) || q.answer === opt ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-white/[0.02] text-[#D8D4CC] border border-transparent'}`}>
                  {String.fromCharCode(65 + j)}. {opt}
                </li>
              ))}
            </ul>
            {q.explanation && <p className="text-xs text-[#A8A296] italic">{q.explanation}</p>}
          </div>
        ))}
      </div>
    );
  }
  if (format === 'slides' && Array.isArray(data)) {
    return (
      <div className="space-y-4">
        {data.map((slide: any, i: number) => (
          <div key={i} className="rounded-xl bg-gradient-to-br from-[#2B2320] to-[#1B1917] border border-[#2E2B28] p-6">
            <p className="text-xs text-[#6E695F] mb-2">Slide {i + 1}</p>
            <h3 className="font-heading text-2xl text-white mb-3">{slide.title}</h3>
            <ul className="space-y-2">
              {slide.bullets?.map((b: string, j: number) => (
                <li key={j} className="text-sm text-[#D8D4CC] flex gap-2"><ChevronRight className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#E8C15E' }} />{b}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }
  if (format === 'glossary' && Array.isArray(data)) {
    return (
      <div className="space-y-2">
        {data.map((g: any, i: number) => (
          <div key={i} className="rounded-xl bg-[#1F1E1C] border border-[#2E2B28] p-4">
            <p className="text-sm font-bold mb-1" style={{ color: '#F0DCA0' }}>{g.term}</p>
            <p className="text-xs text-[#D8D4CC]">{g.definition}</p>
          </div>
        ))}
      </div>
    );
  }
  if (format === 'mindmap' && typeof data === 'string') {
    return <MindmapRenderer content={data} dark />;
  }
  if (format === 'infographic' && typeof data === 'string') {
    return <InfographicRenderer content={data} dark />;
  }
  if (format === 'videoScript' && typeof data === 'string') {
    return (
      <div className="space-y-4">
        <VideoPlayer script={data} />
        <details className="rounded-xl bg-[#1F1E1C] border border-[#2E2B28] overflow-hidden">
          <summary className="cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-widest text-[#A8A296] hover:text-white transition-colors">
            View storyboard &amp; script
          </summary>
          <div className="px-4 pb-4">
            <VideoStoryboard script={data} dark />
          </div>
        </details>
      </div>
    );
  }
  if (format === 'audioScript' && typeof data === 'string') {
    return <SmartAudioPlayer script={data} dark />;
  }
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return (
    <div className={PROSE_CLASSES}>
      <MathMarkdown>{text}</MathMarkdown>
    </div>
  );
}
