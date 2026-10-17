'use client';

import { DashHeader, DashPage } from '@/components/dash-ui';
import { CatalogueEditor } from '@/components/institutions/catalogue-editor';
import { ProgrammeRevenue } from '@/components/insights/programme-revenue';

export default function AdminInstitutionPricingPage() {
  return (
    <DashPage>
      <DashHeader
        eyebrow="Super admin"
        title="Institution pricing"
        description="Edit programmes, per-seat prices, volume tiers, currencies, minimums, and the trial. Seed amounts are placeholders until you save."
      />
      <CatalogueEditor />
      <ProgrammeRevenue />
    </DashPage>
  );
}
