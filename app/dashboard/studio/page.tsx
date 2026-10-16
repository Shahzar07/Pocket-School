'use client';

import Link from 'next/link';
import { ArrowRight, Calculator, ClipboardList, PenLine, Sparkles, Users } from 'lucide-react';
import { DashPage, DashHeader } from '@/components/dash-ui';
import { STUDIO_ET, STUDIO_EXAM_PREP, STUDIO_MATHS } from '@/lib/studio-paths';

const TOOLS = [
  {
    href: STUDIO_ET,
    icon: Sparkles,
    name: 'ET AI',
    blurb: 'Turn any topic into a lesson, quiz, flashcards, audio or video, and keep it in your library.',
    links: [] as { href: string; label: string }[],
  },
  {
    href: STUDIO_MATHS,
    icon: Calculator,
    name: 'ET Maths',
    blurb: 'Snap or type a problem. ET AI walks you through it, with exam packs and a puzzle for today.',
    links: [
      { href: `${STUDIO_MATHS}/packs`, label: 'Exam packs' },
      { href: `${STUDIO_MATHS}/lab`, label: "Today's puzzle" },
    ],
  },
  {
    href: STUDIO_EXAM_PREP,
    icon: ClipboardList,
    name: 'ET Exams',
    blurb: 'Your notes, slides and past papers become a day-by-day plan, a mock, and an oral with ET AI.',
    links: [
      { href: `${STUDIO_EXAM_PREP}/new`, label: 'New plan' },
    ],
  },
  {
    href: '/dashboard/studio/essay',
    icon: PenLine,
    name: 'ET AI Essay Writer',
    blurb: 'Write an essay. ET AI grades it from 9 to 1, with a percentage and an A*–U letter.',
    links: [
      { href: '/dashboard/student/essay', label: 'Student page' },
    ],
  },
  {
    href: '/dashboard/studio/teachers',
    icon: Users,
    name: 'AI Teachers',
    blurb: 'Talk with ET Maths, ET Science, and the rest. Type, send voice notes, or open a live voice and video session.',
    links: [],
  },
];

export default function StudioHub() {
  return (
    <DashPage>
      <DashHeader
        eyebrow="AI Studio"
        title="ET AI's tools,"
        accent="full page."
        description="ET AI, ET Maths, ET Exams, ET AI Essay Writer, and AI Teachers each open as their own page."
      />
      <ul className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <li key={tool.href}>
              <article className="h-full bg-card border border-border rounded-2xl shadow-[var(--shadow-card)] p-5 flex flex-col">
                <span className="w-10 h-10 rounded-xl bg-secondary text-primary grid place-items-center">
                  <Icon className="w-5 h-5" />
                </span>
                <h2 className="font-heading text-[22px] tracking-[-0.03em] text-foreground mt-4">{tool.name}</h2>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{tool.blurb}</p>
                <Link href={tool.href} className="mt-5 inline-flex h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-semibold items-center gap-1.5 w-fit hover:opacity-90">
                  Open {tool.name} <ArrowRight className="w-4 h-4" />
                </Link>
                {tool.links.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tool.links.map((link) => (
                      <Link key={link.href} href={link.href} className="text-[12px] font-semibold text-primary hover:underline">
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </article>
            </li>
          );
        })}
      </ul>
    </DashPage>
  );
}
