'use client';

import { rankLeaderboard } from '@/lib/academy-settings';
import { useWhiteLabel } from '@/components/white-label-provider';
import { LeaderboardPodium } from '@/components/leaderboard/podium';

export default function AcademyLeaderboardPage() {
  const { institution, branding, resolving } = useWhiteLabel();
  if (resolving) return <div className="mx-auto max-w-3xl px-4 py-16 text-sm text-muted-foreground">Loading the academy…</div>;
  if (!institution) return <div className="mx-auto max-w-3xl px-4 py-16">Open this page from an academy address.</div>;
  if (institution.features?.leaderboard === false || institution.leaderboardVisible === 'off') {
    return <div className="mx-auto max-w-3xl px-4 py-16">{branding.displayName} has not published a leaderboard.</div>;
  }
  const rows = rankLeaderboard(institution.leaderboard ?? []);
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-12">
      <h1 className="font-heading text-4xl">{branding.displayName} leaderboard</h1>
      <LeaderboardPodium
        empty="No scores have been published yet."
        entries={rows.map(row => ({
          id: `${row.rank}-${row.name}`,
          label: row.name,
          score: row.points,
          scoreLabel: `${row.points.toLocaleString()} points`,
        }))}
      />
    </div>
  );
}
