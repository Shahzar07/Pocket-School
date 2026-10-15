'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BehaviourDashboard } from '@/components/insights/behaviour-dashboard';
import { seedBehaviour } from '@/lib/insights/behaviour-seed';
import type { BehaviourRole } from '@/lib/insights/behaviour-board';
import type { Mood } from '@/lib/insights/behaviour';

function roleFrom(side: string | null): BehaviourRole {
  if (side === 'parent') return 'parent';
  if (side === 'teacher') return 'teacher';
  if (side === 'institution') return 'institution_admin';
  return 'student';
}

function BehaviourPreviewBody() {
  const params = useSearchParams();
  const role = roleFrom(params.get('side'));
  const [moodNote, setMoodNote] = useState<string | null>(null);
  const board = useMemo(() => seedBehaviour(role), [role]);

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-4">
      <p className="text-sm rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
        Sample data for review. These figures are the seeded behaviour board, not a live account. {role}.
      </p>
      <h1 className="font-heading text-3xl">Behaviour</h1>
      {moodNote && <p data-mood-saved>Check-in saved: {moodNote}</p>}
      <BehaviourDashboard
        board={board}
        showChecks
        onMood={(mood: Mood, effort: number) => setMoodNote(`${mood} effort ${effort}`)}
      />
    </main>
  );
}

export default function BehaviourPreviewPage() {
  return (
    <Suspense fallback={<main className="p-8">Loading behaviour</main>}>
      <BehaviourPreviewBody />
    </Suspense>
  );
}
