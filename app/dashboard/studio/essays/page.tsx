'use client';

import { EssaysDesk } from '@/components/essays/essays-desk';
import { DashHeader, DashPage } from '@/components/dash-ui';

export default function StudioEssaysPage() {
  return (
    <DashPage>
      <DashHeader
        eyebrow="AI Studio"
        title="ET Essays"
        accent="with ET AI."
        description="Draft an essay, or paste and upload one for marking. ET AI uses the same method as ET English."
      />
      <EssaysDesk />
    </DashPage>
  );
}
