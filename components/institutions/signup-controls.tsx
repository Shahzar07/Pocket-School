'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { authedFetch } from '@/lib/api-client';
import { defaultApprovalSettings, type ApprovalSettings } from '@/lib/institution-self-serve';

interface ActivationRow {
  id: string;
  name: string;
  at: string;
  seats: number;
  total: number;
  currency: string;
  tender: string;
  trial: boolean;
}

export function SignupControls() {
  const [settings, setSettings] = useState<ApprovalSettings>(defaultApprovalSettings());
  const [feed, setFeed] = useState<ActivationRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    authedFetch('/api/institutions/approval-settings')
      .then((data) => {
        if (data.settings && typeof data.settings === 'object') setSettings(data.settings as ApprovalSettings);
        if (Array.isArray(data.feed)) setFeed(data.feed as ActivationRow[]);
      })
      .catch(() => undefined);
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      const data = await authedFetch('/api/institutions/approval-settings', {
        method: 'POST',
        body: JSON.stringify(settings),
      });
      if (data.settings && typeof data.settings === 'object') setSettings(data.settings as ApprovalSettings);
      toast.success('Institution approval mode saved.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save approval settings.');
    } finally {
      setBusy(false);
    }
  };

  const hold = (key: 'holdInvoice' | 'holdCustomDomain' | 'holdCobrand' | 'holdMarketplace' | 'holdFreeEmail', label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={settings[key]}
        onChange={(event) => setSettings({ ...settings, [key]: event.target.checked })}
      />
      {label}
    </label>
  );

  return (
    <section className="mb-8 rounded-3xl border border-border bg-card p-5">
      <h2 className="font-heading text-2xl">Institution approval mode</h2>
      <p className="mt-1 text-sm text-muted-foreground">Auto opens the academy when payment succeeds. Manual and the review rules keep it pending until you approve it. Suspend, refund, and edit stay on each academy.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Mode
          <select className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3" value={settings.mode} onChange={(event) => setSettings({ ...settings, mode: event.target.value as ApprovalSettings['mode'] })}>
            <option value="auto">Auto</option>
            <option value="manual">Manual</option>
            <option value="auto_review">Auto with review rules</option>
          </select>
        </label>
        <label className="text-sm">Free trial days
          <input className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3" type="number" min={1} max={90} value={settings.trialDays} onChange={(event) => setSettings({ ...settings, trialDays: Number(event.target.value) })} />
        </label>
        <label className="text-sm">Trial seat cap
          <input className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3" type="number" min={1} max={500} value={settings.trialSeatCap} onChange={(event) => setSettings({ ...settings, trialSeatCap: Number(event.target.value) })} />
        </label>
        <label className="text-sm">Free-email review above this many seats
          <input className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3" type="number" min={0} max={500} value={settings.freeEmailSeatLimit} onChange={(event) => setSettings({ ...settings, freeEmailSeatLimit: Number(event.target.value) })} />
        </label>
      </div>
      <div className="mt-4 space-y-2">
        {hold('holdInvoice', 'Hold invoice and purchase-order payments')}
        {hold('holdCustomDomain', 'Hold custom domain requests')}
        {hold('holdCobrand', 'Hold co-branded certificates')}
        {hold('holdMarketplace', 'Hold marketplace course publishing')}
        {hold('holdFreeEmail', 'Hold free-email domains above the seat limit')}
      </div>
      <button type="button" className="mt-4 h-11 rounded-full bg-[#203337] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} onClick={() => void save()}>
        {busy ? 'Saving…' : 'Save approval mode'}
      </button>
      <h3 className="mt-6 text-sm font-semibold">Auto-activated institutions</h3>
      {feed.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">None yet.</p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm">
          {feed.map((row) => (
            <li key={row.id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2">
              <span className="font-medium">{row.name || 'Academy'}</span>
              <span className="text-muted-foreground">{row.trial ? 'Trial' : row.tender} · {row.seats} seats · {row.currency} {row.total.toFixed(2)} · {row.at.slice(0, 10)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
