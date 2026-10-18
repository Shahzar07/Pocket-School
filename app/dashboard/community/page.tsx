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
        <a href="/dashboard/community" className={`inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold ${channels ? 'bg-[#F4F6F6] text-[#1E6A83]' : 'border border-[#1E6A83] bg-[#3FE0D0] text-[#203337]'}`}>Wall</a>
        <a href="/dashboard/community?tab=channels" className={`inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold ${channels ? 'border border-[#1E6A83] bg-[#3FE0D0] text-[#203337]' : 'bg-[#F4F6F6] text-[#1E6A83]'}`}>Class channels</a>
      </div>
      {channels ? <ClassChannels /> : <WallScreen />}
    </FeatureGate>
  );
}

export default function CommunityPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-[#203337]">Loading the wall…</p>}>
      <CommunityPageInner />
    </Suspense>
  );
}
