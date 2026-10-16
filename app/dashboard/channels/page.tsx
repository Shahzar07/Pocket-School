'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Channels are a tab on Community. */
export default function ChannelsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/community?tab=channels');
  }, [router]);
  return <p className="p-6 text-sm text-muted-foreground">Opening channels in Community…</p>;
}
