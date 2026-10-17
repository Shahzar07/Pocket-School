'use client';

import { useState } from 'react';
import { DashHeader, DashPage } from '@/components/dash-ui';
import { SEEDED_EMERGENCY_NUMBERS, type EmergencyNumbers } from '@/lib/emergency-numbers/catalog';

export function EmergencyNumbersEditor({ sample = false }: { sample?: boolean }) {
  const [rows, setRows] = useState<EmergencyNumbers[]>([...SEEDED_EMERGENCY_NUMBERS]);
  const [note, setNote] = useState(sample ? 'Sample editor. Numbers stay on this page.' : '');

  function update(code: string, field: keyof EmergencyNumbers, value: string | boolean) {
    setRows(current => current.map(row => row.countryCode === code ? { ...row, [field]: value } : row));
  }

  async function save(row: EmergencyNumbers) {
    if (sample) {
      setNote('Saved on this sample editor.');
      return;
    }
    const response = await fetch('/api/emergency-numbers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(row),
    });
    const body = await response.json();
    setNote(typeof body.error === 'string' ? body.error : 'Emergency numbers saved.');
  }

  return (
    <DashPage>
      <DashHeader
        eyebrow="Poket School"
        title="Emergency numbers"
        description="Only numbers you can cite from an official page. Anything else stays marked for review."
      />
      {rows.map(row => (
        <form key={row.countryCode} className="grid gap-3 rounded-[24px] border border-border bg-card p-4" onSubmit={event => { event.preventDefault(); void save(row); }}>
          <h2 className="font-heading text-xl">{row.countryName}</h2>
          {row.needsReview ? <p className="text-sm font-semibold">Needs review</p> : <p className="text-sm text-muted-foreground">Checked {row.lastVerified}</p>}
          <label className="grid gap-1 text-sm font-semibold">Police
            <input className="min-h-12 rounded-xl border border-border px-3 font-normal" value={row.police} onChange={event => update(row.countryCode, 'police', event.target.value)} aria-label={`${row.countryName} police`} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">Ambulance
            <input className="min-h-12 rounded-xl border border-border px-3 font-normal" value={row.ambulance} onChange={event => update(row.countryCode, 'ambulance', event.target.value)} aria-label={`${row.countryName} ambulance`} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">Fire
            <input className="min-h-12 rounded-xl border border-border px-3 font-normal" value={row.fire} onChange={event => update(row.countryCode, 'fire', event.target.value)} aria-label={`${row.countryName} fire`} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">General emergency
            <input className="min-h-12 rounded-xl border border-border px-3 font-normal" value={row.general} onChange={event => update(row.countryCode, 'general', event.target.value)} aria-label={`${row.countryName} general emergency`} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">Child helpline
            <input className="min-h-12 rounded-xl border border-border px-3 font-normal" value={row.childHelpline} onChange={event => update(row.countryCode, 'childHelpline', event.target.value)} aria-label={`${row.countryName} child helpline`} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">Mental health helpline
            <input className="min-h-12 rounded-xl border border-border px-3 font-normal" value={row.mentalHealth} onChange={event => update(row.countryCode, 'mentalHealth', event.target.value)} aria-label={`${row.countryName} mental health`} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">Official child-alert name
            <input className="min-h-12 rounded-xl border border-border px-3 font-normal" value={row.childAlertName} onChange={event => update(row.countryCode, 'childAlertName', event.target.value)} aria-label={`${row.countryName} child alert`} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">Source URL
            <input className="min-h-12 rounded-xl border border-border px-3 font-normal" value={row.sourceUrl} onChange={event => update(row.countryCode, 'sourceUrl', event.target.value)} aria-label={`${row.countryName} source`} />
          </label>
          <label className="min-h-12 flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={row.needsReview} onChange={event => update(row.countryCode, 'needsReview', event.target.checked)} />
            Needs review
          </label>
          <button type="submit" className="min-h-12 rounded-xl bg-foreground font-bold text-background">Save {row.countryName}</button>
        </form>
      ))}
      {note ? <p className="text-sm font-semibold">{note}</p> : null}
    </DashPage>
  );
}
