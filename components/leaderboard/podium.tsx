'use client';

import { Crown, Flame as FlameIcon, Medal, Minus, Star, TrendingDown, TrendingUp } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { medalForRank, type MedalId } from '@/lib/design/chart-colours';

export interface PodiumEntry {
  id: string;
  label: string;
  score: number;
  scoreLabel: string;
  isYou?: boolean;
  /** Finished days in a row. A flame shows from three. */
  streak?: number;
  /** Places climbed since the comparison board. Negative means the rank fell. */
  rankDelta?: number;
}

const PLACE: Record<MedalId, { icon: typeof Crown; pattern: string }> = {
  gold: { icon: Crown, pattern: 'none' },
  silver: {
    icon: Star,
    pattern: 'repeating-linear-gradient(135deg, transparent 0 5px, color-mix(in srgb, var(--medal-silver-ink) 28%, transparent) 5px 7px)',
  },
  bronze: {
    icon: Medal,
    pattern: 'radial-gradient(circle, color-mix(in srgb, var(--medal-bronze-ink) 35%, transparent) 1.1px, transparent 1.3px)',
  },
};

function RankChange({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <motion.span
        initial={{ y: 6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="inline-flex items-center gap-0.5 text-[11px] font-bold"
        style={{ color: 'var(--ps-emerald)' }}
        title={`Up ${delta} ${delta === 1 ? 'place' : 'places'}`}
      >
        <TrendingUp className="h-3.5 w-3.5" aria-hidden />
        Up {delta}
      </motion.span>
    );
  }
  if (delta < 0) {
    const places = Math.abs(delta);
    return (
      <motion.span
        initial={{ y: -6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="inline-flex items-center gap-0.5 text-[11px] font-bold"
        style={{ color: 'var(--ps-coral)' }}
        title={`Down ${places} ${places === 1 ? 'place' : 'places'}`}
      >
        <TrendingDown className="h-3.5 w-3.5" aria-hidden />
        Down {places}
      </motion.span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-muted-foreground">
      <Minus className="h-3.5 w-3.5" aria-hidden />
      Steady
    </span>
  );
}

function StreakFlame({ days }: { days: number }) {
  if (days < 3) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: 'var(--ps-coral)' }} title={`${days} day streak`}>
      <FlameIcon className="ps-flame h-3.5 w-3.5" aria-hidden />
      {days} day streak
    </span>
  );
}

function PodiumBlock({ entry, rank }: { entry: PodiumEntry; rank: number }) {
  const medal = medalForRank(rank);
  if (!medal) return null;
  const { icon: Icon, pattern } = PLACE[medal];
  const tall = rank === 1 ? 'min-h-[168px]' : rank === 2 ? 'min-h-[132px]' : 'min-h-[112px]';
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: rank === 1 ? 0.08 : 0.16 }}
      className={`flex flex-col justify-end rounded-2xl px-3 pb-3 pt-4 text-center ${tall} ${rank === 1 ? 'col-start-2' : rank === 2 ? 'col-start-1' : 'col-start-3'} ${entry.isYou ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
      style={{
        backgroundColor: `var(--medal-${medal})`,
        color: `var(--medal-${medal}-ink)`,
        backgroundImage: pattern === 'none' ? undefined : pattern,
        backgroundSize: medal === 'bronze' ? '8px 8px' : undefined,
      }}
      aria-label={`${PLACE_NAME[medal]} ${entry.label}, ${entry.scoreLabel}${entry.isYou ? ', your rank' : ''}`}
    >
      <Icon className="mx-auto mb-1 h-5 w-5" aria-hidden />
      <p className="text-[11px] font-bold uppercase tracking-[0.16em]">{PLACE_NAME[medal]}</p>
      <p className="mt-1 truncate text-sm font-semibold">{entry.label}</p>
      <p className="font-heading text-2xl tabular-nums leading-none">{entry.score.toLocaleString()}</p>
      <div className="mt-2 flex flex-col items-center gap-1">
        <RankChange delta={entry.rankDelta ?? 0} />
        <StreakFlame days={entry.streak ?? 0} />
        {entry.isYou && <span className="text-[10px] font-bold uppercase tracking-wider">Your rank</span>}
      </div>
    </motion.li>
  );
}

const PLACE_NAME: Record<MedalId, string> = {
  gold: '1st · Gold',
  silver: '2nd · Silver',
  bronze: '3rd · Bronze',
};

export function LeaderboardPodium({
  entries,
  empty,
}: {
  entries: PodiumEntry[];
  empty?: string;
}) {
  const reduce = useReducedMotion();
  if (entries.length === 0) {
    return <p className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">{empty ?? 'No rankings yet.'}</p>;
  }
  const top = entries.slice(0, 3);
  const rest = entries.slice(3);
  const byRank = new Map(top.map((entry, index) => [index + 1, entry]));
  const order = [2, 1, 3].filter(rank => byRank.has(rank));

  return (
    <div className="space-y-4" data-leaderboard-podium>
      <ol className="grid grid-cols-3 items-end gap-2 sm:gap-3">
        {order.map(rank => {
          const entry = byRank.get(rank);
          if (!entry) return null;
          return <PodiumBlock key={entry.id} entry={entry} rank={rank} />;
        })}
      </ol>
      {rest.length > 0 && (
        <ol className="overflow-hidden rounded-3xl border border-border bg-card">
          {rest.map((entry, index) => {
            const rank = index + 4;
            return (
              <motion.li
                key={entry.id}
                layout={!reduce}
                className={`flex items-center gap-3 border-b border-border px-4 py-3 last:border-0 ${entry.isYou ? 'bg-primary/10' : ''}`}
              >
                <span className="w-8 font-heading text-xl tabular-nums text-muted-foreground">{rank}</span>
                <span
                  className="grid h-10 w-10 place-items-center rounded-full text-sm font-bold"
                  style={{ background: 'color-mix(in srgb, var(--ps-teal) 16%, transparent)', color: 'var(--ps-teal)' }}
                >
                  {entry.label.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {entry.label}
                    {entry.isYou && <span className="ml-2 text-[11px] font-bold uppercase tracking-wider text-primary">Your rank</span>}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <RankChange delta={entry.rankDelta ?? 0} />
                    <StreakFlame days={entry.streak ?? 0} />
                  </div>
                </div>
                <p className="text-sm font-semibold tabular-nums">{entry.scoreLabel}</p>
              </motion.li>
            );
          })}
        </ol>
      )}
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Poket School · ET AI</p>
    </div>
  );
}
