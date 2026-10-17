'use client';

import { ParentExplainerScreen } from '@/components/institutions/join-screen';
import { useBrandedAcademy } from '@/components/institutions/use-branded-academy';

export default function AcademyExplainerPage() {
  const { branding, status } = useBrandedAcademy();
  if (status === 'loading') {
    return <main className="min-h-screen bg-[#F6F1E7] px-6 py-16 text-sm text-[#1A3C34]">Opening the Parent Explainer…</main>;
  }
  const name = status === 'ready' ? branding.displayName : 'This academy';
  return (
    <ParentExplainerScreen
      schoolName={name}
      primaryColor={branding.primaryColor}
      secondaryColor={branding.secondaryColor}
    />
  );
}
