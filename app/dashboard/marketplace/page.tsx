'use client';

import { MarketHome } from '@/components/shelf/market-view';

/** Same shelf as /courses. The thin course list used to live here on its own. */
export default function DashboardMarketplace() {
  return (
    <div className="pb-12">
      <MarketHome />
    </div>
  );
}
