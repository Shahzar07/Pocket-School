'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import {
  Atom,
  Calculator,
  PenTool,
  Globe,
  Languages,
  Code2,
  Briefcase,
  Palette,
  ScrollText,
  Brain,
  Heart,
  Scale,
  ArrowRight,
  Mic,
  Sparkles,
} from 'lucide-react';
import { AiTeacherModal } from '@/components/ai-teacher-modal';
import { MarketingHero } from '@/components/marketing/illustrations';
import { PublicToolShell } from '@/components/studio/tool-shell';
import { portraitAlt, teacherPortrait } from '@/lib/teacher-portrait';
import Image from 'next/image';
import {
  accentOnLight,
  AI_TEACHERS,
  CEFR_BANNER,
  CEFR_LEVELS,
  TEACHER_CATEGORIES,
  type AiTeacher,
  type TeacherCategory,
  type TeacherIconKey,
} from '@/lib/ai-teachers';

const ICONS: Record<TeacherIconKey, typeof Atom> = {
  atom: Atom,
  calculator: Calculator,
  pen: PenTool,
  globe: Globe,
  languages: Languages,
  code: Code2,
  briefcase: Briefcase,
  palette: Palette,
  history: ScrollText,
  heart: Heart,
  scale: Scale,
  brain: Brain,
};

export default function AiTeachersPage() {
  const [filter, setFilter] = useState<'All' | TeacherCategory>('All');
  const [selected, setSelected] = useState<AiTeacher | null>(null);

  const visible = useMemo(() => {
    const filtered = filter === 'All' ? AI_TEACHERS : AI_TEACHERS.filter((t) => t.category === filter);
    // live teachers first
    return [...filtered].sort((a, b) => {
      const aLive = a.status === 'live' ? 0 : 1;
      const bLive = b.status === 'live' ? 0 : 1;
      return aLive - bLive;
    });
  }, [filter]);

  const open = (t: AiTeacher) => setSelected(t);
  const showCefr = filter === 'All' || filter === 'Languages';

  return (
    <PublicToolShell>
    <div className="min-h-full bg-transparent">
      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative pt-14 lg:pt-20 pb-12 bg-gradient-to-b from-secondary via-background to-background dark:from-[#0B1417] dark:via-[#121E22] dark:to-[#0B1417] overflow-hidden">
        <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-[var(--ps-cyan-soft)] blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <MarketingHero slug="ai-teachers">
          <div className="min-w-0 text-center lg:text-left">
          <p className="mb-4">
            <Link href="/" className="text-sm font-semibold text-[#1E6A83]">Home</Link>
          </p>
          <p className="text-xs font-bold tracking-[0.25em] text-primary mb-5">AI TEACHERS LIBRARY</p>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl tracking-tight text-foreground leading-[0.95] mb-6 max-w-4xl mx-auto lg:mx-0">
            Your 24/7 Faculty.
            <br />
            <span className="bg-gradient-to-r from-[var(--ps-primary)] via-[#1E3A8A] to-[var(--ps-primary)] bg-clip-text text-transparent">
              Always Available.
            </span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto lg:mx-0 mb-8">
            Talk face-to-face with AI educators trained on the curricula that matter. No appointments. No waiting. Just learning.
          </p>
          <div className="flex items-center justify-center lg:justify-start gap-2 sm:gap-3 flex-wrap text-xs sm:text-sm font-bold text-foreground">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card shadow-md border border-black/[0.04]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              30+ AVAILABLE NOW
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card shadow-md border border-black/[0.04]">
              <Sparkles className="w-3.5 h-3.5 text-[var(--ps-cyan-text)]" />
              30+ SUBJECTS
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card shadow-md border border-black/[0.04]">
              <Mic className="w-3.5 h-3.5 text-primary" />
              VOICE + TEXT
            </span>
          </div>
          </div>
          </MarketingHero>
        </div>
      </section>

      {/* ── Filter + grid ─────────────────────────────────────── */}
      <section className="bg-background py-16 lg:py-20 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="mb-10 flex items-end justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-primary mb-3">EXPLORE THE FACULTY</p>
              <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl tracking-tight text-foreground leading-[1.05]">
                Meet every teacher on the bench.
              </h2>
            </div>
            <p className="text-sm font-semibold text-muted-foreground">
              Showing {visible.length} of 30+
            </p>
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-2 flex-wrap mb-8">
            {(['All', ...TEACHER_CATEGORIES] as const).map((c) => {
              const active = filter === c;
              return (
                <button
                  key={c}
                  onClick={() => setFilter(c)}
                  className={`text-xs font-bold px-4 py-2 rounded-full transition-all ${
                    active
                      ? 'bg-[#203337] text-white shadow-md'
                      : 'bg-card text-muted-foreground border border-slate-200 hover:border-primary hover:text-primary'
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>

          {/* Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            <AnimatePresence mode="popLayout">
              {visible.map((t, i) => (
                <TeacherCard key={t.id} teacher={t} index={i} onOpen={() => open(t)} />
              ))}
            </AnimatePresence>
          </div>

          {showCefr && (
            <div className="mt-8 rounded-3xl border border-primary/20 bg-card px-5 py-5 sm:px-7">
              <p className="text-xs font-bold tracking-[0.18em] text-primary mb-3">CEFR · LANGUAGES</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {CEFR_LEVELS.map((level) => (
                  <span key={level.code} className="inline-flex items-center gap-1.5 rounded-full bg-[#E9F7FA] px-3 py-1.5 text-xs font-bold text-[#1E6A83]">
                    {level.code}
                    <span className="font-semibold text-primary">{level.label}</span>
                  </span>
                ))}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{CEFR_BANNER}</p>
            </div>
          )}

          {visible.length === 0 && (
            <div className="text-center py-20">
              <p className="text-sm text-muted-foreground">No teachers in this category yet.</p>
            </div>
          )}
        </div>
      </section>

      <section className="bg-background py-16 lg:py-20" id="beyond">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs font-bold tracking-[0.2em] text-primary mb-3">BEYOND A-LEVEL</p>
          <h2 className="font-heading text-3xl sm:text-4xl tracking-tight text-foreground">Degrees and professional routes.</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Law, medicine, engineering, and nursing teachers stay on the same bench. The work is preparation. It is not an award from a university or an exam board.
          </p>
        </div>
      </section>

      {/* ── Closing CTA ───────────────────────────────────────── */}
      <section className="py-20 lg:py-28 bg-[#203337] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgba(39,134,164,0.25),transparent)]" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs font-bold tracking-[0.25em] text-primary mb-5">JOIN THE FACULTY</p>
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl tracking-tight text-white leading-[1.05] mb-5">
            Know a great educator?
            <br />
            <span className="bg-gradient-to-r from-[var(--ps-primary)] via-[#6FBBCE] to-[#3FE0D0] bg-clip-text text-transparent">
              Help us train the next AI teacher.
            </span>
          </h2>
          <p className="text-base text-white/70 mb-4 max-w-xl mx-auto">
            Every Poket School AI educator is modelled on a real teacher’s pedagogy. If you’d like to lend yours, we’d love to talk.
          </p>
          <p className="text-sm text-white/50 mb-9 max-w-xl mx-auto leading-relaxed">
            Partnership means a short pedagogy interview, contributing your curriculum and teaching
            approach to train an AI teacher, and an ongoing revenue share on every session it runs.
          </p>
          <a
            href="mailto:educators@poketschool.ai?subject=Partner%20Educator%20Enquiry"
            className="inline-flex items-center justify-center gap-2 rounded-full h-12 px-7 text-sm font-bold bg-primary text-primary-foreground hover:brightness-110 shadow-xl shadow-primary/40 transition-colors"
          >
            Become a partner educator <ArrowRight className="w-4 h-4" />
          </a>
          <p className="mt-4 text-xs text-white/40">
            educators@poketschool.ai · we reply to every enquiry
          </p>
        </div>
      </section>

      <AiTeacherModal
        teacher={selected}
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </div>
    </PublicToolShell>
  );
}

function TeacherCard({
  teacher,
  index,
  onOpen,
}: {
  teacher: AiTeacher;
  index: number;
  onOpen: () => void;
}) {
  const Icon = ICONS[teacher.iconKey];
  const isLive = teacher.status === 'live';
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: index * 0.04 }}
      whileHover={{ y: -4 }}
      onClick={onOpen}
      className="group text-left bg-card border border-slate-200 rounded-2xl overflow-hidden hover:border-primary/40 hover:shadow-[0_20px_50px_-20px_color-mix(in_srgb,var(--ps-primary)_25%,transparent)] transition-all flex flex-col"
    >
      {/* Portrait pane — a full-bleed illustration rather than a small tile */}
      <div className="relative h-64 overflow-hidden">
        <Image
          src={teacherPortrait(teacher)}
          alt={portraitAlt(teacher.name)}
          fill
          sizes="(max-width: 768px) 100vw, 360px"
          className="object-cover group-hover:scale-[1.04] transition-transform duration-500"
        />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent" />
        {isLive && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
            </span>
            <span className="text-[9px] font-bold tracking-widest text-white">AVAILABLE NOW</span>
          </div>
        )}
        {!isLive && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-[var(--ps-cyan)] shadow-sm">
            <span className="text-[9px] font-bold tracking-widest text-[var(--ps-cyan-ink)]">COMING SOON</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-heading text-lg text-foreground leading-tight mb-1">{teacher.name}</h3>
        <p className="text-xs text-muted-foreground leading-snug mb-3 line-clamp-2">{teacher.title}</p>

        <div className="flex flex-wrap gap-1 mb-4">
          {teacher.subjects.slice(0, 3).map((s) => (
            <span
              key={s}
              className="text-[10px] font-bold px-2 py-0.5 rounded"
              style={{ backgroundColor: `${teacher.accentColor}15`, color: accentOnLight(teacher.accentColor) }}
            >
              {s}
            </span>
          ))}
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed mb-4 flex-1 line-clamp-2">{teacher.tagline}</p>

        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground group-hover:text-primary transition-colors">
          {isLive ? 'Start conversation' : 'See details'}
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </motion.button>
  );
}
