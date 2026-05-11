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

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden pt-16">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="blob-1 absolute -top-32 -left-40 w-[600px] h-[600px] rounded-full bg-blue-400/20 blur-[100px]" />
          <div className="blob-2 absolute top-1/4 right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-400/15 blur-[100px]" />
          <div className="blob-3 absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full bg-teal-400/15 blur-[100px]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(26,115,232,0.08),transparent)]" />
        </div>

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left — text */}
            <div>
              <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
                <Badge className="mb-6 gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200 shadow-sm">
                  <Sparkles className="w-3 h-3" />
                  Powered by Gemini 2.5 Pro
                </Badge>
              </motion.div>

              <motion.h1
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={1}
                className="text-4xl sm:text-5xl lg:text-6xl xl:text-[68px] font-extrabold leading-[1.08] tracking-tight text-foreground mb-6"
              >
                The Smarter Way<br />
                to Learn{' '}
                <span className="gradient-text">Anything</span>
              </motion.h1>

              <motion.p
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={2}
                className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-8 max-w-md"
              >
                Upload any material — a PDF, video or URL. Our AI transforms it into 11 personalised
                learning formats in seconds, tailored to exactly how you learn best.
              </motion.p>

              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={3}
                className="flex flex-col sm:flex-row gap-3"
              >
                <Button
                  size="lg"
                  onClick={() => router.push('/signup')}
                  className="rounded-full h-12 px-8 text-base bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all"
                >
                  Start Learning for Free
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => { document.getElementById('portal-showcase')?.scrollIntoView({ behavior: 'smooth' }); }}
                  className="rounded-full h-12 px-8 text-base border-border text-foreground hover:bg-muted transition-all"
                >
                  See It in Action
                </Button>
              </motion.div>

              {/* Credential strip */}
              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={4}
                className="mt-8 flex items-center gap-4 flex-wrap"
              >
                <span className="text-xs text-muted-foreground/60 font-medium">Built with</span>
                {credentialLogos.map((name) => (
                  <span key={name} className="text-xs font-semibold text-muted-foreground/50 tracking-wide">
                    {name}
                  </span>
                ))}
              </motion.div>
            </div>

            {/* Right — portal preview */}
            <div className="hidden lg:block relative">
              {/* Small peripheral: Teacher alert */}
              <motion.div
                initial={{ opacity: 0, y: 24, rotate: -3 }}
                animate={{ opacity: 1, y: 0, rotate: -3 }}
                transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 0.5 }}
                className="absolute -left-8 top-12 w-52 bg-white/95 dark:bg-[#111118]/95 backdrop-blur-sm rounded-2xl border border-border shadow-card p-4 z-10"
              >
                <div className="flex items-start gap-2 mb-2">
                  <Bell className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-semibold text-foreground">3 submissions ready</p>
                    <p className="text-[9px] text-muted-foreground">Biology 101 · Mrs. Hartley</p>
                  </div>
                </div>
                <div className="h-1 rounded-full bg-amber-100 overflow-hidden">
                  <div className="h-full w-[60%] bg-amber-400 rounded-full" />
                </div>
              </motion.div>

              {/* Main browser-framed mockup */}
              <motion.div
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 0.3 }}
                className="relative rounded-2xl overflow-hidden border border-border shadow-[0_30px_80px_-20px_rgba(15,23,42,0.18)] ring-1 ring-black/[0.06]"
                style={{ height: 400 }}
              >
                <BrowserChrome url="pocketschool.app/student" />
                <div className="h-[calc(100%-28px)] bg-background">
                  <StudentMockup />
                </div>
              </motion.div>

              {/* Small peripheral: AI Tutor chat */}
              <motion.div
                initial={{ opacity: 0, y: 24, rotate: 4 }}
                animate={{ opacity: 1, y: 0, rotate: 4 }}
                transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 0.65 }}
                className="absolute -right-6 bottom-10 w-52 bg-white/95 dark:bg-[#111118]/95 backdrop-blur-sm rounded-2xl border border-border shadow-card overflow-hidden z-10"
              >
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                    <Brain className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-[10px] font-semibold text-white">AI Tutor</span>
                  <span className="ml-auto text-[8px] px-1.5 py-0.5 rounded-full bg-white/20 text-white font-medium">K-12</span>
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex justify-end">
                    <div className="bg-primary text-white text-[9px] rounded-xl rounded-tr-sm px-2.5 py-1.5 max-w-[80%]">
                      What is ATP and why does it matter?
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shrink-0">
                      <Brain className="w-2.5 h-2.5 text-white" />
                    </div>
                    <div className="bg-muted text-foreground text-[9px] rounded-xl rounded-tl-sm px-2.5 py-1.5 max-w-[80%]">
                      Good question — before I explain, what do you think cells might need energy for?
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
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
      <section id="features" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
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
      <section id="portal-showcase" className="py-20 sm:py-28 bg-muted/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
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
      <section id="testimonials" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
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
