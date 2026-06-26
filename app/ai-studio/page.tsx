'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import {
  Brain, Sparkles, Send, Search, ArrowLeft, Library, MessageSquare,
  FileText, ClipboardList, Network, BookMarked,
  Presentation, Image as ImageIcon, Calculator, FlipHorizontal,
  Loader2, Save, Trash2, Copy, Plus, History, ChevronRight, Home as HomeIcon, User as UserIcon,
  GraduationCap, Building2, Scale, Baby, Wand2,
} from 'lucide-react';
import { MindmapRenderer } from '@/components/mindmap-renderer';
import { InfographicRenderer } from '@/components/infographic-renderer';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  getAiGenerations, deleteAiGeneration, type AiGeneration,
} from '@/lib/db';

type Panel = 'home' | 'chat' | 'library';
type FormatId = 'text' | 'flashcards' | 'quiz' | 'slides' | 'notes' | 'summary' | 'problems' | 'glossary' | 'mindmap' | 'infographic';

const FORMATS: { id: FormatId; label: string; desc: string; icon: React.ReactNode; gradient: string }[] = [
  { id: 'text', label: 'Full Lesson', desc: 'Complete written lesson', icon: <FileText className="w-4 h-4" />, gradient: 'from-blue-500 to-indigo-600' },
  { id: 'flashcards', label: 'Flashcards', desc: 'Quick recall cards', icon: <FlipHorizontal className="w-4 h-4" />, gradient: 'from-cyan-500 to-blue-600' },
  { id: 'quiz', label: 'Quiz', desc: 'Test your knowledge', icon: <ClipboardList className="w-4 h-4" />, gradient: 'from-amber-500 to-orange-600' },
  { id: 'slides', label: 'Slides', desc: 'Presentation deck', icon: <Presentation className="w-4 h-4" />, gradient: 'from-indigo-500 to-violet-600' },
  { id: 'notes', label: 'Study Notes', desc: 'Concise key points', icon: <BookMarked className="w-4 h-4" />, gradient: 'from-slate-500 to-slate-700' },
  { id: 'summary', label: 'Summary', desc: 'TL;DR overview', icon: <FileText className="w-4 h-4" />, gradient: 'from-emerald-500 to-teal-600' },
  { id: 'problems', label: 'Practice Problems', desc: 'Worked exercises', icon: <Calculator className="w-4 h-4" />, gradient: 'from-orange-500 to-red-600' },
  { id: 'glossary', label: 'Glossary', desc: 'Key terms defined', icon: <BookMarked className="w-4 h-4" />, gradient: 'from-teal-500 to-cyan-600' },
  { id: 'mindmap', label: 'Mind Map', desc: 'Visual concept map', icon: <Network className="w-4 h-4" />, gradient: 'from-fuchsia-500 to-pink-600' },
  { id: 'infographic', label: 'Infographic', desc: 'Scannable visual facts', icon: <ImageIcon className="w-4 h-4" />, gradient: 'from-rose-500 to-pink-600' },
];

const LEVELS = ['Primary', 'GCSE', 'A-Level', 'University', 'Professional'];

const CHAT_MODES: { id: 'k12' | 'college' | 'professional' | 'legal'; label: string; icon: React.ReactNode }[] = [
  { id: 'k12', label: 'K-12', icon: <Baby className="w-3.5 h-3.5" /> },
  { id: 'college', label: 'College', icon: <GraduationCap className="w-3.5 h-3.5" /> },
  { id: 'professional', label: 'Professional', icon: <Building2 className="w-3.5 h-3.5" /> },
  { id: 'legal', label: 'Legal', icon: <Scale className="w-3.5 h-3.5" /> },
];

type ChatMessage = { role: 'user' | 'assistant'; text: string };

export default function AiStudio() {
  const [user, setUser] = useState<User | null>(null);
  const [panel, setPanel] = useState<Panel>('home');

  // home/generate
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState('GCSE');
  const [format, setFormat] = useState<FormatId>('text');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ format: FormatId; data: any; prompt: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // chat
  const [chatMode, setChatMode] = useState<'k12' | 'college' | 'professional' | 'legal'>('college');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // library
  const [library, setLibrary] = useState<AiGeneration[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (panel === 'library' && user) loadLibrary();
  }, [panel, user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const loadLibrary = async () => {
    if (!user) return;
    setLibraryLoading(true);
    try {
      const items = await getAiGenerations(user.uid);
      setLibrary(items);
    } catch {
      setLibrary([]);
    } finally {
      setLibraryLoading(false);
    }
  };

  const generate = async () => {
    if (!topic.trim()) { toast.error('What do you want to learn?'); return; }
    setGenerating(true);
    setResult(null);
    try {
      const prompt = `Topic: ${topic.trim()}\nSubject: ${subject || 'general'}\nLevel: ${level}`;
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: prompt, format }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || `Generation failed (${res.status})`);
        return;
      }
      const data = await res.json();
      const newResult = { format, data: data.result, prompt };
      setResult(newResult);
      // Auto-save to library (like Canva — every generation is automatically saved)
      if (user) {
        try {
          await fetch('/api/ai/save-generation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.uid,
              type: format,
              prompt,
              result: typeof data.result === 'string' ? data.result : JSON.stringify(data.result),
              subject,
              level,
            }),
          });
        } catch {}
      }
    } catch (e: any) {
      toast.error(e?.message || 'Generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const saveToLibrary = async () => {
    if (!result || !user) { toast.error(user ? 'Nothing to save.' : 'Sign in to save.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/ai/save-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          type: result.format,
          prompt: result.prompt,
          result: typeof result.data === 'string' ? result.data : JSON.stringify(result.data),
          subject,
          level,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to save.');
        return;
      }
      toast.success('Saved to your library.');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const copyResult = async () => {
    if (!result) return;
    const text = typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard.');
    } catch {
      toast.error('Failed to copy.');
    }
  };

  const sendChat = async () => {
    const message = chatInput.trim();
    if (!message) return;
    const nextHistory: ChatMessage[] = [...chatHistory, { role: 'user', text: message }];
    setChatHistory(nextHistory);
    setChatInput('');
    setChatSending(true);
    try {
      const res = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          mode: chatMode,
          history: chatHistory.map(m => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || `AI failed (${res.status})`);
        setChatHistory(prev => [...prev, { role: 'assistant', text: 'Sorry — I hit an error. Please try again.' }]);
        return;
      }
      const data = await res.json();
      setChatHistory(prev => [...prev, { role: 'assistant', text: data.reply || '…' }]);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to reach AI.');
    } finally {
      setChatSending(false);
    }
  };

  const removeFromLibrary = async (item: AiGeneration) => {
    if (!user) return;
    if (!confirm('Delete this saved generation?')) return;
    try {
      await deleteAiGeneration(user.uid, item.id);
      setLibrary(l => l.filter(x => x.id !== item.id));
      toast.success('Deleted.');
    } catch (e: any) {
      toast.error(e?.message || 'Failed.');
    }
  };

  return (
    <div className="flex h-screen bg-[#05070F] text-slate-100 overflow-hidden relative">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="blob-1 absolute -top-40 -left-32 w-[32rem] h-[32rem] rounded-full bg-[#1A73E8]/20 blur-[120px]" />
        <div className="blob-2 absolute top-1/3 -right-40 w-[36rem] h-[36rem] rounded-full bg-[#7C3AED]/15 blur-[130px]" />
        <div className="blob-3 absolute bottom-0 left-1/4 w-[28rem] h-[28rem] rounded-full bg-cyan-500/10 blur-[110px]" />
      </div>

      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 flex flex-col p-4 shrink-0 bg-white/[0.015] backdrop-blur-2xl z-10">
        <Link href="/" className="flex items-center gap-2.5 mb-8 px-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1A73E8] via-[#3B82F6] to-[#7C3AED] flex items-center justify-center shadow-[0_0_20px_rgba(26,115,232,0.4)]">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-white">AI Pocket School</p>
            <p className="text-[10px] text-slate-400 leading-tight tracking-wide">STUDIO</p>
          </div>
        </Link>

        <nav className="space-y-1">
          <button
            onClick={() => { setPanel('home'); setResult(null); }}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${panel === 'home' ? 'bg-gradient-to-r from-[#1A73E8]/20 to-[#7C3AED]/10 border border-[#1A73E8]/30 text-white shadow-[0_0_24px_rgba(26,115,232,0.12)]' : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'}`}
          >
            <HomeIcon className="w-4 h-4" /> Home
          </button>
          <button
            onClick={() => setPanel('chat')}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${panel === 'chat' ? 'bg-gradient-to-r from-[#1A73E8]/20 to-[#7C3AED]/10 border border-[#1A73E8]/30 text-white shadow-[0_0_24px_rgba(26,115,232,0.12)]' : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'}`}
          >
            <MessageSquare className="w-4 h-4" /> Ask AI
          </button>
          <button
            onClick={() => setPanel('library')}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${panel === 'library' ? 'bg-gradient-to-r from-[#1A73E8]/20 to-[#7C3AED]/10 border border-[#1A73E8]/30 text-white shadow-[0_0_24px_rgba(26,115,232,0.12)]' : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'}`}
          >
            <Library className="w-4 h-4" /> My Library
          </button>
          <Link
            href="/ai-teachers"
            className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 border border-transparent transition-all group"
          >
            <span className="flex items-center gap-3">
              <UserIcon className="w-4 h-4" /> AI Teachers
            </span>
            <ChevronRight className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </nav>

        <div className="mt-auto pt-4 border-t border-white/5">
          {user ? (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1A73E8] to-[#7C3AED] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                {(user.email ?? 'U').slice(0, 2).toUpperCase()}
              </div>
              <span className="text-xs text-slate-300 truncate">{user.email}</span>
            </div>
          ) : (
            <Link href="/login" className="flex items-center gap-2 text-xs text-slate-400 hover:text-white px-2 py-1.5">
              <UserIcon className="w-3.5 h-3.5" /> Sign in to save
            </Link>
          )}
          <Link
            href="/"
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-200 px-2 py-1.5 mt-1 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to website
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto z-10">
        <AnimatePresence mode="wait">
          {panel === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="max-w-4xl mx-auto p-8 sm:p-12"
            >
              {!result && (
                <>
                  <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-slate-300 mb-5">
                      <Sparkles className="w-3 h-3 text-[#60A5FA]" /> AI-Powered Learning
                    </div>
                    <h1 className="font-heading text-5xl sm:text-6xl tracking-tight mb-3">
                      <span className="bg-gradient-to-br from-white via-white to-slate-400 bg-clip-text text-transparent">What do you want</span>
                      <br />
                      <span className="bg-gradient-to-r from-[#60A5FA] via-[#93C5FD] to-[#C4B5FD] bg-clip-text text-transparent">to learn today?</span>
                    </h1>
                    <p className="text-slate-400">
                      Pick a format, enter a topic, get a complete study toolkit in seconds.
                    </p>
                  </div>

                  <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-2 flex items-center mb-5 focus-within:border-[#1A73E8]/60 focus-within:ring-2 focus-within:ring-[#1A73E8]/20 transition-all">
                    <Search className="w-5 h-5 text-slate-500 ml-3 mr-2 shrink-0" />
                    <input
                      type="text"
                      placeholder="e.g. ATP synthesis in mitochondria"
                      value={topic}
                      onChange={e => setTopic(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && generate()}
                      disabled={generating}
                      className="flex-1 min-w-0 bg-transparent outline-none text-base text-white placeholder:text-slate-500 py-2.5"
                    />
                    <button
                      onClick={generate}
                      disabled={generating || !topic.trim()}
                      className="rounded-xl bg-gradient-to-r from-[#1A73E8] via-[#3B82F6] to-[#7C3AED] hover:opacity-90 disabled:opacity-40 px-5 py-2.5 text-sm font-semibold text-white flex items-center gap-2 shrink-0 shadow-[0_0_24px_rgba(26,115,232,0.35)] transition-all"
                    >
                      {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                      {generating ? 'Generating…' : 'Generate'}
                    </button>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 mb-6">
                    <input
                      type="text"
                      placeholder="Subject (e.g. Biology)"
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      disabled={generating}
                      className="bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#1A73E8]/60 placeholder:text-slate-500 text-white transition-colors"
                    />
                    <select
                      value={level}
                      onChange={e => setLevel(e.target.value)}
                      disabled={generating}
                      className="bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#1A73E8]/60 cursor-pointer text-white transition-colors"
                    >
                      {LEVELS.map(l => <option key={l} value={l} className="bg-[#0B0F1A]">{l}</option>)}
                    </select>
                  </div>

                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Choose format</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    {FORMATS.map(f => (
                      <button
                        key={f.id}
                        onClick={() => setFormat(f.id)}
                        disabled={generating}
                        className={`group relative p-3 rounded-xl border text-left transition-all ${
                          format === f.id
                            ? 'bg-[#1A73E8]/10 border-[#1A73E8]/60 ring-1 ring-[#1A73E8]/40 shadow-[0_0_20px_rgba(26,115,232,0.15)]'
                            : 'bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.05]'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-2 shadow-sm`}>
                          <span className="text-white">{f.icon}</span>
                        </div>
                        <p className="text-xs font-semibold text-white">{f.label}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{f.desc}</p>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {result && (
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <button
                      onClick={() => setResult(null)}
                      className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" /> New generation
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={copyResult}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 hover:border-white/20 hover:bg-white/[0.07] text-xs font-semibold text-slate-200 transition-all"
                      >
                        <Copy className="w-3.5 h-3.5" /> Copy
                      </button>
                      <button
                        onClick={saveToLibrary}
                        disabled={saving || !user}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#1A73E8] via-[#3B82F6] to-[#7C3AED] disabled:opacity-40 text-xs font-semibold text-white shadow-[0_0_18px_rgba(26,115,232,0.3)] transition-all"
                      >
                        <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save to library'}
                      </button>
                    </div>
                  </div>
                  <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 sm:p-8">
                    <div className="flex items-center gap-2 mb-5 pb-4 border-b border-white/10">
                      {(() => {
                        const fmt = FORMATS.find(f => f.id === result.format);
                        return fmt ? (
                          <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${fmt.gradient} flex items-center justify-center shrink-0`}>
                            <span className="text-white">{fmt.icon}</span>
                          </div>
                        ) : <Sparkles className="w-4 h-4 text-[#60A5FA]" />;
                      })()}
                      <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                        {FORMATS.find(f => f.id === result.format)?.label ?? result.format}
                      </span>
                    </div>
                    <GenerationOutput format={result.format} data={result.data} />
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {panel === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col h-full"
            >
              <div className="border-b border-white/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 max-w-4xl mx-auto w-full">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1A73E8] via-[#3B82F6] to-[#7C3AED] flex items-center justify-center shadow-[0_0_20px_rgba(26,115,232,0.35)] shrink-0">
                    <Brain className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-heading text-2xl text-white leading-tight">Ask AI</h2>
                    <p className="text-xs text-slate-400">Socratic tutor — guides you to the answer.</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/10 rounded-xl p-1">
                  {CHAT_MODES.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setChatMode(m.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${chatMode === m.id ? 'bg-gradient-to-r from-[#1A73E8] to-[#7C3AED] text-white shadow-[0_0_16px_rgba(26,115,232,0.3)]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                      {m.icon}
                      <span className="hidden sm:inline">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-4">
                {chatHistory.length === 0 && (
                  <div className="text-center py-20 text-slate-500">
                    <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto mb-4">
                      <MessageSquare className="w-6 h-6 opacity-60" />
                    </div>
                    <p className="text-sm">Ask anything. The AI will guide you to the answer.</p>
                  </div>
                )}
                {chatHistory.map((m, i) => (
                  <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1A73E8] to-[#7C3AED] flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      m.role === 'user'
                        ? 'bg-gradient-to-br from-[#1A73E8] to-[#7C3AED] text-white'
                        : 'bg-white/[0.04] border border-white/10 text-slate-100'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.text}</p>
                    </div>
                  </div>
                ))}
                {chatSending && (
                  <div className="flex gap-2.5 justify-start">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1A73E8] to-[#7C3AED] flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      <span className="text-xs text-slate-400">Thinking…</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="border-t border-white/5 p-4 max-w-4xl mx-auto w-full">
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-2 flex items-center focus-within:border-[#1A73E8]/60 focus-within:ring-2 focus-within:ring-[#1A73E8]/20 transition-all">
                  <input
                    type="text"
                    placeholder="Ask anything…"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !chatSending && sendChat()}
                    disabled={chatSending}
                    className="flex-1 min-w-0 bg-transparent outline-none text-sm text-white placeholder:text-slate-500 px-3 py-2"
                  />
                  <button
                    onClick={sendChat}
                    disabled={chatSending || !chatInput.trim()}
                    className="rounded-xl bg-gradient-to-r from-[#1A73E8] via-[#3B82F6] to-[#7C3AED] hover:opacity-90 disabled:opacity-40 p-2.5 text-white shadow-[0_0_18px_rgba(26,115,232,0.3)] transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {panel === 'library' && (
            <motion.div
              key="library"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="max-w-5xl mx-auto p-8 sm:p-12"
            >
              <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
                <div>
                  <h2 className="font-heading text-4xl tracking-tight text-white">My Library</h2>
                  <p className="text-slate-400 mt-1">Saved generations you can revisit anytime.</p>
                </div>
                <button
                  onClick={() => setPanel('home')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#1A73E8] via-[#3B82F6] to-[#7C3AED] text-white text-sm font-semibold shadow-[0_0_20px_rgba(26,115,232,0.3)]"
                >
                  <Plus className="w-4 h-4" /> New generation
                </button>
              </div>

              {!user && (
                <div className="text-center py-20">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto mb-4">
                    <Library className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-400 mb-4">Sign in to save generations to your library.</p>
                  <Link href="/login" className="text-sm font-semibold text-[#60A5FA] hover:underline">Sign in</Link>
                </div>
              )}

              {user && libraryLoading && (
                <div className="grid sm:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-white/[0.03] border border-white/10 animate-pulse rounded-2xl" />)}
                </div>
              )}

              {user && !libraryLoading && library.length === 0 && (
                <div className="text-center py-20">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto mb-4">
                    <History className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-400">Nothing saved yet. Generate something and hit "Save to library".</p>
                </div>
              )}

              {user && !libraryLoading && library.length > 0 && (
                <div className="grid sm:grid-cols-2 gap-4">
                  {library.map((item, i) => {
                    const fmt = FORMATS.find(f => f.id === item.type);
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 hover:border-white/20 hover:bg-white/[0.05] transition-all"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {fmt && (
                              <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${fmt.gradient} flex items-center justify-center shrink-0`}>
                                <span className="text-white">{fmt.icon}</span>
                              </div>
                            )}
                            <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                              {fmt?.label ?? item.type}
                            </span>
                          </div>
                          <button
                            onClick={() => removeFromLibrary(item)}
                            className="text-slate-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm font-semibold text-white mb-2">{item.prompt.split('\n')[0].replace(/^Topic:\s*/i, '')}</p>
                        <p className="text-xs text-slate-400 line-clamp-3 whitespace-pre-wrap">
                          {(typeof item.result === 'string' ? item.result : JSON.stringify(item.result)).slice(0, 300)}
                          {item.result.length > 300 ? '…' : ''}
                        </p>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

/* ─── Generation output renderer ───────────────────────────── */

const PROSE_CLASSES = 'prose prose-sm prose-invert max-w-none prose-headings:font-heading prose-headings:text-white prose-p:text-slate-300 prose-strong:text-white prose-li:text-slate-300 prose-a:text-[#60A5FA] prose-blockquote:border-l-[#1A73E8] prose-blockquote:text-slate-400 prose-hr:border-white/10 prose-code:text-[#93C5FD]';

function GenerationOutput({ format, data }: { format: FormatId; data: any }) {
  if (format === 'flashcards' && Array.isArray(data)) {
    return (
      <div className="grid sm:grid-cols-2 gap-3">
        {data.map((card: any, i: number) => (
          <div key={i} className="rounded-xl bg-white/[0.03] border border-white/10 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#60A5FA] mb-2">Question</p>
            <p className="text-sm text-white mb-3">{card.question}</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400 mb-2">Answer</p>
            <p className="text-sm text-slate-300">{card.answer}</p>
          </div>
        ))}
      </div>
    );
  }
  if (format === 'quiz' && Array.isArray(data)) {
    return (
      <div className="space-y-4">
        {data.map((q: any, i: number) => (
          <div key={i} className="rounded-xl bg-white/[0.03] border border-white/10 p-4">
            <p className="text-sm font-semibold text-white mb-3">{i + 1}. {q.question}</p>
            <ul className="space-y-1.5 mb-3">
              {q.options?.map((opt: string, j: number) => (
                <li key={j} className={`text-sm rounded-lg px-3 py-2 ${q.answer === String.fromCharCode(65 + j) || q.answer === opt ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-white/[0.02] text-slate-300 border border-transparent'}`}>
                  {String.fromCharCode(65 + j)}. {opt}
                </li>
              ))}
            </ul>
            {q.explanation && (
              <p className="text-xs text-slate-400 italic">{q.explanation}</p>
            )}
          </div>
        ))}
      </div>
    );
  }
  if (format === 'slides' && Array.isArray(data)) {
    return (
      <div className="space-y-4">
        {data.map((slide: any, i: number) => (
          <div key={i} className="rounded-xl bg-gradient-to-br from-[#0F1530] to-[#070A14] border border-white/10 p-6">
            <p className="text-xs text-slate-500 mb-2">Slide {i + 1}</p>
            <h3 className="font-heading text-2xl text-white mb-3">{slide.title}</h3>
            <ul className="space-y-2">
              {slide.bullets?.map((b: string, j: number) => (
                <li key={j} className="text-sm text-slate-300 flex gap-2"><ChevronRight className="w-4 h-4 text-[#60A5FA] mt-0.5 shrink-0" />{b}</li>
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
          <div key={i} className="rounded-xl bg-white/[0.03] border border-white/10 p-4">
            <p className="text-sm font-bold text-[#93C5FD] mb-1">{g.term}</p>
            <p className="text-xs text-slate-300">{g.definition}</p>
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
  // text / notes / summary / problems → markdown
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return (
    <div className={PROSE_CLASSES}>
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}
