'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { VisualBlockView } from '@/components/visual-blocks';
import { UnitTestAnalysis } from '@/components/unit-test-analysis';
import { parentExplainer } from '@/lib/unit-test';
import type { UnitQuizAttempt } from '@/lib/db';
import type { VisualBlock } from '@/lib/visual-blocks';
import Link from 'next/link';

const visuals: VisualBlock[] = [
  {
    kind: 'mindmapImage',
    alt: 'Mind map of a plant: leaves, roots, and photosynthesis around a central stem.',
    src: '/landing/reads.webp',
    caption: 'Mind map for the living-things module.',
    intelligence: 'Spatial',
  },
  {
    kind: 'comic',
    alt: 'Three-panel comic of a learner checking a plant, naming the leaf, and celebrating a correct answer.',
    title: 'How a leaf feeds',
    intelligence: 'Linguistic',
    panels: [
      { src: '/landing/goals.webp', alt: 'A learner looking at a classroom plant.', caption: 'Look closely.' },
      { src: '/landing/modes.webp', alt: 'A labelled leaf on the desk.', caption: 'Name the part.' },
      { src: '/landing/analytics.webp', alt: 'A tick next to the word photosynthesis.', caption: 'That is the process.' },
    ],
  },
  {
    kind: 'revisionPoster',
    alt: 'Unit revision poster listing photosynthesis, the heart, and the pass mark of 70 percent.',
    src: '/landing/exams.webp',
    caption: 'Unit revision poster',
    intelligence: 'Logical-Mathematical',
  },
  {
    kind: 'gallery',
    alt: 'Gallery of living-things photographs used in this module.',
    intelligence: 'Naturalistic',
    items: [
      { src: '/landing/reads.webp', alt: 'Open book beside a small plant.', caption: 'Read the page, then look.' },
      { src: '/landing/tutors.webp', alt: 'A tutor pointing at a diagram of the heart.', caption: 'The heart pumps blood.' },
    ],
  },
  {
    kind: 'audioChant',
    alt: 'Short chant naming leaf, root, and stem.',
    src: '',
    title: 'Plant chant',
    transcript: 'Leaf, root, stem. The leaf makes food.',
    intelligence: 'Musical',
  },
];

const sampleAttempts = [
  {
    id: 'sample',
    studentId: 'sample',
    courseId: 'sample',
    unitId: 'living-things',
    lessonId: 'unit-test',
    kind: 'unit_test' as const,
    version: 'A' as const,
    attemptNumber: 1,
    score: 3,
    total: 5,
    marksAwarded: 3,
    marksMax: 5,
    percentage: 60,
    passed: false,
    timeTakenSeconds: 75,
    responses: [
      { questionIndex: 0, question: 'Which process lets a plant make food?', selected: 'opt:0', correct: false, marks: 2, marksAwarded: 0, bloom: 'Remember', lessonId: 'plants' },
      { questionIndex: 1, question: 'Which organ pumps blood?', selected: 'opt:1', correct: true, marks: 3, marksAwarded: 3, bloom: 'Understand', lessonId: 'heart' },
    ],
    recommendedLessonIds: ['plants'],
  },
] as UnitQuizAttempt[];

function Panel() {
  const panel = useSearchParams().get('panel') ?? 'review';
  const lines = parentExplainer({
    unitTitle: 'Living things',
    percentage: 60,
    passed: false,
    passMark: 70,
    version: 'A',
    reviewTitles: ['How plants feed'],
    timeTakenSeconds: 75,
  });

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Poket School</p>
      <h1 className="font-heading text-3xl text-foreground">Unit test and visual blocks</h1>
      {panel === 'review' && (
        <section className="rounded-3xl border border-[var(--ps-cyan-border)]/30 bg-[var(--ps-cyan-soft)] p-6 space-y-4">
          <p className="text-5xl font-extrabold">60%</p>
          <p className="text-sm font-semibold text-[var(--ps-cyan-text)]">3/5 marks · 1m 15s · attempt #1 · Version A</p>
          <p className="font-bold">Not yet — you need 70% to pass. Review these lessons, then the unit test unlocks on Version B.</p>
          <div className="rounded-2xl border border-primary/20 bg-card p-4">
            <h2 className="font-bold text-sm mb-2">Review these lessons</h2>
            <Link href="/preview/unit-test?panel=visuals" className="text-sm text-primary underline">How plants feed</Link>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4 space-y-1">
            <p className="text-xs font-bold">Parent explainer</p>
            {lines.map(line => <p key={line} className="text-sm text-muted-foreground">{line}</p>)}
          </div>
        </section>
      )}
      {panel === 'visuals' && <VisualBlockView blocks={visuals} />}
      {panel === 'analysis' && (
        <section className="rounded-3xl border border-border bg-card p-5 space-y-3">
          <h2 className="font-heading text-xl">Unit test item analysis</h2>
          <UnitTestAnalysis attempts={sampleAttempts} />
        </section>
      )}
    </main>
  );
}

export default function UnitTestPreviewPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm">Loading the sample…</p>}>
      <Panel />
    </Suspense>
  );
}
