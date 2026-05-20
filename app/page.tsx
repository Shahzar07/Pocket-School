'use client';

import { motion, useScroll, useTransform, AnimatePresence, type Variants, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
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
  ClipboardList,
  ImageIcon,
  Music,
  Calculator,
  Upload,
  Sparkles,
  Users,
  ShieldCheck,
  Star,
  Menu,
  X,
  ChevronDown,
  TrendingUp,
  Trophy,
  BookOpenCheck,
  Home,
  Library,
  User,
  AlertCircle,
  Layers,
} from 'lucide-react';

/* ─── Data ──────────────────────────────────────────────────── */

const platformIntelligence = [
  {
    icon: <Layers className="w-5 h-5" />,
    title: 'Adaptive Learning Engine',
    desc: 'Every answer, every skipped lesson, every revisited concept causes the platform to recalibrate. It surfaces the right content at the right difficulty at the right moment — automatically, without you having to think about it.',
    tag: 'Real-time adaptive personalisation',
  },
  {
    icon: <User className="w-5 h-5" />,
    title: 'Mojo Tutor AI',
    desc: 'Your 24/7 AI tutor — explains concepts, answers questions, encourages progress, and adapts its teaching style to your intelligence profile. Always available, never impatient.',
    tag: null,
  },
  {
    icon: <ImageIcon className="w-5 h-5" />,
    title: 'Visual Learning Engine',
    desc: 'Every concept rendered through infographics, mind maps, animated sequences, and interactive diagrams — activating multiple cognitive channels simultaneously.',
    tag: null,
  },
  {
    icon: <TrendingUp className="w-5 h-5" />,
    title: 'Progress Intelligence',
    desc: 'Real-time dashboards tracking mastery by topic, exam readiness by subject, and learning momentum — visible to students, parents, and institutions.',
    tag: null,
  },
  {
    icon: <ShieldCheck className="w-5 h-5" />,
    title: 'Smart Exam Prep',
    desc: 'Past papers, auto-marked mock exams, gap analysis reports, and AI-generated revision plans — all orchestrated to maximise grade outcomes.',
    tag: null,
  },
  {
    icon: <Trophy className="w-5 h-5" />,
    title: 'Gamified Mastery System',
    desc: 'Streaks, milestones, leaderboards, and achievement badges transform the hard work of academic mastery into an engaging daily habit — because motivation is half the battle, and Pocket School is built to win it.',
    tag: 'Engagement through gamification',
  },
];

const eightIntelligences = [
  { icon: <BookOpen className="w-5 h-5" />, title: 'Linguistic', desc: 'Word-based learners who thrive through reading, writing and storytelling', accent: '#1A73E8' },
  { icon: <Calculator className="w-5 h-5" />, title: 'Logical-Mathematical', desc: 'Analytical minds drawn to patterns, reasoning and systems', accent: '#1E3A8A' },
  { icon: <ImageIcon className="w-5 h-5" />, title: 'Spatial', desc: 'Visual thinkers who understand through imagery, maps and design', accent: '#F5B400' },
  { icon: <Music className="w-5 h-5" />, title: 'Musical', desc: 'Learners who connect ideas through rhythm, tone and sound', accent: '#EC4899' },
  { icon: <Zap className="w-5 h-5" />, title: 'Bodily-Kinaesthetic', desc: 'Hands-on processors who learn best by doing and moving', accent: '#10B981' },
  { icon: <Users className="w-5 h-5" />, title: 'Interpersonal', desc: 'Social learners who thrive through dialogue and collaboration', accent: '#8B5CF6' },
  { icon: <Brain className="w-5 h-5" />, title: 'Intrapersonal', desc: 'Reflective, self-directed learners who work best independently', accent: '#1A73E8' },
  { icon: <Sparkles className="w-5 h-5" />, title: 'Naturalist', desc: 'Pattern-seekers who learn by classifying and connecting to the world', accent: '#10B981' },
];

const ninePathways = [
  { num: '01', tag: 'QUALIFICATION', title: 'IGCSE Program', desc: 'International General Certificate of Secondary Education — delivered through a fully modular, self-paced format with AI-guided revision and visual concept tools for all subjects.', badge: 'Ideal for Cambridge, Pearson & AQA examination bodies' },
  { num: '02', tag: 'QUALIFICATION', title: 'A Levels', desc: 'Advanced Level programmes opening pathways to universities worldwide. AI exam prep, structured study schedules, and visual subject mastery built around your timeline.', badge: 'Ideal for Cambridge, Pearson & AQA examination bodies' },
  { num: '03', tag: 'TRANSITION', title: 'Pre-University Programs', desc: 'Bridging programmes that close the gap between secondary school and degree-level study — developing critical thinking, academic writing, and research fluency.', badge: 'University prep' },
  { num: '04', tag: 'FOUNDATION', title: 'Foundation Programs', desc: 'Structured academic foundations across business, sciences, arts, and technology — preparing learners for direct entry into bachelor degree programmes.', badge: 'Degree entry' },
  { num: '05', tag: 'DEGREE', title: 'London External Law Degree', desc: 'Study a globally respected external LLB with full platform support, visual case study tools, and law-specialist AI guidance — entirely at your own pace.', badge: 'University of London' },
  { num: '06', tag: 'CREDENTIAL', title: 'Micro Degrees', desc: 'Focused, credit-bearing micro-qualifications in high-demand fields — completed in weeks. Portable, employer-recognised, and stackable toward full degrees.', badge: 'Flexible credential' },
  { num: '07', tag: 'QUALIFICATION', title: 'Diplomas', desc: 'Accredited diploma programmes in business, technology, education, and creative disciplines — a respected pathway for career changers and school leavers alike.', badge: 'Accredited' },
  { num: '08', tag: 'PROFESSIONAL', title: 'Professional Certifications', desc: 'Industry-aligned certifications that validate real skills — from project management to digital marketing, data analytics to educational coaching.', badge: 'Career ready' },
  { num: '09', tag: 'OPEN LEARNING', title: 'Independent Learning Courses', desc: 'Self-directed exploration for curious minds. Pick a topic, learn at your pace, guided by Mojo AI and a rich visual resource library. No deadlines. Just growth.', badge: 'Self-paced' },
];

const fourSteps = [
  { num: '01', title: 'Create Your Profile', desc: 'Share your goals, level, and time. Our AI builds your personalised learning map from day one.' },
  { num: '02', title: 'Choose Your Pathway', desc: 'Pick from 9 academic pathways — or let Mojo AI recommend the best route for your goals.' },
  { num: '03', title: 'Learn Your Way', desc: 'Visual lessons, adaptive exercises, AI explanations — delivered in your intelligence style, at your pace.' },
  { num: '04', title: 'Track & Achieve', desc: 'Watch mastery grow in real time. Earn recognised credentials. Unlock your next level.' },
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

const stats = [
  { value: '9', label: 'Academic Pathways' },
  { value: '8', label: 'Ways of Knowing' },
  { value: '24/7', label: 'Mojo AI Tutor' },
  { value: 'Cambridge · AQA', label: 'Examination Bodies' },
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
    a: "Advanced AI models for content generation and the Socratic tutor. We don't train on your uploads — your material stays yours.",
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

const credentialLogos = ['Google AI', 'Firebase', 'Next.js', 'Vercel'];

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

/* ─── Hero Carousel Illustrations ───────────────────────── */

function HeroIllustrationLearn() {
  // Slide 1: progress + skills (open book + bar chart growing)
  return (
    <svg viewBox="0 0 400 400" className="w-full h-full" aria-hidden>
      <defs>
        <linearGradient id="g-learn-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1E3A8A" />
          <stop offset="100%" stopColor="#1A73E8" />
        </linearGradient>
        <linearGradient id="g-learn-b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F5B400" />
          <stop offset="100%" stopColor="#E89A00" />
        </linearGradient>
      </defs>
      {/* Soft background blob */}
      <ellipse cx="200" cy="200" rx="180" ry="170" fill="#FFF" opacity="0.55" />
      {/* Stack of books */}
      <g transform="translate(70, 80)">
        <rect x="0" y="180" width="200" height="28" rx="6" fill="#1A73E8" />
        <rect x="0" y="180" width="200" height="6" fill="#60A5FA" opacity="0.7" />
        <rect x="14" y="148" width="172" height="28" rx="6" fill="#EC4899" />
        <rect x="14" y="148" width="172" height="6" fill="#F9A8D4" opacity="0.7" />
        <rect x="28" y="116" width="144" height="28" rx="6" fill="#10B981" />
        <rect x="28" y="116" width="144" height="6" fill="#6EE7B7" opacity="0.7" />
      </g>
      {/* Floating "Brain" diamond */}
      <g transform="translate(260, 90)">
        <circle cx="0" cy="0" r="38" fill="url(#g-learn-a)" />
        <path d="M -14 -4 Q 0 -22, 14 -4 Q 18 8, 8 14 L -8 14 Q -18 8, -14 -4 Z" fill="white" />
        <circle cx="-4" cy="2" r="2" fill="#1A73E8" />
        <circle cx="6" cy="2" r="2" fill="#1A73E8" />
      </g>
      {/* Bar chart growth bottom */}
      <g transform="translate(85, 290)">
        <rect x="0" y="50" width="22" height="20" rx="3" fill="#CBD5E1" />
        <rect x="32" y="38" width="22" height="32" rx="3" fill="#CBD5E1" />
        <rect x="64" y="20" width="22" height="50" rx="3" fill="url(#g-learn-b)" />
        <rect x="96" y="10" width="22" height="60" rx="3" fill="#CBD5E1" />
        <rect x="128" y="0" width="22" height="70" rx="3" fill="url(#g-learn-b)" />
      </g>
      {/* Sparkles */}
      <g fill="#F5B400">
        <path d="M 60 60 L 64 70 L 74 74 L 64 78 L 60 88 L 56 78 L 46 74 L 56 70 Z" />
        <path d="M 320 250 L 323 258 L 331 261 L 323 264 L 320 272 L 317 264 L 309 261 L 317 258 Z" />
      </g>
    </svg>
  );
}

function HeroIllustrationFormats() {
  // Slide 2: 11 format icons radiating from center brain
  return (
    <svg viewBox="0 0 400 400" className="w-full h-full" aria-hidden>
      <defs>
        <radialGradient id="g-fmt-center" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#1E3A8A" />
          <stop offset="100%" stopColor="#0B1B3F" />
        </radialGradient>
      </defs>
      <ellipse cx="200" cy="200" rx="180" ry="170" fill="#FFF" opacity="0.55" />
      {/* Outer dotted ring */}
      <circle cx="200" cy="200" r="140" fill="none" stroke="#1A73E8" strokeWidth="1.5" strokeDasharray="3 6" opacity="0.4" />
      <circle cx="200" cy="200" r="100" fill="none" stroke="#1A73E8" strokeWidth="1.5" strokeDasharray="2 5" opacity="0.3" />
      {/* Format icon dots around the ring */}
      {[
        { x: 200, y: 60, color: '#8B5CF6' },
        { x: 296, y: 102, color: '#EC4899' },
        { x: 340, y: 200, color: '#F5B400' },
        { x: 296, y: 298, color: '#10B981' },
        { x: 200, y: 340, color: '#1A73E8' },
        { x: 104, y: 298, color: '#EF4444' },
        { x: 60, y: 200, color: '#06B6D4' },
        { x: 104, y: 102, color: '#F97316' },
      ].map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="14" fill={p.color} />
      ))}
      {/* Center brain */}
      <circle cx="200" cy="200" r="62" fill="url(#g-fmt-center)" />
      <g transform="translate(176, 178)" fill="white">
        <path d="M 12 0 Q -4 -2, -8 12 Q -16 22, -2 30 Q 8 38, 18 30 Q 32 22, 28 12 Q 24 -2, 12 0 Z" />
        <circle cx="6" cy="16" r="2.5" fill="#1E3A8A" />
        <circle cx="20" cy="16" r="2.5" fill="#1E3A8A" />
      </g>
      {/* "11" badge */}
      <g transform="translate(248, 130)">
        <circle cx="0" cy="0" r="24" fill="#F5B400" stroke="white" strokeWidth="4" />
        <text x="0" y="6" textAnchor="middle" fontWeight="900" fontSize="22" fill="#1E3A8A">11</text>
      </g>
    </svg>
  );
}

function HeroIllustrationAi() {
  // Slide 3: AI tutor chat speech bubbles
  return (
    <svg viewBox="0 0 400 400" className="w-full h-full" aria-hidden>
      <defs>
        <linearGradient id="g-ai-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1A73E8" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>
      </defs>
      <ellipse cx="200" cy="200" rx="180" ry="170" fill="#FFF" opacity="0.55" />
      {/* AI bubble */}
      <g transform="translate(60, 130)">
        <path d="M 0 20 Q 0 0, 20 0 L 200 0 Q 220 0, 220 20 L 220 80 Q 220 100, 200 100 L 40 100 L 20 122 L 22 100 Q 0 100, 0 80 Z" fill="url(#g-ai-a)" />
        <rect x="20" y="22" width="120" height="6" rx="3" fill="white" opacity="0.85" />
        <rect x="20" y="38" width="170" height="6" rx="3" fill="white" opacity="0.6" />
        <rect x="20" y="54" width="140" height="6" rx="3" fill="white" opacity="0.6" />
        <rect x="20" y="70" width="80" height="6" rx="3" fill="white" opacity="0.85" />
      </g>
      {/* User bubble */}
      <g transform="translate(140, 260)">
        <path d="M 220 20 Q 220 0, 200 0 L 20 0 Q 0 0, 0 20 L 0 60 Q 0 80, 20 80 L 180 80 L 200 100 L 198 80 Q 220 80, 220 60 Z" fill="white" stroke="#1A73E8" strokeWidth="2" />
        <rect x="30" y="22" width="160" height="5" rx="2.5" fill="#1E3A8A" opacity="0.85" />
        <rect x="30" y="38" width="120" height="5" rx="2.5" fill="#1E3A8A" opacity="0.5" />
        <rect x="30" y="54" width="90" height="5" rx="2.5" fill="#1E3A8A" opacity="0.5" />
      </g>
      {/* Sparkle bursts */}
      <g fill="#F5B400">
        <path d="M 320 100 L 324 110 L 334 114 L 324 118 L 320 128 L 316 118 L 306 114 L 316 110 Z" />
        <path d="M 60 60 L 63 68 L 71 71 L 63 74 L 60 82 L 57 74 L 49 71 L 57 68 Z" />
      </g>
    </svg>
  );
}

function HeroIllustrationUpload() {
  // Slide 4: Upload (file → magic → outputs)
  return (
    <svg viewBox="0 0 400 400" className="w-full h-full" aria-hidden>
      <defs>
        <linearGradient id="g-up" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1A73E8" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
      </defs>
      <ellipse cx="200" cy="200" rx="180" ry="170" fill="#FFF" opacity="0.55" />
      {/* Source PDF document */}
      <g transform="translate(60, 130)">
        <path d="M 0 0 H 80 L 100 22 V 130 H 0 Z" fill="white" stroke="#1E3A8A" strokeWidth="2" />
        <path d="M 80 0 V 22 H 100" fill="none" stroke="#1E3A8A" strokeWidth="2" />
        <rect x="14" y="44" width="72" height="4" rx="2" fill="#94A3B8" />
        <rect x="14" y="56" width="60" height="4" rx="2" fill="#94A3B8" />
        <rect x="14" y="68" width="72" height="4" rx="2" fill="#94A3B8" />
        <rect x="14" y="80" width="50" height="4" rx="2" fill="#94A3B8" />
        <rect x="14" y="100" width="36" height="14" rx="3" fill="#EF4444" />
        <text x="32" y="111" textAnchor="middle" fontSize="9" fill="white" fontWeight="700">PDF</text>
      </g>
      {/* Arrow with sparkle */}
      <g transform="translate(180, 195)">
        <path d="M 0 0 L 50 0 L 45 -6 M 50 0 L 45 6" stroke="url(#g-up)" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 25 -22 L 28 -14 L 36 -11 L 28 -8 L 25 0 L 22 -8 L 14 -11 L 22 -14 Z" fill="#F5B400" />
      </g>
      {/* Output cards */}
      <g transform="translate(250, 110)">
        <rect x="0" y="0" width="90" height="60" rx="8" fill="#1A73E8" />
        <text x="45" y="26" textAnchor="middle" fontSize="11" fontWeight="700" fill="white">Podcast</text>
        <rect x="14" y="38" width="62" height="6" rx="3" fill="white" opacity="0.4" />
        <rect x="14" y="38" width="32" height="6" rx="3" fill="white" />
      </g>
      <g transform="translate(250, 180)">
        <rect x="0" y="0" width="90" height="60" rx="8" fill="#EC4899" />
        <text x="45" y="26" textAnchor="middle" fontSize="11" fontWeight="700" fill="white">Quiz</text>
        <rect x="14" y="38" width="62" height="6" rx="3" fill="white" opacity="0.4" />
        <rect x="14" y="38" width="44" height="6" rx="3" fill="white" />
      </g>
      <g transform="translate(250, 250)">
        <rect x="0" y="0" width="90" height="60" rx="8" fill="#10B981" />
        <text x="45" y="26" textAnchor="middle" fontSize="11" fontWeight="700" fill="white">Flashcards</text>
        <rect x="14" y="38" width="62" height="6" rx="3" fill="white" opacity="0.4" />
        <rect x="14" y="38" width="56" height="6" rx="3" fill="white" />
      </g>
    </svg>
  );
}

function HeroIllustrationRoles() {
  // Slide 5: 4 role avatars connected
  return (
    <svg viewBox="0 0 400 400" className="w-full h-full" aria-hidden>
      <defs>
        <linearGradient id="g-role-1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#1A73E8" /><stop offset="100%" stopColor="#1E3A8A" /></linearGradient>
        <linearGradient id="g-role-2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#10B981" /><stop offset="100%" stopColor="#059669" /></linearGradient>
        <linearGradient id="g-role-3" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#F59E0B" /><stop offset="100%" stopColor="#D97706" /></linearGradient>
        <linearGradient id="g-role-4" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#8B5CF6" /><stop offset="100%" stopColor="#6D28D9" /></linearGradient>
      </defs>
      <ellipse cx="200" cy="200" rx="180" ry="170" fill="#FFF" opacity="0.55" />
      {/* Connecting lines */}
      <g stroke="#1A73E8" strokeWidth="1.5" strokeDasharray="3 4" opacity="0.4" fill="none">
        <path d="M 120 130 L 280 130" />
        <path d="M 120 270 L 280 270" />
        <path d="M 120 130 L 120 270" />
        <path d="M 280 130 L 280 270" />
      </g>
      {/* 4 role circles */}
      {[
        { x: 120, y: 130, label: 'S', grad: 'g-role-1' },
        { x: 280, y: 130, label: 'T', grad: 'g-role-2' },
        { x: 120, y: 270, label: 'P', grad: 'g-role-3' },
        { x: 280, y: 270, label: 'A', grad: 'g-role-4' },
      ].map((r, i) => (
        <g key={i} transform={`translate(${r.x},${r.y})`}>
          <circle cx="0" cy="0" r="44" fill="white" />
          <circle cx="0" cy="0" r="38" fill={`url(#${r.grad})`} />
          <text x="0" y="10" textAnchor="middle" fontSize="32" fontWeight="900" fill="white">{r.label}</text>
        </g>
      ))}
      {/* Center sparkle */}
      <g transform="translate(200, 200)">
        <circle cx="0" cy="0" r="22" fill="#F5B400" stroke="white" strokeWidth="4" />
        <path d="M -6 -2 L 0 -8 L 6 -2 L 8 8 L -8 8 Z" fill="#1E3A8A" />
      </g>
    </svg>
  );
}

const HERO_SLIDES = [
  {
    pills: ['Adaptive AI', 'Personalised', 'Free Forever'],
    title: 'Master New Skills,',
    titleAccent: 'Learn Your Way.',
    body: 'Upload any PDF, video or URL. Our AI builds 11 personalised study formats — podcasts, flashcards, quizzes — tailored to how you learn best.',
    Illustration: HeroIllustrationLearn,
  },
  {
    pills: ['11 Formats', 'One Source', 'Any Subject'],
    title: 'One upload.',
    titleAccent: 'Eleven ways to learn.',
    body: 'Podcasts on your commute. Flashcards before bed. Mind maps for revision week. Same source — every format you need.',
    Illustration: HeroIllustrationFormats,
  },
  {
    pills: ['Socratic Method', 'Always-on', 'Multi-level'],
    title: 'Study with AI that',
    titleAccent: 'actually teaches.',
    body: "Our tutor doesn't just give answers. It asks the right questions until you understand — at your level, in your subject, on your schedule.",
    Illustration: HeroIllustrationAi,
  },
  {
    pills: ['PDF · Video · URL', 'Audio · Text', 'Up to 200MB'],
    title: 'Drop in anything.',
    titleAccent: 'Get a study toolkit.',
    body: 'Lesson notes, a YouTube link, a 40-page paper — our AI turns it into a complete revision pack in under a minute.',
    Illustration: HeroIllustrationUpload,
  },
  {
    pills: ['Students', 'Teachers', 'Parents', 'Admins'],
    title: 'Built for everyone',
    titleAccent: 'in the classroom.',
    body: "Each role gets a tailored experience — gamified study for students, AI grading for teachers, weekly summaries for parents, and full controls for admins.",
    Illustration: HeroIllustrationRoles,
  },
];

/* ─── Hero Carousel Component ─────────────────────────────── */

function HeroCarousel() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const total = HERO_SLIDES.length;
  const slide = HERO_SLIDES[index];
  const Illustration = slide.Illustration;

  useEffect(() => {
    if (prefersReducedMotion) return;
    const t = setTimeout(() => setIndex(i => (i + 1) % total), 7000);
    return () => clearTimeout(t);
  }, [index, total, prefersReducedMotion]);

  const next = () => setIndex(i => (i + 1) % total);
  const prev = () => setIndex(i => (i - 1 + total) % total);

  return (
    <section className="relative h-[100dvh] min-h-[600px] flex items-center pt-16 pb-6 overflow-hidden bg-gradient-to-br from-[#EEF4FF] via-[#FAFCFF] to-[#FFF8ED]">
      <FloatingDecoration
        className="absolute top-24 left-4 lg:left-12 w-10 h-10 lg:w-14 lg:h-14 z-20"
        scrollRange={[0, 0.3]}
        yRange={[0, -30]}
        rotateRange={[0, -15]}
      >
        <PencilSVG className="w-full h-full drop-shadow-md" />
      </FloatingDecoration>
      <FloatingDecoration
        className="absolute top-28 right-6 lg:right-20 w-12 h-12 lg:w-16 lg:h-16 z-20"
        scrollRange={[0, 0.3]}
        yRange={[0, -36]}
        rotateRange={[0, 25]}
      >
        <PinkStarBurst className="w-full h-full drop-shadow-md" />
      </FloatingDecoration>

      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6">
        <div className="relative">
          <div className="grid lg:grid-cols-[1.05fr_1fr] gap-0 lg:gap-4 pt-4 lg:pt-6 pb-8 lg:pb-10">
            {/* LEFT — illustration */}
            <div className="relative px-6 lg:px-12 flex items-center justify-center min-h-[340px] lg:min-h-[520px] order-2 lg:order-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={index}
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -12 }}
                  transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
                  className="relative w-full max-w-md aspect-square"
                >
                  <Illustration />
                </motion.div>
              </AnimatePresence>

              {/* Floating category pills */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={`pills-${index}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4, ease: EASE_OUT_EXPO, delay: 0.15 }}
                  className="absolute top-4 left-4 lg:top-8 lg:left-8 flex flex-col gap-2 z-10"
                >
                  {slide.pills.slice(0, 2).map((p, i) => (
                    <span
                      key={p}
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm shadow-sm ${
                        i === 0
                          ? 'bg-[#1E3A8A] text-white'
                          : 'bg-white/80 border border-[#1A73E8]/20 text-[#1E3A8A]'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-[#F5B400]' : 'bg-[#1A73E8]'}`} />
                      {p}
                    </span>
                  ))}
                </motion.div>
              </AnimatePresence>

              {slide.pills.length > 2 && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`pills-r-${index}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.4, ease: EASE_OUT_EXPO, delay: 0.25 }}
                    className="absolute top-12 right-4 lg:top-20 lg:right-8 flex flex-col gap-2 z-10"
                  >
                    {slide.pills.slice(2).map((p) => (
                      <span
                        key={p}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-sm border border-[#1A73E8]/20 text-[#1E3A8A] shadow-sm"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#EC4899]" />
                        {p}
                      </span>
                    ))}
                  </motion.div>
                </AnimatePresence>
              )}

              {/* Mini Progress chart card */}
              <div className="absolute bottom-4 left-4 lg:bottom-2 lg:left-6 bg-white rounded-2xl shadow-xl border border-black/[0.04] p-3 w-44 lg:w-52 z-10">
                <p className="text-[10px] font-bold text-slate-700 mb-2">Your Learning Progress</p>
                <div className="flex items-end gap-1.5 h-12">
                  {[10, 30, 50, 70, 92].map((p, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[8px] font-bold text-slate-500">{p}%</span>
                      <div
                        className={`w-full rounded-t-md ${i % 2 === 0 ? 'bg-[#1A73E8]' : 'bg-slate-200'}`}
                        style={{ height: `${p * 0.4}px` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT — text */}
            <div className="px-6 lg:px-12 flex flex-col justify-center order-1 lg:order-2 pt-4 lg:pt-0">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
                className="flex items-center gap-2 mb-5"
              >
                <span className="inline-flex items-center gap-1.5 bg-[#F5B400] text-[#1E3A8A] text-xs font-extrabold px-2.5 py-1 rounded-full shadow-sm">
                  <Star className="w-3 h-3 fill-[#1E3A8A]" />
                  5.0
                </span>
                <span className="text-xs font-semibold text-slate-700">Students Review</span>
              </motion.div>

              <AnimatePresence mode="wait">
                <motion.h1
                  key={`title-${index}`}
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -20 }}
                  transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
                  className="text-4xl sm:text-5xl lg:text-[58px] xl:text-[68px] font-black leading-[0.95] tracking-tight text-[#0B1B3F] mb-5"
                >
                  {slide.title}
                  <br />
                  <span className="bg-gradient-to-r from-[#1A73E8] to-[#1E3A8A] bg-clip-text text-transparent">
                    {slide.titleAccent}
                  </span>
                </motion.h1>
              </AnimatePresence>

              <AnimatePresence mode="wait">
                <motion.p
                  key={`body-${index}`}
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
                  transition={{ duration: 0.4, ease: EASE_OUT_EXPO, delay: 0.05 }}
                  className="text-sm sm:text-base text-slate-700 leading-relaxed mb-7 max-w-md"
                >
                  {slide.body}
                </motion.p>
              </AnimatePresence>

              <div className="flex items-center gap-4 flex-wrap">
                <Button
                  onClick={() => router.push('/signup')}
                  className="rounded-full h-12 px-7 text-sm font-bold bg-[#1A73E8] hover:bg-[#1967D2] text-white shadow-lg shadow-[#1A73E8]/30 transition-all"
                >
                  Start Free <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
                <button
                  onClick={() => document.getElementById('portal-showcase')?.scrollIntoView({ behavior: 'smooth' })}
                  className="flex items-center gap-3 text-sm font-bold text-[#0B1B3F] hover:text-[#1A73E8] transition-colors group"
                >
                  <span className="w-11 h-11 rounded-full bg-white shadow-md flex items-center justify-center group-hover:bg-[#1A73E8] transition-colors">
                    <span className="w-0 h-0 border-l-[8px] border-l-[#1A73E8] group-hover:border-l-white border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent ml-1" />
                  </span>
                  Free Course
                </button>
              </div>

              <div className="mt-12 lg:mt-16 flex items-center justify-between border-t border-black/[0.06] pt-5">
                <div className="text-xs text-slate-600">
                  <p className="font-semibold text-[#0B1B3F]">{slide.pills[0]}</p>
                  <p>Project-driven content</p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-sm font-bold text-[#0B1B3F]">
                    <span className="text-[#1A73E8]">{String(index + 1).padStart(1, '0')}</span>
                    <span className="text-slate-400">/{String(total).padStart(1, '0')}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={prev}
                      aria-label="Previous slide"
                      className="w-9 h-9 rounded-full border border-[#0B1B3F]/15 hover:border-[#1A73E8] hover:bg-[#1A73E8] text-[#0B1B3F] hover:text-white transition-colors flex items-center justify-center"
                    >
                      <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                    </button>
                    <button
                      onClick={next}
                      aria-label="Next slide"
                      className="w-9 h-9 rounded-full bg-[#1A73E8] hover:bg-[#1967D2] text-white transition-colors flex items-center justify-center"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        <div className="mt-6 flex items-center justify-center gap-x-6 gap-y-2 flex-wrap">
          <span className="text-[11px] text-[#0B1B3F]/60 font-bold tracking-widest uppercase">Powered by</span>
          {credentialLogos.map((name) => (
            <span key={name} className="text-xs font-extrabold text-[#0B1B3F]/70 tracking-wide">
              {name}
            </span>
          ))}
        </div>
      </div>

      {/* Slide progress bar — anchored to section bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/[0.06]">
        <motion.div
          key={index}
          className="h-full bg-gradient-to-r from-[#1A73E8] to-[#F5B400]"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: prefersReducedMotion ? 0 : 7, ease: 'linear' }}
        />
      </div>
    </section>
  );
}

/* ─── Popular Courses (marketplace teaser) ────────────────── */

function PopularCoursesSection() {
  const [items, setItems] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import('@/lib/db').then(async ({ getPublicCourses }) => {
      try {
        const list = await getPublicCourses();
        if (!cancelled) {
          setItems(list.slice(0, 4));
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  if (!loaded || items.length === 0) return null;

  const fmtPrice = (c: any) => {
    if (!c.price || c.price === 0) return 'Free';
    const symbol = c.currency === 'USD' ? '$' : c.currency === 'EUR' ? '€' : '£';
    return `${symbol}${c.price.toFixed(2)}`;
  };

  return (
    <section className="py-20 sm:py-28 bg-muted/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10"
        >
          <div>
            <Badge className="mb-3 rounded-full bg-amber-50 text-amber-700 border-amber-200 text-xs font-semibold">
              Marketplace
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Popular right now
            </h2>
          </div>
          <Link
            href="/courses"
            className="text-sm font-semibold text-primary hover:underline flex items-center gap-1"
          >
            Browse all <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {items.map((c, i) => (
            <motion.div
              key={c.id}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              custom={i}
            >
              <Link href={`/courses/${c.id}`} className="block bg-card border border-border rounded-2xl overflow-hidden card-glow h-full flex flex-col">
                <div className="aspect-video bg-gradient-to-br from-blue-100 via-indigo-100 to-violet-100 relative flex items-center justify-center">
                  {c.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.thumbnailUrl} alt={c.title} className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen className="w-10 h-10 text-blue-400/60" />
                  )}
                  <span className="absolute top-2 left-2 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/95 text-foreground">
                    {c.type ?? 'course'}
                  </span>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-bold text-sm text-foreground mb-1 line-clamp-2">{c.title}</h3>
                  <p className="text-[11px] text-muted-foreground mb-3">{c.ownerName ?? 'Pocket School'}</p>
                  <div className="mt-auto flex items-center justify-between">
                    <span className={`text-sm font-extrabold ${c.price ? 'text-foreground' : 'text-emerald-600'}`}>
                      {fmtPrice(c)}
                    </span>
                    {c.level && (
                      <span className="text-[10px] text-muted-foreground font-semibold">{c.level}</span>
                    )}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Component ─────────────────────────────────────────────── */

export default function LandingPage() {
  const router = useRouter();
  const { user, profile } = useAuthSTORE();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activePortalTab, setActivePortalTab] = useState('student');
  const prefersReducedMotion = useReducedMotion();

  const dashPath = profile?.role === 'teacher' ? '/dashboard/teacher'
    : profile?.role === 'admin' ? '/dashboard/admin'
    : profile?.role === 'parent' ? '/dashboard/parent'
    : '/dashboard/student';
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { label: "Who It's For", href: '#methodology' },
    { label: 'Programs', href: '#programs' },
    { label: 'Platform', href: '#platform' },
    { label: 'AI Teachers', href: '/ai-teachers' },
    { label: 'Marketplace', href: '/courses' },
    { label: 'AI Studio', href: '/ai-studio' },
    { label: 'Methodology', href: '#methodology' },
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
            {user ? (
              <Link href={dashPath} className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-blue-600 transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold select-none">
                  {profile?.name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <span>{profile?.name?.split(' ')[0] ?? 'Dashboard'}</span>
              </Link>
            ) : (
              <>
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
              </>
            )}
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
                {user ? (
                  <Link href={dashPath} className="flex items-center gap-2 text-sm font-medium text-foreground py-1">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold select-none">
                      {profile?.name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? 'U'}
                    </div>
                    <span>{profile?.name ?? 'Go to Dashboard'}</span>
                  </Link>
                ) : (
                  <>
                    <Link href="/login" className="text-sm font-medium text-muted-foreground">Sign In</Link>
                    <Button
                      onClick={() => router.push('/signup')}
                      className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white w-full"
                    >
                      Get Started <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Hero (Learnova-style carousel, brand colors) ─────── */}
      <HeroCarousel />


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

      {/* ── Manifesto / Quote ─────────────────────────────────── */}
      <section className="relative py-20 sm:py-28 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="border-l-4 border-[#1A73E8] pl-6 lg:pl-8"
          >
            <p className="text-3xl sm:text-4xl lg:text-5xl font-black leading-[1.1] tracking-tight text-[#0B1B3F]">
              &ldquo;Our platform embodies visual learning methodologies designed to invoke and strengthen a learner&rsquo;s{' '}
              <span className="bg-gradient-to-r from-[#1A73E8] to-[#1E3A8A] bg-clip-text text-transparent">
                multiple intelligences
              </span>
              .&rdquo;
            </p>
            <div className="mt-8 flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-slate-500">Ideal for:</span>
              {['Cambridge', 'Pearson', 'AQA'].map((b) => (
                <span key={b} className="px-3 py-1.5 rounded-md border border-[#1A73E8]/20 bg-[#EEF3FF] text-xs font-bold text-[#1E3A8A]">
                  {b}
                </span>
              ))}
              <span className="text-xs text-slate-500">examination bodies</span>
            </div>
          </motion.div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="space-y-5 text-base sm:text-lg leading-relaxed text-slate-700"
          >
            <p>
              Pocket School is not a tutoring platform or a content library. It is a full learning operating system — one that adapts to how you think, how you see, and how you make meaning of the world.
            </p>
            <p>
              Built on the science of multiple intelligences, every lesson, interaction, and assessment is designed to activate more than one way of knowing. Your unique intelligence profile shapes every step of your learning journey.
            </p>
            <p>
              The result: faster mastery, deeper retention, and learners who genuinely love the process — whatever their age, background, or starting point.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Eight Ways of Knowing ─────────────────────────────── */}
      <section id="methodology" className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="grid lg:grid-cols-2 gap-10 lg:gap-16 mb-14 items-start"
          >
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-[#1A73E8] mb-4">LEARNING METHODOLOGY</p>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-[#0B1B3F] leading-[1.05]">
                Eight Ways
                <br />
                of{' '}
                <span className="bg-gradient-to-r from-[#1A73E8] to-[#1E3A8A] bg-clip-text text-transparent">Knowing</span>
              </h2>
            </div>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed lg:pt-12">
              Every person processes the world differently. Pocket School&rsquo;s visual learning methodology is built on the science of multiple intelligences — activating several intelligence types in every lesson so content reaches learners the way they actually think, not the way a textbook assumes they should.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {eightIntelligences.map((it, i) => (
              <motion.div
                key={it.title}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                custom={i % 4}
                className="bg-[#F8FAFF] border border-slate-100 rounded-2xl p-6 text-center hover:shadow-lg hover:border-slate-200 transition-all"
              >
                <div
                  className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center"
                  style={{ backgroundColor: `${it.accent}15`, color: it.accent }}
                >
                  {it.icon}
                </div>
                <h3 className="text-base font-extrabold text-[#0B1B3F] mb-2">{it.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{it.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Platform Intelligence — AI That Actually Knows You ── */}
      <section id="platform" className="relative py-20 sm:py-28 bg-gradient-to-b from-[#F8FAFF] to-white overflow-hidden">
        <FloatingDecoration
          className="absolute top-12 right-6 w-12 h-12 lg:w-16 lg:h-16 opacity-80"
          scrollRange={[0.05, 0.35]}
          yRange={[40, -60]}
          rotateRange={[-15, 20]}
        >
          <PencilSVG className="w-full h-full" />
        </FloatingDecoration>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="mb-14 max-w-3xl"
          >
            <p className="text-xs font-bold tracking-[0.2em] text-[#1A73E8] mb-4">PLATFORM INTELLIGENCE</p>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-[#0B1B3F] leading-[1.05] mb-5">
              AI That Actually{' '}
              <span className="bg-gradient-to-r from-[#1A73E8] to-[#1E3A8A] bg-clip-text text-transparent">Knows You</span>
            </h2>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
              Pocket School&rsquo;s intelligence layer adapts to how you learn and evolves with every session — not just what you study, but how you understand.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {platformIntelligence.map((f, i) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                custom={i}
                className="group relative bg-white border border-slate-200 rounded-2xl p-7 hover:border-[#1A73E8]/40 hover:shadow-[0_20px_50px_-20px_rgba(26,115,232,0.25)] transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-[#EEF3FF] flex items-center justify-center mb-5 text-[#1A73E8]">
                  {f.icon}
                </div>
                <h3 className="text-lg font-extrabold text-[#0B1B3F] mb-2">{f.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">{f.desc}</p>
                {f.tag && (
                  <div className="pt-4 border-t border-slate-100">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1A73E8]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#F5B400]" />
                      {f.tag}
                    </span>
                  </div>
                )}
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

      {/* ── Popular Courses (marketplace teaser) ──────────────── */}
      <PopularCoursesSection />

      {/* ── Getting Started — Up and Learning in Four Steps ──── */}
      <section id="getting-started" className="py-20 sm:py-28 bg-[#F8FAFF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="mb-16 max-w-2xl"
          >
            <p className="text-xs font-bold tracking-[0.2em] text-[#1A73E8] mb-4">GETTING STARTED</p>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-[#0B1B3F] leading-[1.05] mb-5">
              Up and Learning{' '}
              <span className="bg-gradient-to-r from-[#1A73E8] to-[#1E3A8A] bg-clip-text text-transparent">in Four Steps</span>
            </h2>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
              From sign-up to your first breakthrough — Pocket School gets you there faster than any platform you&rsquo;ve tried.
            </p>
          </motion.div>

          <div className="relative grid md:grid-cols-4 gap-8 md:gap-4 mt-12">
            <div className="hidden md:block absolute top-7 left-[calc(12.5%+1rem)] right-[calc(12.5%+1rem)] h-px border-t-2 border-dashed border-[#1A73E8]/30 z-0" />
            {fourSteps.map((s, i) => (
              <motion.div
                key={s.num}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                custom={i}
                className="relative z-10 text-center"
              >
                <div className="w-14 h-14 rounded-full bg-white border-2 border-[#1A73E8] flex items-center justify-center mx-auto mb-6 shadow-md">
                  <span className="text-sm font-black text-[#1A73E8]">{s.num}</span>
                </div>
                <h3 className="text-lg font-extrabold text-[#0B1B3F] mb-3">{s.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Nine Pathways. One Platform. ─────────────────────── */}
      <section id="programs" className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="mb-14 max-w-2xl"
          >
            <p className="text-xs font-bold tracking-[0.2em] text-[#1A73E8] mb-4">ACADEMIC PATHWAYS</p>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-[#0B1B3F] leading-[1.05] mb-5">
              Nine Pathways.
              <br />
              <span className="bg-gradient-to-r from-[#1A73E8] to-[#1E3A8A] bg-clip-text text-transparent">One Platform.</span>
            </h2>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
              From globally recognised academic qualifications to professional certifications and self-directed learning — there is a pathway here for every ambition.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {ninePathways.map((p, i) => (
              <motion.div
                key={p.num}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                custom={i % 4}
                className="group bg-white border border-slate-200 rounded-2xl p-6 hover:border-[#1A73E8]/40 hover:shadow-[0_20px_50px_-20px_rgba(26,115,232,0.2)] transition-all flex flex-col"
              >
                <p className="text-[10px] font-bold tracking-[0.15em] text-slate-400 mb-3">
                  {p.num} — {p.tag}
                </p>
                <h3 className="text-lg font-extrabold text-[#0B1B3F] mb-3 leading-tight">{p.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-5 flex-1">{p.desc}</p>
                <span className="inline-block self-start text-[10px] font-bold tracking-wide uppercase px-2.5 py-1.5 rounded-md border border-[#1A73E8]/25 bg-[#EEF3FF] text-[#1E3A8A] leading-tight">
                  {p.badge}
                </span>
              </motion.div>
            ))}
          </div>
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

      {/* ── Your Smartest Learning Decision ──────────────────── */}
      <section className="py-24 sm:py-32 relative overflow-hidden bg-[#0B1B3F]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgba(26,115,232,0.25),transparent)] -z-0" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(245,180,0,0.12),transparent)] -z-0" />

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 text-center"
        >
          <p className="text-xs font-bold tracking-[0.25em] text-[#1A73E8] mb-5">START TODAY</p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white mb-6 leading-[1.05]">
            Your Smartest
            <br />
            <span className="bg-gradient-to-r from-[#1A73E8] via-[#60A5FA] to-[#F5B400] bg-clip-text text-transparent">
              Learning Decision
            </span>
          </h2>
          <p className="text-base sm:text-lg text-white/70 mb-10 leading-relaxed max-w-2xl mx-auto">
            Whether you&rsquo;re a school, a homeschooling family, a learning centre, or a professional ready to level up — Pocket School has a pathway personalised for you.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button
              size="lg"
              onClick={() => router.push('/courses')}
              className="rounded-full h-12 px-7 text-sm font-bold bg-[#1A73E8] hover:bg-[#1967D2] text-white shadow-xl shadow-[#1A73E8]/40 transition-all"
            >
              Browse All Programs <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => document.getElementById('platform')?.scrollIntoView({ behavior: 'smooth' })}
              className="rounded-full h-12 px-7 text-sm font-bold bg-transparent border-white/25 hover:bg-white/10 text-white hover:text-white transition-all"
            >
              Explore the Platform
            </Button>
          </div>
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
                {[
                  { label: 'AI Teachers', href: '/ai-teachers' },
                  { label: 'AI Studio', href: '/ai-studio' },
                  { label: 'Programs', href: '#programs' },
                  { label: 'Marketplace', href: '/courses' },
                  { label: 'FAQ', href: '#faq' },
                ].map(l => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{l.label}</Link>
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
