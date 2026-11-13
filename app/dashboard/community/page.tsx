'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ClassChannels } from '@/components/class-channels';
import { FeatureGate } from '@/components/scope-c/feature-gate';
import { WallScreen } from '@/components/wall/wall-screen';

function CommunityPageInner() {
  const params = useSearchParams();
  const channels = params.get('tab') === 'channels';
  return (
    <FeatureGate flag="community">
      <div className="mb-3 flex gap-2 px-3 pt-3">
        <a href="/dashboard/community" className={`inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold ${channels ? 'bg-[#f8fafc] text-[#096ab7]' : 'border border-[#096ab7] bg-[#d9efff] text-[#11131b]'}`}>Wall</a>
        <a href="/dashboard/community?tab=channels" className={`inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold ${channels ? 'border border-[#096ab7] bg-[#d9efff] text-[#11131b]' : 'bg-[#f8fafc] text-[#096ab7]'}`}>Class channels</a>
      </div>
      {channels ? <ClassChannels /> : <WallScreen />}
    </FeatureGate>
  );
}

export default function CommunityPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-[#11131b]">Loading the wall…</p>}>
      <CommunityPageInner />
    </Suspense>
  );
}
