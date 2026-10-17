'use client';

import { useState } from 'react';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { PERK_CATEGORIES } from '@/lib/student-id/model';

export interface PartnerOfferRow {
  id: string;
  title: string;
  discount: string;
  status: string;
  redemptions: number;
}

export function PartnerDesk({
  name,
  status,
  offers,
  onCreate,
}: {
  name: string;
  status: string;
  offers: PartnerOfferRow[];
  onCreate?: (input: { title: string; discount: string; terms: string; category: string; ageMin: number; codeType: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [discount, setDiscount] = useState('');
  const [terms, setTerms] = useState('');
  const [category, setCategory] = useState('food');
  const [ageMin, setAgeMin] = useState(0);
  const [codeType, setCodeType] = useState('scan');
  const [note, setNote] = useState('');

  return (
    <DashPage>
      <DashHeader
        eyebrow="Partner merchant"
        title={name || 'Partner portal'}
        description="Create offers for review. You see redemption counts only. Student names, numbers, and dates of birth stay off this desk. This role cannot publish Amber alerts."
      />
      <Panel>
        <p className="text-sm text-[#203337]">Account status: <span className="font-semibold">{status}</span></p>
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        {offers.map((offer) => (
          <Panel key={offer.id}>
            <h2 className="font-heading text-2xl text-[#203337]">{offer.title}</h2>
            <p className="mt-1 text-sm text-[#1E6A83]">{offer.discount}</p>
            <p className="mt-3 text-sm text-[#203337]">Status: {offer.status}</p>
            <p className="text-sm font-semibold text-[#203337]">{offer.redemptions} redemptions</p>
          </Panel>
        ))}
      </div>
      {onCreate ? (
        <Panel>
          <h2 className="font-heading text-xl text-[#203337]">New offer</h2>
          <p className="mt-1 text-sm text-[#5F7074]">It stays in review until an admin approves it. Blocked categories need age 18 or over.</p>
          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void onCreate({ title, discount, terms, category, ageMin, codeType })
                .then(() => setNote('Sent for review.'))
                .catch((reason: unknown) => setNote(reason instanceof Error ? reason.message : 'Could not send the offer.'));
            }}
          >
            <input className="rounded-2xl border border-[#E7EDED] px-3 py-2 text-sm text-[#203337]" placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} required />
            <input className="rounded-2xl border border-[#E7EDED] px-3 py-2 text-sm text-[#203337]" placeholder="Discount" value={discount} onChange={(event) => setDiscount(event.target.value)} required />
            <textarea className="rounded-2xl border border-[#E7EDED] px-3 py-2 text-sm text-[#203337]" placeholder="Terms" value={terms} onChange={(event) => setTerms(event.target.value)} required />
            <div className="flex flex-wrap gap-2">
              <select className="rounded-2xl border border-[#E7EDED] px-3 py-2 text-sm text-[#203337]" value={category} onChange={(event) => setCategory(event.target.value)}>
                {PERK_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
              <select className="rounded-2xl border border-[#E7EDED] px-3 py-2 text-sm text-[#203337]" value={codeType} onChange={(event) => setCodeType(event.target.value)}>
                <option value="scan">Scan</option>
                <option value="unique">Unique code</option>
                <option value="static">Static code</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-[#203337]">
                Age minimum
                <input className="w-16 rounded-2xl border border-[#E7EDED] px-2 py-2" type="number" min={0} max={99} value={ageMin} onChange={(event) => setAgeMin(Number(event.target.value))} />
              </label>
            </div>
            <button type="submit" className="w-fit rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-4 py-2 text-sm font-semibold text-[#203337]">
              Send for review
            </button>
          </form>
          {note ? <p className="mt-3 text-sm text-[#203337]">{note}</p> : null}
        </Panel>
      ) : null}
    </DashPage>
  );
}
