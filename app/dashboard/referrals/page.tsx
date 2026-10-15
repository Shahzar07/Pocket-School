'use client';

import { useEffect, useState } from 'react';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { authedFetch } from '@/lib/api-client';
import { useAuthSTORE } from '@/hooks/use-auth';
import { formatMoney } from '@/lib/money';

export default function ReferralsPage() {
  const { profile } = useAuthSTORE();
  const [code, setCode] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [total, setTotal] = useState(0);
  const [share, setShare] = useState(10);
  const [notice, setNotice] = useState('');

  const load = () => {
    authedFetch('/api/payments/referral').then((data) => {
      setEnabled(data.enabled !== false);
      setCode(typeof data.code === 'string' ? data.code : null);
      setTotal(Number(data.total ?? 0));
      setShare(Number(data.shareBps ?? 1000) / 100);
    }).catch(() => setNotice('Referrals could not be loaded.'));
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    const data = await authedFetch('/api/payments/referral', {
      method: 'POST',
      body: JSON.stringify({ create: true, name: profile?.name ?? 'Poket' }),
    });
    setCode(typeof data.code === 'string' ? data.code : null);
    setNotice(typeof data.code === 'string' ? 'Your code is ready to share.' : 'Referrals are switched off.');
  };

  return (
    <DashPage>
      <DashHeader eyebrow="Referrals" title="Share Poket School" description="A friend gets a discount. You earn a share of the pre-tax amount." />
      <Panel className="space-y-3">
        {!enabled && <p className="text-sm text-muted-foreground">Referral codes are switched off.</p>}
        {enabled && code && <p className="font-mono text-2xl font-semibold">{code}</p>}
        {enabled && !code && (
          <button type="button" onClick={() => void create()} className="h-11 px-5 rounded-full bg-primary text-primary-foreground text-sm font-bold">
            Create my code
          </button>
        )}
        <p className="text-sm text-muted-foreground">Commission {share}% · earned {formatMoney(total)}</p>
        {notice && <p className="text-sm">{notice}</p>}
      </Panel>
    </DashPage>
  );
}
