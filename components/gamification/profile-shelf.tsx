'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getUserBadges } from '@/lib/db';
import { STARTER_BADGES } from '@/lib/gamification/catalog';
import { BadgeShelf } from '@/components/gamification/badge-shelf';

export function ProfileBadgeShelf({ userId }: { userId: string }) {
  const [earned, setEarned] = useState<string[]>([]);
  useEffect(() => {
    getUserBadges(userId).then(rows => setEarned(rows.map(row => row.type))).catch(() => setEarned([]));
  }, [userId]);
  const definitions = STARTER_BADGES.filter(badge => earned.includes(badge.id)).slice(0, 8);
  if (!definitions.length) return null;
  return (
    <section className="mb-8 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-2xl">Badges</h2>
        <Link href="/dashboard/student/achievements" className="text-sm font-semibold underline">Achievements</Link>
      </div>
      <BadgeShelf definitions={definitions} earnedIds={earned} />
    </section>
  );
}
