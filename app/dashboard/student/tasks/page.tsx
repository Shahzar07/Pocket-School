'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/** Daily goals and tasks are one page. The query, including ?add=1, is kept. */
export default function StudentTasksRedirect() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-[#1E6A83]">Opening your goals.</p>}>
      <TasksRedirect />
    </Suspense>
  );
}

function TasksRedirect() {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    const query = params.toString();
    router.replace(query ? `/dashboard/student/goals?${query}` : '/dashboard/student/goals');
  }, [router, params]);
  return <p className="p-8 text-sm text-[#1E6A83]">Opening your goals.</p>;
}
