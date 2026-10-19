'use client';

/**
 * AI Studio — ET AI.
 * One thread where ET AI tutors and generates study formats.
 * Dark canvas by default. Cyan #3FE0D0 on #203337 ink. The site theme toggle stays outside this shell.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';
import { MathMarkdown } from '@/components/math-markdown';
import { readLanguage } from '@/lib/languages';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { NotificationsBell } from '@/components/notifications-bell';
import { PipGuide } from '@/components/pip-guide';
import { SparksChip } from '@/components/sparks-chip';
import { CurrencySwitcher } from '@/components/currency-switcher';
import { DashboardSearch } from '@/components/dashboard-search';
import { AccountMenu } from '@/components/account/account-menu';
import { useAccountMode } from '@/hooks/use-account-mode';
import { homeForMode, MODE_NAMES, type AccountMode } from '@/lib/account-modes';
import { resolveStaffRole } from '@/lib/admin-console';
import type { TourRole } from '@/lib/tour-steps';
import { DeskFrame } from '@/components/studio/desk-frame';
import { ToolLoading } from '@/components/studio/boot';
import {
  Sparkles, ArrowUp, ArrowLeft, Library, MessageSquare, Home,
  FileText, ClipboardList, Network, BookMarked,
  Presentation, Image as ImageIcon, Calculator, FlipHorizontal,
  Loader2, Save, Trash2, Copy, Plus, ChevronRight, User as UserIcon,
  RefreshCw, X, Menu, Mic, Volume2, Camera, Paperclip,
  Video, Headphones, Asterisk, Phone, HelpCircle, Search,
} from 'lucide-react';
import { AI_TEACHERS, ET_AI_TUTOR, type AiTeacher } from '@/lib/ai-teachers';
import { TeacherPortrait } from '@/components/teachers/portrait';
import { ET_COPY } from '@/lib/studio/et-copy';
import { RECOGNITION_LANG } from '@/lib/languages';
import type { Speaker } from '@/lib/speech';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  getAiGenerations, deleteAiGeneration, saveAiGeneration, type AiGeneration,
} from '@/lib/db';
import { PROGRAMMES, studioModeForProgramme, subjectsForProgramme } from '@/lib/programmes';
import { bookSourcePrompt, parseBookCommand } from '@/lib/platform/studio-commands';
import { useAuthSTORE } from '@/hooks/use-auth';
import { BOOKS, bookById } from '@/lib/reads/seed';
import { canUseDeskTool, type DeskToolId } from '@/lib/studio/desk';
import { STUDIO_TIMETABLE } from '@/lib/studio-paths';
import { studioTimetableGate } from '@/lib/timetable/access';
import { TIMETABLE_COPY } from '@/lib/timetable/copy';

const MindmapRenderer = dynamic(() => import('@/components/mindmap-renderer').then(mod => mod.MindmapRenderer), {
  loading: () => <ToolLoading label="Loading this ET AI tool" />,
});
const InfographicRenderer = dynamic(() => import('@/components/infographic-renderer').then(mod => mod.InfographicRenderer), {
  loading: () => <ToolLoading label="Loading this ET AI tool" />,
});
const VideoStoryboard = dynamic(() => import('@/components/video-storyboard').then(mod => mod.VideoStoryboard), {
  loading: () => <ToolLoading label="Loading this ET AI tool" />,
});
const VideoPlayer = dynamic(() => import('@/components/video-player').then(mod => mod.VideoPlayer), {
  loading: () => <ToolLoading label="Loading this ET AI tool" />,
});
const SmartAudioPlayer = dynamic(() => import('@/components/smart-audio-player').then(mod => mod.SmartAudioPlayer), {
  loading: () => <ToolLoading label="Loading this ET AI tool" />,
});
const EssaysDesk = dynamic(() => import('@/components/essays/essays-desk').then(mod => mod.EssaysDesk), {
  loading: () => <ToolLoading label="Loading ET Essays" tall />,
});
const HandwritingCapture = dynamic(() => import('@/components/handwriting-capture').then(mod => mod.HandwritingCapture), { ssr: false });
const TeacherToolkitPanel = dynamic(() => import('@/components/studio/desk-panels').then(mod => mod.TeacherToolkitPanel), {
  loading: () => <ToolLoading label="Loading Teacher Toolkit" tall />,
});
const ParentExplainerPanel = dynamic(() => import('@/components/studio/desk-panels').then(mod => mod.ParentExplainerPanel), {
  loading: () => <ToolLoading label="Loading Parent Explainer" tall />,
});
const ResearchHelperPanel = dynamic(() => import('@/components/studio/desk-panels').then(mod => mod.ResearchHelperPanel), {
  loading: () => <ToolLoading label="Loading Research Helper" tall />,
});

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

const SUGGESTIONS = [
  { label: 'Make a video on photosynthesis', format: 'videoScript' as FormatId, text: 'Photosynthesis' },
  { label: 'Quiz me on the French Revolution', format: 'quiz' as FormatId, text: 'The French Revolution' },
  { label: 'Explain quadratic equations', format: null, text: 'Can you explain how to solve quadratic equations?' },
  { label: 'Flashcards for the periodic table', format: 'flashcards' as FormatId, text: 'The periodic table — first 20 elements' },
];

type Turn =
  | { kind: 'user'; text: string; skill?: FormatId; image?: string }
  | { kind: 'chat'; text: string }
  | { kind: 'gen'; format: FormatId; data: any; prompt: string; saved?: boolean };

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

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

const TEACHERS: AiTeacher[] = [ET_AI_TUTOR, ...AI_TEACHERS];
const CHAT_STORE = 'poket-et-studio-chats';

interface Chat { id: number; title: string; turns: Turn[] }

/* Dark studio canvas. Cyan #3FE0D0 with #203337 ink. No gold, mustard, or olive. */
const C = {
  bg: 'bg-[#1A1918]',
  surface: 'bg-[#242220]',
  surfaceHover: 'hover:bg-[#2B2927]',
  raised: 'bg-[#2B2927]',
  border: 'border-[#3A3733]',
  borderSoft: 'border-[#2E2B28]',
  text: 'text-[#EDEAE4]',
  dim: 'text-[#C8C2B8]',
  faint: 'text-[#B7B1A4]',
  accent: '#3FE0D0',
  accentInk: '#203337',
};
const FILL = '#3FE0D0';
const HERO = 'linear-gradient(160deg, #0B1417 0%, #1E6A83 62%, #3FE0D0 140%)';
const PROSE_CLASSES = 'prose prose-sm prose-invert max-w-none prose-headings:font-heading prose-headings:text-[#EDEAE4] prose-p:text-[#EDEAE4] prose-strong:text-white prose-li:text-[#EDEAE4] prose-a:text-[#3FE0D0]';
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3FE0D0]';
const STUDIO_VARS = {
  '--background': '#1A1918',
  '--foreground': '#EDEAE4',
  '--card': '#242220',
  '--card-foreground': '#EDEAE4',
  '--muted': '#2B2927',
  '--muted-foreground': '#C8C2B8',
  '--border': '#3A3733',
  '--input': '#3A3733',
  '--sidebar': '#1F1E1C',
  '--sidebar-foreground': '#EDEAE4',
  '--sidebar-border': '#2E2B28',
  '--secondary-foreground': '#3FE0D0',
  colorScheme: 'dark',
} as React.CSSProperties;

const MODE_OPTIONS = [
  { id: 'k12', label: 'School' },
  { id: 'college', label: 'College' },
  { id: 'professional', label: 'Professional' },
  { id: 'legal', label: 'Law' },
] as const;

function plannerHref(role: string | undefined): string {
  if (role === 'teacher') return '/dashboard/teacher/planner';
  if (role === 'parent') return '/dashboard/parent/planner';
  if (role === 'admin' || role === 'super_admin' || role === 'content_editor') return '/dashboard/admin/planner';
  if (role === 'institution_admin') return '/dashboard/calendar';
  return '/dashboard/student/planner';
}

interface StudioToolLink {
  href: string;
  label: string;
  entry?: 'timetable';
}

/** Every studio destination, once. The timetable link is only for teachers and schools. */
function studioToolLinks(embedded: boolean, role: string | undefined, showTimetable: boolean): StudioToolLink[] {
  const links: StudioToolLink[] = [
    { href: '/dashboard/studio', label: 'AI Studio' },
    { href: '/dashboard/studio/et', label: 'ET AI' },
    { href: embedded ? '/dashboard/studio/teachers' : '/ai-teachers', label: 'AI Teachers' },
    { href: embedded ? '/ai-teachers' : '/dashboard/studio/teachers', label: 'ET + Subject' },
    { href: '/dashboard/studio/maths', label: 'ET Maths' },
    { href: '/dashboard/studio/exam-prep', label: 'ET Exams' },
    { href: '/dashboard/studio/essays', label: 'ET Essays' },
    { href: '/reads/studio', label: 'Book Studio' },
    { href: '/reads', label: 'PoketReads' },
    { href: '/dashboard/admin/books', label: 'AI Book Creator' },
    { href: '/dashboard/store', label: 'Creator Store' },
    { href: plannerHref(role), label: 'Planner' },
    { href: '/dashboard/calendar', label: 'Calendar' },
  ];
  if (showTimetable) {
    links.push({ href: STUDIO_TIMETABLE, label: TIMETABLE_COPY.studioTab, entry: 'timetable' });
  }
  return links;
}

const SIDE_LINK = `flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm ${C.dim} ${C.surfaceHover} hover:text-[#EDEAE4] transition-colors`;
const CHIP = 'rounded-full border border-[#3A3733] bg-[#242220] px-2.5 py-1 text-[11px] font-semibold leading-none text-[#EDEAE4] hover:border-[#3FE0D0]';

/** Students land on /dashboard. Other roles open their own home. */
function dashboardHomeHref(role: string | undefined): string {
  if (role === 'teacher') return '/dashboard/teacher';
  if (role === 'parent') return '/dashboard/parent';
  if (role === 'institution_admin') return '/dashboard/institution';
  if (role === 'admin' || role === 'super_admin' || role === 'content_editor') return '/dashboard/admin';
  if (role === 'partner_merchant') return '/dashboard/partner';
  return '/dashboard';
}

function safelineHref(role: string | undefined): string {
  if (role === 'teacher') return '/dashboard/teacher/hotline';
  if (role === 'parent') return '/dashboard/parent/hotline';
  if (role === 'admin' || role === 'super_admin' || role === 'content_editor') return '/dashboard/admin/hotline';
  if (role === 'institution_admin') return '/dashboard/institution/hotline';
  return '/dashboard/student/safety';
}

const TOUR_ROLES = new Set<string>(['student', 'teacher', 'parent', 'admin', 'institution_admin']);

/** Pip, theme, language, notifications, sparks, currency, and search. The account chip stays in the sidebar. */
function StudioEssentials() {
  const profile = useAuthSTORE(state => state.profile);
  const tourRole = (TOUR_ROLES.has(profile?.role ?? '') ? profile?.role : 'student') as TourRole;
  return (
    <div className="flex min-w-0 items-center justify-end gap-1 overflow-x-auto" data-studio-essentials="1">
      <div className="[&_[data-tour=pip-trigger]_span]:sr-only">
        <PipGuide role={tourRole} />
      </div>
      <ThemeToggle onDark />
      <LanguageSwitcher tone="onDark" />
      <NotificationsBell tone="onDark" />
      <SparksChip />
      <CurrencySwitcher tone="onDark" />
      <div className="relative">
        <button
          type="button"
          aria-label="Search"
          className="grid h-9 w-9 place-items-center rounded-xl text-[#EDEAE4] hover:bg-white/10"
          onClick={() => document.getElementById('dashboard-search')?.focus()}
        >
          <Search className="h-4 w-4" aria-hidden />
        </button>
        <div className="absolute end-0 top-11 z-30 w-[min(22rem,80vw)] opacity-0 pointer-events-none focus-within:opacity-100 focus-within:pointer-events-auto">
          <DashboardSearch />
        </div>
      </div>
    </div>
  );
}

function StudioAccountChip({ email }: { email: string }) {
  const router = useRouter();
  const profile = useAuthSTORE(state => state.profile);
  const account = useAccountMode();
  const showModes = account.modes.length > 1 || account.canBecome;
  const roleLabel = account.mode ? MODE_NAMES[account.mode] : (profile?.role ?? 'Student');
  const chooseMode = (next: AccountMode) => {
    account.setMode(next);
    router.push(homeForMode(next));
  };
  return (
    <AccountMenu
      name={profile?.displayName || profile?.name || email || 'User'}
      email={email || profile?.email || ''}
      roleLabel={roleLabel}
      staffHome={Boolean(resolveStaffRole(profile))}
      modes={account.modes}
      activeMode={account.mode}
      onSwitchMode={showModes ? chooseMode : undefined}
      onBecomeInstructor={account.canBecome ? () => router.push('/dashboard/student/become-instructor') : undefined}
    >
      <span className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 ${C.surface}`}>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold text-[#203337]" style={{ background: FILL }}>
          {(email || 'U').slice(0, 2).toUpperCase()}
        </span>
        <span className={`truncate text-xs ${C.dim}`}>{email}</span>
      </span>
    </AccountMenu>
  );
}

/* Rotating status lines ET shows while working. */
const THINKING_PHRASES = [
  'Searching and thinking the best solutions for you…',
  'Good question — connecting the dots…',
  'Reasoning it through, step by step…',
  'Almost there — sharpening the answer…',
];
const CREATING_PHRASES = [
  'ET AI is working on this…',
  'Searching for a clear path…',
  'Connecting the ideas…',
  'Checking the steps…',
  'Polishing the result…',
];

function PocoWorking({ creating }: { creating: boolean }) {
  const reduce = useReducedMotion();
  const phrases = creating ? CREATING_PHRASES : THINKING_PHRASES;
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setIdx(i => (i + 1) % phrases.length), 2400);
    return () => clearInterval(t);
  }, [phrases.length, reduce]);
  return (
    <div className="flex gap-3" role="status" aria-live="polite">
      <motion.div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1"
        style={{ background: FILL }}
        animate={reduce ? undefined : { rotate: 360, scale: [1, 1.08, 1] }}
        transition={reduce ? undefined : { rotate: { repeat: Infinity, duration: 3.5, ease: 'linear' }, scale: { repeat: Infinity, duration: 1.6 } }}
      >
        <Asterisk className="w-4 h-4" style={{ color: C.accentInk }} aria-hidden />
      </motion.div>
      <div className="flex items-center gap-2.5 py-2 min-h-[36px]">
        <span className="flex gap-1" aria-hidden>
          {[0, 1, 2].map(d => (
            <motion.span key={d} className="w-1.5 h-1.5 rounded-full" style={{ background: FILL }}
              animate={reduce ? undefined : { opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
              transition={reduce ? undefined : { repeat: Infinity, duration: 1.1, delay: d * 0.18 }} />
          ))}
        </span>
        <AnimatePresence mode="wait">
          <motion.span
            key={idx}
            initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
            transition={{ duration: 0.35 }}
            className="text-sm text-muted-foreground"
          >
            {phrases[idx]}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

export function AiStudio({ embedded = false }: { embedded?: boolean } = {}) {
  const frame = embedded ? 'min-h-0 flex-1' : 'h-dvh';
  const [user, setUser] = useState<User | null>(null);
  /** Undefined until Firebase reports the first auth state — prevents a
   * sign-in flash for users who are already logged in. */
  const [authReady, setAuthReady] = useState(false);
  const [view, setView] = useState<'chat' | 'library' | 'essays' | 'tools' | DeskToolId>('chat');
  const profile = useAuthSTORE(state => state.profile);
  const timetableGate = studioTimetableGate({
    role: profile?.role,
    roles: profile?.roles,
    permissions: profile?.permissions,
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sidebarOpen]);

  // Conversations (session-scoped, like Claude's recents)
  const [chats, setChats] = useState<Chat[]>([{ id: 1, title: 'New chat', turns: [] }]);
  const [activeChatId, setActiveChatId] = useState(1);
  const chatsRef = useRef(chats);
  chatsRef.current = chats;
  const activeRef = useRef(activeChatId);
  activeRef.current = activeChatId;
  const chat = chats.find(c => c.id === activeChatId) ?? chats[0];

  // Composer
  const [input, setInput] = useState('');
  const [skill, setSkill] = useState<FormatId | null>(null);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState('');
  const derivedMode = level ? studioModeForProgramme(level) : 'k12';
  const [modeChoice, setModeChoice] = useState<string>('');
  const chatMode = (modeChoice || derivedMode) as typeof derivedMode;
  const subjectOptions = subjectsForProgramme(level);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [streamText, setStreamText] = useState('');
  const [pendingImage, setPendingImage] = useState('');
  const [recording, setRecording] = useState(false);
  const [noteStatus, setNoteStatus] = useState('');
  const [teacherId, setTeacherId] = useState(ET_AI_TUTOR.id);
  const [storeReady, setStoreReady] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const teacher = TEACHERS.find(item => item.id === teacherId) ?? ET_AI_TUTOR;

  // Library
  const [library, setLibrary] = useState<AiGeneration[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const browserTranscript = useRef('');
  const speakerRef = useRef<Speaker | null>(null);
  const sentQuery = useRef(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setAuthReady(true); }), []);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAT_STORE);
      if (raw) {
        const parsed = JSON.parse(raw) as { chats?: Chat[]; active?: number };
        if (parsed.chats?.length) {
          setChats(parsed.chats);
          if (parsed.active) setActiveChatId(parsed.active);
        }
      }
    } catch { /* private mode */ }
    setStoreReady(true);
  }, []);
  useEffect(() => {
    if (!storeReady) return;
    try {
      const slim = chats.map(item => ({
        ...item,
        turns: item.turns.map(turn => turn.kind === 'user' ? { kind: 'user' as const, text: turn.text, skill: turn.skill } : turn),
      })).slice(-20);
      localStorage.setItem(CHAT_STORE, JSON.stringify({ chats: slim, active: activeChatId }));
    } catch { /* full */ }
  }, [activeChatId, chats, storeReady]);
  useEffect(() => { if (view === 'library' && user) loadLibrary(); }, [view, user]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat.turns.length, busy, streamText]);

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
    const lang = readLanguage();
    const prompt = `Topic: ${topic}\nSubject: ${subject || 'general'}\nLevel: ${level}`;
    const token = await auth.currentUser?.getIdToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch('/api/ai/generate', {
      method: 'POST',
      headers,
      body: JSON.stringify({ content: prompt, format, language: lang !== 'en' ? lang : undefined }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Generation failed (${res.status})`);
    }
    const data = await res.json();
    pushTurns(chatId, { kind: 'gen', format, data: data.result, prompt });
  };

  /* ── Tutor turn. Streams when the model key is present. ── */
  const runTutor = async (chatId: number, message: string, history: Turn[], bookContext?: string, image?: string) => {
    const chatTurns = history
      .filter((t): t is Extract<Turn, { kind: 'user' | 'chat' }> => t.kind === 'user' || t.kind === 'chat')
      .map(t => ({ role: t.kind === 'user' ? 'user' : 'model', text: t.text }));
    const token = await auth.currentUser?.getIdToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch('/api/ai/tutor', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        mode: chatMode,
        history: chatTurns,
        language: readLanguage(),
        bookContext,
        stream: true,
        image,
        persona: `${teacher.name}, ${teacher.title}. You teach for Poket School. Call yourself ${teacher.name}.`,
      }),
    });
    const contentType = res.headers.get('content-type') ?? '';
    if (!res.ok || contentType.includes('application/json') || !res.body) {
      const err = await res.json().catch(() => ({} as { error?: string }));
      throw new Error(err.error || `ET AI hit an error (${res.status})`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    setStreamText('');
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      full += decoder.decode(value, { stream: true });
      setStreamText(full);
    }
    setStreamText('');
    pushTurns(chatId, { kind: 'chat', text: full.trim() || ET_COPY.emptyReply });
  };

  const submit = async (overrideText?: string, overrideSkill?: FormatId | null, imageOverride?: string) => {
    const text = (overrideText ?? input).trim();
    const useSkill = overrideSkill !== undefined ? overrideSkill : skill;
    const image = imageOverride ?? pendingImage;
    if ((!text && !image) || busy) return;
    const chatId = activeRef.current;
    const historySnapshot = chatsRef.current.find(item => item.id === chatId)?.turns ?? [];
    setInput('');
    setPendingImage('');
    setBusy(true);
    setView('chat');
    pushTurns(chatId, { kind: 'user', text: text || 'Please look at this photo.', skill: useSkill ?? undefined, image: image || undefined });
    const command = parseBookCommand(text, BOOKS);
    const attached = command?.matched ? bookById(command.bookId) : undefined;
    if (command && !attached) {
      pushTurns(chatId, { kind: 'chat', text: `I can't find a book called “${command.bookId}”. Try /book harbour-light.` });
      setBusy(false);
      return;
    }
    const prompt = attached ? bookSourcePrompt(attached, command?.rest ?? '') : (text || 'Please look at this photo and help me with it. Read any homework question in the photo.');
    try {
      if (useSkill && !image) await runGeneration(chatId, useSkill, prompt);
      else await runTutor(
        chatId,
        attached ? (command?.rest || `Teach ${attached.title}`) : prompt,
        historySnapshot,
        attached ? prompt : undefined,
        image || undefined,
      );
    } catch (e: any) {
      pushTurns(chatId, { kind: 'chat', text: `Sorry — ${e?.message || 'something went wrong'}. Try again.` });
    } finally {
      setBusy(false);
      setStreamText('');
    }
  };

  const submitRef = useRef(submit);
  submitRef.current = submit;

  useEffect(() => {
    if (!storeReady || !authReady || !user || sentQuery.current) return;
    sentQuery.current = true;
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    if (mode === 'teacher-toolkit' || mode === 'parent-explainer' || mode === 'research-helper') setView(mode);
    const q = params.get('q')?.trim();
    if (!q) return;
    const id = Math.max(...chatsRef.current.map(item => item.id)) + 1;
    setChats(prev => [...prev, { id, title: q.slice(0, 42), turns: [] }]);
    setActiveChatId(id);
    activeRef.current = id;
    void submitRef.current(q, null);
  }, [authReady, storeReady, user]);

  const readAloud = async (text: string) => {
    const { Speaker: SpeakerCtor, SentenceStream } = await import('@/lib/speech');
    if (!speakerRef.current) speakerRef.current = new SpeakerCtor({});
    const lang = readLanguage();
    speakerRef.current.setOptions({
      voice: teacher.voice,
      style: teacher.voiceStyle,
      lang: RECOGNITION_LANG[lang] ?? 'en-GB',
    });
    const turn = speakerRef.current.begin();
    const sentences = new SentenceStream(sentence => speakerRef.current?.enqueue(sentence, turn));
    sentences.push(text);
    sentences.flush();
  };

  const onPhoto = (file: File | undefined) => {
    if (!file) return;
    if (file.type.startsWith('image/')) {
      if (file.size > 1_500_000) {
        setNoteStatus('That photo is too large. Use one under 1.5 MB.');
        return;
      }
      void fileToDataUrl(file).then(setPendingImage).catch(() => setNoteStatus('Could not read that photo.'));
      setNoteStatus('');
      return;
    }
    if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      void file.text().then(body => {
        const clip = body.slice(0, 8000);
        setInput(current => current.trim() ? `${current.trim()}\n${clip}` : clip);
      });
      return;
    }
    setNoteStatus('Choose a photo, or a text file.');
  };

  const transcribeNote = async (blob: Blob, heard: string) => {
    setNoteStatus(ET_COPY.listening);
    let transcript = '';
    try {
      const dataUrl = await fileToDataUrl(blob);
      const audio = dataUrl.split(',')[1] ?? '';
      const token = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers,
        body: JSON.stringify({ audio, mime: blob.type || 'audio/webm', language: readLanguage() }),
      });
      const data = await res.json().catch(() => ({} as { transcript?: string; reason?: string; error?: string }));
      if (typeof data.transcript === 'string' && data.transcript.trim()) transcript = data.transcript.trim();
      else if (heard) transcript = heard;
    } catch {
      if (heard) transcript = heard;
    }
    if (!transcript) {
      setNoteStatus(heard ? '' : ET_COPY.voiceMissing);
      if (heard) submitRef.current(heard, null, '');
      return;
    }
    setNoteStatus('');
    submitRef.current(transcript, null, '');
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
    const recognition = browserRecognition();
    if (!recognition && !navigator.mediaDevices?.getUserMedia) {
      setNoteStatus(ET_COPY.voiceMissing);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      browserTranscript.current = '';
      if (recognition) {
        recognition.lang = RECOGNITION_LANG[readLanguage()] ?? 'en-GB';
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.onresult = (event) => {
          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            if (event.results[index].isFinal) browserTranscript.current += ` ${event.results[index][0].transcript}`;
          }
        };
        try { recognition.start(); } catch { /* server transcript can still run */ }
        recognitionRef.current = recognition;
      }
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        const heard = browserTranscript.current.trim();
        void transcribeNote(blob, heard);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setNoteStatus(ET_COPY.listening);
    } catch {
      if (recognition) {
        setNoteStatus(ET_COPY.listening);
        recognition.onresult = (event) => {
          let heard = '';
          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            if (event.results[index].isFinal) heard += ` ${event.results[index][0].transcript}`;
          }
          const text = heard.trim();
          if (text) {
            setNoteStatus('');
            setRecording(false);
            submitRef.current(text, null, '');
          }
        };
        recognition.onend = () => setRecording(false);
        try { recognition.start(); setRecording(true); } catch { setNoteStatus(ET_COPY.voiceMissing); }
        return;
      }
      setNoteStatus(ET_COPY.voiceMissing);
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

  // ── Auth gate: AI Studio is a paid feature and must not run anonymously ──
  if (!authReady) {
    return (
      <div className={`flex ${frame} items-center justify-center ${C.bg}`} >
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: C.accent }} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`dark flex ${frame} items-center justify-center px-5 ${C.bg} ${C.text}`} style={STUDIO_VARS} data-studio-layout="dark">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md text-center"
        >
          <motion.div
            initial={{ scale: 0.6, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', damping: 14 }}
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: FILL, boxShadow: '0 0 48px rgba(63,224,208,0.35)' }}
          >
            <Asterisk className="w-8 h-8" style={{ color: C.accentInk }} />
          </motion.div>

          <h1 className="font-heading text-3xl sm:text-4xl leading-tight mb-3">
            Sign in to meet <span style={{ color: C.accent }}>ET AI</span>
          </h1>
          <p className={`${C.dim} text-[15px] leading-relaxed mb-7`}>
            ET AI turns any topic into lessons, quizzes, flashcards, mind maps, narrated video and
            audio, and saves everything to your personal library. Create a free Poket School account to start.
          </p>

          <div className="flex flex-col sm:flex-row gap-2.5 justify-center mb-8">
            <Link
              href="/signup"
              className="h-11 px-6 rounded-full font-bold text-sm flex items-center justify-center transition-transform hover:scale-105"
              style={{ background: FILL, color: C.accentInk }}
            >
              Create free account
            </Link>
            <Link
              href="/login"
              className={`h-11 px-6 rounded-full font-semibold text-sm flex items-center justify-center border ${C.border} ${C.surfaceHover} transition-colors`}
            >
              Sign in
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-8">
            {[
              { icon: <Video className="w-4 h-4" />, label: 'Video lessons' },
              { icon: <Headphones className="w-4 h-4" />, label: 'AI audio' },
              { icon: <ClipboardList className="w-4 h-4" />, label: 'Quizzes' },
            ].map(f => (
              <div key={f.label} className={`rounded-2xl border ${C.borderSoft} ${C.surface} py-3 px-2`}>
                <span className="flex justify-center mb-1.5" style={{ color: C.accent }}>{f.icon}</span>
                <p className={`text-[11px] ${C.dim}`}>{f.label}</p>
              </div>
            ))}
          </div>

          <Link href="/" className={`text-xs ${C.faint} hover:text-foreground transition-colors inline-flex items-center gap-1.5`}>
            <ArrowLeft className="w-3.5 h-3.5 ps-dir-icon" /> Back to Poket School
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`dark relative flex ${frame} ${C.bg} ${C.text} overflow-hidden ${FOCUS} [&_a]:focus-visible:outline [&_a]:focus-visible:outline-2 [&_a]:focus-visible:outline-offset-2 [&_a]:focus-visible:outline-[#3FE0D0] [&_button]:focus-visible:outline [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-2 [&_button]:focus-visible:outline-[#3FE0D0] [&_select]:focus-visible:outline [&_select]:focus-visible:outline-2 [&_select]:focus-visible:outline-[#3FE0D0] [&_input]:focus-visible:outline [&_input]:focus-visible:outline-2 [&_input]:focus-visible:outline-[#3FE0D0] [&_textarea]:focus-visible:outline [&_textarea]:focus-visible:outline-2 [&_textarea]:focus-visible:outline-[#3FE0D0]`} style={STUDIO_VARS} data-studio-layout="dark" data-studio-theme={resolvedTheme === 'light' ? 'dark-default' : 'dark'}>

      {/* ── Sidebar ── */}
      <aside aria-label="ET AI Studio" data-studio-sidebar="1" className={`${sidebarOpen ? 'flex' : 'hidden'} lg:flex h-full min-h-0 w-[min(264px,86vw)] shrink-0 flex-col overflow-hidden border-e ${C.borderSoft} bg-sidebar absolute lg:static inset-y-0 start-0 z-40 shadow-xl lg:shadow-none`}>
        <div className="shrink-0 p-3">
          <Link href={embedded ? '/dashboard/studio' : '/'} className="flex items-center gap-2.5 px-2 py-2 mb-1">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: FILL }}>
              <Asterisk className="w-5 h-5 text-[#203337]" />
            </div>
            <div>
              <p className="text-[15px] font-bold leading-tight">ET</p>
              <p className={`text-[10px] tracking-[0.2em] uppercase leading-tight`} style={{ color: C.accent }}>AI STUDIO</p>
            </div>
          </Link>
          {!embedded && (
            <div className="flex justify-end px-2">
              <LanguageSwitcher />
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
          <nav className="mt-1 space-y-0.5" aria-label="AI Studio">
            <Link
              href={dashboardHomeHref(profile?.role)}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-semibold ${C.text} ${C.surfaceHover}`}
            >
              <Home className="w-4 h-4" style={{ color: C.accent }} aria-hidden /> Dashboard
            </Link>
            <button
              onClick={newChat}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold border ${C.border} ${C.surfaceHover} transition-colors`}
            >
              <Plus className="w-4 h-4" style={{ color: C.accent }} /> New chat
            </button>
            <button
              onClick={() => { setView('chat'); setSidebarOpen(false); }}
              aria-current={view === 'chat' ? 'page' : undefined}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors ${view === 'chat' ? `${C.raised} ${C.text}` : `${C.dim} ${C.surfaceHover}`}`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: FILL }} aria-hidden />
              <MessageSquare className="w-4 h-4" aria-hidden /> Chats
            </button>
            <button
              onClick={() => { setView('library'); setSidebarOpen(false); }}
              aria-current={view === 'library' ? 'page' : undefined}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors ${view === 'library' ? `${C.raised} ${C.text}` : `${C.dim} ${C.surfaceHover}`}`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: FILL }} aria-hidden />
              <Library className="w-4 h-4" aria-hidden /> Library
            </button>
            <p className={`px-3 pt-4 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] ${C.faint}`}>Tools</p>
            <Link href="/dashboard/studio/maths" onClick={() => setSidebarOpen(false)} className={SIDE_LINK}>ET Maths</Link>
            <Link href="/dashboard/studio/exam-prep" onClick={() => setSidebarOpen(false)} className={SIDE_LINK}>ET Exams</Link>
            <Link href="/dashboard/studio/essays" onClick={() => setSidebarOpen(false)} className={SIDE_LINK}>ET Essays</Link>
            <Link href="/reads/studio" onClick={() => setSidebarOpen(false)} className={SIDE_LINK}>Book Studio</Link>
            {canUseDeskTool(profile, 'research-helper') && (
              <button
                onClick={() => { setView('research-helper'); setSidebarOpen(false); }}
                aria-current={view === 'research-helper' ? 'page' : undefined}
                className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors ${view === 'research-helper' ? `${C.raised} ${C.text}` : `${C.dim} ${C.surfaceHover}`}`}
              >
                <BookMarked className="w-4 h-4" style={{ color: C.accent }} aria-hidden /> Research Helper
              </button>
            )}
            {canUseDeskTool(profile, 'teacher-toolkit') && (
              <button
                onClick={() => { setView('teacher-toolkit'); setSidebarOpen(false); }}
                aria-current={view === 'teacher-toolkit' ? 'page' : undefined}
                className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors ${view === 'teacher-toolkit' ? `${C.raised} ${C.text}` : `${C.dim} ${C.surfaceHover}`}`}
              >
                <ClipboardList className="w-4 h-4" style={{ color: C.accent }} aria-hidden /> Teacher Toolkit
              </button>
            )}
            {canUseDeskTool(profile, 'parent-explainer') && (
              <button
                onClick={() => { setView('parent-explainer'); setSidebarOpen(false); }}
                aria-current={view === 'parent-explainer' ? 'page' : undefined}
                className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors ${view === 'parent-explainer' ? `${C.raised} ${C.text}` : `${C.dim} ${C.surfaceHover}`}`}
              >
                <UserIcon className="w-4 h-4" style={{ color: C.accent }} aria-hidden /> Parent Explainer
              </button>
            )}
            <Link href={embedded ? '/dashboard/studio/teachers' : '/ai-teachers'} onClick={() => setSidebarOpen(false)} className={SIDE_LINK}>AI Teachers</Link>
            <Link href={embedded ? '/ai-teachers' : '/dashboard/studio/teachers'} onClick={() => setSidebarOpen(false)} className={SIDE_LINK}>ET + Subject</Link>
            {timetableGate !== 'hidden' && (
              <Link href={STUDIO_TIMETABLE} onClick={() => setSidebarOpen(false)} className={SIDE_LINK} data-studio-entry="timetable">{TIMETABLE_COPY.studioTab}</Link>
            )}
            <Link href={plannerHref(profile?.role)} onClick={() => setSidebarOpen(false)} className={SIDE_LINK}>Planner</Link>
            <Link href="/dashboard/calendar" onClick={() => setSidebarOpen(false)} className={SIDE_LINK}>Calendar</Link>
            <button
              type="button"
              onClick={() => { setView('tools'); setSidebarOpen(false); }}
              aria-current={view === 'tools' ? 'page' : undefined}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors ${view === 'tools' ? `${C.raised} ${C.text}` : `${C.dim} ${C.surfaceHover}`}`}
            >
              <Sparkles className="w-4 h-4" style={{ color: C.accent }} aria-hidden /> All tools
            </button>
          </nav>

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
        <div className={`shrink-0 space-y-1 border-t p-3 ${C.borderSoft}`}>
          {user ? (
            <StudioAccountChip email={user.email ?? ''} />
          ) : (
            <Link href="/login" className={`flex items-center gap-2 text-xs ${C.dim} hover:text-foreground px-2.5 py-2`}>
              <UserIcon className="w-3.5 h-3.5" /> Sign in to save
            </Link>
          )}
          <Link href={safelineHref(profile?.role)} className={`flex items-center gap-2 px-2.5 py-1.5 text-xs ${C.dim} hover:text-foreground transition-colors`}>
            <Phone className="h-3.5 w-3.5" aria-hidden /> Poket SafeLine
          </Link>
          <Link href="/dashboard/helpdesk" className={`flex items-center gap-2 px-2.5 py-1.5 text-xs ${C.dim} hover:text-foreground transition-colors`}>
            <HelpCircle className="h-3.5 w-3.5" aria-hidden /> Help Center
          </Link>
          <Link href="/" className={`flex items-center gap-2 text-xs ${C.faint} hover:text-foreground px-2.5 py-1.5 transition-colors`}>
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Poket School
          </Link>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && <button type="button" className="fixed inset-0 bg-black/50 z-30 lg:hidden" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}

      {/* ── Main ── */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        {embedded && view !== 'chat' ? (
          <div className={`flex shrink-0 items-center justify-end border-b px-2 py-1 ${C.borderSoft}`}>
            <StudioEssentials />
          </div>
        ) : null}
        {/* Mobile top bar */}
        <div className={`flex lg:hidden items-center gap-2 overflow-x-auto px-3 py-2 border-b ${C.borderSoft}`} data-studio-tools="row">
          <button type="button" onClick={() => setSidebarOpen(true)} className={C.dim} aria-label="Open ET AI menu" aria-expanded={sidebarOpen}><Menu className="w-5 h-5" /></button>
          <Link href={dashboardHomeHref(profile?.role)} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold">
            <Home className="h-3.5 w-3.5" aria-hidden /> Dashboard
          </Link>
          <TeacherPortrait teacher={teacher} size={32} className="h-8 w-8 rounded-full object-cover" />
          <span className="text-sm font-bold shrink-0">{teacher.name}</span>
          <button type="button" onClick={newChat} className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold">{ET_COPY.newChat}</button>
          <button type="button" onClick={() => { setView('library'); setSidebarOpen(false); }} className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold">{ET_COPY.library}</button>
          <button type="button" onClick={() => { setView('chat'); setSkill('problems'); setSubject('Mathematics'); }} className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold">{ET_COPY.maths}</button>
          <button type="button" onClick={() => setView('essays')} className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold">{ET_COPY.essays}</button>
          <button type="button" onClick={() => setSidebarOpen(true)} className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold">{ET_COPY.recents}</button>
        </div>

        {view === 'teacher-toolkit' ? (
          <DeskFrame kicker="Teach" title="Teacher Toolkit" testId="mode-teacher-toolkit" blurb="Lesson plans, worksheets, rubrics, the same task for support, core, and stretch, and an exit ticket. Download it, email it, or save it as a course draft.">
            <TeacherToolkitPanel />
          </DeskFrame>
        ) : view === 'parent-explainer' ? (
          <DeskFrame kicker="Home" title="Parent Explainer" testId="mode-parent-explainer" blurb="A plain-language week from your child's saved activity, in the language you choose. ET AI only opens children linked to you.">
            <ParentExplainerPanel />
          </DeskFrame>
        ) : view === 'research-helper' ? (
          <DeskFrame kicker="Sources" title="Research Helper" testId="mode-research-helper" blurb="Sources, citations in APA, Harvard, and MLA, and a note on credibility. ET AI does not write the assignment.">
            <ResearchHelperPanel />
          </DeskFrame>
        ) : view === 'essays' ? (
          <DeskFrame kicker="Plan" title="ET Essays" testId="mode-essays" blurb="Plan with ET AI, then write the essay yourself. A mark shows a 9–1 grade, a letter from A* to U, and a percentage.">
            <EssaysDesk />
          </DeskFrame>
        ) : view === 'tools' ? (
          <AllToolsView
            links={studioToolLinks(embedded, profile?.role, timetableGate !== 'hidden')}
            showToolkit={canUseDeskTool(profile, 'teacher-toolkit')}
            showParent={canUseDeskTool(profile, 'parent-explainer')}
            showResearch={canUseDeskTool(profile, 'research-helper')}
            onChat={() => setView('chat')}
            onLibrary={() => setView('library')}
            onEssays={() => setView('essays')}
            onDesk={(tool) => setView(tool)}
          />
        ) : view === 'library' ? (
          <LibraryView
            user={user} library={library} loading={libraryLoading}
            onDelete={removeFromLibrary} onNew={newChat}
          />
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-border px-3 py-1.5" data-et-teacher={teacher.id}>
              <TeacherPortrait teacher={teacher} size={32} className="h-8 w-8 rounded-full object-cover" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{teacher.name}</p>
                <p className="truncate text-xs text-muted-foreground">{teacher.title}</p>
              </div>
              <label className="sr-only" htmlFor="et-teacher">{ET_COPY.teacher}</label>
              <select
                id="et-teacher"
                aria-label={ET_COPY.teacher}
                value={teacher.id}
                onChange={(event) => setTeacherId(event.target.value)}
                className="max-w-[9rem] rounded-full border border-border bg-card px-2 py-1 text-xs"
              >
                {TEACHERS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              {embedded ? <div className="ms-auto min-w-0 max-w-[58%]"><StudioEssentials /></div> : null}
            </header>
            {/* Thread */}
            <div className="min-h-0 flex-1 overflow-y-auto" data-et-chat="1">
              <div className="max-w-3xl mx-auto px-4 pb-2 pt-3 sm:px-6">
                {empty ? (
                  <div className="relative text-center" data-testid="studio-greeting">
                    <div className="pointer-events-none absolute inset-x-6 top-0 h-36 rounded-full opacity-50 blur-3xl" style={{ background: HERO }} aria-hidden />
                    <div className="relative mx-auto mb-2 grid h-11 w-11 place-items-center rounded-full" style={{ background: FILL, boxShadow: '0 0 48px rgba(63,224,208,0.35)' }}>
                      <Asterisk className="h-6 w-6 text-[#203337]" />
                    </div>
                    <h1 className="relative font-heading text-2xl leading-tight tracking-tight sm:text-3xl">
                      Hi, I&apos;m <span style={{ color: C.accent }}>ET AI</span>.
                    </h1>
                    <p className={`relative mx-auto mt-1 max-w-md text-sm ${C.dim} sm:text-base`}>
                      Ask anything, or pick a skill. ET AI turns a topic into a lesson, quiz, video, audio and more.
                    </p>
                    <div className="relative mt-3 grid w-full gap-2 text-left sm:grid-cols-2">
                      {SUGGESTIONS.map(s => (
                        <button
                          key={s.label}
                          onClick={() => { setSkill(s.format); submit(s.text, s.format); }}
                          className={`flex items-center gap-2.5 rounded-2xl border ${C.border} ${C.surface} px-3 py-2 text-left text-sm ${C.text} transition hover:-translate-y-0.5 hover:border-[#3FE0D0] motion-reduce:transform-none`}
                        >
                          {s.format
                            ? <span style={{ color: C.accent }}>{FORMATS.find(f => f.id === s.format)?.icon}</span>
                            : <MessageSquare className="w-4 h-4" style={{ color: C.accent }} />}
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <div className="relative mt-3 flex flex-wrap justify-center gap-2" data-studio-tools="chips">
                      {studioToolLinks(embedded, profile?.role, timetableGate !== 'hidden').map((link) => (
                        <Link key={link.label} href={link.href} className={CHIP}>{link.label}</Link>
                      ))}
                      {canUseDeskTool(profile, 'teacher-toolkit') && (
                        <button type="button" className={CHIP} onClick={() => setView('teacher-toolkit')}>Teacher Toolkit</button>
                      )}
                      {canUseDeskTool(profile, 'parent-explainer') && (
                        <button type="button" className={CHIP} onClick={() => setView('parent-explainer')}>Parent Explainer</button>
                      )}
                      {canUseDeskTool(profile, 'research-helper') && (
                        <button type="button" className={CHIP} onClick={() => setView('research-helper')}>Research Helper</button>
                      )}
                      <button type="button" className={CHIP} onClick={() => setView('tools')}>All tools</button>
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
                                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-1.5 px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--secondary-foreground) 16%, transparent)', color: C.accent }}>
                                  {FORMATS.find(f => f.id === t.skill)?.icon}
                                  {FORMATS.find(f => f.id === t.skill)?.label}
                                </span>
                              )}
                              {t.image && t.image.startsWith('data:image/') ? <img src={t.image} alt={ET_COPY.photo} className="mb-2 max-h-40 rounded-lg" /> : null}
                              <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{t.text}</p>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={i} className="flex gap-3">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1" style={{ background: FILL }}>
                            <Asterisk className="w-4 h-4 text-[#203337]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            {t.kind === 'chat' ? (
                              <div className={PROSE_CLASSES} data-assistant="1">
                                <MathMarkdown>{t.text}</MathMarkdown>
                                <button type="button" onClick={() => void readAloud(t.text)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#3FE0D0]" aria-label={ET_COPY.readAloud}>
                                  <Volume2 className="h-3.5 w-3.5" aria-hidden /> {ET_COPY.readAloud}
                                </button>
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
                                  <button type="button" onClick={() => copyGen(t)} className={`p-1.5 rounded-lg ${C.faint} hover:text-foreground ${C.surfaceHover} transition-colors`} aria-label="Copy">
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  <button type="button" onClick={() => regenerate(i)} disabled={busy} className={`p-1.5 rounded-lg ${C.faint} hover:text-foreground ${C.surfaceHover} transition-colors`} aria-label="Regenerate">
                                    <RefreshCw className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => saveGen(i)}
                                    disabled={saving === i || t.saved}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${t.saved ? 'text-success' : `${C.faint} hover:text-foreground ${C.surfaceHover}`}`}
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
                    {streamText ? (
                      <div className="flex gap-3" data-assistant="1" data-streaming="1">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1" style={{ background: FILL }}>
                          <Asterisk className="w-4 h-4 text-[#203337]" />
                        </div>
                        <div className={PROSE_CLASSES}><MathMarkdown>{streamText}</MathMarkdown></div>
                      </div>
                    ) : null}
                    {busy && !streamText && <PocoWorking creating={!!skill} />}
                    <div ref={endRef} />
                  </div>
                )}
              </div>
            </div>

            {/* ── Composer ── */}
            <div className="shrink-0 px-4 pb-3 pt-1 sm:px-6" data-studio-composer="1">
              <div className="max-w-3xl mx-auto">
                <div
                  className={`rounded-3xl border ${dragOver ? 'border-[#3FE0D0]' : C.border} ${C.surface} shadow-[0_8px_30px_rgba(63,224,208,0.12)] focus-within:border-[#3FE0D0] transition-colors`}
                  onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragOver(false);
                    onPhoto(event.dataTransfer.files?.[0]);
                  }}
                >
                  {/* Selected skill chip */}
                  {activeFormat && (
                    <div className="px-4 pt-3 -mb-1">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'color-mix(in srgb, var(--secondary-foreground) 16%, transparent)', color: C.accent }}>
                        {activeFormat.icon} {activeFormat.label}
                        <button type="button" onClick={() => setSkill(null)} className="hover:text-foreground ml-0.5" aria-label="Back to chat"><X className="w-3 h-3" /></button>
                      </span>
                    </div>
                  )}
                    <textarea
                    ref={inputRef}
                    aria-label="Message ET AI"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
                    }}
                    placeholder={activeFormat ? `What topic should the ${activeFormat.label.toLowerCase()} cover?` : 'Ask ET AI anything…'}
                    rows={2}
                    disabled={busy}
                    className={`w-full bg-transparent outline-none resize-none px-4 pt-3 pb-1 text-[15px] ${C.text} placeholder:text-muted-foreground`}
                  />
                  {pendingImage ? (
                    <div className="flex items-center gap-2 px-4 pt-3" data-photo-pending="1">
                      <img src={pendingImage} alt={ET_COPY.photo} className="h-12 w-12 rounded-lg object-cover" />
                      <span className="text-xs text-muted-foreground">{ET_COPY.attached}</span>
                      <button type="button" onClick={() => setPendingImage('')} aria-label={ET_COPY.removePhoto} className="text-xs font-semibold text-[#3FE0D0]">{ET_COPY.removePhoto}</button>
                    </div>
                  ) : null}
                  <div className="flex items-center gap-1.5 px-3 pb-3 flex-wrap">
                    <HandwritingCapture disabled={busy} onText={text => setInput(current => current.trim() ? `${current.trim()}\n${text}` : text)} />
                    <button type="button" onClick={() => fileRef.current?.click()} className="rounded-full border border-[#3A3733] px-2.5 py-1.5 text-xs font-semibold text-[#3FE0D0] md:hidden">
                      Upload photo
                    </button>
                    <button type="button" onClick={() => void startRecording()} aria-pressed={recording} aria-label={ET_COPY.mic} data-mic="1" className={`flex h-9 w-9 items-center justify-center rounded-full border ${recording ? 'border-[#3FE0D0] bg-[#3FE0D0] text-[#203337]' : 'border-[#3A3733] text-[#3FE0D0]'}`}>
                      <Mic className="h-4 w-4" aria-hidden />
                    </button>
                    <button type="button" onClick={() => fileRef.current?.click()} aria-label={ET_COPY.photo} data-attach="1" className="flex h-9 w-9 items-center justify-center rounded-full border border-[#3A3733] text-[#3FE0D0]">
                      <Paperclip className="h-4 w-4" aria-hidden />
                    </button>
                    <button type="button" onClick={() => cameraRef.current?.click()} aria-label={ET_COPY.camera} data-camera="1" className="flex h-9 w-9 items-center justify-center rounded-full border border-[#3A3733] text-[#3FE0D0]">
                      <Camera className="h-4 w-4" aria-hidden />
                    </button>
                    <button type="button" onClick={() => docRef.current?.click()} aria-label={ET_COPY.file} data-file="1" className="rounded-full border border-[#3A3733] px-2.5 py-1.5 text-xs font-semibold text-[#3FE0D0]">
                      {ET_COPY.file}
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-label={ET_COPY.photo} data-photo-file="1" onChange={event => { onPhoto(event.target.files?.[0]); event.target.value = ''; }} />
                    <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" aria-label={ET_COPY.camera} data-camera-file="1" onChange={event => { onPhoto(event.target.files?.[0]); event.target.value = ''; }} />
                    <input ref={docRef} type="file" accept="image/*,.txt,.md,text/plain" className="hidden" aria-label={ET_COPY.file} onChange={event => { onPhoto(event.target.files?.[0]); event.target.value = ''; }} />
                    {/* Skills picker */}
                    <div className="relative">
                      <button
                        onClick={() => setSkillsOpen(o => !o)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${C.border} ${C.dim} hover:text-foreground ${C.surfaceHover} transition-colors`}
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
                            className={`absolute bottom-full mb-2 left-0 w-[290px] sm:w-[330px] rounded-2xl border ${C.border} bg-card shadow-2xl p-2 z-30`}
                          >
                            <p className={`px-2 pt-1 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] ${C.faint}`}>ET AI&apos;s skills</p>
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
                      aria-label="Subject"
                      list="programme-subjects"
                      className={`w-28 sm:w-36 px-3 py-1.5 rounded-full text-xs border ${C.border} bg-transparent outline-none ${C.dim} placeholder:text-muted-foreground focus:text-foreground transition-colors`}
                    />
                    <datalist id="programme-subjects">
                      {subjectOptions.map((option) => <option key={option} value={option} />)}
                    </datalist>
                    <select
                      value={level}
                      onChange={e => {
                        const next = e.target.value;
                        setLevel(next);
                        const options = subjectsForProgramme(next);
                        if (subject && options.length > 0 && !options.includes(subject)) setSubject('');
                      }}
                      className={`max-w-[11rem] px-2.5 py-1.5 rounded-full text-xs border ${C.border} bg-card outline-none ${C.dim} cursor-pointer`}
                      style={{ colorScheme: 'dark' }}
                      aria-label="Level"
                    >
                      <option value="">Level</option>
                      {PROGRAMMES.map(programme => <option key={programme.value} value={programme.value}>{programme.label}</option>)}
                    </select>
                    <select
                      value={modeChoice}
                      onChange={e => setModeChoice(e.target.value)}
                      className={`max-w-[9rem] px-2.5 py-1.5 rounded-full text-xs border ${C.border} bg-card outline-none ${C.dim} cursor-pointer`}
                      style={{ colorScheme: 'dark' }}
                      aria-label="Mode"
                    >
                      <option value="">Mode</option>
                      {MODE_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>

                    <span className="flex-1" />
                    <button
                      onClick={() => submit()}
                      disabled={busy || (!input.trim() && !pendingImage)}
                      type="button"
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[#203337] disabled:opacity-30 transition-all hover:scale-105 active:scale-95 motion-reduce:transform-none"
                      style={{ background: FILL }}
                      aria-label="Send"
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                </div>
                {noteStatus ? <p className="mt-2 text-center text-xs text-[#3FE0D0]" role="status" data-voice-status="1">{noteStatus}</p> : null}
                {dragOver ? <p className="mt-1 text-center text-xs text-[#3FE0D0]">{ET_COPY.drop}</p> : null}
                <p className={`text-center text-[10px] ${C.faint} mt-2`}>
                  ET AI can make mistakes. Check important answers.
                </p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

/* ─── All tools, the light cards behind the dark chat ───────── */

function AllToolsView({
  links, showToolkit, showParent, showResearch, onChat, onLibrary, onEssays, onDesk,
}: {
  links: StudioToolLink[];
  showToolkit: boolean;
  showParent: boolean;
  showResearch: boolean;
  onChat: () => void;
  onLibrary: () => void;
  onEssays: () => void;
  onDesk: (tool: DeskToolId) => void;
}) {
  const card = 'block rounded-2xl border border-[#D5DEDE] bg-white px-4 py-4 text-left text-sm font-semibold text-[#203337] shadow-sm transition hover:border-[#3FE0D0]';
  return (
    <div className="flex-1 overflow-y-auto bg-[#F4F6F6] text-[#203337]" data-studio-view="tools">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#203337]">All ET AI Studio tools</p>
        <h1 className="mt-2 font-heading text-3xl tracking-tight text-[#203337]">What should ET AI make today</h1>
        <p className="mt-2 max-w-xl text-sm text-[#203337]">
          The chat is the home. These cards open the same tools, desks, planner, and library.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" onClick={onChat} className="rounded-full px-4 py-2 text-sm font-bold" style={{ background: FILL, color: C.accentInk }}>Back to chat</button>
          <button type="button" onClick={onLibrary} className="rounded-full border border-[#D5DEDE] bg-white px-4 py-2 text-sm font-semibold text-[#203337]">Library</button>
          <button type="button" onClick={onEssays} className="rounded-full border border-[#D5DEDE] bg-white px-4 py-2 text-sm font-semibold text-[#203337]">ET Essays</button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => (
            <Link key={link.label} href={link.href} className={card}>{link.label}</Link>
          ))}
          {showToolkit && <button type="button" onClick={() => onDesk('teacher-toolkit')} className={card}>Teacher Toolkit</button>}
          {showParent && <button type="button" onClick={() => onDesk('parent-explainer')} className={card}>Parent Explainer</button>}
          {showResearch && <button type="button" onClick={() => onDesk('research-helper')} className={card}>Research Helper</button>}
        </div>
      </div>
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
            className="flex items-center gap-2 px-4 py-2 rounded-full text-[#203337] text-sm font-semibold transition-transform hover:scale-105"
            style={{ background: FILL }}
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
            <p className="font-heading text-[22px] tracking-[-0.03em] text-foreground">Nothing saved yet</p>
            <p className={`mt-1 text-sm ${C.dim}`}>Ask ET AI for a lesson, quiz or video, then choose Save to library.</p>
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
                  className={`${C.surface} border ${C.borderSoft} rounded-2xl p-5 transition hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {fmt && <span style={{ color: C.accent }}>{fmt.icon}</span>}
                      <span className={`text-[11px] font-bold uppercase tracking-[0.15em] ${C.dim}`}>{fmt?.label ?? item.type}</span>
                    </div>
                    <button type="button" onClick={() => onDelete(item)} className={`${C.faint} hover:text-red-400 transition-colors`} aria-label="Delete from library">
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

function GenerationOutput({ format, data }: { format: FormatId; data: any }) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const card = 'rounded-xl bg-muted border border-border p-4';
  if (format === 'flashcards' && Array.isArray(data)) {
    return (
      <div className="grid sm:grid-cols-2 gap-3">
        {data.map((cardItem: any, i: number) => (
          <div key={i} className={card}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2 text-[#3FE0D0] dark:text-[#A7D9E5]">Question</p>
            <p className="text-sm text-foreground mb-3">{cardItem.question}</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2 text-[#166534] dark:text-[#86EFAC]">Answer</p>
            <p className="text-sm text-foreground">{cardItem.answer}</p>
          </div>
        ))}
      </div>
    );
  }
  if (format === 'quiz' && Array.isArray(data)) {
    return (
      <div className="space-y-4">
        {data.map((q: any, i: number) => (
          <div key={i} className={card}>
            <p className="text-sm font-semibold text-foreground mb-3">{i + 1}. {q.question}</p>
            <ul className="space-y-1.5 mb-3">
              {q.options?.map((opt: string, j: number) => (
                <li key={j} className={`text-sm rounded-lg px-3 py-2 text-foreground ${q.answer === String.fromCharCode(65 + j) || q.answer === opt ? 'bg-success/10 border border-success/40 dark:border-success/40' : 'bg-background border border-transparent'}`}>
                  {String.fromCharCode(65 + j)}. {opt}
                </li>
              ))}
            </ul>
            {q.explanation && <p className="text-xs text-muted-foreground italic">{q.explanation}</p>}
          </div>
        ))}
      </div>
    );
  }
  if (format === 'slides' && Array.isArray(data)) {
    return (
      <div className="space-y-4">
        {data.map((slide: any, i: number) => (
          <div key={i} className="rounded-xl border border-border bg-card p-6">
            <p className="text-xs text-muted-foreground mb-2">Slide {i + 1}</p>
            <h3 className="font-heading text-2xl text-foreground mb-3">{slide.title}</h3>
            <ul className="space-y-2">
              {slide.bullets?.map((b: string, j: number) => (
                <li key={j} className="text-sm text-foreground flex gap-2"><ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-[#3FE0D0] dark:text-[#A7D9E5]" />{b}</li>
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
          <div key={i} className={card}>
            <p className="text-sm font-bold mb-1 text-[#3FE0D0] dark:text-[#A7D9E5]">{g.term}</p>
            <p className="text-xs text-foreground">{g.definition}</p>
          </div>
        ))}
      </div>
    );
  }
  if (format === 'mindmap' && typeof data === 'string') {
    return <MindmapRenderer content={data} dark={dark} />;
  }
  if (format === 'infographic' && typeof data === 'string') {
    return <InfographicRenderer content={data} dark={dark} />;
  }
  if (format === 'videoScript' && typeof data === 'string') {
    return (
      <div className="space-y-4">
        <VideoPlayer script={data} />
        <details className="rounded-xl bg-muted border border-border overflow-hidden">
          <summary className="cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
            View storyboard &amp; script
          </summary>
          <div className="px-4 pb-4">
            <VideoStoryboard script={data} dark={dark} />
          </div>
        </details>
      </div>
    );
  }
  if (format === 'audioScript' && typeof data === 'string') {
    return <SmartAudioPlayer script={data} dark={dark} />;
  }
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return (
    <div className={PROSE_CLASSES}>
      <MathMarkdown>{text}</MathMarkdown>
    </div>
  );
}

export default function AiStudioPage() {
  return <AiStudio />;
}
