'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { DestinationBoardView } from '@/components/portfolio/record-panels';
import { DashHeader, DashPage } from '@/components/dash-ui';
import { useAuthSTORE } from '@/hooks/use-auth';
import { authedFetch } from '@/lib/api-client';
import type { DestinationBoard } from '@/lib/destinations';

const EMPTY: DestinationBoard = { institutions: [], countries: [], courses: [], named: [], testimonials: [], hiddenBuckets: 0 };

export default function DestinationsPage() {
  const institutionId = useAuthSTORE((state) => state.profile?.institutionId ?? '');
  const [board, setBoard] = useState<DestinationBoard & { note?: string }>({ ...EMPTY, note: 'Groups under five stay hidden.' });

  const load = useCallback(() => {
    if (!institutionId) return;
    authedFetch(`/api/institutions/destinations?institutionId=${institutionId}`)
      .then((data) => setBoard(data as unknown as DestinationBoard & { note?: string }))
      .catch(() => toast.error('Could not open alumni destinations.'));
  }, [institutionId]);

  useEffect(() => { load(); }, [load]);

  if (!institutionId) return <p className="p-6 text-sm text-[#1A3C34]">This page opens once your account is tied to an academy.</p>;

  return (
    <DashPage className="max-w-5xl">
      <DashHeader
        eyebrow="Academy"
        title="Alumni destinations"
        description="Counts by institution, country, and course. A name or a testimonial appears only when that alumnus opts in to share it with this school."
      />
      <DestinationBoardView board={board} />
    </DashPage>
  );
}
