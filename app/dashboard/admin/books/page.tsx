'use client';

import { StudioView } from '@/components/reads/studio-view';
import { StudioFrame } from '@/components/studio/studio-nav';

/** The same Book Studio as Poket Reads, opened from the CMS. */
export default function BookStudioPage() {
  return (
    <StudioFrame>
      <StudioView />
    </StudioFrame>
  );
}
