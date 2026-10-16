'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft, BookOpen, Camera, ClipboardList, Globe, Lightbulb, Loader2, Lock, MessageSquare,
  Mic, PenSquare, Phone, PhoneOff, Play, RotateCcw, Send, StickyNote, Video, Volume2, VolumeX, X,
} from 'lucide-react';
import { LiveVoiceSession } from '@/components/live-voice-session';
import { MathMarkdown } from '@/components/math-markdown';
import { ProblemCard, QuizCard } from '@/components/teacher-board';
import { useAuthSTORE } from '@/hooks/use-auth';
import { usePricing } from '@/hooks/use-pricing';
import { auth } from '@/lib/firebase';
import type { AiTeacher } from '@/lib/ai-teachers';
import { addOn, hasAddOn, permissionsFor } from '@/lib/entitlements';
import { applyAppLanguage } from '@/lib/i18n/apply';
import { hashFields } from '@/lib/i18n/content-translation';
import { useContentTranslation } from '@/hooks/use-content-translation';
import { LANGUAGES, RECOGNITION_LANG, readLanguage, textDirection } from '@/lib/languages';
import { tutorModeFor } from '@/lib/learner-level';
import { formatMoney, quoteAddon } from '@/lib/pricing';
import { SentenceStream, Speaker } from '@/lib/speech';
import {
  extractBoardItems, TEACHER_QUICK_PROMPTS, transcriptText,
  type BoardItem, type ChatMessage, type ProblemItem, type QuizItem,
} from '@/lib/teacher-chat';

type Variant = 'session' | 'studio' | 'dock';
type Tab = 'chat' | 'board' | 'notes' | 'transcript';
type ReplyMode = 'text' | 'voice';

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { resultIndex: number; results: { length: number; [index: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
}

function browserRecognition(): SpeechRecognitionLike | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

async function fileToDataUrl(file: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

export function TeacherConversation({
  teacher,
  variant = 'session',
  lessonContext,
  tutorMode,
  onClose,
}: {
  teacher: AiTeacher;
  variant?: Variant;
  lessonContext?: string;
  tutorMode?: string;
  onClose?: () => void;
}) {
  const router = useRouter();
  const { user, profile, loading } = useAuthSTORE();
  const lyraUnlocked = hasAddOn(permissionsFor(profile), 'lyra_live');
  const lyra = addOn('lyra_live');
  const { config, currency } = usePricing();
  const lyraQuote = quoteAddon(config, 'lyra_live', currency);
  const requireAuth = variant !== 'dock';
  const backHref = variant === 'studio' ? '/dashboard/studio/teachers' : '/ai-teachers';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [board, setBoard] = useState<BoardItem[]>([]);
  const [tab, setTab] = useState<Tab>('chat');
  const [input, setInput] = useState('');
  const [pendingImage, setPendingImage] = useState('');
  const [thinking, setThinking] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [replyMode, setReplyMode] = useState<ReplyMode>('text');
  const [autoPlay, setAutoPlay] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [liveVoice, setLiveVoice] = useState(false);
  const [videoOn, setVideoOn] = useState(false);
  const [lyraPrompt, setLyraPrompt] = useState(false);
  const [recording, setRecording] = useState(false);
  const [noteStatus, setNoteStatus] = useState('');
  const [lang, setLang] = useState('en');
  const [langOpen, setLangOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [unseenBoard, setUnseenBoard] = useState(0);
  const [notices, setNotices] = useState<string[]>([]);

  const endRef = useRef<HTMLDivElement>(null);
  const speakerRef = useRef<Speaker | null>(null);
  if (!speakerRef.current) speakerRef.current = new Speaker({ onSpeakingChange: setSpeaking });
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const langRef = useRef(lang);
  const tabRef = useRef(tab);
  const speakRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const greeted = useRef(false);
  const idCounter = useRef(0);
  const boardBadge = useRef(0);
  const noteChain = useRef(Promise.resolve());
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const browserTranscript = useRef('');
  const fileRef = useRef<HTMLInputElement>(null);
  const transcriptKey = `ps-session-${teacher.id}`;
  const mode = tutorMode || tutorModeFor(profile?.level);

  useEffect(() => { langRef.current = lang; }, [lang]);
  useEffect(() => { tabRef.current = tab; }, [tab]);
  useEffect(() => { speakRef.current = replyMode === 'voice' && autoPlay; }, [replyMode, autoPlay]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => {
    speakerRef.current?.setOptions({ voice: teacher.voice, style: teacher.voiceStyle, lang: RECOGNITION_LANG[lang] ?? 'en-GB' });
  }, [teacher.voice, teacher.voiceStyle, lang]);

  useEffect(() => {
    if (requireAuth && !loading && !user) {
      const next = variant === 'studio' ? `/dashboard/studio/teachers/${teacher.id}` : `/ai-teachers/${teacher.id}/session`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [loading, requireAuth, router, teacher.id, user, variant]);

  useEffect(() => {
    setLang(readLanguage());
    const savedReply = localStorage.getItem('poket-teacher-reply');
    if (savedReply === 'voice' || savedReply === 'text') setReplyMode(savedReply);
    const savedPlay = localStorage.getItem('poket-teacher-autoplay');
    if (savedPlay === '0') setAutoPlay(false);
    const savedNotes = localStorage.getItem(`ps-notes-${teacher.id}`);
    if (savedNotes) setNotes(savedNotes);
    try {
      const saved = JSON.parse(localStorage.getItem(transcriptKey) ?? 'null') as { messages?: ChatMessage[]; board?: BoardItem[] } | null;
      if (saved?.messages?.length) {
        setMessages(saved.messages);
        if (Array.isArray(saved.board)) {
          setBoard(saved.board);
          idCounter.current = saved.board.reduce((max, item) => Math.max(max, item.id), 0);
        }
        greeted.current = true;
      }
    } catch { /* start fresh */ }
    const onLang = () => setLang(readLanguage());
    window.addEventListener('pocket-school-lang-change', onLang);
    return () => window.removeEventListener('pocket-school-lang-change', onLang);
  }, [teacher.id, transcriptKey]);

  useEffect(() => {
    fetch('/api/ai/capabilities').then(res => res.json()).then(data => {
      if (Array.isArray(data.notices)) setNotices(data.notices.filter((note: unknown) => typeof note === 'string'));
    }).catch(() => { /* the chat still explains a failed reply */ });
  }, []);

  useEffect(() => {
    const speaker = speakerRef.current;
    return () => { abortRef.current?.abort(); speaker?.stop(); recorderRef.current?.stop(); };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages, thinking, streamingText]);
  useEffect(() => {
    if (!messages.length) return;
    try { localStorage.setItem(transcriptKey, JSON.stringify({ messages: messages.slice(-60), board: board.slice(-30) })); } catch { /* full */ }
  }, [board, messages, transcriptKey]);
  useEffect(() => { localStorage.setItem(`ps-notes-${teacher.id}`, notes); }, [notes, teacher.id]);

  const nextId = () => ++idCounter.current;

  const ask = useCallback(async (
    text: string,
    history: ChatMessage[],
    opts: { say?: (sentence: string) => void; signal?: AbortSignal; image?: string } = {},
  ): Promise<string> => {
    busyRef.current = true;
    setThinking(true);
    setStreamingText('');
    const speaker = speakerRef.current!;
    const ownVoice = !opts.say && speakRef.current;
    const turn = ownVoice ? speaker.begin() : -1;
    const say = opts.say ?? (ownVoice ? (sentence: string) => speaker.enqueue(sentence, turn) : null);
    const sentences = say ? new SentenceStream(say) : null;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    opts.signal?.addEventListener('abort', () => ctrl.abort());
    let full = '';
    try {
      const token = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers,
        signal: ctrl.signal,
        body: JSON.stringify({
          message: text,
          image: opts.image,
          mode,
          persona: `${teacher.name}, ${teacher.title}. You teach for Poket School. Call yourself ${teacher.name}.`,
          lessonContext: lessonContext || `Subjects: ${teacher.subjects.join(', ')}`,
          language: langRef.current,
          workboard: variant !== 'dock',
          stream: true,
          history: history.map(item => ({ role: item.role, text: item.text })),
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const data = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(data.error || 'ET AI could not reply.');
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const delta = decoder.decode(value, { stream: true });
        full += delta;
        sentences?.push(delta);
        setStreamingText(full.replace(/```(QUIZ|PROBLEM)[\s\S]*?(```|$)/g, '\nAdding that to your board.\n'));
      }
      sentences?.flush();
      const { prose, items } = extractBoardItems(full, nextId);
      if (items.length) {
        setBoard(prev => [...prev, ...items]);
        if (tabRef.current !== 'board') {
          boardBadge.current += items.length;
          setUnseenBoard(boardBadge.current);
        }
      }
      const finalText = prose || (items.length ? 'I put something on your board.' : '…');
      setMessages(prev => [...prev, { role: 'model', text: finalText }]);
      return prose || finalText;
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      if (name === 'AbortError') {
        const { prose } = extractBoardItems(full, nextId);
        if (prose.trim()) setMessages(prev => [...prev, { role: 'model', text: `${prose.trim()} …` }]);
        return prose;
      }
      const message = error instanceof Error ? error.message : 'connection error';
      const shown = `Sorry — ${message}`;
      setMessages(prev => [...prev, { role: 'model', text: shown }]);
      return shown;
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      busyRef.current = false;
      setThinking(false);
      setStreamingText(null);
    }
  }, [lessonContext, mode, teacher.name, teacher.subjects, teacher.title, variant]);

  const askRef = useRef(ask);
  askRef.current = ask;

  const askByVoice = useCallback(async (spoken: string, say: (sentence: string) => void, signal: AbortSignal) => {
    const next = [...messagesRef.current, { role: 'user' as const, text: spoken, voice: true }];
    setMessages(next);
    messagesRef.current = next;
    return askRef.current(`${spoken}\n\n(Reply conversationally in 2-4 sentences — this is spoken aloud.)`, next, { say, signal });
  }, []);

  const send = useCallback((text?: string, extra?: { voice?: boolean; image?: string }) => {
    const value = (text ?? input).trim();
    const image = extra?.image ?? pendingImage;
    if ((!value && !image) || busyRef.current) return;
    const next = [...messagesRef.current, { role: 'user' as const, text: value || 'Please look at this photo.', image: image || undefined, voice: extra?.voice }];
    setMessages(next);
    messagesRef.current = next;
    setInput('');
    setPendingImage('');
    setTab('chat');
    void askRef.current(value || 'Please look at this photo and help me with it.', next, { image: image || undefined });
  }, [input, pendingImage]);
  const sendRef = useRef(send);
  sendRef.current = send;

  useEffect(() => {
    if (greeted.current || !teacher || (requireAuth && (!user || loading))) return;
    greeted.current = true;
    void askRef.current(`Greet me warmly as ${teacher.name} in 2 short sentences, then ask what I would like to learn today. Do not add a quiz yet.`, []);
  }, [loading, requireAuth, teacher, user]);

  const newSession = () => {
    abortRef.current?.abort();
    speakerRef.current?.stop();
    try { localStorage.removeItem(transcriptKey); } catch { /* noop */ }
    setMessages([]);
    setBoard([]);
    setScore({ right: 0, total: 0 });
    messagesRef.current = [];
    idCounter.current = 0;
    greeted.current = true;
    void askRef.current(`Greet me warmly as ${teacher.name} in 2 short sentences, then ask what I would like to learn today. Do not add a quiz yet.`, []);
  };

  const answerQuiz = (id: number, option: string) => {
    setBoard(prev => prev.map(item => (item.kind === 'quiz' && item.id === id && !item.chosen ? { ...item, chosen: option } : item)));
    const item = board.find(entry => entry.id === id) as QuizItem | undefined;
    if (!item || item.chosen) return;
    const correct = item.options.indexOf(option) === item.options.indexOf(item.answer);
    setScore(current => ({ right: current.right + (correct ? 1 : 0), total: current.total + 1 }));
    if (!correct && !busyRef.current) {
      sendRef.current(`On the quiz "${item.question}" I chose "${option}" but the correct answer was "${item.answer}". Briefly explain why my choice is wrong.`);
    }
  };

  const checkProblem = (id: number, answer: string) => {
    const item = board.find(entry => entry.id === id) as ProblemItem | undefined;
    if (!item || !answer.trim() || busyRef.current) return;
    setBoard(prev => prev.map(entry => entry.id === id ? { ...entry, submitted: true } : entry));
    sendRef.current(`Please check my answer.\nProblem: "${item.prompt}"\nMy answer: "${answer}"\nMark it and show the step I should revisit.`);
  };

  const playReply = (text: string) => {
    const speaker = speakerRef.current!;
    const turn = speaker.begin();
    const sentences = new SentenceStream(sentence => speaker.enqueue(sentence, turn));
    sentences.push(text);
    sentences.flush();
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    recorderRef.current?.stop();
    setRecording(false);
  };

  const startRecording = async () => {
    if (recording) {
      stopRecording();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      browserTranscript.current = '';
      const recognition = browserRecognition();
      if (recognition) {
        recognition.lang = RECOGNITION_LANG[langRef.current] ?? 'en-GB';
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.onresult = (event) => {
          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            if (event.results[index].isFinal) browserTranscript.current += ` ${event.results[index][0].transcript}`;
          }
        };
        recognition.onend = null;
        try { recognition.start(); } catch { /* the server transcript can still run */ }
        recognitionRef.current = recognition;
      }
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        const heard = browserTranscript.current.trim();
        noteChain.current = noteChain.current.then(() => transcribeNote(blob, heard)).catch(() => undefined);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setNoteStatus(recognition ? 'Recording. Stop to send, then you can record another.' : 'Recording. This browser cannot draft a transcript, so the speech key will be used.');
    } catch {
      setNoteStatus('Microphone access was blocked. Allow it to send a voice note, or type instead.');
    }
  };

  const transcribeNote = async (blob: Blob, heard: string) => {
    setNoteStatus('Transcribing your voice note…');
    let transcript = '';
    let reason = '';
    try {
      const dataUrl = await fileToDataUrl(blob);
      const audio = dataUrl.split(',')[1] ?? '';
      const token = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers,
        body: JSON.stringify({ audio, mime: blob.type || 'audio/webm', language: langRef.current }),
      });
      const data = await res.json().catch(() => ({} as { transcript?: string; fallback?: boolean; reason?: string; error?: string }));
      if (typeof data.transcript === 'string' && data.transcript.trim()) transcript = data.transcript.trim();
      else if (heard) transcript = heard;
      reason = data.reason || data.error || '';
    } catch {
      if (heard) transcript = heard;
      else reason = 'That voice note could not be transcribed.';
    }
    if (!transcript) {
      setNoteStatus(reason || 'That voice note could not be transcribed. Type it instead.');
      return;
    }
    setNoteStatus('');
    sendRef.current(transcript, { voice: true, image: '' });
  };

  const onPhoto = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setNoteStatus('Choose a photo.');
      return;
    }
    if (file.size > 1_500_000) {
      setNoteStatus('That photo is too large. Use one under 1.5 MB.');
      return;
    }
    void fileToDataUrl(file).then(setPendingImage);
  };

  const openLive = (withCamera: boolean) => {
    if (!lyraUnlocked) {
      setLyraPrompt(true);
      return;
    }
    abortRef.current?.abort();
    speakerRef.current?.stop();
    setVideoOn(withCamera);
    setLiveVoice(true);
  };

  const downloadTranscript = () => {
    const blob = new Blob([transcriptText(teacher.name, messages)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${teacher.id}-transcript.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!teacher) return null;
  if (requireAuth && (loading || !user)) {
    return (
      <div className="h-full min-h-[240px] grid place-items-center bg-[#07070E] text-white">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const accent = teacher.accentColor;
  const frame = variant === 'session' ? 'fixed inset-0' : 'relative h-full min-h-0';
  const quickIcons = {
    quiz: <ClipboardList className="w-3.5 h-3.5" />,
    problem: <PenSquare className="w-3.5 h-3.5" />,
    simpler: <Lightbulb className="w-3.5 h-3.5" />,
    topic: <BookOpen className="w-3.5 h-3.5" />,
  };

  return (
    <div className={`${frame} bg-[#07070E] text-white overflow-hidden flex flex-col`} dir={textDirection(lang)}>
      <AnimatePresence>
        {lyraPrompt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-black/70 grid place-items-center p-4" onClick={() => setLyraPrompt(false)}>
            <div onClick={event => event.stopPropagation()} className="bg-[#15161c] border border-white/10 rounded-3xl p-7 max-w-sm w-full text-center">
              <Phone className="w-6 h-6 mx-auto mb-3" />
              <h3 className="font-bold text-lg">{lyra?.name ?? 'ET AI Live'}</h3>
              <p className="text-white/60 text-sm mt-2">{lyra?.blurb ?? 'Live voice and video with your teacher are part of ET AI Live.'}</p>
              <p className="text-2xl font-extrabold mt-4">{lyraQuote ? formatMoney(lyraQuote.amount, lyraQuote.currency) : ''}<span className="text-sm font-medium text-white/50">/month</span></p>
              <p className="text-white/40 text-[11px] mt-1">Text, voice notes, and photos stay available. Live voice and video need ET AI Live.</p>
              <Link href="/pricing#addons" className="mt-5 block w-full h-11 rounded-full font-bold text-black grid place-items-center" style={{ background: accent }}>See ET AI Live</Link>
              <button type="button" onClick={() => setLyraPrompt(false)} className="mt-3 text-white/50 text-xs font-semibold">Keep chatting</button>
            </div>
          </motion.div>
        )}
        {liveVoice && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40">
            <LiveVoiceSession teacher={teacher} lang={lang} camera={videoOn} onAsk={askByVoice} onClose={() => { setLiveVoice(false); setVideoOn(false); }} />
          </motion.div>
        )}
      </AnimatePresence>

      <header className="h-12 px-3 flex items-center justify-between border-b border-white/10 shrink-0 bg-[#0D0D18]">
        {variant === 'dock' ? <span className="text-sm font-semibold">{teacher.name}</span> : (
          <Link href={backHref} className="flex items-center gap-2 text-sm font-semibold text-white/60 hover:text-white">
            <ArrowLeft className="w-4 h-4" /><span className="hidden sm:inline">{variant === 'studio' ? 'AI Teachers' : 'AI Teachers'}</span>
          </Link>
        )}
        <span className="text-[11px] font-bold tracking-widest uppercase truncate">Live · {teacher.name}</span>
        <div className="flex items-center gap-1">
          <div className="relative">
            <button type="button" onClick={() => setLangOpen(open => !open)} className="text-white/70 p-1.5" aria-label="Language"><Globe className="w-4 h-4" /></button>
            {langOpen && (
              <div className="absolute top-full right-0 mt-1 w-44 max-h-64 overflow-y-auto rounded-xl bg-[#15161c] border border-white/10 py-1 z-40">
                {LANGUAGES.map(language => (
                  <button key={language.code} type="button" onClick={() => { applyAppLanguage(language.code, { explicit: true }); setLang(language.code); setLangOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs ${language.code === lang ? 'bg-white/10' : 'text-white/70'}`}>
                    {language.flag} {language.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" onClick={() => openLive(false)} className="text-xs font-bold px-2 py-1 rounded-full text-black inline-flex items-center gap-1" style={{ background: accent }} title="Live voice">
            <Phone className="w-3.5 h-3.5" />{!lyraUnlocked && <Lock className="w-3 h-3" />}
          </button>
          <button type="button" onClick={() => openLive(true)} className="text-xs font-bold px-2 py-1 rounded-full border border-white/15 inline-flex items-center gap-1" title="Video session">
            <Video className="w-3.5 h-3.5" />{!lyraUnlocked && <Lock className="w-3 h-3" />}
          </button>
          <button type="button" onClick={newSession} className="p-1.5 text-white/70" title="New session"><RotateCcw className="w-4 h-4" /></button>
          <button type="button" onClick={() => { setAutoPlay(value => { const next = !value; localStorage.setItem('poket-teacher-autoplay', next ? '1' : '0'); if (!next) speakerRef.current?.stop(); return next; }); }} className="p-1.5 text-white/70" title={autoPlay ? 'Auto-play on' : 'Auto-play off'}>
            {autoPlay && replyMode === 'voice' ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          {variant === 'session' && <Link href={backHref} className="p-1.5 text-white/50" title="End"><X className="w-4 h-4" /></Link>}
          {variant === 'dock' && onClose && <button type="button" onClick={onClose} className="p-1.5 text-white/50" title="Close"><X className="w-4 h-4" /></button>}
        </div>
      </header>

      {notices.length > 0 && (
        <div className="px-3 py-2 bg-amber-500/10 text-amber-100 text-xs space-y-1 shrink-0">
          {notices.map(note => <p key={note}>{note}</p>)}
        </div>
      )}

      <main className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {variant !== 'dock' && (
          <div className="relative shrink-0 lg:w-[34%] h-[22dvh] lg:h-auto grid place-items-center border-b lg:border-b-0 lg:border-r border-white/10">
            <div className="text-center">
              <motion.img src={teacher.avatarUrl} alt="" animate={speaking ? { scale: [1, 1.05, 1] } : { scale: 1 }} transition={{ repeat: speaking ? Infinity : 0, duration: 0.7 }}
                className="w-20 h-20 lg:w-36 lg:h-36 rounded-full mx-auto object-cover" style={{ boxShadow: `0 0 50px -12px ${accent}` }} />
              <h2 className="mt-2 font-heading text-lg">{teacher.name}</h2>
              <p className="text-xs text-white/50">{speaking ? 'Speaking' : thinking ? 'Thinking' : teacher.title}</p>
            </div>
          </div>
        )}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex border-b border-white/10 text-xs font-semibold shrink-0">
            {([
              ['chat', 'Chat', <MessageSquare key="c" className="w-3.5 h-3.5" />],
              ['board', 'Workboard', <ClipboardList key="b" className="w-3.5 h-3.5" />],
              ['notes', 'Notes', <StickyNote key="n" className="w-3.5 h-3.5" />],
              ['transcript', 'Transcript', <BookOpen key="t" className="w-3.5 h-3.5" />],
            ] as const).map(([id, label, icon]) => (
              <button key={id} type="button" onClick={() => { setTab(id); if (id === 'board') { boardBadge.current = 0; setUnseenBoard(0); } }}
                className={`px-3 py-2 inline-flex items-center gap-1 border-b-2 ${tab === id ? 'text-white' : 'text-white/40 border-transparent'}`}
                style={tab === id ? { borderColor: accent } : undefined}>
                {icon} {label}
                {id === 'board' && unseenBoard > 0 ? <span className="text-[9px] text-black px-1 rounded-full" style={{ background: accent }}>{unseenBoard}</span> : null}
              </button>
            ))}
            {score.total > 0 && <span className="ml-auto self-center pr-3 text-emerald-300">{score.right}/{score.total}</span>}
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 px-3 py-3 space-y-3">
            {tab === 'chat' && messages.map((message, index) => (
              <div key={`${index}-${message.text.slice(0, 12)}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.role === 'model'
                  ? <TeacherBubble teacher={teacher} text={message.text} lang={lang} accent={accent} onPlay={() => playReply(message.text)} />
                  : (
                    <div className="max-w-[85%] rounded-2xl bg-white/10 px-3 py-2 text-sm">
                      {message.voice && <p className="text-[10px] uppercase tracking-wider text-white/50 mb-1">Voice note</p>}
                      {message.image && <img src={message.image} alt="Uploaded" className="max-h-40 rounded-lg mb-2" />}
                      <p className="whitespace-pre-wrap">{message.text}</p>
                    </div>
                  )}
              </div>
            ))}
            {tab === 'chat' && streamingText !== null && (
              <div className="max-w-[85%] rounded-2xl border border-white/10 px-3 py-2 text-sm">
                {streamingText ? <MathMarkdown>{streamingText}</MathMarkdown> : <Loader2 className="w-4 h-4 animate-spin" />}
              </div>
            )}
            {tab === 'board' && (board.length === 0 ? <p className="text-sm text-white/50 text-center py-8">Ask {teacher.name} for a quiz or a practice problem.</p> : board.map(item => (
              <div key={item.id} className="rounded-2xl border border-white/10">
                {item.kind === 'quiz' ? <QuizCard item={item} accent={accent} onAnswer={answerQuiz} /> : <ProblemCard item={item} accent={accent} onCheck={checkProblem} />}
              </div>
            )))}
            {tab === 'notes' && (
              <textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Notes stay on this device." className="w-full min-h-[220px] rounded-2xl bg-white/5 border border-white/10 p-3 text-sm outline-none" />
            )}
            {tab === 'transcript' && (
              <div>
                <button type="button" onClick={downloadTranscript} className="text-xs font-bold mb-3 underline">Download transcript</button>
                <pre className="whitespace-pre-wrap text-sm text-white/80 font-sans">{transcriptText(teacher.name, messages) || 'The transcript appears as you talk.'}</pre>
              </div>
            )}
            <div ref={endRef} />
          </div>
          <div className="border-t border-white/10 p-2 shrink-0">
            {noteStatus && <p className="text-xs text-amber-100 px-2 pb-1">{noteStatus}</p>}
            <div className="flex gap-1 overflow-x-auto pb-2">
              {TEACHER_QUICK_PROMPTS.map(action => (
                <button key={action.id} type="button" disabled={thinking} onClick={() => send(action.prompt)} className="shrink-0 text-[11px] border border-white/10 rounded-full px-3 py-1 inline-flex items-center gap-1">
                  {quickIcons[action.id]} {action.label}
                </button>
              ))}
            </div>
            {pendingImage && <img src={pendingImage} alt="Ready to send" className="h-16 rounded-lg mb-2" />}
            <div className="flex items-end gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="w-10 h-10 rounded-full border border-white/15 grid place-items-center" title="Photo"><Camera className="w-4 h-4" /></button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={event => { onPhoto(event.target.files?.[0]); event.target.value = ''; }} />
              <button type="button" onClick={() => void startRecording()} className={`w-10 h-10 rounded-full grid place-items-center ${recording ? 'bg-red-500' : 'border border-white/15'}`} title={recording ? 'Stop and send voice note' : 'Voice note'}>
                {recording ? <PhoneOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <label className="text-[11px] text-white/60 self-center">
                Reply
                <select value={replyMode} onChange={event => { const next = event.target.value === 'voice' ? 'voice' : 'text'; setReplyMode(next); localStorage.setItem('poket-teacher-reply', next); }} className="ml-1 bg-transparent">
                  <option value="text">Text</option>
                  <option value="voice">Voice</option>
                </select>
              </label>
              <textarea value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }}
                placeholder={`Message ${teacher.name}`} rows={1} className="flex-1 resize-none max-h-28 rounded-2xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none" />
              <button type="button" onClick={() => send()} disabled={thinking || (!input.trim() && !pendingImage)} className="w-10 h-10 rounded-full grid place-items-center text-black disabled:opacity-30" style={{ background: accent }}>
                {thinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function TeacherBubble({
  teacher, text, lang, accent, onPlay,
}: {
  teacher: AiTeacher;
  text: string;
  lang: string;
  accent: string;
  onPlay: () => void;
}) {
  const [wantEnglish, setWantEnglish] = useState(false);
  const english = useContentTranslation(
    `teacher-reply:${teacher.id}:${hashFields({ text })}`,
    { text },
    'en',
    wantEnglish && lang !== 'en',
    { intoEnglish: true, sourceDirection: textDirection(lang) },
  );
  const shown = wantEnglish && english.status === 'ready' ? english.values.text : text;
  const dir = wantEnglish && english.status === 'ready' ? 'ltr' : textDirection(lang);
  return (
    <div className="max-w-[85%] rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm" dir={dir}>
      <div className="prose prose-sm prose-invert max-w-none"><MathMarkdown>{shown}</MathMarkdown></div>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-white/60">
        <button type="button" onClick={onPlay} className="inline-flex items-center gap-1"><Play className="w-3 h-3" style={{ color: accent }} /> Play</button>
        {lang !== 'en' && (
          <button type="button" onClick={() => setWantEnglish(value => !value)}>
            {english.status === 'loading' ? 'Translating…' : wantEnglish ? `Show ${teacher.name}` : 'Show English'}
          </button>
        )}
        {english.status === 'unavailable' && wantEnglish && <span>{english.notice || 'English is unavailable right now.'}</span>}
      </div>
    </div>
  );
}
