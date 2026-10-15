'use client';

import { useEffect, useState } from 'react';
import { DashHeader, DashPage, Panel, StatCard } from '@/components/dash-ui';
import { authedFetch, ApiError } from '@/lib/api-client';
import { isSuperAdmin } from '@/lib/roles';
import { useAuthSTORE } from '@/hooks/use-auth';
import { Landmark } from 'lucide-react';

interface SecretRow { id: string; label: string; envVar: string; state: string; masked: string | null; why: string }

export default function PaymentsAdminPage() {
  const { profile } = useAuthSTORE();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [notice, setNotice] = useState('');
  const [slot, setSlot] = useState('stripe_secret');
  const [secret, setSecret] = useState('');

  const load = () => {
    authedFetch('/api/payments/admin-payments').then(setData).catch((error: unknown) => {
      setNotice(error instanceof ApiError ? error.message : 'Payments console is unavailable.');
    });
  };
  useEffect(() => { if (isSuperAdmin(profile)) load(); }, [profile]);

  if (!isSuperAdmin(profile)) {
    return <DashPage><DashHeader title="Payments" description="This console is for a Poket School super admin." /></DashPage>;
  }

  const methods = data?.methods as { myMyr?: string[]; myUsd?: string[] } | undefined;
  const secrets = Array.isArray(data?.secrets) ? data.secrets as SecretRow[] : [];
  const save = async (body: Record<string, unknown>) => {
    await authedFetch('/api/payments/admin-payments', { method: 'POST', body: JSON.stringify(body) });
    setSecret('');
    load();
  };

  return (
    <DashPage>
      <DashHeader eyebrow="Super admin" title="Payments" description="Keys stay on the server. This page shows the masked value only." />
      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard icon={Landmark} label="Stripe" value={String(data?.stripeMode ?? '…')} index={0} />
        <StatCard icon={Landmark} label="Gateway" value={String(data?.gateway ?? 'billplz')} badge={String(data?.gatewayMode ?? '')} index={1} />
        <StatCard icon={Landmark} label="Webhook" value={String((data?.webhook as { ok?: boolean } | undefined)?.ok ? 'Healthy' : 'Waiting')} index={2} />
      </div>
      <Panel className="space-y-2 text-sm">
        <p>Malaysia · MYR: {(methods?.myMyr ?? []).join(', ') || '—'}</p>
        <p>Malaysia · USD: {(methods?.myUsd ?? []).join(', ') || '—'}</p>
        <p className="text-muted-foreground">Stripe {String((data?.endpoints as { stripe?: string } | undefined)?.stripe ?? '')} · Gateway {String((data?.endpoints as { gateway?: string } | undefined)?.gateway ?? '')}</p>
      </Panel>
      <Panel className="space-y-3">
        <h2 className="text-[15px] font-semibold">Store a key</h2>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Secret slot" value={slot} onChange={(event) => setSlot(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm">
            {secrets.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <input aria-label="Secret value" type="password" value={secret} onChange={(event) => setSecret(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm" placeholder="Paste the key" />
          <button type="button" className="h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-bold" onClick={() => void save({ action: 'secret', slot, value: secret })}>Save</button>
        </div>
        <ul className="space-y-2">
          {secrets.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 text-sm">
              <span>{item.label} <span className="text-muted-foreground font-mono text-xs">{item.envVar}</span></span>
              <span>{item.masked || item.state}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </DashPage>
  );
}
