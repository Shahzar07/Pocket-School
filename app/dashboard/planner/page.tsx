'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** The year planner is the terms view of the calendar. */
export default function PlannerPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/calendar?view=terms');
  }, [router]);
  return <p className="p-6 text-sm text-muted-foreground">Opening terms on the calendar…</p>;
}
