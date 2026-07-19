'use client';

/**
 * Live AI teacher session — a reliable, self-hosted conversational tutor.
 * Powered by our own /api/ai/tutor (persona-driven, language-aware) with
 * the human AI voice from /api/ai/audio, so every teacher works without any
 * third-party avatar embed.
 */

import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, X, Send, Loader2, Volume2, VolumeX, Globe, Sparkles } from 'lucide-react';
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

export default function TeacherSessionPage({ params }: { params: Promise<{ teacherId: string }> }) {
  const { teacherId } = use(params);
  const router = useRouter();
  const { user, loading } = useAuthSTORE();
  const teacher = AI_TEACHERS.find((t) => t.id === teacherId);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [lang, setLang] = useState('en');
  const [langOpen, setLangOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const greeted = useRef(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(`/ai-teachers/${teacherId}/session`)}`);
    }
  }, [loading, user, router, teacherId]);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('pocket-school-lang') : null;
    if (stored) setLang(stored);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; if (audioRef.current) audioRef.current.pause(); };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, thinking]);

  // Speak a reply with the human AI voice (falls back to browser speech).
  const speak = async (text: string) => {
    if (!voiceOn) return;
    const clean = text.replace(/[*#`_$]/g, '').slice(0, 1200);
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
        audio.play().catch(() => setSpeaking(false));
        return;
      }
    } catch { /* fall through to browser voice */ }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(clean);
      u.onend = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
    } else setSpeaking(false);
  };

  const ask = async (text: string, history: Msg[]) => {
    setThinking(true);
    try {
      const res = await fetch('/api/ai/tutor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          mode: 'college',
          persona: teacher ? `${teacher.name}, ${teacher.title}` : undefined,
          lessonContext: teacher ? `Subjects: ${teacher.subjects.join(', ')}` : undefined,
          language: lang,
          history: history.map(m => ({ role: m.role, text: m.text })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      const reply = res.ok ? (data.reply || '…') : `Sorry — ${data.error || 'I hit an error'}.`;
      setMessages(prev => [...prev, { role: 'model', text: reply }]);
      speak(reply);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'model', text: `Sorry — ${e?.message || 'connection error'}.` }]);
    } finally {
      setThinking(false);
    }
  };

  // Greet once the teacher + user are ready.
  useEffect(() => {
    if (greeted.current || !teacher || !user || loading) return;
    greeted.current = true;
    ask(`Greet me as ${teacher.name}, briefly introduce what you can help with, and ask what I'd like to work on. Keep it to 2-3 sentences.`, []);
  }, [teacher, user, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = () => {
    const text = input.trim();
    if (!text || thinking) return;
    const next = [...messages, { role: 'user' as const, text }];
    setMessages(next);
    setInput('');
    ask(text, next);
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
      {/* Top bar */}
      <header className="h-14 px-4 sm:px-5 flex items-center justify-between border-b border-white/[0.06] shrink-0 bg-[#0D0D18]">
        <Link href="/ai-teachers" className="flex items-center gap-2 text-sm font-semibold text-white/60 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /><span className="hidden sm:inline">AI Teachers</span>
        </Link>
        <div className="flex items-center gap-2.5">
          <img src={teacher.avatarUrl} alt={teacher.name} className="w-8 h-8 rounded-full bg-white/10" />
          <div className="leading-tight">
            <p className="text-sm font-bold">{teacher.name}</p>
            <p className="text-[10px] text-white/50 flex items-center gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Live session {speaking && '· speaking…'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Language */}
          <div className="relative">
            <button onClick={() => setLangOpen(o => !o)} className="flex items-center gap-1 text-white/70 hover:text-white text-xs px-2 py-1.5 rounded-lg hover:bg-white/5" title="Language">
              <Globe className="w-4 h-4" /> {LANGUAGES.find(l => l.code === lang)?.flag}
            </button>
            {langOpen && (
              <div className="absolute top-full right-0 mt-1 w-40 max-h-64 overflow-y-auto rounded-xl bg-[#15161c] border border-white/10 shadow-2xl py-1 z-30">
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
          <button onClick={() => window.close()} className="flex items-center gap-1.5 text-xs font-semibold text-white/50 hover:text-white/90 px-2.5 py-1 rounded-full hover:bg-white/[0.07]" title="End session">
            <X className="w-3.5 h-3.5" /><span className="hidden sm:inline">End</span>
          </button>
        </div>
      </header>

      {/* Session body */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Avatar stage */}
        <div className="hidden lg:flex w-[38%] items-center justify-center relative border-r border-white/[0.06] p-8">
          <div className="absolute inset-0 opacity-40" style={{ background: `radial-gradient(ellipse 60% 50% at 50% 40%, ${accent}40, transparent)` }} />
          <div className="relative text-center">
            <motion.div
              animate={speaking ? { scale: [1, 1.04, 1] } : { scale: 1 }}
              transition={{ repeat: speaking ? Infinity : 0, duration: 0.7 }}
              className="w-52 h-52 rounded-full mx-auto mb-6 overflow-hidden ring-4 shadow-2xl"
              style={{ boxShadow: `0 0 80px -10px ${accent}`, borderColor: accent }}
            >
              <img src={teacher.avatarUrl} alt={teacher.name} className="w-full h-full object-cover" style={{ background: `${accent}22` }} />
            </motion.div>
            <h2 className="font-heading text-2xl">{teacher.name}</h2>
            <p className="text-sm text-white/50 mt-1 max-w-xs mx-auto">{teacher.title}</p>
            {speaking && (
              <div className="flex items-center justify-center gap-1 mt-4">
                {[0, 1, 2, 3].map(i => (
                  <motion.span key={i} className="w-1 rounded-full" style={{ background: accent }}
                    animate={{ height: [6, 18, 6] }} transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.12 }} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'model' && <img src={teacher.avatarUrl} alt="" className="w-8 h-8 rounded-full bg-white/10 shrink-0 mt-0.5" />}
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role === 'user' ? 'bg-white/10 rounded-br-md' : 'bg-white/[0.04] border border-white/10 rounded-bl-md'}`}>
                  {m.role === 'model'
                    ? <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-p:text-white/85"><MathMarkdown>{m.text}</MathMarkdown></div>
                    : <p className="whitespace-pre-wrap">{m.text}</p>}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex gap-3">
                <img src={teacher.avatarUrl} alt="" className="w-8 h-8 rounded-full bg-white/10 shrink-0" />
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-2 text-white/60 text-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> {teacher.name.split(' ')[0]} is thinking…
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Composer */}
          <div className="p-4 border-t border-white/[0.06] bg-[#0B0B14]">
            <div className="flex items-end gap-2 max-w-3xl mx-auto">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={`Ask ${teacher.name.split(' ')[0]} anything…`}
                rows={1}
                className="flex-1 resize-none max-h-32 rounded-2xl bg-white/[0.05] border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-white/25 placeholder:text-white/30"
              />
              <button onClick={send} disabled={thinking || !input.trim()}
                className="w-10 h-10 rounded-full flex items-center justify-center text-black disabled:opacity-30 shrink-0 hover:scale-105 transition-transform"
                style={{ background: accent }}>
                {thinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-center text-[10px] text-white/30 mt-2 flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3" /> Powered by POCO AI · voiced replies · {LANGUAGES.find(l => l.code === lang)?.label}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
