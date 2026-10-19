'use client';

import { AiStudio } from '@/components/studio/ai-studio';

/** Signed-in Studio home is the dark ET AI chat. Tools live in that sidebar. */
export default function StudioHub() {
  return (
    <div className="fixed inset-0 z-20 flex min-h-0 flex-col bg-[#1A1918]" data-studio-home="chat">
      <AiStudio embedded />
    </div>
  );
}
