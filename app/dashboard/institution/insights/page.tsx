'use client';

import { useEffect, useState } from 'react';
import { CensusPanel } from '@/components/insights/census-panel';
import { ProgrammeRevenue } from '@/components/insights/programme-revenue';
import { useAuthSTORE } from '@/hooks/use-auth';
import { authedFetch } from '@/lib/api-client';
import type { AlumniPerson } from '@/lib/alumni';
import { alumniStats } from '@/lib/alumni';

export default function InstitutionInsightsPage() {
  const institutionId = useAuthSTORE((state) => state.profile?.institutionId ?? '');
  const [stats, setStats] = useState<{ alumni: number; certificates: number; seatsFreed: number; byYear: { year: string; graduates: number; certificates: number; seatsFreed: number }[] } | null>(null);
  useEffect(() => {
    if (!institutionId) return;
    authedFetch(`/api/institutions/alumni?institutionId=${institutionId}`)
      .then((data) => {
        const people = Array.isArray(data.people) ? data.people as AlumniPerson[] : [];
        setStats(alumniStats(people));
      })
      .catch(() => setStats(null));
  }, [institutionId]);
  if (!institutionId) {
    return <p className="p-6 text-sm text-[#203337]">This Insights view opens once your account is tied to an institution.</p>;
  }
  return (
    <div className="space-y-5">
      {stats && (
        <section className="mx-auto max-w-[1400px] px-4">
          <div className="rounded-3xl border border-[#203337]/10 bg-white p-5 text-[#203337]">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1E6A83]">Alumni</p>
            <h2 className="font-heading text-2xl">{stats.alumni} alumni · {stats.seatsFreed} seats freed · {stats.certificates} certificates</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {stats.byYear.map((row) => (
                <span key={row.year} className="rounded-full bg-[#E9F7FA] px-3 py-1">{row.year}: {row.graduates} graduate{row.graduates === 1 ? '' : 's'} · {row.seatsFreed} seat{row.seatsFreed === 1 ? '' : 's'} freed</span>
              ))}
            </div>
          </div>
        </section>
      )}
      <CensusPanel institutionId={institutionId} locked />
      <div className="mx-auto max-w-[1400px] px-4">
        <ProgrammeRevenue institutionId={institutionId} />
      </div>
    </div>
  );
}
