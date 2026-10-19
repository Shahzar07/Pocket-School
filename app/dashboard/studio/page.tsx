'use client';

import Link from 'next/link';
import { AiStudio } from '@/components/studio/ai-studio';
import { useAuthSTORE } from '@/hooks/use-auth';
import { STUDIO_TIMETABLE } from '@/lib/studio-paths';
import { studioTimetableGate } from '@/lib/timetable/access';
import { TIMETABLE_COPY } from '@/lib/timetable/copy';

/** Teachers and school timetablers open the week from the chat. Students do not see it. */
function StudioTimetableEntry() {
  const profile = useAuthSTORE(state => state.profile);
  const gate = studioTimetableGate({
    role: profile?.role,
    roles: profile?.roles,
    permissions: profile?.permissions,
  });
  if (gate === 'hidden') return null;
  return (
    <Link
      href={STUDIO_TIMETABLE}
      data-studio-entry="timetable"
      data-timetable-gate={gate}
      className="mt-2 inline-flex h-9 items-center rounded-full border border-[#1E6A83] px-3 text-sm font-semibold text-[#1E6A83]"
    >
      {TIMETABLE_COPY.studioTab}
    </Link>
  );
}

/** Studio home is the same ET AI chat. Header tabs still open every tool. */
export default function StudioHub() {
  return (
    <div className="flex h-[calc(100dvh-8.5rem)] min-h-[32rem] flex-col" data-studio-home="chat">
      <div className="px-4 pt-3 text-center">
        <h1 className="text-lg font-semibold text-[#203337]">What should ET AI make today</h1>
        <StudioTimetableEntry />
      </div>
      <div className="min-h-0 flex-1">
        <AiStudio embedded />
      </div>
    </div>
  );
}
