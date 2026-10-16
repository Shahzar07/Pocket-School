'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CountrySelect } from '@/components/country-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { readGeoCountry } from '@/lib/countries';
import { INSTITUTION_TYPES, leadDraftError, type InstitutionType, type LeadDraft } from '@/lib/enterprise';
import { createDemoLead } from '@/lib/institution-store';

const EMPTY: LeadDraft = {
  name: '',
  email: '',
  organisation: '',
  country: '',
  type: 'school',
  seats: 30,
  message: '',
};

/** Public request that lands in the admin leads pipeline. */
export function DemoLeadForm() {
  const { i18n } = useTranslation();
  const [draft, setDraft] = useState<LeadDraft>(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const geo = readGeoCountry();
    if (!geo) return;
    setDraft((current) => (current.country ? current : { ...current, country: geo }));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const error = leadDraftError(draft);
    if (error) {
      toast.error(error);
      return;
    }
    setBusy(true);
    try {
      await createDemoLead(draft);
      toast.success('Request received. Someone from Poket School will be in touch.');
      setDraft({ ...EMPTY, country: draft.country });
    } catch {
      toast.error('Could not send that request. Email institutions@poketschool.ai.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">
        Name
        <Input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-1 h-11 rounded-xl" />
      </label>
      <label className="text-sm">
        Work email
        <Input required type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} className="mt-1 h-11 rounded-xl" />
      </label>
      <label className="text-sm">
        Organisation
        <Input required value={draft.organisation} onChange={(event) => setDraft({ ...draft, organisation: event.target.value })} className="mt-1 h-11 rounded-xl" />
      </label>
      <label className="text-sm">
        Type
        <select
          aria-label="Organisation type"
          value={draft.type}
          onChange={(event) => setDraft({ ...draft, type: event.target.value as InstitutionType })}
          className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 capitalize"
        >
          {INSTITUTION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
      </label>
      <CountrySelect label="Country" locale={i18n.language} value={draft.country} onChange={(country) => setDraft({ ...draft, country })} />
      <label className="text-sm">
        Seats
        <Input
          required
          type="number"
          min={1}
          max={100000}
          value={draft.seats}
          onChange={(event) => setDraft({ ...draft, seats: Number(event.target.value) })}
          className="mt-1 h-11 rounded-xl"
        />
      </label>
      <label className="text-sm sm:col-span-2">
        What should the walkthrough cover?
        <textarea
          value={draft.message}
          onChange={(event) => setDraft({ ...draft, message: event.target.value })}
          rows={3}
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" className="rounded-full" disabled={busy}>{busy ? 'Sending…' : 'Request a demo'}</Button>
      </div>
    </form>
  );
}
