'use client';

import { useState } from 'react';
import { InstitutionJoinScreen, type JoinScreenResult } from '@/components/institutions/join-screen';
import { useBrandedAcademy } from '@/components/institutions/use-branded-academy';
import { useAuthSTORE } from '@/hooks/use-auth';
import { authedFetch } from '@/lib/api-client';
import type { JoinAttempt } from '@/lib/institution-join';

export default function AcademyJoinPage() {
  const { slug, branding, status } = useBrandedAcademy();
  const { user } = useAuthSTORE();
  const [result, setResult] = useState<JoinScreenResult | null>(null);
  const [busy, setBusy] = useState(false);

  const check = async (input: JoinAttempt & { childStudentNumber: string }) => {
    setBusy(true);
    try {
      const response = await fetch('/api/institutions/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decide', slug, ...input }),
      });
      const data = await response.json() as { decision?: JoinScreenResult & { message: string }; programmes?: { id: string; title: string }[]; error?: string };
      if (!response.ok || !data.decision) {
        setResult({
          status: 'pending',
          message: data.error || 'The academy will confirm this account from the approval queue.',
          level: '',
          className: '',
          programmes: [],
        });
        return;
      }
      setResult({
        status: data.decision.status,
        message: data.decision.message,
        level: data.decision.level,
        className: data.decision.className,
        programmes: data.programmes ?? [],
      });
    } catch {
      setResult({
        status: 'pending',
        message: 'The academy will confirm this account from the approval queue.',
        level: '',
        className: '',
        programmes: [],
      });
    } finally {
      setBusy(false);
    }
  };

  const attach = async (input: JoinAttempt & { childStudentNumber: string; takeCredit: boolean }) => {
    setBusy(true);
    try {
      const data = await authedFetch('/api/institutions/join', {
        method: 'POST',
        body: JSON.stringify({ action: 'attach', slug, ...input }),
      });
      const decision = data.decision as JoinScreenResult | undefined;
      const programmes = Array.isArray(data.programmes) ? data.programmes as { id: string; title: string }[] : [];
      setResult({
        status: decision?.status ?? 'pending',
        message: typeof data.message === 'string' ? data.message : 'The academy has this account.',
        level: decision?.level ?? '',
        className: decision?.className ?? '',
        programmes,
        credit: typeof data.credit === 'number' ? data.credit : null,
      });
    } catch (error) {
      setResult({
        status: 'pending',
        message: error instanceof Error ? error.message : 'The academy will confirm this account from the approval queue.',
        level: '',
        className: '',
        programmes: [],
      });
    } finally {
      setBusy(false);
    }
  };

  if (status === 'loading') {
    return <main className="min-h-screen bg-[#F6F1E7] px-6 py-16 text-sm text-[#203337]">Opening the join page…</main>;
  }
  if (status === 'missing') {
    return (
      <main className="min-h-screen bg-[#F6F1E7] px-6 py-16 text-[#203337]">
        <h1 className="font-heading text-3xl">This academy page is not set up yet.</h1>
        <a href="/signup" className="mt-4 inline-flex text-sm font-semibold underline">Sign up as an individual</a>
      </main>
    );
  }
  return (
    <InstitutionJoinScreen
      schoolName={branding.displayName}
      slug={slug}
      primaryColor={branding.primaryColor}
      secondaryColor={branding.secondaryColor}
      showPoweredBy={!branding.hidePoweredBy}
      result={result}
      busy={busy}
      signedIn={Boolean(user)}
      onCheck={(input) => { void check(input); }}
      onAttach={(input) => { void attach(input); }}
    />
  );
}
