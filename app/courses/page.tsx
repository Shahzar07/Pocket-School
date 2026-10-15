import type { Metadata } from 'next';
import { MarketHome } from '@/components/shelf/market-view';

export const metadata: Metadata = { title: 'Marketplace · Poket School' };

export default function MarketplacePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 sm:py-8">
        <MarketHome />
      </div>
    </div>
  );
}
