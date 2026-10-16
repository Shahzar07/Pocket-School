'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function StudentGoalsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/student/tasks');
  }, [router]);
  return <p className="p-8 text-sm text-muted-foreground">Daily goals live with your tasks. Parents and teachers still have their own view.</p>;
}
