'use client';

import { ParentHotlineLive } from '@/components/hotline/live';
import { useAuthSTORE } from '@/hooks/use-auth';

export default function ParentHotlinePage() {
  const { profile } = useAuthSTORE();
  return <ParentHotlineLive childIds={profile?.childIds ?? []} />;
}
