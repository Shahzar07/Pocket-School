'use client';

import { use } from 'react';
import Link from 'next/link';
import { AI_TEACHERS } from '@/lib/ai-teachers';
import { TeacherConversation } from '@/components/teacher-conversation';
import { PublicToolShell } from '@/components/studio/tool-shell';

/** Full-screen AI teacher session. The conversation itself lives in one component. */
export default function TeacherSessionPage({ params }: { params: Promise<{ teacherId: string }> }) {
  const { teacherId } = use(params);
  const teacher = AI_TEACHERS.find(item => item.id === teacherId);
  if (!teacher) {
    return (
      <PublicToolShell>
        <div className="flex min-h-[50vh] items-center justify-center px-4 text-[#203337]">
          <div className="text-center">
            <p className="mb-4 text-lg">Teacher not found.</p>
            <Link href="/ai-teachers" className="text-[#1E6A83] underline">Back to AI Teachers</Link>
          </div>
        </div>
      </PublicToolShell>
    );
  }
  return (
    <PublicToolShell>
      <div className="h-[calc(100dvh-3.5rem)] min-h-0">
        <TeacherConversation teacher={teacher} variant="session" />
      </div>
    </PublicToolShell>
  );
}
