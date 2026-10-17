'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Phone } from 'lucide-react';
import { SEEDED_EMERGENCY_NUMBERS, mapsSearchUrl, numbersFor, type EmergencyNumbers } from '@/lib/emergency-numbers/catalog';
import { readGeoCountry } from '@/lib/countries';

function tel(number: string): string {
  return `tel:${number.replace(/[^\d+]/g, '')}`;
}

function openMaps(query: 'police station' | 'hospital') {
  const go = (location?: { lat: number; lng: number } | null) => {
    window.open(mapsSearchUrl(query, location), '_blank', 'noopener,noreferrer');
  };
  if (!navigator.geolocation) {
    go(null);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    position => go({ lat: position.coords.latitude, lng: position.coords.longitude }),
    () => go(null),
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
  );
}

export function HelpNearMe({ rows = SEEDED_EMERGENCY_NUMBERS }: { rows?: readonly EmergencyNumbers[] }) {
  const initial = useMemo(() => readGeoCountry() || 'MY', []);
  const [country, setCountry] = useState(initial);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [note, setNote] = useState('');
  const numbers = numbersFor(country, rows);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/safety-desk/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, description, type: 'unsafe_other' }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) {
      setNote('Sign in to send this to the Safety Desk.');
      return;
    }
    setNote(typeof body.error === 'string' ? body.error : 'Sent to the Poket School Safety Desk.');
  }

  return (
    <main className="mx-auto grid max-w-xl gap-4 px-4 py-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Poket School</p>
      <h1 className="font-heading text-4xl tracking-tight">Get help near me</h1>
      <p className="text-sm text-muted-foreground">These numbers are stored on this page so they still open when you are offline. Maps opens only after you allow location.</p>
      <label className="grid gap-1 text-sm font-semibold">Country
        <select className="min-h-12 rounded-xl border border-border bg-card px-3 font-normal" value={country} onChange={event => setCountry(event.target.value)} aria-label="Country">
          {rows.map(row => <option key={row.countryCode} value={row.countryCode}>{row.countryName}</option>)}
        </select>
      </label>
      {!numbers ? <p className="text-sm font-semibold">No checked numbers for this country yet.</p> : (
        <section className="grid gap-2 rounded-[24px] border border-border bg-card p-4" aria-label="Emergency numbers">
          {numbers.needsReview ? <p className="text-sm font-semibold">These numbers still need a review.</p> : null}
          {[
            ['Police', numbers.police],
            ['Ambulance', numbers.ambulance],
            ['Fire', numbers.fire],
            ['Emergency', numbers.general],
            [numbers.childHelplineName || 'Child helpline', numbers.childHelpline],
            [numbers.mentalHealthName || 'Mental health', numbers.mentalHealth],
          ].filter(([, number]) => number).map(([label, number]) => (
            <a key={label} className="flex min-h-12 items-center justify-between rounded-xl bg-foreground px-4 font-bold text-background" href={tel(number)}>
              <span className="inline-flex items-center gap-2"><Phone size={20} aria-hidden="true" />{label}</span>
              <span>{number}</span>
            </a>
          ))}
          {numbers.childAlertName && numbers.childAlertUrl ? (
            <a className="min-h-12 inline-flex items-center font-semibold text-primary" href={numbers.childAlertUrl}>{numbers.childAlertName}</a>
          ) : null}
          <p className="text-xs text-muted-foreground">Checked {numbers.lastVerified}. Source on file.</p>
        </section>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" className="min-h-12 rounded-xl border border-border bg-card font-bold" onClick={() => openMaps('police station')}>Nearest police station</button>
        <button type="button" className="min-h-12 rounded-xl border border-border bg-card font-bold" onClick={() => openMaps('hospital')}>Nearest hospital</button>
      </div>
      <form className="grid gap-3 rounded-[24px] border border-border bg-card p-4" onSubmit={event => void submit(event)}>
        <h2 className="font-heading text-xl">Tell the Safety Desk</h2>
        <p className="text-sm text-muted-foreground">People without a school cannot publish an alert. This goes to the desk only.</p>
        <label className="grid gap-1 text-sm font-semibold">Title
          <input className="min-h-12 rounded-xl border border-border px-3 font-normal" value={title} onChange={event => setTitle(event.target.value)} aria-label="Desk title" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">What happened
          <textarea className="min-h-24 rounded-xl border border-border px-3 py-2 font-normal" value={description} onChange={event => setDescription(event.target.value)} aria-label="What happened" />
        </label>
        <button type="submit" className="min-h-12 rounded-xl bg-primary font-bold text-primary-foreground">Send to the Safety Desk</button>
      </form>
      {note ? <p className="text-sm font-semibold">{note}</p> : null}
    </main>
  );
}
