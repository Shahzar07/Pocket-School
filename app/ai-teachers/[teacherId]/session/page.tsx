'use client';

import { use } from 'react';
import Link from 'next/link';
import { AI_TEACHERS } from '@/lib/ai-teachers';
import { TeacherConversation } from '@/components/teacher-conversation';

/** Full-screen AI teacher session. The conversation itself lives in one component. */
export default function TeacherSessionPage({ params }: { params: Promise<{ teacherId: string }> }) {
  const { teacherId } = use(params);
  const teacher = AI_TEACHERS.find(item => item.id === teacherId);
  if (!teacher) {
    return (
      <div className="fixed inset-0 bg-[#0A0A0F] text-white flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-lg mb-4">Teacher not found.</p>
          <Link href="/ai-teachers" className="text-blue-400 underline">Back to AI Teachers</Link>
        </div>
      </div>
    );
  }
  return <TeacherConversation teacher={teacher} variant="session" />;
}
