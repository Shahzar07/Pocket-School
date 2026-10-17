'use client';

import { InstitutionAcademyDoor } from '@/components/institutions/join-screen';
import { useBrandedAcademy } from '@/components/institutions/use-branded-academy';

export default function AcademyDoorPage() {
  const { slug, branding, status } = useBrandedAcademy();
  if (status === 'loading') {
    return <main className="min-h-screen bg-[#F6F1E7] px-6 py-16 text-sm text-[#203337]">Opening this academy…</main>;
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
    <InstitutionAcademyDoor
      schoolName={branding.displayName}
      slug={slug}
      primaryColor={branding.primaryColor}
      secondaryColor={branding.secondaryColor}
      showPoweredBy={!branding.hidePoweredBy}
    />
  );
}
