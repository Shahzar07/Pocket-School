'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ClassChannels } from '@/components/class-channels';
import { toast } from 'sonner';
import { useAuthSTORE } from '@/hooks/use-auth';
import { authedFetch } from '@/lib/api-client';
import { FeatureGate } from '@/components/scope-c/feature-gate';
import { CommunityScreen, type PostCard, type SpaceCard } from '@/components/scope-c/community-screen';
import { asAgeTier } from '@/lib/age-tier';

function CommunityPageInner() {
  const { profile } = useAuthSTORE();
  const params = useSearchParams();
  const tab = params.get('tab') === 'channels' ? 'channels' : 'spaces';
  const [spaces, setSpaces] = useState<SpaceCard[]>([]);
  const [posts, setPosts] = useState<PostCard[]>([]);
  const [spaceId, setSpaceId] = useState('');
  const [spaceTitle, setSpaceTitle] = useState('');
  const [ageTier, setAgeTier] = useState(profile?.ageTier ?? 'under13');
  const [explore, setExplore] = useState(false);
  const [dobSaved, setDobSaved] = useState(Boolean(profile?.dateOfBirth));

  const loadSpaces = () => {
    authedFetch('/api/community/spaces').then((data) => {
      const next = Array.isArray(data.spaces) ? data.spaces as SpaceCard[] : [];
      setSpaces(next);
      setAgeTier(asAgeTier(data.ageTier));
      setExplore(data.explore === true);
    }).catch((error: Error) => toast.error(error.message));
  };

  useEffect(() => { loadSpaces(); }, []);

  const openSpace = (id: string) => {
    setSpaceId(id);
    const space = spaces.find((item) => item.id === id);
    setSpaceTitle(space?.title ?? '');
    authedFetch(`/api/community/feed?spaceId=${id}`).then((data) => {
      setPosts(Array.isArray(data.posts) ? data.posts as PostCard[] : []);
    }).catch((error: Error) => toast.error(error.message));
  };

  return (
    <FeatureGate flag="community">
      <div className="flex gap-2 mb-4">
        <a href="/dashboard/community" className={`h-9 px-4 rounded-full text-xs font-semibold inline-flex items-center ${tab === 'spaces' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>Spaces</a>
        <a href="/dashboard/community?tab=channels" className={`h-9 px-4 rounded-full text-xs font-semibold inline-flex items-center ${tab === 'channels' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>Channels</a>
      </div>
      {tab === 'channels' ? <ClassChannels /> : <CommunityScreen
        ageTier={ageTier}
        explore={explore}
        dateOfBirth={dobSaved ? (profile?.dateOfBirth || 'set') : undefined}
        spaces={spaces}
        posts={posts}
        spaceTitle={spaceTitle}
        onSaveDob={(dob) => {
          authedFetch('/api/community/dob', { method: 'POST', body: JSON.stringify({ dateOfBirth: dob }) })
            .then((data) => { toast.success(`Age tier set to ${String(data.ageTier)}`); setDobSaved(true); loadSpaces(); })
            .catch((error: Error) => toast.error(error.message));
        }}
        onOpenSpace={openSpace}
        onPost={(kind, body) => {
          if (!spaceId) { toast.error('Open a space first.'); return; }
          authedFetch('/api/community/post', { method: 'POST', body: JSON.stringify({ spaceId, kind, body }) })
            .then(() => { toast.success('Sent for moderation.'); openSpace(spaceId); })
            .catch((error: Error) => toast.error(error.message));
        }}
        onSearch={(q) => {
          authedFetch(`/api/community/search?q=${encodeURIComponent(q)}`).then((data) => {
            const found = Array.isArray(data.posts) ? data.posts as PostCard[] : [];
            setPosts(found);
            setSpaceTitle('Search');
          }).catch((error: Error) => toast.error(error.message));
        }}
      />}
    </FeatureGate>
  );
}

export default function CommunityPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading community…</p>}>
      <CommunityPageInner />
    </Suspense>
  );
}
