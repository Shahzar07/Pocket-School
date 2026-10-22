'use client';

import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft, BookOpen, Camera, ClipboardList, Globe, Lightbulb, Loader2, Lock, MessageSquare,
  Mic, PenSquare, Phone, PhoneOff, Play, RotateCcw, Send, StickyNote, Video, Volume2, VolumeX, X,
} from 'lucide-react';
import type { LiveVoiceSessionProps } from '@/components/live-voice-session';
import { LevelMenu } from '@/components/level-menu';
import { MathMarkdown } from '@/components/math-markdown';
import { ProblemCard, QuizCard } from '@/components/teacher-board';
import { useAuthSTORE } from '@/hooks/use-auth';
import { usePricing } from '@/hooks/use-pricing';
import { auth } from '@/lib/firebase';
import type { AiTeacher } from '@/lib/ai-teachers';
import { portraitAlt } from '@/lib/teacher-portrait';
import { coachingForTeacher } from '@/lib/essays/coaching';
import { addOn, hasAddOn, permissionsFor } from '@/lib/entitlements';
import { applyAppLanguage } from '@/lib/i18n/apply';
import { hashFields } from '@/lib/i18n/content-translation';
import { useContentTranslation } from '@/hooks/use-content-translation';
import { LANGUAGES, RECOGNITION_LANG, readLanguage, textDirection } from '@/lib/languages';
import { tutorModeFor } from '@/lib/learner-level';
import { formatMoney, quoteAddon } from '@/lib/pricing';
import type { Speaker } from '@/lib/speech';
import { correctIndex } from '@/lib/quiz-answer';
import { optionIndex } from '@/lib/quiz';
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
  const liveUnlocked = hasAddOn(permissionsFor(profile), 'et_ai_live');
  const liveAddon = addOn('et_ai_live');
  const { config, currency } = usePricing();
  const liveQuote = quoteAddon(config, 'et_ai_live', currency);
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
  const [LiveSession, setLiveSession] = useState<ComponentType<LiveVoiceSessionProps> | null>(null);
  const [videoOn, setVideoOn] = useState(false);
  const [livePrompt, setLivePrompt] = useState(false);
  const [recording, setRecording] = useState(false);
  const [noteStatus, setNoteStatus] = useState('');
  const [lang, setLang] = useState('en');
  const [langOpen, setLangOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [unseenBoard, setUnseenBoard] = useState(0);
  const [notices, setNotices] = useState<string[]>([]);
  const [skill, setSkill] = useState('');
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState('');
  const [modeChoice, setModeChoice] = useState('');
  const { resolvedTheme } = useTheme();

  const endRef = useRef<HTMLDivElement>(null);
  const speakerRef = useRef<Speaker | null>(null);
  const liveRequest = useRef(0);
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
  const cameraRef = useRef<HTMLInputElement>(null);
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

  const ensureSpeaker = useCallback(async () => {
    const { Speaker: SpeakerCtor } = await import('@/lib/speech');
    if (!speakerRef.current) {
      speakerRef.current = new SpeakerCtor({ onSpeakingChange: setSpeaking });
    }
    speakerRef.current.setOptions({
      voice: teacher.voice,
      style: teacher.voiceStyle,
      lang: RECOGNITION_LANG[langRef.current] ?? 'en-GB',
    });
    return speakerRef.current;
  }, [teacher.voice, teacher.voiceStyle]);

  const ask = useCallback(async (
    text: string,
    history: ChatMessage[],
    opts: { say?: (sentence: string) => void; signal?: AbortSignal; image?: string } = {},
  ): Promise<string> => {
    busyRef.current = true;
    setThinking(true);
    setStreamingText('');
    const ownVoice = !opts.say && speakRef.current;
    let sentences: { push: (delta: string) => void; flush: () => void } | null = null;
    if (ownVoice || opts.say) {
      const { SentenceStream } = await import('@/lib/speech');
      const speaker = ownVoice ? await ensureSpeaker() : null;
      const turn = speaker ? speaker.begin() : -1;
      const say = opts.say ?? (speaker ? (sentence: string) => speaker.enqueue(sentence, turn) : null);
      sentences = say ? new SentenceStream(say) : null;
    }
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
          coaching: coachingForTeacher(teacher.id) ?? undefined,
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
  }, [ensureSpeaker, lessonContext, mode, teacher.id, teacher.name, teacher.subjects, teacher.title, variant]);

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
    const context = [
      skill ? `Skill: ${skill}` : '',
      subject ? `Subject: ${subject}` : '',
      level ? `Level: ${level}` : '',
      modeChoice ? `Mode: ${modeChoice}` : '',
    ].filter(Boolean).join('. ');
    const next = [...messagesRef.current, { role: 'user' as const, text: value || 'Please look at this photo.', image: image || undefined, voice: extra?.voice }];
    setMessages(next);
    messagesRef.current = next;
    setInput('');
    setPendingImage('');
    setTab('chat');
    const asked = value || 'Please look at this photo and help me with it.';
    void askRef.current(context ? `${asked}\n\n${context}` : asked, next, { image: image || undefined });
  }, [input, level, modeChoice, pendingImage, skill, subject]);
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

  const answerQuiz = (id: number, choice: string) => {
    setBoard(prev => prev.map(item => (item.kind === 'quiz' && item.id === id && !item.chosen ? { ...item, chosen: choice } : item)));
    const item = board.find(entry => entry.id === id) as QuizItem | undefined;
    if (!item || item.chosen) return;
    const selected = optionIndex(choice, item.options.length);
    const answerIdx = correctIndex(item.options, item.answer);
    const correct = selected >= 0 ? selected === answerIdx : item.options.indexOf(choice) === answerIdx;
    setScore(current => ({ right: current.right + (correct ? 1 : 0), total: current.total + 1 }));
    if (!correct && !busyRef.current) {
      const chosenWords = selected >= 0 ? (item.options[selected] ?? choice) : choice;
      const answerWords = answerIdx >= 0 ? (item.options[answerIdx] ?? item.answer) : item.answer;
      sendRef.current(`On the quiz "${item.question}" I chose "${chosenWords}" but the correct answer was "${answerWords}". Briefly explain why my choice is wrong.`);
    }
  };

  const checkProblem = (id: number, answer: string) => {
    const item = board.find(entry => entry.id === id) as ProblemItem | undefined;
    if (!item || !answer.trim() || busyRef.current) return;
    setBoard(prev => prev.map(entry => entry.id === id ? { ...entry, submitted: true } : entry));
    sendRef.current(`Please check my answer.\nProblem: "${item.prompt}"\nMy answer: "${answer}"\nMark it and show the step I should revisit.`);
  };

  const playReply = (text: string) => {
    void (async () => {
      const speaker = await ensureSpeaker();
      const { SentenceStream } = await import('@/lib/speech');
      const turn = speaker.begin();
      const sentences = new SentenceStream(sentence => speaker.enqueue(sentence, turn));
      sentences.push(text);
      sentences.flush();
    })();
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
    if (!liveUnlocked) {
      setLivePrompt(true);
      return;
    }
    abortRef.current?.abort();
    speakerRef.current?.stop();
    const request = ++liveRequest.current;
    void import('@/components/live-voice-session').then((mod) => {
      if (liveRequest.current !== request) return;
      setLiveSession(() => mod.LiveVoiceSession);
      setVideoOn(withCamera);
      setLiveVoice(true);
    });
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
      <div className="h-full min-h-[240px] grid place-items-center bg-[#121E22] text-white">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const accent = '#3FE0D0';
  const lightChat = variant !== 'dock' && resolvedTheme === 'light';
  const frame = 'relative h-full min-h-0';
  const quickIcons = {
    quiz: <ClipboardList className="w-3.5 h-3.5" />,
    problem: <PenSquare className="w-3.5 h-3.5" />,
    simpler: <Lightbulb className="w-3.5 h-3.5" />,
    topic: <BookOpen className="w-3.5 h-3.5" />,
  };

  return (
    <div className={`${frame} overflow-hidden flex flex-col ${lightChat ? 'bg-[#F7FBFC] text-[#203337]' : 'bg-[#121E22] text-white'}`} data-teacher-theme={lightChat ? 'light' : 'dark'} dir={textDirection(lang)}>
      <AnimatePresence>
        {livePrompt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-black/70 grid place-items-center p-4" onClick={() => setLivePrompt(false)}>
            <div onClick={event => event.stopPropagation()} className="bg-[#15161c] border border-white/10 rounded-3xl p-7 max-w-sm w-full text-center">
              <Phone className="w-6 h-6 mx-auto mb-3" />
              <h3 className="font-bold text-lg">{liveAddon?.name ?? 'ET AI Live'}</h3>
              <p className="text-white/60 text-sm mt-2">{liveAddon?.blurb ?? 'Live voice and video with your teacher are part of ET AI Live.'}</p>
              <p className="text-2xl font-extrabold mt-4">{liveQuote ? formatMoney(liveQuote.amount, liveQuote.currency) : ''}<span className="text-sm font-medium text-white/50">/month</span></p>
              <p className="text-white/40 text-[11px] mt-1">Text, voice notes, and photos stay available. Live voice and video need ET AI Live.</p>
              <Link href="/pricing#addons" className="mt-5 block w-full h-11 rounded-full font-bold text-black grid place-items-center" style={{ background: accent }}>See ET AI Live</Link>
              <button type="button" onClick={() => setLivePrompt(false)} className="mt-3 text-white/50 text-xs font-semibold">Keep chatting</button>
            </div>
          </motion.div>
        )}
        {liveVoice && LiveSession && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40">
            <LiveSession teacher={teacher} lang={lang} camera={videoOn} onAsk={askByVoice} onClose={() => { liveRequest.current += 1; setLiveVoice(false); setVideoOn(false); }} />
          </motion.div>
        )}
      </AnimatePresence>

      <header className="min-h-12 px-2 py-1 flex flex-wrap items-center justify-between gap-1 border-b border-white/10 shrink-0 bg-[#121E22]">
        {variant === 'dock' ? <span className="text-sm font-semibold">{teacher.name}</span> : (
          <Link href={backHref} className="min-h-11 px-2 inline-flex items-center gap-2 text-sm font-semibold text-white/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white rounded-full">
            <Image src={teacher.avatarUrl} alt={portraitAlt(teacher.name)} width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
            <ArrowLeft className="w-4 h-4" /><span className="hidden sm:inline">AI Teachers</span>
          </Link>
        )}
        <span className="text-[11px] font-bold tracking-widest uppercase truncate max-w-[40vw]">Live · {teacher.name}</span>
        <div className="flex items-center gap-1 flex-wrap justify-end">
          <div className="relative">
            <button type="button" onClick={() => setLangOpen(open => !open)} className="text-white/70 min-w-11 min-h-11 grid place-items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" aria-label="Content language" aria-expanded={langOpen} aria-haspopup="listbox"><Globe className="w-4 h-4" /></button>
            {langOpen && (
              <div role="listbox" aria-label="Languages" className="absolute top-full right-0 mt-1 w-52 max-h-64 overflow-y-auto rounded-xl bg-[#15161c] border border-white/10 py-1 z-40">
                {LANGUAGES.map(language => (
                  <button key={language.code} type="button" role="option" aria-selected={language.code === lang} onClick={() => { applyAppLanguage(language.code, { explicit: true }); setLang(language.code); setLangOpen(false); }}
                    className={`w-full text-start min-h-11 px-3 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${language.code === lang ? 'bg-white/10' : 'text-white/70'}`}>
                    {language.flag} {language.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" onClick={() => openLive(false)} className="min-h-11 min-w-11 text-xs font-bold px-2 rounded-full text-black inline-flex items-center justify-center gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" style={{ background: accent }} aria-label="Live voice">
            <Phone className="w-4 h-4" />{!liveUnlocked && <Lock className="w-3 h-3" aria-hidden />}
          </button>
          <button type="button" onClick={() => openLive(true)} className="min-h-11 min-w-11 text-xs font-bold px-2 rounded-full border border-white/15 inline-flex items-center justify-center gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" aria-label="Video session">
            <Video className="w-4 h-4" />{!liveUnlocked && <Lock className="w-3 h-3" aria-hidden />}
          </button>
          <button type="button" onClick={newSession} className="min-w-11 min-h-11 grid place-items-center text-white/70 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" aria-label="New session"><RotateCcw className="w-4 h-4" /></button>
          <button type="button" onClick={() => { setAutoPlay(value => { const next = !value; localStorage.setItem('poket-teacher-autoplay', next ? '1' : '0'); if (!next) speakerRef.current?.stop(); return next; }); }} className="min-w-11 min-h-11 grid place-items-center text-white/70 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" aria-pressed={autoPlay} aria-label={autoPlay ? 'Auto-play voice replies on' : 'Auto-play voice replies off'}>
            {autoPlay && replyMode === 'voice' ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          {variant === 'session' && <Link href={backHref} className="min-w-11 min-h-11 grid place-items-center text-white/50 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" aria-label="End session"><X className="w-4 h-4" /></Link>}
          {variant === 'dock' && onClose && <button type="button" onClick={onClose} className="min-w-11 min-h-11 grid place-items-center text-white/50 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" aria-label="Close chat"><X className="w-4 h-4" /></button>}
        </div>
      </header>

      {notices.length > 0 && (
        <div role="status" className="px-3 py-2 bg-[var(--ps-cyan-soft)] text-[var(--ps-cyan-text)] text-xs space-y-1 shrink-0">
          {notices.map(note => <p key={note}>{note}</p>)}
        </div>
      )}

      <main className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {variant !== 'dock' && (
          <div className="relative shrink-0 lg:w-[34%] h-[22dvh] lg:h-auto grid place-items-center border-b lg:border-b-0 lg:border-r border-white/10">
            <div className="text-center">
              <motion.div animate={speaking ? { scale: [1, 1.05, 1] } : { scale: 1 }} transition={{ repeat: speaking ? Infinity : 0, duration: 0.7 }}
                className="mx-auto w-20 h-20 lg:w-36 lg:h-36" style={{ boxShadow: `0 0 50px -12px ${accent}`, borderRadius: '9999px' }}>
                <Image src={teacher.avatarUrl} alt={portraitAlt(teacher.name)} width={144} height={144} className="h-full w-full rounded-full object-cover" />
              </motion.div>
              <h2 className="mt-2 font-heading text-lg">{teacher.name}</h2>
              <p className="text-xs text-white/50">{speaking ? 'Speaking' : thinking ? 'Thinking' : teacher.title}</p>
            </div>
          </div>
        )}
        <div className="flex-1 flex flex-col min-h-0">
          <div role="tablist" aria-label="Conversation" className="flex border-b border-white/10 text-xs font-semibold shrink-0 overflow-x-auto">
            {([
              ['chat', 'Chat', <MessageSquare key="c" className="w-3.5 h-3.5" />],
              ['board', 'Workboard', <ClipboardList key="b" className="w-3.5 h-3.5" />],
              ['notes', 'Notes', <StickyNote key="n" className="w-3.5 h-3.5" />],
              ['transcript', 'Transcript', <BookOpen key="t" className="w-3.5 h-3.5" />],
            ] as const).map(([id, label, icon]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); if (id === 'board') { boardBadge.current = 0; setUnseenBoard(0); } }}
                className={`min-h-11 px-3 py-2 inline-flex items-center gap-1 border-b-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${tab === id ? 'text-white' : 'text-white/40 border-transparent'}`}
                style={tab === id ? { borderColor: accent } : undefined}>
                {icon} {label}
                {id === 'board' && unseenBoard > 0 ? <span className="text-[9px] text-black px-1 rounded-full" style={{ background: accent }}>{unseenBoard}</span> : null}
              </button>
            ))}
            {score.total > 0 && <span className="ml-auto self-center pr-3 text-success">{score.right}/{score.total}</span>}
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
              <textarea value={notes} onChange={event => setNotes(event.target.value)} aria-label="Notes" placeholder="Notes stay on this device." className="w-full min-h-[220px] rounded-2xl bg-white/5 border border-white/10 p-3 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" />
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
            {noteStatus && <p role="status" className="text-xs text-[var(--ps-cyan-text)] px-2 pb-1">{noteStatus}</p>}
            <div className="flex gap-1 overflow-x-auto pb-2">
              {TEACHER_QUICK_PROMPTS.map(action => (
                <button key={action.id} type="button" disabled={thinking} onClick={() => send(action.prompt)} className="shrink-0 text-[11px] border border-white/10 rounded-full px-3 py-1 inline-flex items-center gap-1">
                  {quickIcons[action.id]} {action.label}
                </button>
              ))}
            </div>
            {pendingImage && <img src={pendingImage} alt="Ready to send" className="h-16 rounded-lg mb-2" data-photo-pending="1" />}
            <div className="mb-2 flex flex-wrap items-center gap-1">
              <button type="button" onClick={() => fileRef.current?.click()} className="rounded-full border border-current/20 px-2.5 py-1.5 text-xs font-semibold" aria-label="Upload photo">Upload photo</button>
              <button type="button" data-attach="1" onClick={() => fileRef.current?.click()} className="rounded-full border border-current/20 px-2.5 py-1.5 text-xs font-semibold" aria-label="Attach">Attach</button>
              <button type="button" data-camera="1" onClick={() => cameraRef.current?.click()} className="rounded-full border border-current/20 px-2.5 py-1.5 text-xs font-semibold" aria-label="Camera">Camera</button>
              <button type="button" data-file="1" onClick={() => fileRef.current?.click()} className="rounded-full border border-current/20 px-2.5 py-1.5 text-xs font-semibold">File</button>
              <button type="button" onClick={() => setSkillsOpen(open => !open)} className="rounded-full border border-current/20 px-2.5 py-1.5 text-xs font-semibold" aria-expanded={skillsOpen}>Skills</button>
              <button type="button" aria-label="Read aloud" className="rounded-full border border-current/20 px-2.5 py-1.5 text-xs font-semibold" onClick={() => { const last = [...messages].reverse().find(message => message.role === 'model'); if (last) playReply(last.text); }}>Read aloud</button>
              <input value={subject} onChange={event => setSubject(event.target.value)} aria-label="Subject" placeholder="Subject" className="w-28 rounded-full border border-current/20 bg-transparent px-2.5 py-1.5 text-xs" />
              <LevelMenu ariaLabel="Level" value={level} valueKind="label" allowEmpty emptyLabel="Level" onChange={setLevel} className="w-44" />
              <select value={modeChoice} onChange={event => setModeChoice(event.target.value)} aria-label="Mode" className="rounded-full border border-current/20 bg-transparent px-2 py-1.5 text-xs">
                <option value="">Mode</option>
                <option value="k12">School</option>
                <option value="college">College</option>
                <option value="professional">Professional</option>
                <option value="legal">Law</option>
              </select>
            </div>
            {skillsOpen ? (
              <div className="mb-2 flex flex-wrap gap-1">
                {['Tutor chat', 'Flashcards', 'Quiz', 'Lesson', 'Worksheet'].map(name => (
                  <button key={name} type="button" onClick={() => { setSkill(name === 'Tutor chat' ? '' : name); setSkillsOpen(false); }} className="rounded-full border border-current/20 px-2.5 py-1 text-[11px] font-semibold">
                    {name}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="flex items-end gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="w-11 h-11 rounded-full border border-white/15 grid place-items-center shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" aria-label="Attach a photo"><Camera className="w-4 h-4" /></button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-label="Photo upload" data-photo-file="1" onChange={event => { onPhoto(event.target.files?.[0]); event.target.value = ''; }} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Camera photo" data-camera-file="1" onChange={event => { onPhoto(event.target.files?.[0]); event.target.value = ''; }} />
              <button type="button" data-mic="1" onClick={() => void startRecording()} aria-pressed={recording} className={`w-11 h-11 rounded-full grid place-items-center shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${recording ? 'bg-[#1E6A83]' : 'border border-white/15'}`} aria-label={recording ? 'Stop and send voice note' : 'Record a voice note'}>
                {recording ? <PhoneOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <label htmlFor={`teacher-reply-${teacher.id}`} className="text-[11px] text-white/60 self-center shrink-0">
                Reply
                <select id={`teacher-reply-${teacher.id}`} value={replyMode} onChange={event => { const next = event.target.value === 'voice' ? 'voice' : 'text'; setReplyMode(next); localStorage.setItem('poket-teacher-reply', next); }} className="ml-1 bg-transparent min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                  <option value="text">Text</option>
                  <option value="voice">Voice</option>
                </select>
              </label>
              <textarea value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }}
                aria-label={`Message ${teacher.name}`} placeholder={`Message ${teacher.name}`} rows={1} className="flex-1 min-w-0 resize-none max-h-28 rounded-2xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" />
              <button type="button" onClick={() => send()} disabled={thinking || (!input.trim() && !pendingImage)} aria-label="Send message" className="w-11 h-11 rounded-full grid place-items-center text-black disabled:opacity-30 shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" style={{ background: accent }}>
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
        <button type="button" onClick={onPlay} className="min-h-11 inline-flex items-center gap-1 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" aria-label="Play this reply"><Play className="w-3 h-3" style={{ color: accent }} /> Play</button>
        {lang !== 'en' && (
          <button type="button" aria-pressed={wantEnglish} onClick={() => setWantEnglish(value => !value)} className="min-h-11 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
            {english.status === 'loading' ? 'Translating…' : wantEnglish ? `Show ${teacher.name}` : 'Show English'}
          </button>
        )}
        {english.status === 'unavailable' && wantEnglish && <span>{english.notice || 'English is unavailable right now.'}</span>}
      </div>
    </div>
  );
}
