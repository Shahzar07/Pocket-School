'use client';

import { CensusPanel } from '@/components/insights/census-panel';
import { ProgrammeRevenue } from '@/components/insights/programme-revenue';

export default function AdminInsightsPage() {
  return (
    <div className="space-y-5">
      <CensusPanel />
      <div className="mx-auto max-w-[1400px] px-4">
        <ProgrammeRevenue />
      </div>
    </div>
  );
}
