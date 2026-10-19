'use client';

import { AiStudio } from '@/components/studio/ai-studio';

/** ET AI chat inside the dashboard shell. One sidebar, header tabs above. */
export default function StudioEt() {
  return (
    <div className="fixed inset-0 z-20 flex min-h-0 flex-col bg-[#1A1918]">
      <AiStudio embedded />
    </div>
  );
}
