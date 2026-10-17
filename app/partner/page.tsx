'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authedFetch } from '@/lib/api-client';
import { PERK_CATEGORIES } from '@/lib/student-id/model';

export default function PartnerOnboardingPage() {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [category, setCategory] = useState('food');
  const [country, setCountry] = useState('MY');
  const [note, setNote] = useState('');

  return (
    <main className="min-h-screen bg-[#F4F6F6] px-4 py-12 text-[#203337]">
      <form
        className="mx-auto max-w-lg space-y-4 rounded-[28px] bg-white p-6 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          void authedFetch('/api/partners', {
            method: 'POST',
            body: JSON.stringify({ action: 'apply', name, contact, categories: [category], countries: [country], logo: '' }),
          }).then(() => setNote('Application sent. An admin reviews it before any offer can go live.'))
            .catch((reason: unknown) => setNote(reason instanceof Error ? reason.message : 'Sign in, then send the application.'));
        }}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#1E6A83]">Poket School</p>
        <h1 className="font-heading text-4xl">Partner with student perks</h1>
        <p className="text-sm text-[#5F7074]">The student card is free. This merchant role is separate from safety partners and cannot publish Amber alerts.</p>
        <input className="w-full rounded-2xl border border-[#E7EDED] px-3 py-2 text-sm" placeholder="Business name" value={name} onChange={(event) => setName(event.target.value)} required />
        <input className="w-full rounded-2xl border border-[#E7EDED] px-3 py-2 text-sm" placeholder="Contact email" value={contact} onChange={(event) => setContact(event.target.value)} required />
        <div className="flex gap-2">
          <select className="flex-1 rounded-2xl border border-[#E7EDED] px-3 py-2 text-sm" value={category} onChange={(event) => setCategory(event.target.value)}>
            {PERK_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <input className="w-24 rounded-2xl border border-[#E7EDED] px-3 py-2 text-sm" value={country} onChange={(event) => setCountry(event.target.value)} aria-label="Country" />
        </div>
        <button type="submit" className="rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-5 py-3 text-sm font-semibold text-[#203337]">
          Apply
        </button>
        {note ? <p className="text-sm">{note}</p> : null}
        <p className="text-sm"><Link className="text-[#1E6A83]" href="/login">Sign in</Link> if the application asks you to.</p>
      </form>
    </main>
  );
}
