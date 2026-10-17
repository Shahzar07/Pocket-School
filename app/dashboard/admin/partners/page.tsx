'use client';

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/api-client';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';

interface PartnerRow { id: string; name: string; contact: string; categories: string[] }
interface OfferRow { id: string; title: string; ageMin: number; category: string }

export default function PartnerReviewPage() {
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [note, setNote] = useState('');

  const load = () => authedFetch('/api/partners?queue=1').then((data) => {
    setPartners(Array.isArray(data.partners) ? data.partners as PartnerRow[] : []);
    setOffers(Array.isArray(data.offers) ? data.offers as OfferRow[] : []);
  });

  useEffect(() => {
    load().catch((reason: unknown) => setNote(reason instanceof Error ? reason.message : 'The queue could not be loaded.'));
  }, []);

  const act = (action: string, id: string) => {
    void authedFetch('/api/partners', { method: 'POST', body: JSON.stringify({ action, id }) })
      .then(() => load())
      .then(() => setNote('Saved.'))
      .catch((reason: unknown) => setNote(reason instanceof Error ? reason.message : 'Could not update that record.'));
  };

  return (
    <DashPage>
      <DashHeader
        eyebrow="Admin"
        title="Partner perks"
        description="Approve merchants and offers. Alcohol, vape, tobacco, gambling, and adult categories are refused when they could be shown to under-18s."
      />
      <Panel>
        <h2 className="font-heading text-xl text-[#203337]">Merchant applications</h2>
        <ul className="mt-3 space-y-3">
          {partners.map((partner) => (
            <li key={partner.id} className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#203337]">
              <span>{partner.name} · {partner.contact}</span>
              <span className="flex gap-2">
                <button type="button" className="rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-3 py-1.5 text-xs font-semibold text-[#203337]" onClick={() => act('approve-partner', partner.id)}>Approve</button>
                <button type="button" className="rounded-full border border-[#E7EDED] px-3 py-1.5 text-xs font-semibold text-[#1E6A83]" onClick={() => act('reject-partner', partner.id)}>Reject</button>
              </span>
            </li>
          ))}
          {partners.length === 0 ? <li className="text-sm text-[#5F7074]">No applications waiting.</li> : null}
        </ul>
      </Panel>
      <Panel>
        <h2 className="font-heading text-xl text-[#203337]">Offers in review</h2>
        <ul className="mt-3 space-y-3">
          {offers.map((offer) => (
            <li key={offer.id} className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#203337]">
              <span>{offer.title} · {offer.category} · age {offer.ageMin}</span>
              <span className="flex gap-2">
                <button type="button" className="rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-3 py-1.5 text-xs font-semibold text-[#203337]" onClick={() => act('approve-offer', offer.id)}>Approve</button>
                <button type="button" className="rounded-full border border-[#E7EDED] px-3 py-1.5 text-xs font-semibold text-[#1E6A83]" onClick={() => act('reject-offer', offer.id)}>Reject</button>
              </span>
            </li>
          ))}
          {offers.length === 0 ? <li className="text-sm text-[#5F7074]">No offers waiting.</li> : null}
        </ul>
      </Panel>
      {note ? <p className="text-sm text-[#203337]">{note}</p> : null}
    </DashPage>
  );
}
