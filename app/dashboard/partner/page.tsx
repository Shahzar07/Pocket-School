'use client';

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/api-client';
import { PartnerDesk, type PartnerOfferRow } from '@/components/student-id/partner-desk';

export default function PartnerPortalPage() {
  const [name, setName] = useState('');
  const [status, setStatus] = useState('pending');
  const [offers, setOffers] = useState<PartnerOfferRow[]>([]);
  const [error, setError] = useState('');

  const load = () => authedFetch('/api/partners').then((data) => {
    const partner = data.partner as { name?: string; status?: string } | null;
    setName(partner?.name ?? '');
    setStatus(partner?.status ?? 'pending');
    setOffers(Array.isArray(data.offers) ? data.offers as PartnerOfferRow[] : []);
  });

  useEffect(() => {
    load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'The partner desk could not be loaded.'));
  }, []);

  if (error) return <p className="text-sm text-[#203337]">{error}</p>;

  return (
    <PartnerDesk
      name={name}
      status={status}
      offers={offers}
      onCreate={async (input) => {
        await authedFetch('/api/partners', { method: 'POST', body: JSON.stringify({ action: 'offer', ...input }) });
        await load();
      }}
    />
  );
}
