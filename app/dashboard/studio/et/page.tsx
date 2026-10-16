'use client';

import dynamic from 'next/dynamic';
import { StudioBoot } from '@/components/studio/boot';

const AiStudio = dynamic(() => import('@/components/studio/ai-studio').then(mod => mod.AiStudio), {
  loading: () => <StudioBoot />,
});

/** ET AI, inside the dashboard shell rather than as its own app. */
export default function StudioEt() {
  return (
    <div className="-mx-4 lg:-mx-6 h-[calc(100dvh-6.25rem)] lg:h-[calc(100dvh-7.25rem)] overflow-hidden rounded-2xl border border-border">
      <AiStudio embedded />
    </div>
  );
}
