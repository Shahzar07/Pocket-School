'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SnapPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/studio/maths?snap=1');
  }, [router]);
  return <p className="p-8 text-sm text-muted-foreground">Opening the camera in ET Maths.</p>;
}
