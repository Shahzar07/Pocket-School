'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { useAuthSTORE } from '@/hooks/use-auth';
import { authedFetch } from '@/lib/api-client';
import { PAYER_NOTE } from '@/lib/billing-model';
import { formatMoney } from '@/lib/money';
import { WALLET_TOPUPS } from '@/lib/payments/catalog';

interface LedgerRow { id: string; amountMinor: number; currency: string }

export default function WalletPage() {
  const { profile } = useAuthSTORE();
  const [balances, setBalances] = useState({ USD: 0, MYR: 0 });
  const [ledger, setLedger] = useState<LedgerRow[]>([]);

  useEffect(() => {
    authedFetch('/api/payments/wallet').then((data) => {
      const next = data.balances as { USD?: number; MYR?: number } | undefined;
      setBalances({ USD: Number(next?.USD ?? 0), MYR: Number(next?.MYR ?? 0) });
      setLedger(Array.isArray(data.ledger) ? data.ledger as LedgerRow[] : []);
    }).catch(() => undefined);
  }, []);

  return (
    <DashPage>
      <DashHeader eyebrow="Wallet" title="Poket wallet" description="Cash top-ups and Sparks live in this one wallet. Sparks are the learning allowance, not a second product." />
      <div className="grid sm:grid-cols-3 gap-4">
        <Panel>
          <p className="text-sm text-muted-foreground">Sparks</p>
          <p className="text-3xl font-semibold mt-1">{profile?.sparksBalance ?? 0}</p>
        </Panel>
        <Panel>
          <p className="text-sm text-muted-foreground">US dollars</p>
          <p className="text-3xl font-semibold mt-1">{formatMoney(balances.USD, 'USD')}</p>
        </Panel>
        <Panel>
          <p className="text-sm text-muted-foreground">Malaysian ringgit</p>
          <p className="text-3xl font-semibold mt-1">{formatMoney(balances.MYR, 'MYR')}</p>
        </Panel>
      </div>
      <p className="text-sm text-muted-foreground">{PAYER_NOTE}</p>
      <Panel>
        <h2 className="text-[15px] font-semibold mb-3">Add funds</h2>
        <div className="flex flex-wrap gap-2">
          {WALLET_TOPUPS.map((amount) => (
            <Link key={`usd-${amount}`} href={`/dashboard/checkout?kind=wallet&sku=${amount}&currency=USD`} className="h-10 px-4 rounded-full border border-border text-sm font-semibold inline-flex items-center">
              {formatMoney(amount, 'USD')}
            </Link>
          ))}
          {WALLET_TOPUPS.map((amount) => (
            <Link key={`myr-${amount}`} href={`/dashboard/checkout?kind=wallet&sku=${amount}&currency=MYR`} className="h-10 px-4 rounded-full border border-border text-sm font-semibold inline-flex items-center">
              {formatMoney(amount, 'MYR')}
            </Link>
          ))}
        </div>
      </Panel>
      <Panel>
        <h2 className="text-[15px] font-semibold mb-3">Ledger</h2>
        {ledger.length === 0 && <p className="text-sm text-muted-foreground">No wallet movements yet.</p>}
        <ul className="space-y-2">
          {ledger.map((row) => (
            <li key={row.id} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{row.id}</span>
              <span>{formatMoney(row.amountMinor / 100, row.currency || 'USD')}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </DashPage>
  );
}
