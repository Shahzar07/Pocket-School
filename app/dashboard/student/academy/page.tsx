'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { AlumniOfferCard } from '@/components/alumni/record-panels';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { useAuthSTORE } from '@/hooks/use-auth';
import { authedFetch } from '@/lib/api-client';
import { documentPdf } from '@/lib/institution-pricing';

export default function StudentAcademyPage() {
  const { user, profile, fetchProfile } = useAuthSTORE();
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const joined = Boolean(profile?.institutionId) && profile?.institutionAccess !== 'grace' && profile?.institutionAccess !== 'ended';

  const leave = async () => {
    setBusy(true);
    try {
      const data = await authedFetch('/api/institutions/join', { method: 'POST', body: JSON.stringify({ action: 'leave' }) });
      if (user) await fetchProfile(user.uid);
      toast.success(data.institutionAccess === 'grace' && typeof data.graceEndsOn === 'string'
        ? `You are an alumnus on an individual account. The seat is free. Academy courses stay open to review until ${data.graceEndsOn}. Your records stay.`
        : 'You are an alumnus on an individual account. The seat is free. Your profile, student number, certificates, badges, transcript, and progress stay.');
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
        description="An individual account can join an academy later. Progress stays. Leaving moves academy courses to Completed, frees the seat, and keeps this account as an individual with the alumni offer."
      />
      {(profile?.alumniOf || profile?.institutionAccess === 'grace' || profile?.institutionAccess === 'ended') && (
        <AlumniOfferCard
          name={profile?.name ?? ''}
          graceEndsOn={profile?.alumniGraceEnds ?? ''}
          reviewOpen={profile?.institutionAccess === 'grace'}
          discount={profile?.alumniDiscount ?? 0}
          studentNumber={profile?.studentNumber ?? ''}
          publicOn={profile?.alumniPublic === true}
          joinHref={slug.trim() ? `/i/${slug.trim()}/join` : '/signup'}
          onTogglePublic={(optIn) => {
            void authedFetch('/api/alumni', { method: 'POST', body: JSON.stringify({ action: 'public', optIn }) })
              .then(() => user && fetchProfile(user.uid))
              .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not update the public profile.'));
          }}
          onTranscript={() => {
            void authedFetch('/api/alumni', { method: 'POST', body: JSON.stringify({ action: 'transcript', rows: [] }) })
              .then((data) => {
                const lines = Array.isArray(data.lines) ? data.lines.filter((line): line is string => typeof line === 'string') : [];
                const bytes = documentPdf(lines);
                const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
                const link = document.createElement('a');
                link.href = url;
                link.download = 'record-of-achievement.pdf';
                link.click();
                URL.revokeObjectURL(url);
              })
              .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not download the record.'));
          }}
        />
      )}
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
