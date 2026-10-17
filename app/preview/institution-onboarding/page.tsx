'use client';

import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { BrandedLoginStep } from '@/components/institutions/branded-login-step';
import { OnboardingList } from '@/components/institutions/commerce-panels';
import { journeyChecklist } from '@/lib/institution-journey';

const STEPS = journeyChecklist({ profile: true });

/** Static setup step so the branded login editor can be reviewed without Firebase. */
export default function InstitutionOnboardingPreview() {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <DashPage className="max-w-3xl">
        <DashHeader
          eyebrow="Institution"
          title="Onboarding"
          description="Finish the academy in this order. The branded login page is the public door for students, teachers, and admins. Co-admins sign in with an email code."
        />
        <Panel>
          <OnboardingList steps={STEPS} />
        </Panel>
        <Panel>
          <h2 className="font-heading text-2xl">Branded login page</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a logo, pick colours, and claim an address such as poketschool.ai/i/rochfords. A custom domain is optional. Publish when the preview looks right.
          </p>
          <div className="mt-5">
            <BrandedLoginStep
              preview
              institution={{
                id: 'preview',
                name: 'Rochfords',
                plan: 'team',
                subdomain: 'rochfords',
                customDomain: 'learn.rochfords.example',
                branding: {
                  displayName: 'Rochfords',
                  primaryColor: '#203337',
                  secondaryColor: '#1E6A83',
                  loginHeadline: 'Welcome back to Rochfords',
                  loginBody: 'Students, teachers, and institution admins sign in here.',
                },
              }}
            />
          </div>
        </Panel>
      </DashPage>
    </div>
  );
}
