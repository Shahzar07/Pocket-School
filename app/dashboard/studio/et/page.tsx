'use client';

import { AiStudio } from '@/components/studio/ai-studio';

/** ET AI chat inside the dashboard shell. One sidebar, header tabs above. */
export default function StudioEt() {
  return (
    <div className="h-[calc(100dvh-8.5rem)] min-h-[32rem]">
      <AiStudio embedded />
    </div>
  );
}
