'use client';

import dynamic from 'next/dynamic';
import { DashHeader, DashPage } from '@/components/dash-ui';

const EssayReview = dynamic(() => import('@/components/essays/essay-review').then(mod => mod.EssayReview), {
  loading: () => <div className="h-64 animate-pulse rounded-2xl bg-muted" role="status" aria-label="Loading teacher review" />,
});

export default function StudioEssayReviewPage() {
  return (
    <DashPage>
      <DashHeader
        eyebrow="ET AI Studio"
        title="Teacher review"
        accent="for ET Essays."
        description="See how ET AI was used on each essay. Release marking when a flag appears to be a false positive."
      />
      <EssayReview />
    </DashPage>
  );
}
