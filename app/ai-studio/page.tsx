'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import {
  Brain, Sparkles, Send, Search, ArrowLeft, Library, MessageSquare,
  Headphones, Video, FileText, ClipboardList, Network, BookMarked,
  Presentation, Image as ImageIcon, Music, Calculator, FlipHorizontal,
  Loader2, Save, Trash2, Copy, Plus, History, ChevronRight, Home as HomeIcon, User as UserIcon,
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  getAiGenerations, deleteAiGeneration, type AiGeneration,
} from '@/lib/db';

type Panel = 'home' | 'chat' | 'library';
type FormatId = 'text' | 'flashcards' | 'quiz' | 'slides' | 'notes' | 'summary' | 'problems' | 'glossary' | 'mindmap' | 'infographic';

const FORMATS: { id: FormatId; label: string; icon: React.ReactNode; gradient: string }[] = [
  { id: 'text', label: 'Full Lesson', icon: <FileText className="w-4 h-4" />, gradient: 'from-blue-500 to-indigo-600' },
  { id: 'flashcards', label: 'Flashcards', icon: <FlipHorizontal className="w-4 h-4" />, gradient: 'from-cyan-500 to-blue-600' },
  { id: 'quiz', label: 'Quiz', icon: <ClipboardList className="w-4 h-4" />, gradient: 'from-amber-500 to-orange-600' },
  { id: 'slides', label: 'Slides', icon: <Presentation className="w-4 h-4" />, gradient: 'from-indigo-500 to-violet-600' },
  { id: 'notes', label: 'Study Notes', icon: <BookMarked className="w-4 h-4" />, gradient: 'from-slate-500 to-slate-700' },
  { id: 'summary', label: 'Summary', icon: <FileText className="w-4 h-4" />, gradient: 'from-emerald-500 to-teal-600' },
  { id: 'problems', label: 'Practice Problems', icon: <Calculator className="w-4 h-4" />, gradient: 'from-orange-500 to-red-600' },
  { id: 'glossary', label: 'Glossary', icon: <BookMarked className="w-4 h-4" />, gradient: 'from-teal-500 to-cyan-600' },
  { id: 'mindmap', label: 'Mind Map', icon: <Network className="w-4 h-4" />, gradient: 'from-fuchsia-500 to-pink-600' },
  { id: 'infographic', label: 'Infographic', icon: <ImageIcon className="w-4 h-4" />, gradient: 'from-rose-500 to-pink-600' },
];

const LEVELS = ['Primary', 'GCSE', 'A-Level', 'University', 'Professional'];

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
      setResult({ format, data: data.result, prompt });
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
    <div className="flex h-screen bg-[#0A0A0F] text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/10 flex flex-col p-4 shrink-0">
        <Link href="/" className="flex items-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-fuchsia-500 via-violet-600 to-blue-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">AI Pocket School</p>
            <p className="text-[10px] text-slate-400 leading-tight">Studio</p>
          </div>
        </Link>

        <button
          onClick={() => { setPanel('home'); setResult(null); }}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${panel === 'home' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
        >
          <HomeIcon className="w-4 h-4" /> Home
        </button>
        <button
          onClick={() => setPanel('chat')}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${panel === 'chat' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
        >
          <MessageSquare className="w-4 h-4" /> Ask AI
        </button>
        <button
          onClick={() => setPanel('library')}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${panel === 'library' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
        >
          <Library className="w-4 h-4" /> My Library
        </button>

        <div className="mt-auto pt-4 border-t border-white/10">
          {user ? (
            <div className="flex items-center gap-2 px-2 py-1.5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[10px] font-bold">
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
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-white px-2 py-1.5 mt-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to website
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
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
                      <Sparkles className="w-3 h-3 text-fuchsia-400" /> Powered by Gemini 2.5 Pro
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-3">
                      What do you want to learn?
                    </h1>
                    <p className="text-slate-400">
                      Pick a format, enter a topic, get a complete study toolkit in seconds.
                    </p>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-2 flex items-center mb-5 focus-within:border-white/30 transition-colors">
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
                      className="rounded-xl bg-gradient-to-r from-fuchsia-500 via-violet-600 to-blue-600 hover:opacity-90 disabled:opacity-40 px-5 py-2.5 text-sm font-semibold text-white flex items-center gap-2 shrink-0"
                    >
                      {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Generate
                    </button>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 mb-6">
                    <input
                      type="text"
                      placeholder="Subject (e.g. Biology)"
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      disabled={generating}
                      className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-white/30 placeholder:text-slate-500"
                    />
                    <select
                      value={level}
                      onChange={e => setLevel(e.target.value)}
                      disabled={generating}
                      className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-white/30 cursor-pointer"
                    >
                      {LEVELS.map(l => <option key={l} value={l} className="bg-[#0A0A0F]">{l}</option>)}
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
                            ? 'bg-white/10 border-white/30'
                            : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-2`}>
                          <span className="text-white">{f.icon}</span>
                        </div>
                        <p className="text-xs font-semibold text-white">{f.label}</p>
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
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-xs font-semibold text-slate-200"
                      >
                        <Copy className="w-3.5 h-3.5" /> Copy
                      </button>
                      <button
                        onClick={saveToLibrary}
                        disabled={saving || !user}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-fuchsia-500 via-violet-600 to-blue-600 disabled:opacity-40 text-xs font-semibold text-white"
                      >
                        <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save to library'}
                      </button>
                    </div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-4 pb-4 border-b border-white/10">
                      <Sparkles className="w-4 h-4 text-fuchsia-400" />
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
              <div className="border-b border-white/10 p-4 flex items-center justify-between gap-4 max-w-4xl mx-auto w-full">
                <div>
                  <h2 className="text-lg font-bold">Ask AI</h2>
                  <p className="text-xs text-slate-400">Socratic tutor — guides you to the answer.</p>
                </div>
                <select
                  value={chatMode}
                  onChange={e => setChatMode(e.target.value as any)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none cursor-pointer"
                >
                  <option value="k12" className="bg-[#0A0A0F]">K-12 (Simple)</option>
                  <option value="college" className="bg-[#0A0A0F]">College (Academic)</option>
                  <option value="professional" className="bg-[#0A0A0F]">Professional (Concise)</option>
                  <option value="legal" className="bg-[#0A0A0F]">Legal (OSCOLA)</option>
                </select>
              </div>

              <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-4">
                {chatHistory.length === 0 && (
                  <div className="text-center py-20 text-slate-500">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Ask anything. The AI will guide you to the answer.</p>
                  </div>
                )}
                {chatHistory.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      m.role === 'user'
                        ? 'bg-gradient-to-br from-fuchsia-600 to-violet-700 text-white'
                        : 'bg-white/5 border border-white/10 text-slate-100'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.text}</p>
                    </div>
                  </div>
                ))}
                {chatSending && (
                  <div className="flex justify-start">
                    <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      <span className="text-xs text-slate-400">Thinking…</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="border-t border-white/10 p-4 max-w-4xl mx-auto w-full">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-2 flex items-center focus-within:border-white/30">
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
                    className="rounded-xl bg-gradient-to-r from-fuchsia-500 via-violet-600 to-blue-600 hover:opacity-90 disabled:opacity-40 p-2.5 text-white"
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
              className="max-w-4xl mx-auto p-8 sm:p-12"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-extrabold tracking-tight">My Library</h2>
                  <p className="text-slate-400 mt-1">Saved generations you can revisit anytime.</p>
                </div>
                <button
                  onClick={() => setPanel('home')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-500 via-violet-600 to-blue-600 text-white text-sm font-semibold"
                >
                  <Plus className="w-4 h-4" /> New generation
                </button>
              </div>

              {!user && (
                <div className="text-center py-20">
                  <Library className="w-10 h-10 mx-auto text-slate-500 mb-3" />
                  <p className="text-sm text-slate-400 mb-4">Sign in to save generations to your library.</p>
                  <Link href="/login" className="text-sm font-semibold text-fuchsia-400 hover:underline">Sign in</Link>
                </div>
              )}

              {user && libraryLoading && (
                <div className="text-center py-20">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                </div>
              )}

              {user && !libraryLoading && library.length === 0 && (
                <div className="text-center py-20">
                  <History className="w-10 h-10 mx-auto text-slate-500 mb-3" />
                  <p className="text-sm text-slate-400">Nothing saved yet. Generate something and hit "Save to library".</p>
                </div>
              )}

              {user && !libraryLoading && library.length > 0 && (
                <div className="space-y-3">
                  {library.map(item => {
                    const fmt = FORMATS.find(f => f.id === item.type);
                    return (
                      <div key={item.id} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {fmt && (
                              <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${fmt.gradient} flex items-center justify-center`}>
                                <span className="text-white">{fmt.icon}</span>
                              </div>
                            )}
                            <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                              {fmt?.label ?? item.type}
                            </span>
                          </div>
                          <button
                            onClick={() => removeFromLibrary(item)}
                            className="text-slate-400 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm font-semibold text-white mb-2">{item.prompt.split('\n')[0].replace(/^Topic:\s*/i, '')}</p>
                        <p className="text-xs text-slate-400 line-clamp-3 whitespace-pre-wrap">
                          {(typeof item.result === 'string' ? item.result : JSON.stringify(item.result)).slice(0, 300)}
                          {item.result.length > 300 ? '…' : ''}
                        </p>
                      </div>
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

function GenerationOutput({ format, data }: { format: FormatId; data: any }) {
  if (format === 'flashcards' && Array.isArray(data)) {
    return (
      <div className="space-y-3">
        {data.map((card: any, i: number) => (
          <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-400 mb-2">Question</p>
            <p className="text-sm text-white mb-3">{card.question}</p>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-2">Answer</p>
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
          <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-4">
            <p className="text-sm font-semibold text-white mb-3">{i + 1}. {q.question}</p>
            <ul className="space-y-1.5 mb-3">
              {q.options?.map((opt: string, j: number) => (
                <li key={j} className={`text-sm rounded-lg px-3 py-2 ${q.answer === String.fromCharCode(65 + j) || q.answer === opt ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-slate-300'}`}>
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
          <div key={i} className="rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 p-6">
            <p className="text-xs text-slate-500 mb-2">Slide {i + 1}</p>
            <h3 className="text-xl font-bold text-white mb-3">{slide.title}</h3>
            <ul className="space-y-2">
              {slide.bullets?.map((b: string, j: number) => (
                <li key={j} className="text-sm text-slate-300 flex gap-2"><ChevronRight className="w-4 h-4 text-fuchsia-400 mt-0.5 shrink-0" />{b}</li>
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
          <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-4">
            <p className="text-sm font-bold text-fuchsia-300 mb-1">{g.term}</p>
            <p className="text-xs text-slate-300">{g.definition}</p>
          </div>
        ))}
      </div>
    );
  }
  // text / notes / summary / problems / mindmap / infographic → markdown-ish text
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return (
    <pre className="whitespace-pre-wrap font-sans text-sm text-slate-200 leading-relaxed">{text}</pre>
  );
}
