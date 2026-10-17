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
        description="ET AI sets a question and helps you plan. You write the essay. A mark shows a 9–1 grade, a letter from A* to U, and a percentage."
      />
      <EssaysDesk />
    </DashPage>
  );
}
