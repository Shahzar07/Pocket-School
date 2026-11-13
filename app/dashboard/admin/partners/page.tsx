'use client';

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/api-client';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';

interface PartnerRow {
  id: string;
  name: string;
  logo: string;
  category: string;
  contact: string;
  status: string;
  ageMin: number;
  offersNote: string;
}

interface OfferRow { id: string; title: string; ageMin: number; category: string; status: string }

const fieldClass = 'mt-1 min-h-11 w-full rounded-xl border border-[#D5E6EA] bg-white px-3 text-sm text-[#11131b]';
const emptyPartner = { id: '', name: '', logo: '', category: 'study', contact: '', status: 'pending', ageMin: 0, offersNote: '' };

export default function PartnerReviewPage() {
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [own, setOwn] = useState(false);
  const [form, setForm] = useState(emptyPartner);
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);

  const load = () => authedFetch('/api/partners?desk=1').then((data) => {
    setPartners(Array.isArray(data.partners) ? data.partners as PartnerRow[] : []);
    setOffers(Array.isArray(data.offers) ? data.offers as OfferRow[] : []);
    setOwn(data.own === true);
  });

  useEffect(() => {
    load().catch((reason: unknown) => setNote(reason instanceof Error ? reason.message : 'The partner desk could not be loaded.'));
  }, []);

  const act = (action: string, id: string) => {
    void authedFetch('/api/partners', { method: 'POST', body: JSON.stringify({ action, id }) })
      .then(() => load())
      .then(() => setNote('Saved.'))
      .catch((reason: unknown) => setNote(reason instanceof Error ? reason.message : 'Could not update that record.'));
  };

  const save = async () => {
    try {
      const data = await authedFetch('/api/partners', { method: 'POST', body: JSON.stringify({ action: 'save', ...form, ageMin: Number(form.ageMin) }) });
      if (data.comingSoon) {
        setNote('The partner desk is coming soon.');
        return;
      }
      setOpen(false);
      setForm(emptyPartner);
      setNote('Partner saved.');
      await load();
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Could not save that partner.');
    }
  };

  const edit = (partner: PartnerRow) => {
    setForm(partner);
    setOpen(true);
  };

  return (
    <DashPage>
      <DashHeader
        eyebrow="Admin"
        title="Partner perks"
        description="Add a merchant, then approve, suspend, or archive them. Offers stay in review until a staff member approves them."
      />
      <Panel>
        <h2 className="font-heading text-xl text-[#11131b]">How this desk works</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-[#11131b]">
          <li>Add the merchant with a name, logo, category, offers, age limit, and contact.</li>
          <li>Approve them when the offer is safe. Under-18 offers cannot use alcohol, vape, tobacco, gambling, or adult categories.</li>
          <li>Suspend a live merchant to stop new redemptions, or archive them when the partnership ends.</li>
          <li>A partner login can edit only their own record. They cannot approve themselves.</li>
        </ol>
        {!own ? (
          <button type="button" className="mt-4 rounded-full border border-[#096ab7] bg-[#d9efff] px-4 py-2 text-sm font-semibold text-[#11131b]" onClick={() => { setForm(emptyPartner); setOpen(true); }}>Add partner</button>
        ) : (
          <button type="button" className="mt-4 rounded-full border border-[#096ab7] bg-[#d9efff] px-4 py-2 text-sm font-semibold text-[#11131b]" onClick={() => partners[0] && edit(partners[0])}>Update your record</button>
        )}
      </Panel>
      {open ? (
        <Panel>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void save(); }}>
            <label className="text-sm text-[#11131b]">Name
              <input required className={fieldClass} aria-label="Partner name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label className="text-sm text-[#11131b]">Contact
              <input required className={fieldClass} aria-label="Partner contact" value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} />
            </label>
            <label className="text-sm text-[#11131b]">Logo URL
              <input className={fieldClass} aria-label="Partner logo" placeholder="https://" value={form.logo} onChange={(event) => setForm({ ...form, logo: event.target.value })} />
            </label>
            <label className="text-sm text-[#11131b]">Category
              <input className={fieldClass} aria-label="Partner category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
            </label>
            <label className="text-sm text-[#11131b] sm:col-span-2">Offers
              <textarea className={fieldClass} aria-label="Partner offers" rows={3} value={form.offersNote} onChange={(event) => setForm({ ...form, offersNote: event.target.value })} />
            </label>
            <label className="text-sm text-[#11131b]">Age restriction
              <input className={fieldClass} aria-label="Age restriction" type="number" min={0} value={form.ageMin} onChange={(event) => setForm({ ...form, ageMin: Number(event.target.value) })} />
            </label>
            {own ? null : (
              <label className="text-sm text-[#11131b]">Status
                <select aria-label="Partner status" className={fieldClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="suspended">Suspended</option>
                  <option value="archived">Archived</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
            )}
            <div className="flex gap-2 sm:col-span-2">
              <button type="button" className="rounded-full border border-[#D5E6EA] px-4 py-2 text-sm" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="rounded-full border border-[#096ab7] bg-[#d9efff] px-4 py-2 text-sm font-semibold text-[#11131b]">Save partner</button>
            </div>
          </form>
        </Panel>
      ) : null}
      <Panel>
        <h2 className="font-heading text-xl text-[#11131b]">{own ? 'Your merchant record' : 'Merchants'}</h2>
        <ul className="mt-3 space-y-3">
          {partners.map((partner) => (
            <li key={partner.id} className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#11131b]">
              <span>
                {partner.logo ? <img src={partner.logo} alt="" className="mr-2 inline h-8 w-8 rounded-full object-cover" /> : null}
                {partner.name} · {partner.contact} · {partner.category} · {partner.status}
              </span>
              <span className="flex flex-wrap gap-2">
                <button type="button" className="rounded-full border border-[#096ab7] px-3 py-1.5 text-xs font-semibold text-[#096ab7]" onClick={() => edit(partner)}>Edit</button>
                {own ? null : (
                  <>
                    <button type="button" className="rounded-full border border-[#096ab7] bg-[#d9efff] px-3 py-1.5 text-xs font-semibold text-[#11131b]" onClick={() => act('approve-partner', partner.id)}>Approve</button>
                    <button type="button" className="rounded-full border border-[#e5ebf2] px-3 py-1.5 text-xs font-semibold text-[#096ab7]" onClick={() => act('suspend-partner', partner.id)}>Suspend</button>
                    <button type="button" className="rounded-full border border-[#e5ebf2] px-3 py-1.5 text-xs font-semibold text-[#096ab7]" onClick={() => act('archive-partner', partner.id)}>Archive</button>
                  </>
                )}
              </span>
            </li>
          ))}
          {partners.length === 0 ? <li className="text-sm text-[#626976]">No merchants yet. Add one to start the review.</li> : null}
        </ul>
      </Panel>
      {own ? null : (
        <Panel>
          <h2 className="font-heading text-xl text-[#11131b]">Offers</h2>
          <ul className="mt-3 space-y-3">
            {offers.map((offer) => (
              <li key={offer.id} className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#11131b]">
                <span>{offer.title} · {offer.category} · age {offer.ageMin} · {offer.status}</span>
                <span className="flex gap-2">
                  <button type="button" className="rounded-full border border-[#096ab7] bg-[#d9efff] px-3 py-1.5 text-xs font-semibold text-[#11131b]" onClick={() => act('approve-offer', offer.id)}>Approve</button>
                  <button type="button" className="rounded-full border border-[#e5ebf2] px-3 py-1.5 text-xs font-semibold text-[#096ab7]" onClick={() => act('reject-offer', offer.id)}>Reject</button>
                </span>
              </li>
            ))}
            {offers.length === 0 ? <li className="text-sm text-[#626976]">No offers yet.</li> : null}
          </ul>
        </Panel>
      )}
      {note ? <p className="text-sm text-[#11131b]">{note}</p> : null}
    </DashPage>
  );
}
