'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CountrySelect } from '@/components/country-select';
import { auth } from '@/lib/firebase';
import { authedFetch } from '@/lib/api-client';
import { AMBER_JOIN_CTA, amberJoinPath } from '@/lib/amber/public';
import { BRAND } from '@/lib/brand';
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
    <section className="grid gap-3 rounded-3xl border bg-white p-4" style={{ color: BRAND.ink, borderColor: '#D5E3E7' }}>
      <h2 className="text-xl font-semibold" style={{ color: BRAND.blueDeep }}>{AMBER_JOIN_CTA}</h2>
      <p className="text-sm" style={{ color: BRAND.ink }}>Free for every account, including people with no school.</p>
      <CountrySelect value={place} onChange={setPlace} label="Country or home country" />
      <label className="grid gap-1 text-sm font-semibold" style={{ color: BRAND.blueDeep }}>State or city
        <input className="h-12 rounded-xl border bg-white px-3 text-sm" style={{ color: BRAND.ink, borderColor: BRAND.blueDeep }} value={state} onChange={event => setState(event.target.value)} aria-label="State or city" />
      </label>
      <button type="button" disabled={busy} onClick={() => void join()} className="min-h-12 rounded-xl px-4 text-base font-bold" style={{ background: BRAND.cyan, color: BRAND.ink, border: `1px solid ${BRAND.blueDeep}` }}>
        {AMBER_JOIN_CTA}
      </button>
      {code ? <p className="text-sm">Referral code {code}</p> : null}
      {note ? <p className="text-sm">{note}</p> : null}
    </section>
  );
}
