import type { Metadata } from 'next';
import { LeaderboardView } from '@/components/reads/leaderboard-view';

export const metadata: Metadata = { title: 'Board · Poket Reads' };

export default function LeaderboardPage() {
  return <LeaderboardView />;
}
