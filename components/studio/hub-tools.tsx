'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight, BookOpen, Calculator, CalendarDays, CalendarRange, ClipboardList, GraduationCap, Library, PenLine, Search, Sparkles, Users,
  type LucideIcon,
} from 'lucide-react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { hasAccountRole } from '@/lib/account-modes';
import { isFlagEnabled, type FlagName } from '@/lib/flags';
import { STUDIO_ET, STUDIO_EXAM_PREP, STUDIO_MATHS, STUDIO_TIMETABLE } from '@/lib/studio-paths';
import { canUseDeskTool, deskSparkCost, type DeskToolId } from '@/lib/studio/desk';
import { studioTimetableGate } from '@/lib/timetable/access';
import { TIMETABLE_COPY } from '@/lib/timetable/copy';

export interface StudioTool {
  href: string;
  icon: LucideIcon;
  name: string;
  kicker: string;
  blurb: string;
  well: string;
  bar: string;
  links: { href: string; label: string }[];
  gate?: DeskToolId;
  /** Hide the card unless this product switch is on. */
  flag?: FlagName;
  /** Students, including an account that also teaches or parents. */
  studentsOnly?: boolean;
  /** Teachers, institution admins, and timetablers. An upsell shows when the add-on is missing. */
  timetabler?: boolean;
}

export const STUDIO_TOOLS: StudioTool[] = [
  {
    href: STUDIO_ET,
    icon: Sparkles,
    name: 'ET AI',
    kicker: 'Create',
    blurb: 'Turn any topic into a lesson, quiz, flashcards, audio or video, and keep it in your library.',
    well: 'bg-[#E9F7FA] text-[#1E6A83] dark:bg-[#12343F] dark:text-[#A7D9E5]',
    bar: 'bg-[#1E6A83] dark:bg-[#6FBBCE]',
    links: [],
  },
  {
    href: STUDIO_MATHS,
    icon: Calculator,
    name: 'ET Maths',
    kicker: 'Solve',
    blurb: 'Snap or type a problem. ET Maths walks you through it, with exam packs and a puzzle for today.',
    well: 'bg-[var(--ps-cyan-soft)] text-[var(--ps-cyan-text)] dark:bg-[var(--ps-cyan-soft)] dark:text-[var(--ps-cyan)]',
    bar: 'bg-[#1E6A83] dark:border border-[var(--ps-cyan-border)] bg-[var(--ps-cyan)]',
    links: [
      { href: '/dashboard/studio/exams/packs/browse/all/all/mathematics', label: 'Exam packs' },
      { href: `${STUDIO_MATHS}/lab`, label: "Today's puzzle" },
    ],
  },
  {
    href: STUDIO_EXAM_PREP,
    icon: ClipboardList,
    name: 'ET Exams',
    kicker: 'Prepare',
    blurb: 'Your notes, slides and past papers become a day-by-day plan, a mock, and an oral with ET AI.',
    well: 'bg-[#FBECEA] text-[#9A3B2F] dark:bg-[#2C1816] dark:text-[#F0B2A8]',
    bar: 'bg-[#9A3B2F] dark:bg-[#E88976]',
    links: [
      { href: '/dashboard/studio/exams/packs', label: 'Official exams' },
      { href: `${STUDIO_EXAM_PREP}/new`, label: 'New plan' },
    ],
  },
  {
    href: '/dashboard/studio/essays',
    icon: PenLine,
    name: 'ET Essays',
    kicker: 'Plan',
    blurb: 'ET AI sets a question and helps you plan. You write the essay. A mark shows a 9–1 grade, a letter from A* to U, and a percentage.',
    well: 'bg-[#F3EEF8] text-[#5B3D8A] dark:bg-[#241C30] dark:text-[#D4C4EE]',
    bar: 'bg-[#5B3D8A] dark:bg-[#C4B0E8]',
    links: [
      { href: '/studio/essays', label: 'Full page' },
      { href: '/dashboard/studio/essays/review', label: 'Teacher review' },
    ],
  },
  {
    href: '/reads/studio',
    icon: BookOpen,
    name: 'Book Studio',
    kicker: 'Write',
    blurb: 'Shape a book with ET AI, from the idea and the cast through to a draft you can export.',
    well: 'bg-[#E8F4EC] text-[#2F6B4F] dark:bg-[#15241C] dark:text-[#B7DCC6]',
    bar: 'bg-[#2F6B4F] dark:bg-[#8FCBAA]',
    links: [
      { href: '/reads', label: 'Poket Reads' },
    ],
  },
  {
    href: `${STUDIO_ET}?mode=teacher-toolkit`,
    icon: GraduationCap,
    name: 'Teacher Toolkit',
    kicker: 'Teach',
    blurb: 'Lesson plans, worksheets, rubrics, the same task in support, core, and stretch, and an exit ticket. Save it as a course draft.',
    well: 'bg-[#FBF0E8] text-[#C45C26] dark:bg-[#2A1C14] dark:text-[#F0C2A4]',
    bar: 'bg-[#C45C26] dark:bg-[#E8A06A]',
    links: [],
    gate: 'teacher-toolkit',
  },
  {
    href: `${STUDIO_ET}?mode=parent-explainer`,
    icon: Library,
    name: 'Parent Explainer',
    kicker: 'Home',
    blurb: 'A plain-language week for your own child: what they learned, where they are strong, where they are stuck, and how to help at home.',
    well: 'bg-[#F8EEF3] text-[#8B3A62] dark:bg-[#2A1822] dark:text-[#F0C0D4]',
    bar: 'bg-[#8B3A62] dark:bg-[#E7A3C0]',
    links: [],
    gate: 'parent-explainer',
  },
  {
    href: `${STUDIO_ET}?mode=research-helper`,
    icon: Search,
    name: 'Research Helper',
    kicker: 'Sources',
    blurb: 'Trustworthy sources, APA, Harvard, and MLA citations, and a credibility note. ET AI does not write the assignment.',
    well: 'bg-[#EAF0FA] text-[#2457A6] dark:bg-[#152033] dark:text-[#C5D4F0]',
    bar: 'bg-[#2457A6] dark:bg-[#8FB0E8]',
    links: [],
    gate: 'research-helper',
  },
  {
    href: '/dashboard/planner',
    icon: CalendarDays,
    name: 'Study planner',
    kicker: 'Plan',
    blurb: 'A week of revision for your level: Primary, Lower Secondary, IGCSE, or A-Level.',
    well: 'bg-[#E7F4F2] text-[#0F6E62] dark:bg-[#122420] dark:text-[#B7E0D6]',
    bar: 'bg-[#0F6E62] dark:bg-[#7DCFC0]',
    links: [],
    flag: 'studyPlanner',
    studentsOnly: true,
  },
  {
    href: STUDIO_TIMETABLE,
    icon: CalendarRange,
    name: TIMETABLE_COPY.studioTab,
    kicker: 'Week',
    blurb: TIMETABLE_COPY.studioBlurb,
    well: 'bg-[#E9F7FA] text-[#1E6A83] dark:bg-[#12343F] dark:text-[#A7D9E5]',
    bar: 'bg-[#3FE0D0]',
    links: [],
    timetabler: true,
  },
  {
    href: '/dashboard/studio/teachers',
    icon: Users,
    name: 'AI Teachers',
    kicker: 'Talk',
    blurb: 'Talk with ET Maths, ET Science, and the rest. Type, send voice notes, or open a live voice and video session.',
    well: 'bg-[#F3EEF8] text-[#5B3D8A] dark:bg-[#241C30] dark:text-[#D4C4EE]',
    bar: 'bg-[#5B3D8A] dark:bg-[#C4B0E8]',
    links: [],
  },
];

export function visibleStudioTools(source: { role?: string | null; roles?: readonly string[] | null; permissions?: readonly string[] | null } | null, showAll: boolean): StudioTool[] {
  return STUDIO_TOOLS.filter(tool => {
    if (tool.flag && !isFlagEnabled(tool.flag)) return false;
    if (tool.timetabler) {
      if (showAll) return true;
      return studioTimetableGate({ role: source?.role, roles: source?.roles, permissions: source?.permissions }) !== 'hidden';
    }
    if (showAll) return true;
    if (tool.studentsOnly && !hasAccountRole(source, 'student')) return false;
    return !tool.gate || canUseDeskTool(source, tool.gate);
  });
}

export function StudioTimetableQuick() {
  const profile = useAuthSTORE(state => state.profile);
  const gate = studioTimetableGate({ role: profile?.role, roles: profile?.roles, permissions: profile?.permissions });
  if (gate === 'hidden') return null;
  const href = gate === 'personal' || gate === 'school'
    ? `${STUDIO_ET}?q=${encodeURIComponent(TIMETABLE_COPY.studioQuick)}`
    : STUDIO_TIMETABLE;
  return (
    <Link
      href={href}
      data-action="studio-quick"
      className="rounded-full bg-white px-3.5 py-2 text-[13px] font-semibold text-[#1E6A83] transition hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none"
    >
      {TIMETABLE_COPY.studioQuick}
    </Link>
  );
}

export function StudioToolGrid({ showAll = false }: { showAll?: boolean }) {
  const reduce = useReducedMotion();
  const profile = useAuthSTORE(state => state.profile);
  const tools = visibleStudioTools(profile, showAll);
  const timetableGate = studioTimetableGate({ role: profile?.role, roles: profile?.roles, permissions: profile?.permissions });

  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="studio-tool-grid">
      {tools.map((tool, index) => {
        const Icon = tool.icon;
        return (
          <motion.li
            key={tool.href}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: reduce ? 0 : 0.05 * index }}
          >
            <article data-testid={`studio-card-${tool.gate ?? tool.name}`} data-studio-card={tool.timetabler ? 'timetabler' : undefined} data-upsell={tool.timetabler && (timetableGate === 'upsell-personal' || timetableGate === 'upsell-school') ? '1' : '0'} className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition duration-200 hover:-translate-y-1 hover:shadow-lg motion-reduce:transform-none motion-reduce:transition-none">
              <span className={`absolute inset-x-0 top-0 h-1 ${tool.bar}`} aria-hidden />
              <div className="flex items-center justify-between gap-3">
                <span className={`grid h-12 w-12 place-items-center rounded-2xl ${tool.well}`}>
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{tool.kicker}</span>
              </div>
              <h2 className="mt-4 font-heading text-[24px] tracking-[-0.03em] text-foreground">{tool.name}</h2>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">{tool.timetabler && (timetableGate === 'upsell-personal' || timetableGate === 'upsell-school') ? TIMETABLE_COPY.studioUpsell : tool.blurb}</p>
              {tool.gate && (
                <p className="mt-3 text-[12px] font-semibold text-muted-foreground">{deskSparkCost(tool.gate)} Sparks</p>
              )}
              <Link
                href={tool.href}
                className="mt-5 inline-flex h-10 w-fit items-center gap-1.5 rounded-full bg-[#1E6A83] px-4 text-sm font-semibold text-white transition hover:opacity-90 dark:bg-[#6FBBCE] dark:text-[#0B1417]"
              >
                Open {tool.name} <ArrowRight className="h-4 w-4" />
              </Link>
              {tool.links.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
                  {tool.links.map(link => (
                    <Link key={link.href} href={link.href} className="text-[12px] font-semibold text-[#1E6A83] hover:underline dark:text-[#A7D9E5]">
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </article>
          </motion.li>
        );
      })}
    </ul>
  );
}
