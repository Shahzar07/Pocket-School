'use client';

import { AiStudio } from '@/components/studio/ai-studio';

/** Signed-in Studio home is the dark ET AI chat. Tools live in that sidebar. */
export default function StudioHub() {
  return (
    <div className="flex h-[calc(100dvh-8.5rem)] min-h-[32rem] flex-col" data-studio-home="chat">
      <div className="min-h-0 flex-1">
        <AiStudio embedded />
      </div>
    </div>
  );
}
