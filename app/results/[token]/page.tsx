import type { Metadata } from 'next';
import { PublicPortfolio } from '@/components/results/public-portfolio';
import { publicPortfolio } from '@/lib/results/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Academic results',
    robots: { index: false, follow: false },
  };
}

export default async function ResultPortfolioPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await publicPortfolio(token);
  return <PublicPortfolio state={view.state} rows={view.rows} progress={view.progress} />;
}
