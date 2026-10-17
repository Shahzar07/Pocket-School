'use client';

import type { HouseScore } from '@/lib/gamification/engine';
import { BRAND } from '@/lib/brand';

export function HouseBoard({ houses, enabled }: { houses: readonly HouseScore[]; enabled: boolean }) {
  if (!enabled) {
    return <p className="text-sm text-muted-foreground">House competitions are off for this class.</p>;
  }
  if (!houses.length) {
    return <p className="text-sm text-muted-foreground">No house scores yet this week.</p>;
  }
  const top = houses[0]?.xp || 1;
  return (
    <ol className="space-y-3">
      {houses.map((house, index) => (
        <li key={house.houseId} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-heading text-lg text-foreground">{index + 1}. {house.name}</p>
            <p className="text-sm font-semibold" style={{ color: BRAND.blueDeep }}>{house.xp} XP</p>
          </div>
          <div className="mt-2 h-2 rounded-full" style={{ background: BRAND.mint }} aria-hidden="true">
            <div className="h-2 rounded-full" style={{ width: `${Math.max(8, (house.xp / top) * 100)}%`, background: index === 0 ? BRAND.amber : BRAND.primary }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
