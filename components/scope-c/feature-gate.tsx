'use client';

import { ReactNode } from 'react';
import { DashHeader, DashPage } from '@/components/dash-ui';
import { isFeatureEnabled, type FeatureFlag } from '@/lib/feature-flags';
import { useFeatureFlags } from '@/hooks/use-feature-flags';

export function FeatureGate({ flag, children }: { flag: FeatureFlag; children: ReactNode }) {
  const flags = useFeatureFlags();
  if (!isFeatureEnabled(flags, flag)) {
    return (
      <DashPage>
        <DashHeader
          eyebrow="Poket School"
          title="Turned off"
          description="An administrator can enable this in system settings. Nothing here is available while the flag is off."
        />
      </DashPage>
    );
  }
  return <>{children}</>;
}
