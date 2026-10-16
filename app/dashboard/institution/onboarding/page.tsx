'use client';

import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { OnboardingList } from '@/components/institutions/commerce-panels';
import { onboardingChecklist } from '@/lib/institution-membership';

const STEPS = onboardingChecklist({
  profile: true,
  logo: false,
  subdomain: false,
  billing: false,
  admin: true,
  classes: false,
  people: false,
  sparks: false,
});

export default function InstitutionOnboardingPage() {
  return (
    <DashPage className="max-w-3xl">
      <DashHeader eyebrow="Institution" title="Onboarding" description="A new academy is ready when the profile, logo, subdomain, billing, admin, classes, people, and Sparks pool are in place." />
      <Panel>
        <OnboardingList steps={STEPS} />
      </Panel>
    </DashPage>
  );
}
