'use client';

import { motion, useScroll, useTransform } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
    quote:
      'I uploaded my biochemistry textbook chapter on Sunday night. By Monday morning I had a podcast, a full flashcard deck and a quiz. Passed my test with the highest grade in the class.',
    name: 'Amara Osei',
    role: 'Medical Student, Year 2',
    initials: 'AO',
    gradient: 'from-blue-400 to-indigo-500',
  },
  {
    quote:
      'As a teacher I used to spend hours creating revision materials. Now I upload my lesson plan and Pocket School generates everything in seconds. My students are more engaged than ever.',
    name: 'Mr. Daniel Hartley',
    role: 'Secondary School Teacher',
    initials: 'DH',
    gradient: 'from-teal-400 to-emerald-500',
  },
  {
    quote:
      "I can actually see what my daughter is studying each week and track her progress. The parent dashboard is clean and I love getting weekly summaries. It's peace of mind.",
    name: 'Sarah Mensah',
    role: 'Parent of Year 10 Student',
    initials: 'SM',
    gradient: 'from-violet-400 to-purple-500',
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
  { value: '50,000+', label: 'Learners' },
  { value: '11', label: 'Learning Formats' },
  { value: '4', label: 'User Roles' },
  { value: '24/7', label: 'AI Tutor Access' },
];

/* ─── Animation helpers ─────────────────────────────────────── */

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 28 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut', delay: i * 0.08 },
  }),
};

/* ─── Component ─────────────────────────────────────────────── */

export default function LandingPage() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '20%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <span className="text-[15px] font-bold tracking-tight text-foreground">Pocket School</span>
          </Link>

          {/* Center nav — desktop */}
          <nav className="hidden md:flex items-center gap-6">
            {[
              { label: 'Features', href: '#features' },
              { label: 'How It Works', href: '#how-it-works' },
              { label: 'Formats', href: '#formats' },
              { label: 'Testimonials', href: '#testimonials' },
            ].map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>

          {/* Right — desktop */}
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

          {/* Hamburger — mobile */}
          <button
            className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="md:hidden bg-white/95 dark:bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-border px-4 py-4 flex flex-col gap-3"
          >
            {[
              { label: 'Features', href: '#features' },
              { label: 'How It Works', href: '#how-it-works' },
              { label: 'Formats', href: '#formats' },
              { label: 'Testimonials', href: '#testimonials' },
            ].map(({ label, href }) => (
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
      </header>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden pt-16">
        {/* Animated background blobs */}
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
                  onClick={() => { document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' }); }}
                  className="rounded-full h-12 px-8 text-base border-border text-foreground hover:bg-muted transition-all"
                >
                  See How It Works
                </Button>
              </motion.div>

              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={4}
                className="mt-8 flex items-center gap-3"
              >
                <div className="flex -space-x-2">
                  {['AO', 'DH', 'SM', 'KL'].map((init, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full border-2 border-white bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-[10px] font-bold"
                    >
                      {init}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">50,000+</span> learners already inside
                </p>
              </motion.div>
            </div>

            {/* Right — floating format cards */}
            <div className="hidden lg:flex items-center justify-center relative h-[480px]">
              {/* Base card */}
              <motion.div
                initial={{ opacity: 0, y: 30, rotate: -4 }}
                animate={{ opacity: 1, y: 0, rotate: -4 }}
                transition={{ duration: 0.7, ease: "easeOut", delay: 0.3 }}
                className="absolute left-0 top-16 w-52 bg-white/90 dark:bg-[#111118]/90 backdrop-blur-sm rounded-2xl border border-border shadow-card p-5"
              >
                <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center mb-3">
                  <Headphones className="w-4 h-4 text-purple-600" />
                </div>
                <p className="text-xs font-semibold text-foreground mb-1">Podcast Episode</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">18 min · Chapter 3 Summary</p>
                <div className="mt-3 flex items-center gap-1.5">
                  <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                    <div className="h-full w-[40%] bg-purple-500 rounded-full" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">7:12</span>
                </div>
              </motion.div>

              {/* Center card */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: "easeOut", delay: 0.45 }}
                className="absolute top-0 right-4 w-56 bg-white/90 dark:bg-[#111118]/90 backdrop-blur-sm rounded-2xl border border-border shadow-card p-5"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
                  <FlipHorizontal className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-xs font-semibold text-foreground mb-1">Flashcard 4 of 24</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">What is the role of ATP in cellular respiration?</p>
                <div className="mt-3 flex gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 font-medium">Again</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-200 font-medium">Got it</span>
                </div>
              </motion.div>

              {/* Bottom card */}
              <motion.div
                initial={{ opacity: 0, y: 30, rotate: 3 }}
                animate={{ opacity: 1, y: 0, rotate: 3 }}
                transition={{ duration: 0.7, ease: "easeOut", delay: 0.6 }}
                className="absolute bottom-8 right-0 w-52 bg-white/90 dark:bg-[#111118]/90 backdrop-blur-sm rounded-2xl border border-border shadow-card p-5"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
                  <ClipboardList className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-xs font-semibold text-foreground mb-2">Quick Quiz · 5 Questions</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full w-[60%] bg-gradient-to-r from-amber-400 to-orange-500 rounded-full" />
                  </div>
                  <span className="text-[10px] font-semibold text-amber-600">3/5</span>
                </div>
              </motion.div>

              {/* AI Tutor badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut", delay: 0.75 }}
                className="absolute bottom-16 left-12 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5"
              >
                <Brain className="w-3 h-3" />
                AI Tutor Active
              </motion.div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Stats ────────────────────────────────────────────── */}
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
                  <div className={`bg-gradient-to-br ${f.gradient} bg-clip-text`}>
                    <span className={`bg-gradient-to-br ${f.gradient} text-transparent [&>svg]:stroke-current`}>
                      {f.icon}
                    </span>
                  </div>
                </div>
                <h3 className="text-base font-bold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 sm:py-28 bg-muted/20">
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
            {/* Connector line */}
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
      <section id="formats" className="py-20 sm:py-28">
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
                transition={{ delay: i * 0.05, duration: 0.4, ease: "easeOut" }}
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
      <section id="testimonials" className="py-20 sm:py-28 bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="text-center max-w-2xl mx-auto mb-14"
          >
            <Badge className="mb-4 rounded-full bg-amber-50 text-amber-700 border-amber-200 text-xs font-semibold">
              Real Stories
            </Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground mb-4">
              Loved by learners,<br className="hidden sm:block" /> teachers &amp; parents
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                custom={i}
                className="bg-card border border-border rounded-2xl p-7 card-glow flex flex-col"
              >
                {/* Stars */}
                <div className="flex gap-0.5 mb-5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>

                <blockquote className="text-sm text-foreground leading-relaxed flex-1 mb-6">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>

                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className={`text-xs font-bold text-white bg-gradient-to-br ${t.gradient}`}>
                      {t.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── For Every Role ────────────────────────────────────── */}
      <section className="py-20 sm:py-28">
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
            Join 50,000+ students, teachers and parents already using Pocket School to learn smarter.
            No credit card required.
          </p>
          <Button
            size="lg"
            onClick={() => router.push('/signup')}
            className="rounded-full h-13 px-10 text-base bg-white text-blue-700 hover:bg-blue-50 font-bold shadow-xl hover:shadow-2xl transition-all"
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
            {/* Brand */}
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

            {/* Product */}
            <div>
              <p className="text-xs font-bold text-foreground uppercase tracking-widest mb-4">Product</p>
              <ul className="space-y-2.5">
                {['Features', 'How It Works', 'Pricing', 'Changelog'].map(l => (
                  <li key={l}>
                    <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{l}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Roles */}
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

            {/* Legal */}
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
