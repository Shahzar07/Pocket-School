'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CountrySelect } from '@/components/country-select';
import { auth } from '@/lib/firebase';
import { authedFetch } from '@/lib/api-client';
import { AMBER_JOIN_CTA, amberJoinPath } from '@/lib/amber/public';
import { readGeoCountry } from '@/lib/countries';

export function AmberJoin({ code, country }: { code: string; country: string }) {
  const router = useRouter();
  const [place, setPlace] = useState(country || readGeoCountry());
  const [state, setState] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const join = async () => {
    setBusy(true);
    setNote('');
    const href = amberJoinPath(code, place);
    try {
      if (!auth.currentUser) {
        router.push(href);
        return;
      }
      await authedFetch('/api/amber/opt-in', {
        method: 'POST',
        body: JSON.stringify({ country: place, state, referral: code, optIn: true }),
      });
      setNote('You will get free Amber alerts for that country.');
    } catch {
      router.push(href);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="grid gap-3 rounded-3xl border border-white/15 bg-white/10 p-4 text-white">
      <h2 className="text-xl font-semibold">{AMBER_JOIN_CTA}</h2>
      <p className="text-sm text-white/80">Free for every account, including people with no school.</p>
      <CountrySelect value={place} onChange={setPlace} label="Country or home country" />
      <label className="grid gap-1 text-sm font-semibold">State or city
        <input className="h-12 rounded-xl border border-white/20 bg-white px-3 text-sm text-slate-900" value={state} onChange={event => setState(event.target.value)} aria-label="State or city" />
      </label>
      <button type="button" disabled={busy} onClick={() => void join()} className="min-h-12 rounded-xl px-4 text-base font-bold" style={{ background: '#3FE0D0', color: '#1E6A83' }}>
        {AMBER_JOIN_CTA}
      </button>
      {code ? <p className="text-sm">Referral code {code}</p> : null}
      {note ? <p className="text-sm">{note}</p> : null}
    </section>
  );
}
