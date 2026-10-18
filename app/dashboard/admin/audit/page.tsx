'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Staff audit and the server activity log are one page. */
export default function AdminAuditRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/admin/activity');
  }, [router]);
  return <p className="p-8 text-sm text-[#1E6A83]">Opening the activity log.</p>;
}
