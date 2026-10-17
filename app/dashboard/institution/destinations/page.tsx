'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { DestinationBoardView } from '@/components/portfolio/record-panels';
import { DashHeader, DashPage } from '@/components/dash-ui';
import { useAuthSTORE } from '@/hooks/use-auth';
import { authedFetch } from '@/lib/api-client';
import type { DestinationBoard } from '@/lib/destinations';

const EMPTY: DestinationBoard = { institutions: [], countries: [], courses: [], named: [], testimonials: [], outcomes: [], hiddenBuckets: 0 };

export default function DestinationsPage() {
  const institutionId = useAuthSTORE((state) => state.profile?.institutionId ?? '');
  const [board, setBoard] = useState<DestinationBoard & { note?: string }>({ ...EMPTY, note: 'Groups under five stay hidden.' });
  const [requests, setRequests] = useState<{ id: string; itemTitle: string; note: string; visitorLabel: string }[]>([]);

  const load = useCallback(() => {
    if (!institutionId) return;
    authedFetch(`/api/institutions/destinations?institutionId=${institutionId}`)
      .then((data) => {
        setBoard(data as unknown as DestinationBoard & { note?: string });
        const rows = Array.isArray(data.requests) ? data.requests : [];
        setRequests(rows.flatMap((row) => {
          if (!row || typeof row !== 'object') return [];
          const item = row as { id?: unknown; itemTitle?: unknown; note?: unknown; visitorLabel?: unknown };
          return typeof item.id === 'string' ? [{
            id: item.id,
            itemTitle: typeof item.itemTitle === 'string' ? item.itemTitle : '',
            note: typeof item.note === 'string' ? item.note : '',
            visitorLabel: typeof item.visitorLabel === 'string' ? item.visitorLabel : '',
          }] : [];
        }));
      })
      .catch(() => toast.error('Could not open alumni destinations.'));
  }, [institutionId]);

  useEffect(() => { load(); }, [load]);

  if (!institutionId) return <p className="p-6 text-sm text-[#203337]">This page opens once your account is tied to an academy.</p>;

  return (
    <DashPage className="max-w-5xl">
      <DashHeader
        eyebrow="Academy"
        title="Alumni destinations"
        description="Counts of graduates hired or studying, plus institution, country, and course. A group under five stays hidden. A name appears only when that alumnus opts in."
      />
      <DestinationBoardView board={board} />
      {requests.length > 0 && (
        <section className="mt-6 rounded-[28px] border border-[#203337]/10 bg-white p-6 text-[#203337]">
          <h2 className="font-heading text-2xl">Verification requests</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {requests.map((item) => (
              <li key={item.id} className="rounded-xl bg-[#F6F1E7] px-3 py-2">
                <p className="font-medium">{item.itemTitle}</p>
                <p>{item.note}{item.visitorLabel ? ` · ${item.visitorLabel}` : ''}</p>
                <button type="button" className="mt-1 font-semibold" onClick={() => {
                  void authedFetch('/api/institutions/destinations', {
                    method: 'POST',
                    body: JSON.stringify({ institutionId, requestId: item.id }),
                  })
                    .then(() => { toast.success('The school confirmed this item.'); load(); })
                    .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not confirm.'));
                }}>Confirm</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </DashPage>
  );
}
