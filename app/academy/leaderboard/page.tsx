'use client';

import { rankLeaderboard } from '@/lib/academy-settings';
import { useWhiteLabel } from '@/components/white-label-provider';

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
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No scores have been published yet.</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((row) => (
            <li key={`${row.rank}-${row.name}`} className="flex justify-between rounded-2xl border border-border px-4 py-3 text-sm">
              <span>{row.rank}. {row.name}</span>
              <span>{row.points}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
