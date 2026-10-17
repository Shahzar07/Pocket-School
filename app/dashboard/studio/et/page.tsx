'use client';

import dynamic from 'next/dynamic';
import { StudioBoot } from '@/components/studio/boot';

const AiStudio = dynamic(() => import('@/components/studio/ai-studio').then(mod => mod.AiStudio), {
  loading: () => <StudioBoot />,
});

/** ET AI, inside the dashboard shell rather than as its own app. */
export default function StudioEt() {
  return (
    <div className="h-[calc(100dvh-3rem)] overflow-hidden">
      <AiStudio embedded />
    </div>
  );
}
