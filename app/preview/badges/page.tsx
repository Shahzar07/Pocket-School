'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BRAND } from '@/lib/brand';
import { STARTER_BADGES, levelForXp } from '@/lib/gamification/catalog';
import { emptyGameState, evaluateEvent, rankHouses } from '@/lib/gamification/engine';
import { LEARNING_EVENTS } from '@/lib/events';
import { BadgeShelf } from '@/components/gamification/badge-shelf';
import { BadgeCard } from '@/components/gamification/badge-card';
import { ProgressRing } from '@/components/gamification/progress-ring';
import { QuestList } from '@/components/gamification/quest-list';
import { HouseBoard } from '@/components/gamification/house-board';
import { Celebration } from '@/components/gamification/celebration';
import { LeaderboardPodium } from '@/components/leaderboard/podium';

function sampleState() {
  const steps = [
    { event: LEARNING_EVENTS.onboardingComplete, day: '2026-10-10', eventId: 'onboard' },
    { event: LEARNING_EVENTS.lessonFirstComplete, day: '2026-10-10', eventId: 'lesson' },
    { event: LEARNING_EVENTS.studySession, day: '2026-10-11', hour: 6, eventId: 'early', payload: { minutes: 20 } },
    { event: LEARNING_EVENTS.unitTestPass, day: '2026-10-12', eventId: 'pass', payload: { unitId: 'fractions' } },
    { event: LEARNING_EVENTS.unitTestPerfect, day: '2026-10-12', eventId: 'perfect', payload: { unitId: 'fractions' } },
    { event: LEARNING_EVENTS.streakDay, day: '2026-10-10', eventId: 's1' },
    { event: LEARNING_EVENTS.streakDay, day: '2026-10-11', eventId: 's2' },
    { event: LEARNING_EVENTS.streakDay, day: '2026-10-12', eventId: 's3' },
  ] as const;
  return steps.reduce((state, step) => evaluateEvent(state, step).state, emptyGameState());
}

function Preview() {
  const view = useSearchParams().get('view') ?? 'shelf';
  const state = useMemo(() => sampleState(), []);
  const rank = levelForXp(state.xp);
  const [celebrate, setCelebrate] = useState(false);
  const studentBadges = STARTER_BADGES.filter(badge => badge.audience === 'student');
  const perfect = STARTER_BADGES.find(badge => badge.id === 'perfect-score') ?? studentBadges[0];
  const board = [
    { id: 'ada', label: 'Ada L. · North Academy', score: 420, scoreLabel: 'XP', streak: 3, isYou: true },
    { id: 'sam', label: 'Sam R. · North Academy', score: 380, scoreLabel: 'XP', streak: 7 },
    { id: 'noor', label: 'Noor K. · North Academy', score: 260, scoreLabel: 'XP', streak: 1 },
  ];
  const houses = rankHouses([
    { houseId: 'oak', houseName: 'Oak', xp: 420, shareBoard: true },
    { houseId: 'elm', houseName: 'Elm', xp: 380, shareBoard: true },
    { houseId: 'ash', houseName: 'Ash', xp: 260, shareBoard: true },
  ]);

  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-8 relative">
        <Celebration show={celebrate} />
        <header>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: BRAND.primary }}>Poket School</p>
          <h1 className="font-heading text-4xl mt-1">Badges and levels</h1>
        </header>
        {view === 'card' && perfect ? (
          <BadgeCard badge={perfect} earner="Ada L." school="North Academy" />
        ) : null}
        {view === 'boards' ? (
          <div className="space-y-8">
            <section>
              <h2 className="font-heading text-2xl mb-3">This week</h2>
              <LeaderboardPodium entries={board} />
            </section>
            <section>
              <h2 className="font-heading text-2xl mb-3">Houses</h2>
              <HouseBoard houses={houses} enabled />
            </section>
            <QuestList progress={state.quests} done={state.questsDone} periodDay="2026-10-12" periodWeek="2026-W42" />
            <button type="button" className="rounded-full text-white px-4 h-11 font-semibold" style={{ background: BRAND.primary }} onClick={() => setCelebrate(true)}>
              Celebrate
            </button>
          </div>
        ) : null}
        {view === 'shelf' ? (
          <div className="space-y-8">
            <ProgressRing value={rank.progress} label={rank.name} sub={rank.nextName ? `Next is ${rank.nextName}` : 'Top level'} />
            <p className="text-sm text-muted-foreground">{state.freezes} streak freeze earned. Freezes are not for sale.</p>
            <BadgeShelf definitions={studentBadges.slice(0, 8)} earnedIds={state.awarded} />
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default function BadgesPreviewPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-background" />}>
      <Preview />
    </Suspense>
  );
}
