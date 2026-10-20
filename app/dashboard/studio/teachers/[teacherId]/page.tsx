'use client';

import { use } from 'react';
import Link from 'next/link';
import { AI_TEACHERS } from '@/lib/ai-teachers';
import { TeacherConversation } from '@/components/teacher-conversation';

export default function StudioTeacherPage({ params }: { params: Promise<{ teacherId: string }> }) {
  const { teacherId } = use(params);
  const teacher = AI_TEACHERS.find(item => item.id === teacherId);
  if (!teacher) {
    return <p className="p-8 text-sm">That teacher is not in AI Studio. <Link href="/dashboard/studio/teachers" className="underline">Back to AI Teachers</Link></p>;
  }
  return (
    <div className="h-[calc(100dvh-3.5rem)] min-h-0">
      <TeacherConversation teacher={teacher} variant="studio" />
    </div>
  );
}
