'use client';

import { useAuthSTORE } from '@/hooks/use-auth';
import { DashboardHome, EmptyState } from '@/components/dashboard';
import { ComingSoon } from '@/components/coming-soon';

export default function RecruiterHomePage() {
  const { profile } = useAuthSTORE();
  const name = profile?.displayName || profile?.name || 'Recruiter';
  return (
    <div className="space-y-6">
      <ComingSoon title="Recruiter desk" detail="Talent lists are not open yet. A school has to share a list before anyone appears here." />
      <DashboardHome
        role="recruiter"
        name={name.split(' ')[0] || 'Recruiter'}
        listTitle="Shared with you"
        rows={[]}
      />
      <section id="search" className="rounded-[24px] border border-border bg-card p-4">
        <h2 className="font-heading text-xl">Search</h2>
        <p className="mt-1 text-sm text-muted-foreground">Search a list a school has shared. Poket does not invent people or scores.</p>
        <label className="mt-3 block">
          <span className="sr-only">Search talent</span>
          <input className="h-12 w-full rounded-[18px] border border-border bg-background px-4 text-sm" placeholder="Name, level, or subject" />
        </label>
      </section>
      <section id="lists" className="rounded-[24px] border border-border bg-card p-4">
        <h2 className="font-heading text-xl">Talent lists</h2>
        <EmptyState title="No list yet" detail="When a school shares a list with your organisation, it will show up here." />
      </section>
    </div>
  );
}
