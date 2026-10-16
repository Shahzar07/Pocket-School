'use client';

import { useEffect, useState } from 'react';
import { DashHeader, DashPage, Panel, StatCard } from '@/components/dash-ui';
import { authedFetch, ApiError } from '@/lib/api-client';
import { isSuperAdmin } from '@/lib/roles';
import { useAuthSTORE } from '@/hooks/use-auth';
import Link from 'next/link';
import { Landmark } from 'lucide-react';
import { PAYMENT_PROVIDERS } from '@/lib/payment-providers';

interface SecretRow { id: string; label: string; envVar: string; state: string; masked: string | null; why: string }

export default function PaymentsAdminPage() {
  const { profile } = useAuthSTORE();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [notice, setNotice] = useState('');

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

  return (
    <DashPage>
      <DashHeader eyebrow="Super admin" title="Payments" description="Which checkouts are on. API keys are saved only in Integrations." />
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
        <h2 className="text-[15px] font-semibold">Providers</h2>
        <p className="text-sm text-muted-foreground">Stripe, Billplz, iPay88, RMS, PayPal, and Xendit. A super admin sets each key in <Link href="/dashboard/admin/integrations" className="text-primary font-semibold">Integrations</Link>. This page does not store a second copy.</p>
        <ul className="grid sm:grid-cols-2 gap-2">
          {PAYMENT_PROVIDERS.map((provider) => (
            <li key={provider.id} className="rounded-xl border border-border px-3 py-2 text-sm">
              <span className="font-semibold">{provider.name}</span>
              <span className="block text-xs text-muted-foreground">{provider.region}</span>
            </li>
          ))}
        </ul>
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
