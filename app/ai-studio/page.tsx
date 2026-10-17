'use client';

import dynamic from 'next/dynamic';
import { StudioBoot } from '@/components/studio/boot';

const AiStudio = dynamic(() => import('@/components/studio/ai-studio').then(mod => mod.AiStudio), {
  loading: () => <StudioBoot />,
});

export default function AiStudioPage() {
  return <AiStudio />;
}
