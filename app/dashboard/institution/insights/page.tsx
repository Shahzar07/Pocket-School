'use client';

import { CensusPanel } from '@/components/insights/census-panel';
import { ProgrammeRevenue } from '@/components/insights/programme-revenue';
import { useAuthSTORE } from '@/hooks/use-auth';

export default function InstitutionInsightsPage() {
  const institutionId = useAuthSTORE((state) => state.profile?.institutionId ?? '');
  if (!institutionId) {
    return <p className="p-6 text-sm text-[#1A3C34]">This Insights view opens once your account is tied to an institution.</p>;
  }
  return (
    <div className="space-y-5">
      <CensusPanel institutionId={institutionId} locked />
      <div className="mx-auto max-w-[1400px] px-4">
        <ProgrammeRevenue institutionId={institutionId} />
      </div>
    </div>
  );
}
