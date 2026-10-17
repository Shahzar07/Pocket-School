'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ParentExplainerScreen } from '@/components/institutions/join-screen';
import { useBrandedAcademy } from '@/components/institutions/use-branded-academy';

function ExplainerBody() {
  const { branding, status } = useBrandedAcademy();
  const params = useSearchParams();
  const childName = params.get('child')?.trim() ?? '';
  const graduate = childName
    ? { childName, level: params.get('level')?.trim() ?? '', certificates: Number(params.get('certificates') ?? 0) || 0 }
    : null;
  if (status === 'loading') {
    return <main className="min-h-screen bg-[#F6F1E7] px-6 py-16 text-sm text-[#1A3C34]">Opening the Parent Explainer…</main>;
  }
  const name = status === 'ready' ? branding.displayName : 'This academy';
  return (
    <ParentExplainerScreen
      schoolName={name}
      primaryColor={branding.primaryColor}
      secondaryColor={branding.secondaryColor}
      graduate={graduate}
    />
  );
}

export default function AcademyExplainerPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#F6F1E7] px-6 py-16 text-sm text-[#1A3C34]">Opening the Parent Explainer…</main>}>
      <ExplainerBody />
    </Suspense>
  );
}
