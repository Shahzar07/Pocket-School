'use client';

import { AiStudio } from '@/app/ai-studio/page';

/** ET AI chat, full page inside the dashboard frame. */
export default function StudioEt() {
  return (
    <div className="h-[calc(100dvh-3rem)] overflow-hidden">
      <AiStudio embedded />
    </div>
  );
}
