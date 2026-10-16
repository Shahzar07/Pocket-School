'use client';

import dynamic from 'next/dynamic';
import { DashHeader, DashPage } from '@/components/dash-ui';

const EssaysDesk = dynamic(() => import('@/components/essays/essays-desk').then(mod => mod.EssaysDesk), {
  loading: () => <div className="h-64 animate-pulse rounded-2xl bg-muted" role="status" aria-label="Loading ET Essays" />,
});

export default function StudioEssaysPage() {
  return (
    <DashPage>
      <DashHeader
        eyebrow="ET AI Studio"
        title="ET Essays"
        accent="with ET AI."
        description="ET AI sets a question and helps you plan. You write the essay. A mark shows a 9–1 grade, a letter from A* to U, and a percentage."
      />
      <EssaysDesk />
    </DashPage>
  );
}
