'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { useAuthSTORE } from '@/hooks/use-auth';
import { authedFetch } from '@/lib/api-client';

export default function StudentAcademyPage() {
  const { profile } = useAuthSTORE();
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const joined = Boolean(profile?.institutionId);

  const leave = async () => {
    setBusy(true);
    try {
      const data = await authedFetch('/api/institutions/join', { method: 'POST', body: JSON.stringify({ action: 'leave' }) });
      toast.success(data.progressKept === true ? 'Progress stays with you. Academy access has ended.' : 'You are an individual again.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not leave the academy.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashPage className="max-w-2xl">
      <DashHeader
        eyebrow="Student"
        title="My academy"
        description="An individual account can join an academy later. Progress stays. A personal plan can offer the unused days as a credit. Leaving ends academy-paid access."
      />
      {joined ? (
        <Panel>
          <p className="text-sm leading-relaxed">You are with your academy{profile?.academyLevel ? ` on ${profile.academyLevel}` : ''}.</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">To transfer, leave this academy and open the next academy’s join page. Courses, badges, and certificates stay on this account.</p>
          <button type="button" disabled={busy} onClick={() => void leave()} className="mt-4 h-11 rounded-full bg-[#1A3C34] px-5 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? 'Leaving…' : 'Leave the academy'}
          </button>
        </Panel>
      ) : (
        <Panel>
          <p className="text-sm leading-relaxed">You are on an individual plan. Open your academy’s join page to register with them.</p>
          <label className="mt-4 block text-sm">
            Academy link name
            <input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} placeholder="north" className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3" />
          </label>
          <a href={slug.trim() ? `/i/${slug.trim()}/join` : '/signup'} className="mt-4 inline-flex h-11 items-center rounded-full bg-[#1A3C34] px-5 text-sm font-semibold text-white">
            Join with my school
          </a>
        </Panel>
      )}
    </DashPage>
  );
}
