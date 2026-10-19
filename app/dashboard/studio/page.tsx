'use client';

import { AiStudio } from '@/components/studio/ai-studio';

/** Studio home is the same ET AI chat. Header tabs still open every tool. */
export default function StudioHub() {
  return (
    <div className="flex h-[calc(100dvh-8.5rem)] min-h-[32rem] flex-col" data-studio-home="chat">
      <h1 className="px-4 pt-3 text-center text-lg font-semibold text-[#203337]">What should ET AI make today</h1>
      <div className="min-h-0 flex-1">
        <AiStudio embedded />
      </div>
    </div>
  );
}
