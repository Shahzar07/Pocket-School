'use client';

import { EssayReview } from '@/components/essays/essay-review';
import { DashHeader, DashPage } from '@/components/dash-ui';

export default function StudioEssayReviewPage() {
  return (
    <DashPage>
      <DashHeader
        eyebrow="AI Studio"
        title="Teacher review"
        accent="for ET Essays."
        description="See how ET AI was used on each essay. Release marking when a flag appears to be a false positive."
      />
      <EssayReview />
    </DashPage>
  );
}
