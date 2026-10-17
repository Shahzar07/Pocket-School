'use client';

import type { BadgeDefinition } from '@/lib/gamification/catalog';
import { BadgeArt } from '@/components/gamification/badge-art';
import { tierMetal } from '@/lib/brand';

const TIER_LABEL = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' } as const;

export function BadgeShelf({
  definitions,
  earnedIds,
  onSelect,
}: {
  definitions: readonly BadgeDefinition[];
  earnedIds: readonly string[];
  onSelect?: (badge: BadgeDefinition) => void;
}) {
  const earned = new Set(earnedIds);
  const visible = definitions.filter(badge => badge.enabled);
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {visible.map(badge => {
        const has = earned.has(badge.id);
        const body = (
          <>
            <span className={has ? '' : 'grayscale opacity-60'}>
              <BadgeArt icon={badge.icon} size={64} title={badge.name} />
            </span>
            <span className="font-heading text-sm text-foreground">{badge.name}</span>
            <span className="text-[11px] text-muted-foreground leading-snug">{badge.description}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: tierMetal(badge.tier) }}>{TIER_LABEL[badge.tier]}</span>
          </>
        );
        return (
          <li key={badge.id}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(badge)}
                className="w-full h-full text-left rounded-2xl border border-border bg-card p-3 flex flex-col gap-1"
              >
                {body}
              </button>
            ) : (
              <div className="rounded-2xl border border-border bg-card p-3 flex flex-col gap-1">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
