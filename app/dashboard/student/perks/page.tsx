'use client';

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/api-client';
import { PerksBoard, type PerkOffer } from '@/components/student-id/perks-board';

export default function StudentPerksPage() {
  const [offers, setOffers] = useState<PerkOffer[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    authedFetch('/api/student-id?view=perks')
      .then((data) => setOffers(Array.isArray(data.offers) ? data.offers as PerkOffer[] : []))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Perks could not be loaded.'));
  }, []);

  if (error) return <p className="text-sm text-[#203337]">{error}</p>;

  return (
    <PerksBoard
      offers={offers}
      onRedeem={async (offer) => {
        const method = offer.codeType === 'static' || offer.codeType === 'unique' || offer.codeType === 'scan' ? offer.codeType : 'scan';
        const data = await authedFetch('/api/student-id', {
          method: 'POST',
          body: JSON.stringify({ action: 'redeem', offerId: offer.id, method }),
        });
        return typeof data.code === 'string' && data.code ? data.code : '';
      }}
    />
  );
}
