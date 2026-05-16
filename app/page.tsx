'use client';

import { motion, useScroll, useTransform, AnimatePresence, type Variants, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  ArrowRight,
  BookOpen,
  Brain,
  Zap,
  Headphones,
  Video,
  FlipHorizontal,
  Network,
  ClipboardList,
  PresentationIcon,
  ImageIcon,
  FileText,
  Music,
  Calculator,
  BookMarked,
  Upload,
  Sparkles,
  GraduationCap,
  Users,
  ShieldCheck,
  Star,
  CheckCircle2,
  Menu,
  X,
  ChevronDown,
  Bell,
  TrendingUp,
  Trophy,
  BookOpenCheck,
  Home,
  Library,
  User,
  AlertCircle,
  Search,
  Pencil,
} from 'lucide-react';

/* ─── Data ──────────────────────────────────────────────────── */

const features = [
  {
    icon: <Upload className="w-5 h-5" />,
    gradient: 'from-blue-500 to-indigo-600',
    bg: 'bg-blue-50',
    title: 'AI Content Generation',
    desc: 'Upload any PDF, video, URL or paste text. Our AI instantly transforms it into rich learning material.',
  },
  {
    icon: <BookOpen className="w-5 h-5" />,
    gradient: 'from-violet-500 to-purple-600',
    bg: 'bg-violet-50',
    title: '11 Learning Formats',
    desc: 'Podcast, flashcards, mind map, quiz, video, slides, infographic, notes — one source, eleven ways to learn.',
  },
  {
    icon: <Brain className="w-5 h-5" />,
    gradient: 'from-teal-500 to-emerald-600',
    bg: 'bg-teal-50',
    title: 'Socratic AI Tutor',
    desc: "Don't just get answers. Our AI guides you to the solution with questions that build deep understanding.",
  },
  {
    icon: <Zap className="w-5 h-5" />,
    gradient: 'from-amber-400 to-orange-500',
    bg: 'bg-amber-50',
    title: 'Gamified Progress',
    desc: 'Earn XP, unlock achievements and climb the leaderboard as you master new skills every day.',
  },
  {
    icon: <Video className="w-5 h-5" />,
    gradient: 'from-rose-500 to-pink-600',
    bg: 'bg-rose-50',
    title: 'Live Classes',
    desc: 'Join real-time video sessions with teachers. Record, replay and share class recordings instantly.',
  },
  {
    icon: <Users className="w-5 h-5" />,
    gradient: 'from-sky-500 to-cyan-600',
    bg: 'bg-sky-50',
    title: 'Multi-Role Platform',
    desc: 'One platform for students, teachers, parents and admins — each with a tailored, role-aware experience.',
  },
];

const formats = [
  { icon: <Headphones className="w-4 h-4" />, label: 'Podcast', color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { icon: <Video className="w-4 h-4" />, label: 'Video', color: 'text-rose-600 bg-rose-50 border-rose-200' },
  { icon: <FlipHorizontal className="w-4 h-4" />, label: 'Flashcards', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { icon: <Network className="w-4 h-4" />, label: 'Mind Map', color: 'text-teal-600 bg-teal-50 border-teal-200' },
  { icon: <ClipboardList className="w-4 h-4" />, label: 'Quiz', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { icon: <PresentationIcon className="w-4 h-4" />, label: 'Slides', color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  { icon: <ImageIcon className="w-4 h-4" />, label: 'Infographic', color: 'text-pink-600 bg-pink-50 border-pink-200' },
  { icon: <FileText className="w-4 h-4" />, label: 'Notes', color: 'text-slate-600 bg-slate-50 border-slate-200' },
  { icon: <Music className="w-4 h-4" />, label: 'Audio Summary', color: 'text-violet-600 bg-violet-50 border-violet-200' },
  { icon: <Calculator className="w-4 h-4" />, label: 'Practice Problems', color: 'text-orange-600 bg-orange-50 border-orange-200' },
  { icon: <BookMarked className="w-4 h-4" />, label: 'Glossary', color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
];

const testimonials = [
  {
    quote: "Used the podcast format on the bus this morning. Genuinely my best chemistry score this term. Not even joking.",
    name: 'Priya R.',
    role: 'Year 11 Student',
    avatarSeed: 'Priya',
    date: '2 weeks ago',
    stars: 5,
  },
  {
    quote: "I was sceptical about AI grading but the rubric it generated for my Macbeth essays was honestly better than the one I'd been using for six years. I tweaked two lines and shipped it.",
    name: 'Mr. Hartley',
    role: 'Secondary English Teacher',
    avatarSeed: 'Daniel',
    date: 'last month',
    stars: 5,
  },
  {
    quote: "The mind map blew my mind. I'd uploaded a 40-page neuroscience PDF expecting the usual flashcard-spam most apps do. Got a proper concept map showing how the limbic system connects to memory consolidation. Used it for my exam and got an A.",
    name: 'Amara O.',
    role: 'Year 2 Medicine',
    avatarSeed: 'Amara',
    date: '3 months ago',
    stars: 5,
  },
  {
    quote: "Finally I can answer 'how's school?' with actual specifics. Weekly summary email lands Sunday night, takes 2 min to read.",
    name: 'Sarah M.',
    role: 'Parent of Year 10 Student',
    avatarSeed: 'Sarah',
    date: 'last week',
  },
  {
    quote: "Quiz mode is great. Wish the flashcards had spaced repetition built in though — I'm using Anki alongside for now. 4/5.",
    name: 'Kofi A.',
    role: 'Sixth Form Student',
    avatarSeed: 'Kofi',
    date: '6 weeks ago',
    stars: 4,
  },
  {
    quote: "my GCSE maths revision was a disaster until this. I told it I struggle with quadratics, asked for a podcast and ended up listening on repeat on the walk to school. it actually helped.",
    name: 'Jayden T.',
    role: 'Year 10 Student',
    avatarSeed: 'Jayden',
    date: '3 weeks ago',
    stars: 5,
  },
  {
    quote: "The parent dashboard is the first school tech thing my husband has actually used. He checks it before I do most weeks.",
    name: 'Claire W.',
    role: 'Parent of Year 8 Student',
    avatarSeed: 'Claire',
    date: '5 weeks ago',
    stars: 5,
    reply: "Thank you Claire — that genuinely made our week 🙏",
  },
  {
    quote: "Uploaded a 20-page A-Level Spanish grammar guide, got flashcards with audio pronunciation hints and a mini quiz on ser vs estar. Covered a whole term's content in a weekend.",
    name: 'Lucia M.',
    role: 'A-Level Student',
    avatarSeed: 'Lucia',
    date: '2 months ago',
    stars: 5,
  },
  {
    quote: "As a maths teacher I was worried the AI-generated quizzes would be full of errors. Tested it on Year 9 simultaneous equations — every question was accurate and the difficulty was exactly right for the group.",
    name: 'Ms. Okonkwo',
    role: 'Maths Department, Secondary',
    avatarSeed: 'Ngozi',
    date: 'last month',
    stars: 5,
  },
  {
    quote: "it explained the ATP cycle to me four different ways until i understood it. no human tutor has ever done that without getting visibly frustrated",
    name: 'Ben K.',
    role: 'Year 12 Biology Student',
    avatarSeed: 'Benjamin',
    date: '1 month ago',
    stars: 5,
  },
  {
    quote: "We piloted it across our Key Stage 4 cohort this term. Engagement in self-directed revision sessions went up noticeably. The format variety is the key — some kids learn via audio, others need visual maps. Now they both have something.",
    name: 'D. Rahman',
    role: 'Head of Year 10',
    avatarSeed: 'Darius',
    date: '6 weeks ago',
    stars: 5,
  },
  {
    quote: "Made a mind map from my World War II notes and it linked Dunkirk to Churchill's speeches to the Atlantic Charter without me asking. That's a connection I'd completely missed.",
    name: 'Ella B.',
    role: 'Year 9 History Student',
    avatarSeed: 'Ella',
    date: '4 weeks ago',
    stars: 5,
  },
  {
    quote: "The AI tutor wouldn't just give me the answer to my photosynthesis question — it kept asking me what I thought first. Annoying in the moment. Useful in the exam.",
    name: 'Marcus L.',
    role: 'GCSE Biology Student',
    avatarSeed: 'Marcus',
    date: '2 months ago',
    stars: 5,
  },
  {
    quote: "I've used three other AI study tools and Pocket School is the only one that made me feel like I was actually learning, not just staring at outputs.",
    name: 'Tanya S.',
    role: 'University Foundation Year',
    avatarSeed: 'Tanya',
    date: '5 weeks ago',
  },
  {
    quote: "Setting up the class was maybe 10 minutes. Uploading the scheme of work, adding students, they could see their materials by the next morning.",
    name: 'Mr. P. Adeyemi',
    role: 'Science Teacher',
    avatarSeed: 'Peter',
    date: 'last month',
    stars: 5,
  },
  {
    quote: "My daughter has dyscalculia and the visual formats have been really helpful — the infographics especially. Wasn't expecting a generic AI tool to actually accommodate that.",
    name: 'Ruth F.',
    role: 'Parent of Year 7 Student',
    avatarSeed: 'Ruth',
    date: '7 weeks ago',
    stars: 5,
    reply: "We're working on even more accessibility features — thank you for sharing this.",
  },
  {
    quote: "used it to revise for my mocks. did the quiz, got 6/10, it immediately asked if i wanted it to explain the ones i got wrong. yes. obviously yes.",
    name: 'Chidi N.',
    role: 'Year 11 Student',
    avatarSeed: 'Chidi',
    date: '3 weeks ago',
    stars: 5,
  },
  {
    quote: "The podcast episodes feel genuinely produced — proper intro, structured segments, summary at the end. Not just text-to-speech. My commute is now my revision session.",
    name: 'Dr. Osei-Bonsu',
    role: 'Postgraduate Researcher',
    avatarSeed: 'Kwame',
    date: '2 months ago',
    stars: 5,
  },
];

const roles = [
  {
    icon: <GraduationCap className="w-6 h-6" />,
    role: 'Students',
    color: 'border-blue-500',
    iconColor: 'text-blue-600',
    perks: ['AI-generated study materials in 11 formats', 'XP, badges & leaderboard gamification'],
    href: '/signup?role=student',
  },
  {
    icon: <BookOpen className="w-6 h-6" />,
    role: 'Teachers',
    color: 'border-teal-500',
    iconColor: 'text-teal-600',
    perks: ['AI-assisted grading with rubric generation', 'Student analytics & struggling-learner alerts'],
    href: '/signup?role=teacher',
  },
  {
    icon: <Users className="w-6 h-6" />,
    role: 'Parents',
    color: 'border-amber-500',
    iconColor: 'text-amber-600',
    perks: ['Weekly progress summaries per subject', 'Direct messaging with teachers'],
    href: '/signup?role=parent',
  },
  {
    icon: <ShieldCheck className="w-6 h-6" />,
    role: 'Admins',
    color: 'border-violet-500',
    iconColor: 'text-violet-600',
    perks: ['Institution management & access control', 'Platform analytics & AI usage reporting'],
    href: '/signup?role=admin',
  },
];

const steps = [
  {
    number: '01',
    title: 'Upload Your Material',
    desc: 'Drop in a PDF, paste a URL, upload a video or type your notes. Any format works.',
    icon: <Upload className="w-6 h-6 text-blue-600" />,
  },
  {
    number: '02',
    title: 'AI Transforms It',
    desc: 'Our Gemini-powered AI generates up to 11 personalised learning formats in seconds.',
    icon: <Sparkles className="w-6 h-6 text-violet-600" />,
  },
  {
    number: '03',
    title: 'Learn Your Way',
    desc: 'Study via podcast on your commute, practice with flashcards, or test yourself with quizzes.',
    icon: <Brain className="w-6 h-6 text-teal-600" />,
  },
];

const stats = [
  { value: '11', label: 'Learning Formats' },
  { value: '4', label: 'User Roles' },
  { value: '24/7', label: 'AI Tutor Access' },
  { value: 'Gemini 2.5 Pro', label: 'AI Engine' },
];

const faqs = [
  {
    q: 'Is Pocket School free?',
    a: 'Yes. Individual students, teachers and parents can use the core platform free forever. Institutions get a paid tier for analytics, SSO and admin controls.',
  },
  {
    q: 'What can I upload?',
    a: 'PDFs, Word docs, plain text, YouTube and Vimeo URLs, audio recordings up to 200 MB, and pasted text. Scanned-image OCR is coming next quarter.',
  },
  {
    q: 'Which AI model powers Pocket School?',
    a: "Google Gemini 2.5 Pro for content generation and the Socratic tutor. We don't train on your uploads — your material stays yours.",
  },
  {
    q: 'How accurate is the AI-generated content?',
    a: 'Very accurate for well-structured source material. Every generated quiz and flashcard shows source citations so you can verify. Teachers can flag and correct any generation in one click.',
  },
  {
    q: 'Can teachers use it for grading?',
    a: "Yes. The AI suggests a rubric based on your assignment brief, scores submissions, and produces feedback drafts. Final marks always go through the teacher — we never auto-publish grades.",
  },
  {
    q: "Is student data safe?",
    a: "Yes. We're GDPR-compliant, encrypt data at rest and in transit, and uploads aren't used for model training. Schools can request a full data-deletion audit at any time.",
  },
  {
    q: 'Does it work offline?',
    a: 'Generated content — flashcards, notes, podcasts — caches locally for offline study. New AI generation requires a connection.',
  },
];

const credentialLogos = ['Gemini 2.5 Pro', 'Firebase', 'Next.js', 'Vercel'];

/* ─── Animation helpers ─────────────────────────────────────── */

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE_OUT_EXPO, delay: i * 0.08 },
  }),
};

/* ─── Portal Mockups ────────────────────────────────────────── */

function StudentMockup() {
  return (
    <div className="flex h-full">
      {/* Sidebar rail */}
      <div className="w-10 border-r border-border/60 flex flex-col items-center pt-4 gap-4 bg-muted/30">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
          <Brain className="w-3 h-3 text-white" />
        </div>
        <Home className="w-4 h-4 text-primary" />
        <Library className="w-4 h-4 text-muted-foreground/60" />
        <Brain className="w-4 h-4 text-muted-foreground/60" />
        <User className="w-4 h-4 text-muted-foreground/60" />
      </div>
      {/* Main pane */}
      <div className="flex-1 p-4 overflow-hidden space-y-3">
        {/* XP hero card */}
        <div className="rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 p-4 text-white">
          <p className="text-[11px] font-medium text-white/70 mb-0.5">Welcome back, Amara 👋</p>
          <p className="text-base font-bold tracking-tight">1,247 XP · Streak: 12 days</p>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-white/70">Level 2 progress</span>
              <span className="text-[10px] font-semibold text-white/90">1,247 / 2,000 XP</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
              <div className="h-full w-[62%] bg-white rounded-full" />
            </div>
          </div>
          <div className="mt-3 flex gap-3">
            <div className="text-center">
              <p className="text-sm font-bold">3</p>
              <p className="text-[9px] text-white/70">Courses</p>
            </div>
            <div className="w-px bg-white/20" />
            <div className="text-center">
              <p className="text-sm font-bold">11</p>
              <p className="text-[9px] text-white/70">Badges</p>
            </div>
            <div className="w-px bg-white/20" />
            <div className="text-center">
              <p className="text-sm font-bold">2</p>
              <p className="text-[9px] text-white/70">Active</p>
            </div>
          </div>
        </div>
        {/* Two stat tiles */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <ClipboardList className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[10px] font-semibold text-foreground">Today&apos;s Quiz</span>
            </div>
            <p className="text-[13px] font-bold text-foreground">8 questions</p>
            <p className="text-[10px] text-muted-foreground">Biology · Cell Respiration</p>
            <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
              <div className="h-full w-[37%] bg-amber-400 rounded-full" />
            </div>
            <p className="text-[9px] text-muted-foreground mt-0.5">3 of 8 completed</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Headphones className="w-3.5 h-3.5 text-purple-500" />
              <span className="text-[10px] font-semibold text-foreground">Continue</span>
            </div>
            <p className="text-[13px] font-bold text-foreground">Chapter 4 Podcast</p>
            <p className="text-[10px] text-muted-foreground">12:30 remaining</p>
            <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
              <div className="h-full w-[58%] bg-purple-500 rounded-full" />
            </div>
            <p className="text-[9px] text-muted-foreground mt-0.5">14:18 / 24:00</p>
          </div>
        </div>
        {/* Recent activity */}
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[10px] font-semibold text-foreground mb-2">Recent Activity</p>
          <div className="space-y-2">
            {[
              { label: 'Flashcards — ATP Synthesis', time: '2h ago', color: 'bg-blue-500' },
              { label: 'Mind Map — Nervous System', time: 'yesterday', color: 'bg-teal-500' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
                <span className="text-[10px] text-foreground flex-1 truncate">{item.label}</span>
                <span className="text-[9px] text-muted-foreground">{item.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TeacherMockup() {
  const rows = [
    { name: 'Amara O.', assignment: 'ATP Quiz', score: '8/10', avatar: 'AO', color: 'from-blue-400 to-indigo-500' },
    { name: 'Ben K.', assignment: 'Macbeth Essay', score: 'Awaiting', avatar: 'BK', color: 'from-teal-400 to-emerald-500' },
    { name: 'Priya R.', assignment: 'Quadratics WS', score: '14/20', avatar: 'PR', color: 'from-rose-400 to-pink-500' },
  ];
  return (
    <div className="flex h-full">
      <div className="w-10 border-r border-border/60 flex flex-col items-center pt-4 gap-4 bg-muted/30">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
          <Brain className="w-3 h-3 text-white" />
        </div>
        <Home className="w-4 h-4 text-primary" />
        <BookOpenCheck className="w-4 h-4 text-muted-foreground/60" />
        <Users className="w-4 h-4 text-muted-foreground/60" />
        <User className="w-4 h-4 text-muted-foreground/60" />
      </div>
      <div className="flex-1 p-4 overflow-hidden space-y-3">
        {/* Alert card */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-amber-800">3 submissions awaiting review</p>
            <p className="text-[10px] text-amber-700 mt-0.5">Mrs. Hartley · Biology 101 · Due today</p>
          </div>
          <button className="text-[10px] font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 transition-colors px-2 py-1 rounded-md shrink-0">
            Review
          </button>
        </div>
        {/* Pending grades table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-muted/30">
            <p className="text-[10px] font-semibold text-foreground">Pending Grades</p>
          </div>
          <div className="divide-y divide-border/60">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2">
                <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${r.color} flex items-center justify-center text-white text-[8px] font-bold shrink-0`}>
                  {r.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-foreground truncate">{r.name}</p>
                  <p className="text-[9px] text-muted-foreground">{r.assignment}</p>
                </div>
                <span className={`text-[10px] font-semibold ${r.score === 'Awaiting' ? 'text-amber-600' : 'text-teal-600'}`}>
                  {r.score}
                </span>
                <button className="text-[9px] text-primary font-medium hover:underline">Grade</button>
              </div>
            ))}
          </div>
        </div>
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'My Courses', val: '4', color: 'text-blue-600' },
            { label: 'To Grade', val: '3', color: 'text-amber-600' },
            { label: 'Submissions', val: '31', color: 'text-emerald-600' },
          ].map((s, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-2 text-center">
              <p className={`text-base font-bold tracking-tight ${s.color}`}>{s.val}</p>
              <p className="text-[9px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ParentMockup() {
  const subjects = [
    { name: 'Mathematics', pct: 84, color: 'bg-blue-500' },
    { name: 'English Literature', pct: 91, color: 'bg-indigo-500' },
    { name: 'Biology', pct: 76, color: 'bg-teal-500' },
  ];
  const sparkPoints = '0,28 8,22 16,24 24,14 32,18 40,8 48,12 56,6 64,10 72,4';
  return (
    <div className="flex h-full">
      <div className="w-10 border-r border-border/60 flex flex-col items-center pt-4 gap-4 bg-muted/30">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
          <Brain className="w-3 h-3 text-white" />
        </div>
        <Home className="w-4 h-4 text-primary" />
        <TrendingUp className="w-4 h-4 text-muted-foreground/60" />
        <Users className="w-4 h-4 text-muted-foreground/60" />
        <User className="w-4 h-4 text-muted-foreground/60" />
      </div>
      <div className="flex-1 p-4 overflow-hidden space-y-3">
        {/* Child card */}
        <div className="rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 p-4 text-white">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-[11px] font-bold">EC</div>
            <div>
              <p className="text-[13px] font-bold">Ella Chen</p>
              <p className="text-[10px] text-white/80">Year 10 · Visual Learner</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-yellow-300" />
            <span className="text-[11px] font-semibold">892 XP this month</span>
          </div>
        </div>
        {/* Weekly summary */}
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-foreground">This week&apos;s progress</p>
            <svg width="72" height="32" viewBox="0 0 72 32" className="text-blue-500">
              <polyline
                points={sparkPoints}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="space-y-2.5">
            {subjects.map((s, i) => (
              <div key={i}>
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-[10px] text-foreground">{s.name}</span>
                  <span className="text-[10px] font-semibold text-foreground">{s.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full ${s.color} rounded-full`} style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Enrolled', val: '3' },
            { label: 'In Progress', val: '2' },
            { label: 'Completed', val: '1' },
          ].map((s, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-2 text-center">
              <p className="text-base font-bold tracking-tight text-foreground">{s.val}</p>
              <p className="text-[9px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BrowserChrome({ url }: { url: string }) {
  return (
    <div className="h-7 bg-muted/60 border-b border-border/60 flex items-center px-3 gap-2 shrink-0">
      <div className="flex gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
      </div>
      <div className="flex-1 flex justify-center">
        <div className="bg-background/70 border border-border/50 rounded-md px-3 py-0.5 text-[10px] text-muted-foreground font-medium">
          {url}
        </div>
      </div>
    </div>
  );
}

/* ─── Decorative SVGs ───────────────────────────────────────── */

function PinkStarBurst({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <path
        d="M50 0 L60 35 L98 25 L70 55 L100 75 L62 70 L65 100 L50 75 L35 100 L38 70 L0 75 L30 55 L2 25 L40 35 Z"
        fill="#EC4899"
      />
    </svg>
  );
}

function PencilSVG({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden>
      <g transform="rotate(-30 40 40)">
        <rect x="20" y="35" width="40" height="10" fill="#F59E0B" />
        <rect x="20" y="35" width="40" height="3" fill="#FBBF24" />
        <rect x="14" y="35" width="6" height="10" fill="#FEF3C7" />
        <path d="M14 35 L8 40 L14 45 Z" fill="#1E293B" />
        <rect x="60" y="33" width="8" height="14" fill="#EF4444" rx="1" />
        <rect x="60" y="33" width="8" height="3" fill="#FCA5A5" rx="1" />
      </g>
    </svg>
  );
}

function BookStackSVG({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden>
      <rect x="12" y="50" width="56" height="14" rx="2" fill="#3B82F6" />
      <rect x="12" y="50" width="56" height="3" fill="#60A5FA" />
      <rect x="16" y="34" width="48" height="14" rx="2" fill="#EF4444" />
      <rect x="16" y="34" width="48" height="3" fill="#FCA5A5" />
      <rect x="20" y="18" width="40" height="14" rx="2" fill="#10B981" />
      <rect x="20" y="18" width="40" height="3" fill="#6EE7B7" />
    </svg>
  );
}

function PaperSVG({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 70" className={className} aria-hidden>
      <path d="M5 5 H45 L55 15 V65 H5 Z" fill="white" stroke="#1E293B" strokeWidth="2" />
      <path d="M45 5 V15 H55" fill="none" stroke="#1E293B" strokeWidth="2" />
      <line x1="14" y1="28" x2="46" y2="28" stroke="#94A3B8" strokeWidth="1.5" />
      <line x1="14" y1="36" x2="46" y2="36" stroke="#94A3B8" strokeWidth="1.5" />
      <line x1="14" y1="44" x2="38" y2="44" stroke="#94A3B8" strokeWidth="1.5" />
      <line x1="14" y1="52" x2="46" y2="52" stroke="#94A3B8" strokeWidth="1.5" />
    </svg>
  );
}

function ScribbleSVG({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 30" className={className} aria-hidden>
      <path
        d="M3 15 Q12 3, 22 15 T42 15 T62 15 T78 15"
        fill="none"
        stroke="#FB7185"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FloatingDecoration({
  children,
  className = '',
  scrollRange = [0, 1],
  yRange = [0, -80],
  rotateRange = [0, 12],
}: {
  children: React.ReactNode;
  className?: string;
  scrollRange?: [number, number];
  yRange?: [number, number];
  rotateRange?: [number, number];
}) {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, scrollRange, yRange);
  const rotate = useTransform(scrollYProgress, scrollRange, rotateRange);
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      style={prefersReducedMotion ? undefined : { y, rotate }}
      className={`pointer-events-none select-none ${className}`}
      aria-hidden
    >
      {children}
    </motion.div>
  );
}

/* ─── Component ─────────────────────────────────────────────── */

export default function LandingPage() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activePortalTab, setActivePortalTab] = useState('student');
  const prefersReducedMotion = useReducedMotion();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '20%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'See It Live', href: '#portal-showcase' },
    { label: 'Formats', href: '#formats' },
    { label: 'Testimonials', href: '#testimonials' },
    { label: 'FAQ', href: '#faq' },
  ];

  const portalTabUrl: Record<string, string> = {
    student: 'pocketschool.app/student',
    teacher: 'pocketschool.app/teacher',
    parent: 'pocketschool.app/parent',
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Nav ─────────────────────────────────────────────── */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/80 dark:bg-[#0A0A0F]/80 backdrop-blur-xl border-b border-border/60 shadow-sm'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <span className="text-[15px] font-bold tracking-tight text-foreground">Pocket School</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Sign In
            </Link>
            <Button
              onClick={() => router.push('/signup')}
              className="rounded-full h-9 px-5 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all"
            >
              Get Started
              <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
            </Button>
          </div>

          <button
            className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
              className="md:hidden bg-white/95 dark:bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-border px-4 py-4 flex flex-col gap-3"
            >
              {navLinks.map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="text-sm font-medium text-foreground py-1"
                >
                  {label}
                </a>
              ))}
              <div className="pt-2 flex flex-col gap-2 border-t border-border">
                <Link href="/login" className="text-sm font-medium text-muted-foreground">Sign In</Link>
                <Button
                  onClick={() => router.push('/signup')}
                  className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white w-full"
                >
                  Get Started <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Hero (editorial, amber bg + inset white card) ─────── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden pt-20 lg:pt-24 pb-12 bg-[#F5B400]">
        {/* Decorative scattered shapes — animated on scroll */}
        <FloatingDecoration
          className="absolute top-16 right-4 lg:right-12 w-20 h-20 lg:w-32 lg:h-32 z-20"
          scrollRange={[0, 0.4]}
          yRange={[0, -40]}
          rotateRange={[0, 25]}
        >
          <PinkStarBurst className="w-full h-full drop-shadow-md" />
        </FloatingDecoration>

        <FloatingDecoration
          className="absolute bottom-20 left-4 lg:left-12 w-12 h-12 lg:w-16 lg:h-16 z-20"
          scrollRange={[0, 0.4]}
          yRange={[0, -30]}
          rotateRange={[0, -20]}
        >
          <PaperSVG className="w-full h-full drop-shadow-md" />
        </FloatingDecoration>

        <FloatingDecoration
          className="hidden lg:block absolute top-32 left-8 w-16 h-16 z-20"
          scrollRange={[0, 0.5]}
          yRange={[0, -50]}
          rotateRange={[0, 15]}
        >
          <PencilSVG className="w-full h-full drop-shadow-md" />
        </FloatingDecoration>

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 z-10"
        >
          {/* Top label */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
            className="text-center mb-6"
          >
            <p className="text-[11px] sm:text-xs font-extrabold tracking-[0.3em] text-blue-950 uppercase">
              Pocket School
            </p>
            <p className="text-xs sm:text-sm text-blue-950/70 font-semibold tracking-wide">
              Adaptive AI Learning
            </p>
          </motion.div>

          {/* Inset white card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
            className="rounded-3xl bg-white shadow-[0_40px_100px_-20px_rgba(0,0,0,0.25)] overflow-hidden border border-black/5"
          >
            {/* Inner mini-nav (lg+ only) */}
            <div className="hidden lg:flex items-center justify-between px-8 py-5 border-b border-slate-100 bg-white">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
                  <BookOpen className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm font-bold text-slate-900 tracking-tight">Pocket School</span>
              </Link>
              <nav className="flex items-center gap-7">
                <a href="#features" className="text-[11px] font-bold tracking-widest text-slate-700 hover:text-blue-600 uppercase transition-colors">Home</a>
                <a href="#features" className="text-[11px] font-bold tracking-widest text-slate-700 hover:text-blue-600 uppercase transition-colors">Features</a>
                <a href="#portal-showcase" className="text-[11px] font-bold tracking-widest text-slate-700 hover:text-blue-600 uppercase transition-colors">Portal</a>
                <a href="#testimonials" className="text-[11px] font-bold tracking-widest text-slate-700 hover:text-blue-600 uppercase transition-colors">Reviews</a>
              </nav>
              <Button
                onClick={() => router.push('/signup')}
                className="rounded-full bg-[#F5B400] hover:bg-amber-500 text-blue-950 font-extrabold text-[11px] tracking-widest uppercase px-5 h-9 shadow-md"
              >
                Register Now
              </Button>
            </div>

            {/* 3-column hero content */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr_1fr] min-h-[480px]">
              {/* LEFT — blue panel with oversized headline */}
              <div className="bg-[#1E3A8A] p-8 lg:p-10 xl:p-12 flex items-center order-2 lg:order-1">
                <motion.h1
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 0.2 }}
                  className="text-5xl sm:text-6xl lg:text-[58px] xl:text-7xl font-black text-white leading-[0.92] tracking-tight"
                >
                  Learn<br />
                  smarter,<br />
                  not<br />
                  harder.
                </motion.h1>
              </div>

              {/* CENTER — white panel with portal preview + yellow circle badge */}
              <div className="bg-white p-5 lg:p-6 relative flex items-center justify-center order-1 lg:order-2 min-h-[280px] lg:min-h-0">
                <div className="w-full max-w-md rounded-2xl overflow-hidden border border-slate-200 shadow-[0_20px_50px_-10px_rgba(15,23,42,0.18)]">
                  <BrowserChrome url="pocketschool.app/student" />
                  <div style={{ height: 360 }} className="bg-background">
                    <StudentMockup />
                  </div>
                </div>

                {/* Yellow circle badge */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.5, rotate: -15 }}
                  animate={{ opacity: 1, scale: 1, rotate: -8 }}
                  transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay: 0.5 }}
                  className="absolute top-2 right-2 lg:-top-4 lg:-right-4 w-24 h-24 lg:w-28 lg:h-28 rounded-full bg-[#F5B400] flex items-center justify-center text-center shadow-xl border-4 border-white z-10"
                >
                  <div>
                    <p className="text-3xl lg:text-4xl font-black text-blue-950 leading-none">11</p>
                    <p className="text-[9px] lg:text-[10px] font-extrabold text-blue-950 leading-tight uppercase tracking-wide mt-0.5">
                      Learning<br />Formats
                    </p>
                  </div>
                </motion.div>

                {/* Scribble accent under mockup */}
                <ScribbleSVG className="absolute bottom-2 left-6 w-20 h-6 opacity-80" />
              </div>

              {/* RIGHT — blue panel with subhead + search */}
              <div className="bg-[#1E3A8A] p-8 lg:p-10 xl:p-12 flex flex-col justify-center order-3">
                <motion.h2
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 0.3 }}
                  className="text-xl lg:text-2xl font-extrabold text-white leading-tight mb-4"
                >
                  Unlock your potential with{' '}
                  <span className="text-[#F5B400]">adaptive AI</span> learning.
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay: 0.45 }}
                  className="text-sm text-blue-100/80 leading-relaxed mb-6"
                >
                  Upload any PDF, video or URL. Our AI turns it into 11 personalised study formats — podcasts, flashcards, quizzes — tailored to how <em className="not-italic font-bold text-white">you</em> learn best.
                </motion.p>

                {/* Search-style topic input */}
                <motion.form
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay: 0.55 }}
                  onSubmit={(e) => { e.preventDefault(); router.push('/signup'); }}
                  className="bg-white rounded-full p-1 flex items-center shadow-lg gap-1"
                >
                  <Search className="w-4 h-4 text-slate-400 ml-3 shrink-0" />
                  <input
                    type="text"
                    placeholder="What do you want to learn?"
                    className="flex-1 min-w-0 bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400 px-2"
                  />
                  <Button
                    type="submit"
                    className="rounded-full bg-[#F5B400] hover:bg-amber-500 text-blue-950 font-extrabold text-[11px] tracking-widest uppercase px-4 h-9 shrink-0"
                  >
                    Start
                  </Button>
                </motion.form>

                {/* Bottom checkmarks */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay: 0.7 }}
                  className="mt-6 flex gap-4 flex-wrap"
                >
                  {['Free forever', 'No credit card', '11 formats'].map((t) => (
                    <span key={t} className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-100">
                      <CheckCircle2 className="w-3 h-3 text-[#F5B400]" />
                      {t}
                    </span>
                  ))}
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* Credential strip below card */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay: 0.9 }}
            className="mt-8 flex items-center justify-center gap-x-6 gap-y-2 flex-wrap"
          >
            <span className="text-[11px] text-blue-950/70 font-bold tracking-widest uppercase">Powered by</span>
            {credentialLogos.map((name) => (
              <span key={name} className="text-xs font-extrabold text-blue-950/80 tracking-wide">
                {name}
              </span>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── Trust bar ────────────────────────────────────────── */}
      <section className="py-10 border-y border-border bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-0">
            {stats.map((s, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                custom={i}
                className="text-center md:border-r md:last:border-r-0 border-border py-2"
              >
                <p className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">{s.value}</p>
                <p className="text-sm text-muted-foreground mt-1 font-medium">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section id="features" className="relative py-20 sm:py-28 overflow-hidden">
        <FloatingDecoration
          className="absolute top-12 right-6 w-12 h-12 lg:w-16 lg:h-16 opacity-80"
          scrollRange={[0.05, 0.35]}
          yRange={[40, -60]}
          rotateRange={[-15, 20]}
        >
          <PencilSVG className="w-full h-full" />
        </FloatingDecoration>
        <FloatingDecoration
          className="absolute bottom-10 left-4 lg:left-12 w-14 h-14 lg:w-20 lg:h-20 opacity-90"
          scrollRange={[0.05, 0.35]}
          yRange={[60, -40]}
          rotateRange={[10, -15]}
        >
          <BookStackSVG className="w-full h-full" />
        </FloatingDecoration>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="text-center max-w-2xl mx-auto mb-14"
          >
            <Badge className="mb-4 rounded-full bg-violet-50 text-violet-700 border-violet-200 text-xs font-semibold">
              Everything You Need
            </Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground mb-4">
              Learning, reimagined
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
              Every tool you need to study smarter, teach better, and stay in the loop — all in one place.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                custom={i}
                className="group relative bg-card border border-border rounded-2xl p-6 card-glow cursor-default"
              >
                <div className={`w-10 h-10 rounded-xl ${f.bg} flex items-center justify-center mb-5`}>
                  <span className={`bg-gradient-to-br ${f.gradient} text-transparent [&>svg]:stroke-current`}>
                    {f.icon}
                  </span>
                </div>
                <h3 className="text-base font-bold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Portal Showcase ───────────────────────────────────── */}
      <section id="portal-showcase" className="relative py-20 sm:py-28 bg-muted/20 overflow-hidden">
        <FloatingDecoration
          className="absolute top-20 left-6 w-10 h-10 lg:w-14 lg:h-14 opacity-90"
          scrollRange={[0.25, 0.55]}
          yRange={[30, -50]}
          rotateRange={[-10, 18]}
        >
          <PaperSVG className="w-full h-full" />
        </FloatingDecoration>
        <FloatingDecoration
          className="absolute bottom-12 right-6 w-12 h-12 lg:w-16 lg:h-16 opacity-90"
          scrollRange={[0.25, 0.55]}
          yRange={[50, -50]}
          rotateRange={[20, -10]}
        >
          <PinkStarBurst className="w-full h-full" />
        </FloatingDecoration>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="text-center max-w-2xl mx-auto mb-12"
          >
            <Badge className="mb-4 rounded-full bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold">
              See It in Action
            </Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground mb-4">
              A real product,{' '}
              <span className="gradient-text">not a concept</span>
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              These are live previews of the actual student, teacher and parent portals — not mockups designed for marketing.
            </p>
          </motion.div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
          >
            <Tabs value={activePortalTab} onValueChange={setActivePortalTab}>
              <TabsList className="mx-auto mb-6 flex w-fit rounded-full bg-muted p-1 gap-1">
                <TabsTrigger value="student" className="rounded-full px-5 py-2 text-sm font-medium">
                  Student
                </TabsTrigger>
                <TabsTrigger value="teacher" className="rounded-full px-5 py-2 text-sm font-medium">
                  Teacher
                </TabsTrigger>
                <TabsTrigger value="parent" className="rounded-full px-5 py-2 text-sm font-medium">
                  Parent
                </TabsTrigger>
              </TabsList>

              <div className="relative rounded-2xl overflow-hidden border border-border shadow-[0_30px_80px_-20px_rgba(15,23,42,0.18)] ring-1 ring-black/[0.06] bg-background">
                <BrowserChrome url={portalTabUrl[activePortalTab]} />
                <div style={{ height: 420 }} className="relative overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activePortalTab}
                      initial={{ opacity: prefersReducedMotion ? 1 : 0, y: prefersReducedMotion ? 0 : 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: prefersReducedMotion ? 1 : 0, y: prefersReducedMotion ? 0 : -8 }}
                      transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
                      className="absolute inset-0"
                    >
                      {activePortalTab === 'student' && <StudentMockup />}
                      {activePortalTab === 'teacher' && <TeacherMockup />}
                      {activePortalTab === 'parent' && <ParentMockup />}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </Tabs>
          </motion.div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="text-center max-w-2xl mx-auto mb-16"
          >
            <Badge className="mb-4 rounded-full bg-teal-50 text-teal-700 border-teal-200 text-xs font-semibold">
              Simple as 1-2-3
            </Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground mb-4">
              How it works
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              From raw material to a complete study toolkit in under a minute.
            </p>
          </motion.div>

          <div className="relative grid md:grid-cols-3 gap-8 md:gap-6">
            <div className="hidden md:block absolute top-10 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px border-t-2 border-dashed border-border z-0" />
            {steps.map((s, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                custom={i}
                className="relative z-10 text-center"
              >
                <div className="w-20 h-20 rounded-2xl bg-card border border-border shadow-card flex items-center justify-center mx-auto mb-6">
                  {s.icon}
                </div>
                <div className="text-xs font-bold text-muted-foreground tracking-widest mb-2 uppercase">{s.number}</div>
                <h3 className="text-lg font-bold text-foreground mb-3">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Formats Showcase ──────────────────────────────────── */}
      <section id="formats" className="py-20 sm:py-28 bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="text-center max-w-2xl mx-auto mb-12"
          >
            <Badge className="mb-4 rounded-full bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold">
              11 Formats
            </Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground mb-4">
              One source,{' '}
              <span className="gradient-text">eleven ways</span> to learn
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              Upload once. Get an entire study ecosystem — pick the format that fits your mood or learning style.
            </p>
          </motion.div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            className="flex flex-wrap justify-center gap-3"
          >
            {formats.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.4, ease: EASE_OUT_EXPO }}
                whileHover={{ y: -3, scale: 1.04 }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-semibold transition-shadow hover:shadow-md cursor-default ${f.color}`}
              >
                {f.icon}
                {f.label}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────── */}
      <section id="testimonials" className="relative py-20 sm:py-28 overflow-hidden">
        <FloatingDecoration
          className="absolute top-16 left-4 lg:left-12 w-14 h-14 lg:w-20 lg:h-20 opacity-80"
          scrollRange={[0.55, 0.85]}
          yRange={[40, -50]}
          rotateRange={[-12, 20]}
        >
          <BookStackSVG className="w-full h-full" />
        </FloatingDecoration>
        <FloatingDecoration
          className="absolute bottom-16 right-4 lg:right-12 w-12 h-12 lg:w-16 lg:h-16 opacity-80"
          scrollRange={[0.55, 0.85]}
          yRange={[60, -40]}
          rotateRange={[15, -10]}
        >
          <PencilSVG className="w-full h-full" />
        </FloatingDecoration>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="text-center max-w-2xl mx-auto mb-14"
          >
            <Badge className="mb-4 rounded-full bg-amber-50 text-amber-700 border-amber-200 text-xs font-semibold">
              Real People, Real Results
            </Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground mb-4">
              What people are saying
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              From students cramming for exams to teachers reinventing their workflow.
            </p>
          </motion.div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            className="columns-1 md:columns-2 lg:columns-3 gap-5 [&>*]:mb-5 [&>*]:break-inside-avoid"
          >
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-2xl p-5 card-glow flex flex-col"
              >
                {t.stars !== undefined && (
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star
                        key={j}
                        className={`w-3.5 h-3.5 ${j < t.stars! ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted'}`}
                      />
                    ))}
                  </div>
                )}
                <blockquote className="text-sm text-foreground leading-relaxed flex-1 mb-4">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                {t.reply && (
                  <div className="mb-3 pl-3 border-l-2 border-primary/20">
                    <p className="text-[11px] text-muted-foreground">
                      <span className="font-semibold text-primary">↳ Pocket School</span>
                      {' '}— {t.reply}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-2.5">
                  <img
                    src={`https://api.dicebear.com/9.x/notionists-neutral/svg?seed=${t.avatarSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`}
                    alt={t.name}
                    className="w-8 h-8 rounded-full bg-muted shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.role} · {t.date}</p>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── For Every Role ────────────────────────────────────── */}
      <section className="py-20 sm:py-28 bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="text-center max-w-2xl mx-auto mb-14"
          >
            <Badge className="mb-4 rounded-full bg-indigo-50 text-indigo-700 border-indigo-200 text-xs font-semibold">
              For Everyone
            </Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground mb-4">
              Built for every role
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              Whether you&apos;re studying, teaching, parenting or administrating — there&apos;s a tailored experience waiting for you.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {roles.map((r, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                custom={i}
              >
                <Link
                  href={r.href}
                  className={`group block bg-card border-l-4 ${r.color} border border-border rounded-2xl p-6 card-glow h-full`}
                >
                  <div className={`mb-4 ${r.iconColor}`}>{r.icon}</div>
                  <h3 className="text-base font-bold text-foreground mb-4">{r.role}</h3>
                  <ul className="space-y-2">
                    {r.perks.map((p, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-teal-500" />
                        {p}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-5 text-sm font-semibold text-foreground group-hover:underline flex items-center gap-1">
                    Get started <ArrowRight className="w-3.5 h-3.5" />
                  </p>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────── */}
      <section id="faq" className="py-20 sm:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="text-center max-w-2xl mx-auto mb-12"
          >
            <Badge className="mb-4 rounded-full bg-slate-100 text-slate-700 border-slate-200 text-xs font-semibold">
              FAQ
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-4">
              Common questions
            </h2>
          </motion.div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            className="grid md:grid-cols-2 gap-4"
          >
            {faqs.map((item, i) => (
              <details key={i} className="group bg-card border border-border rounded-2xl overflow-hidden">
                <summary className="faq-summary flex items-center justify-between gap-3 px-5 py-4 cursor-pointer select-none list-none">
                  <span className="text-sm font-semibold text-foreground">{item.q}</span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <p className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">{item.a}</p>
              </details>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 -z-0" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_100%,rgba(124,58,237,0.4),transparent)] -z-0" />

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 text-center"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-5">
            Start learning for free today
          </h2>
          <p className="text-base sm:text-lg text-white/80 mb-9 leading-relaxed">
            Free forever for individuals. No credit card required.
          </p>
          <Button
            size="lg"
            onClick={() => router.push('/signup')}
            className="rounded-full h-12 px-10 text-base bg-white text-blue-700 hover:bg-blue-50 font-bold shadow-xl hover:shadow-2xl transition-all"
          >
            Create Your Free Account
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </motion.div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="bg-card border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                  <Brain className="w-4 h-4 text-white" />
                </div>
                <span className="text-[15px] font-bold tracking-tight text-foreground">Pocket School</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-[200px]">
                AI-powered adaptive learning for everyone, everywhere.
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-[11px] font-semibold text-muted-foreground border border-border">
                <Sparkles className="w-3 h-3 text-blue-500" />
                Built with Gemini AI
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-foreground uppercase tracking-widest mb-4">Product</p>
              <ul className="space-y-2.5">
                {['Features', 'How It Works', 'FAQ', 'Changelog'].map(l => (
                  <li key={l}>
                    <Link href={l === 'FAQ' ? '#faq' : '#'} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{l}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-bold text-foreground uppercase tracking-widest mb-4">For</p>
              <ul className="space-y-2.5">
                {['Students', 'Teachers', 'Parents', 'Admins'].map(l => (
                  <li key={l}>
                    <Link href={`/signup?role=${l.toLowerCase()}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{l}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-bold text-foreground uppercase tracking-widest mb-4">Legal</p>
              <ul className="space-y-2.5">
                {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map(l => (
                  <li key={l}>
                    <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{l}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} Pocket School. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground">
              Powered by Rochford&apos;s Education
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
