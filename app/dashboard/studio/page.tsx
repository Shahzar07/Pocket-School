'use client';

import Link from 'next/link';
import { ArrowRight, Calculator, ClipboardList, Sparkles } from 'lucide-react';
import { DashPage, DashHeader } from '@/components/dash-ui';
import { STUDIO_ET, STUDIO_EXAM_PREP, STUDIO_MATHS } from '@/lib/studio-paths';

const TOOLS = [
  {
    href: STUDIO_ET,
    icon: Sparkles,
    name: 'ET',
    blurb: 'Turn any topic into a lesson, quiz, flashcards, audio or video, and keep it in your library.',
    links: [] as { href: string; label: string }[],
  },
  {
    href: STUDIO_MATHS,
    icon: Calculator,
    name: 'ET Maths',
    blurb: 'Snap or type a problem. ET walks you through it, with exam packs and a puzzle for today.',
    links: [
      { href: `${STUDIO_MATHS}/packs`, label: 'Exam packs' },
      { href: `${STUDIO_MATHS}/lab`, label: "Today's puzzle" },
    ],
  },
  {
    href: STUDIO_EXAM_PREP,
    icon: ClipboardList,
    name: 'Exam Prep',
    blurb: 'Your notes, slides and past papers become a day-by-day plan, a mock, and an oral with ET.',
    links: [
      { href: `${STUDIO_EXAM_PREP}/new`, label: 'New plan' },
    ],
  },
];

export default function StudioHub() {
  return (
    <DashPage>
      <DashHeader
        eyebrow="AI Studio"
        title="ET's tools,"
        accent="in one place."
        description="Create study material, work a maths problem, or build a plan that ends on exam day. Each tool opens here in your dashboard."
      />
      <ul className="grid md:grid-cols-3 gap-4">
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
