'use client';

import { useEffect, useState } from 'react';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { ApiError, authedFetch } from '@/lib/api-client';
import Link from 'next/link';
import { isSuperAdmin } from '@/lib/roles';
import { PAYMENT_PROVIDERS } from '@/lib/payment-providers';
import { useAuthSTORE } from '@/hooks/use-auth';

interface SecretRow { id: string; label: string; envVar: string; state: string; masked: string | null; group: string; required: boolean }

export default function IntegrationsPage() {
  const { profile } = useAuthSTORE();
  const [rows, setRows] = useState<SecretRow[]>([]);
  const [caps, setCaps] = useState<Record<string, number | null>>({});
  const [notice, setNotice] = useState('');
  const [cap, setCap] = useState('');

  const load = () => {
    authedFetch('/api/payments/admin-integrations').then((data) => {
      setRows(Array.isArray(data.secrets) ? data.secrets as SecretRow[] : []);
      setCaps((data.caps as Record<string, number | null>) ?? {});
    }).catch((error: unknown) => setNotice(error instanceof ApiError ? error.message : 'Integrations are unavailable.'));
  };
  useEffect(() => { if (isSuperAdmin(profile)) load(); }, [profile]);

  if (!isSuperAdmin(profile)) {
    return <DashPage><DashHeader title="Integrations" description="This console is for a Poket School super admin." /></DashPage>;
  }

  const missing = rows.filter((row) => row.required && row.state === 'missing');
  const test = async (slotId: string) => {
    const data = await authedFetch('/api/payments/admin-integrations', {
      method: 'POST',
      body: JSON.stringify({ action: 'test', slot: slotId }),
    });
    setNotice(typeof data.message === 'string' ? data.message : 'Test finished.');
  };

  return (
    <DashPage>
      <DashHeader eyebrow="Super admin" title="Integrations" description="The only place API keys are saved. Values stay masked. Payments does not keep a second copy." />
      <Panel>
        <h2 className="text-[15px] font-semibold mb-2">Payment providers</h2>
        <ul className="grid sm:grid-cols-3 gap-2 text-sm">
          {PAYMENT_PROVIDERS.map((provider) => <li key={provider.id}>{provider.name}</li>)}
        </ul>
        <p className="text-xs text-muted-foreground mt-2">Turn methods on from <Link href="/dashboard/admin/payments" className="text-primary font-semibold">Payments</Link>. Paste keys only here.</p>
      </Panel>
      {notice && <p className="text-sm">{notice}</p>}
      <Panel>
        <h2 className="text-[15px] font-semibold mb-2">Missing required keys</h2>
        {missing.length === 0 && <p className="text-sm text-muted-foreground">Every required key is present.</p>}
        <ul className="space-y-2">
          {missing.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="font-mono text-xs">{row.envVar}</span>
              <button type="button" className="h-8 px-3 rounded-full border border-border text-xs font-semibold" onClick={() => void test(row.id)}>Test connection</button>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel className="space-y-3">
        <h2 className="text-[15px] font-semibold">OpenRouter spend cap</h2>
        <p className="text-sm text-muted-foreground">Spent about ${Number(caps.openrouterSpentUsd ?? 0).toFixed(2)}. Cap {caps.openrouterCapUsd == null ? 'not set' : `$${caps.openrouterCapUsd}`}.</p>
        <div className="flex gap-2">
          <input aria-label="Monthly cap in dollars" value={cap} onChange={(event) => setCap(event.target.value)} className="h-10 rounded-xl border border-border px-3 text-sm" placeholder="40" />
          <button
            type="button"
            className="h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-bold"
            onClick={() => void authedFetch('/api/payments/admin-integrations', {
              method: 'POST',
              body: JSON.stringify({ action: 'cap', provider: 'openrouter', monthlyUsd: Number(cap) }),
            }).then(load)}
          >
            Save cap
          </button>
        </div>
      </Panel>
    </DashPage>
  );
}
