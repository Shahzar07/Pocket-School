'use client';

import type { BadgeDefinition } from '@/lib/gamification/catalog';
import { BadgeArt } from '@/components/gamification/badge-art';

export function BadgeCard({
  badge,
  earner,
  school,
}: {
  badge: BadgeDefinition;
  earner: string;
  school: string;
}) {
  return (
    <article
      className="w-full max-w-sm rounded-3xl p-6 text-white shadow-lg"
      style={{ background: '#1A3C34' }}
      aria-label={`${badge.name} badge card`}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: '#C8922A' }}>Poket School</p>
      <div className="mt-4 flex justify-center">
        <BadgeArt icon={badge.icon} size={120} title={badge.name} />
      </div>
      <h2 className="font-heading text-3xl mt-4">{badge.name}</h2>
      <p className="text-sm mt-2 text-white/80">{badge.description}</p>
      <p className="mt-6 text-sm font-semibold">{earner}{school ? ` · ${school}` : ''}</p>
      <p className="text-[11px] uppercase tracking-wider mt-1" style={{ color: '#C8922A' }}>{badge.tier}</p>
    </article>
  );
}
