'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  ArrowRight,
  Mic,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AiTeacherModal } from '@/components/ai-teacher-modal';
import {
  AI_TEACHERS,
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
};

export default function AiTeachersPage() {
  const router = useRouter();
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

  const liveCount = AI_TEACHERS.filter((t) => t.status === 'live').length;

  const open = (t: AiTeacher) => setSelected(t);

  return (
    <div className="min-h-screen bg-white">
      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative pt-14 lg:pt-20 pb-12 bg-gradient-to-b from-[#EEF3FF] via-[#F5F1FF] to-[#F8F4EE] overflow-hidden">
        <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-[#1A73E8]/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-[#F5B400]/10 blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs font-bold tracking-[0.25em] text-[#1A73E8] mb-5">AI TEACHERS LIBRARY</p>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-7xl tracking-tight text-[#0B1B3F] leading-[0.95] mb-6 max-w-4xl mx-auto">
            Your 24/7 Faculty.
            <br />
            <span className="bg-gradient-to-r from-[#1A73E8] via-[#1E3A8A] to-[#1A73E8] bg-clip-text text-transparent">
              Always Available.
            </span>
          </h1>
          <p className="text-base sm:text-lg text-slate-700 leading-relaxed max-w-2xl mx-auto mb-8">
            Talk face-to-face with AI educators trained on the curricula that matter. No appointments. No waiting. Just learning.
          </p>
          <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap text-xs sm:text-sm font-bold text-[#0B1B3F]">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-md border border-black/[0.04]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              {liveCount} LIVE NOW
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-md border border-black/[0.04]">
              <Sparkles className="w-3.5 h-3.5 text-[#F5B400]" />
              {AI_TEACHERS.length} SUBJECTS
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-md border border-black/[0.04]">
              <Mic className="w-3.5 h-3.5 text-[#1A73E8]" />
              VOICE + TEXT
            </span>
          </div>
        </div>
      </section>

      {/* ── Filter + grid ─────────────────────────────────────── */}
      <section className="bg-[#F8FAFF] py-16 lg:py-20 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="mb-10 flex items-end justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-[#1A73E8] mb-3">EXPLORE THE FACULTY</p>
              <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl tracking-tight text-[#0B1B3F] leading-[1.05]">
                Meet every teacher on the bench.
              </h2>
            </div>
            <p className="text-sm font-semibold text-slate-500">
              Showing {visible.length} of {AI_TEACHERS.length}
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
                      ? 'bg-[#0B1B3F] text-white shadow-md'
                      : 'bg-white text-slate-700 border border-slate-200 hover:border-[#1A73E8] hover:text-[#1A73E8]'
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

          {visible.length === 0 && (
            <div className="text-center py-20">
              <p className="text-sm text-slate-500">No teachers in this category yet.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Closing CTA ───────────────────────────────────────── */}
      <section className="py-20 lg:py-28 bg-[#0B1B3F] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgba(26,115,232,0.25),transparent)]" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs font-bold tracking-[0.25em] text-[#1A73E8] mb-5">JOIN THE FACULTY</p>
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl tracking-tight text-white leading-[1.05] mb-5">
            Know a great educator?
            <br />
            <span className="bg-gradient-to-r from-[#1A73E8] via-[#60A5FA] to-[#F5B400] bg-clip-text text-transparent">
              Help us train the next AI teacher.
            </span>
          </h2>
          <p className="text-base text-white/70 mb-9 max-w-xl mx-auto">
            Every Pocket School AI educator is modelled on a real teacher’s pedagogy. If you’d like to lend yours, we’d love to talk.
          </p>
          <Button
            size="lg"
            onClick={() => router.push('/signup?role=teacher')}
            className="rounded-full h-12 px-7 text-sm font-bold bg-[#1A73E8] hover:bg-[#1967D2] text-white shadow-xl shadow-[#1A73E8]/40"
          >
            Become a partner educator <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </section>

      <AiTeacherModal
        teacher={selected}
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </div>
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
      className="group text-left bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-[#1A73E8]/40 hover:shadow-[0_20px_50px_-20px_rgba(26,115,232,0.25)] transition-all flex flex-col"
    >
      {/* Avatar pane */}
      <div
        className="relative h-44 flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${teacher.accentColor}, ${teacher.accentColor}cc)`,
        }}
      >
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_30%,white,transparent_60%)]" />
        <div className="relative w-20 h-20 rounded-2xl bg-white/95 backdrop-blur shadow-lg flex items-center justify-center">
          <Icon className="w-9 h-9 text-[#0B1B3F]" strokeWidth={1.5} />
        </div>
        {isLive && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
            </span>
            <span className="text-[9px] font-bold tracking-widest text-white">LIVE 24/7</span>
          </div>
        )}
        {!isLive && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-amber-400 shadow-sm">
            <span className="text-[9px] font-bold tracking-widest text-amber-950">COMING SOON</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-heading text-lg text-[#0B1B3F] leading-tight mb-1">{teacher.name}</h3>
        <p className="text-xs text-slate-500 leading-snug mb-3 line-clamp-2">{teacher.title}</p>

        <div className="flex flex-wrap gap-1 mb-4">
          {teacher.subjects.slice(0, 3).map((s) => (
            <span
              key={s}
              className="text-[10px] font-bold px-2 py-0.5 rounded"
              style={{ backgroundColor: `${teacher.accentColor}15`, color: teacher.accentColor }}
            >
              {s}
            </span>
          ))}
        </div>

        <p className="text-xs text-slate-600 leading-relaxed mb-4 flex-1 line-clamp-2">{teacher.tagline}</p>

        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0B1B3F] group-hover:text-[#1A73E8] transition-colors">
          {isLive ? 'Start conversation' : 'See details'}
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </motion.button>
  );
}
