'use client';

import { useMemo, useState } from 'react';
import { CheckoutPanel } from '@/components/payments/checkout-panel';
import { DashHeader, DashPage, DataTable, Panel, PanelHeader, StatCard } from '@/components/dash-ui';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { formatMoney } from '@/lib/money';
import { fixedPriceItem, subscriptionItem } from '@/lib/payments/catalog';
import { summariseFinance } from '@/lib/payments/finance';
import { methodsFor } from '@/lib/payments/methods';
import { buildQuote } from '@/lib/payments/quote';
import { readsBookItem, readsPlanItem } from '@/lib/payments/reads';
import { SECRET_SLOTS, describeSecret } from '@/lib/payments/secrets';
import { DEFAULT_TAX } from '@/lib/payments/tax';
import { Landmark, Plug, Wallet } from 'lucide-react';

type Scene = 'usd' | 'myr' | 'reads' | 'payments' | 'integrations' | 'finance';

export default function PaymentsPreviewPage() {
  const [scene, setScene] = useState<Scene>('usd');
  const [country, setCountry] = useState('MY');
  const [method, setMethod] = useState('card');

  const quote = useMemo(() => {
    if (scene === 'myr') {
      const item = readsBookItem('harbour-light', 'MYR') ?? fixedPriceItem({
        kind: 'book', sku: 'harbour-light', title: 'The Harbour Light', amount: 24, currency: 'MYR',
      });
      return buildQuote({ item: item!, country, tax: DEFAULT_TAX });
    }
    if (scene === 'reads') {
      const item = readsPlanItem('reads-family', 'month');
      return buildQuote({ item: item!, country, tax: DEFAULT_TAX });
    }
    const item = subscriptionItem('igcse_alevel', 'month');
    return buildQuote({ item: item!, seats: 2, country, tax: DEFAULT_TAX });
  }, [scene, country]);

  const methods = methodsFor({ country, currency: quote?.currency ?? 'USD' }).map((item) => ({
    id: item.id, label: item.label, blurb: item.blurb,
  }));
  const selected = methods.some((item) => item.id === method) ? method : methods[0]?.id ?? 'card';
  const missing = SECRET_SLOTS.map((slot) => describeSecret(slot, undefined, null)).filter((slot) => slot.required && slot.state === 'missing');
  const finance = summariseFinance([
    { status: 'active', monthlyRecurring: 79 },
    { status: 'active', monthlyRecurring: 9 },
  ]);

  return (
    <DashPage className="px-4 pt-8">
      <DashHeader
        eyebrow="Poket School"
        title="Payments"
        accent="preview"
        description="Sandbox fixtures. No keys are stored on this page, and Malaysian wallets appear only on a ringgit charge."
      />
      <div className="flex flex-wrap gap-2">
        {([
          ['usd', 'Family plan · USD'],
          ['myr', 'Book · Touch ’n Go'],
          ['reads', 'Reads Family'],
          ['payments', 'Payments console'],
          ['integrations', 'Integrations'],
          ['finance', 'Finance'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => { setScene(id); setMethod('card'); }}
            className={`h-9 px-3 rounded-full text-xs font-semibold ${scene === id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {(scene === 'usd' || scene === 'myr' || scene === 'reads') && quote && (
        <CheckoutPanel
          quote={quote}
          methods={methods}
          method={selected}
          onMethod={setMethod}
          country={country}
          onCountry={setCountry}
          coupon=""
          onCoupon={() => undefined}
          showSeats={scene === 'usd'}
          seats={2}
          onSeats={() => undefined}
          notice={scene === 'myr'
            ? 'Touch ’n Go, Boost, ShopeePay and DuitNow QR open the Malaysian gateway. FPX and GrabPay stay on Stripe.'
            : 'Subscriptions stay in US dollars. Apple Pay and Google Pay ride on the card.'}
          payLabel={selected === 'tng' ? 'Pay with Touch ’n Go' : 'Pay now'}
        />
      )}

      {scene === 'payments' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <StatCard icon={Landmark} label="Stripe" value="Sandbox" badge="No key" index={0} />
          <StatCard icon={Wallet} label="Gateway" value="Billplz" badge="Mock" index={1} />
          <StatCard icon={Plug} label="Webhooks" value="Waiting" index={2} />
          <Panel className="lg:col-span-3">
            <PanelHeader title="Methods by country" />
            <p className="text-sm">Malaysia · USD: {methodsFor({ country: 'MY', currency: 'USD' }).map((item) => item.label).join(', ')}</p>
            <p className="text-sm mt-2">Malaysia · MYR: {methodsFor({ country: 'MY', currency: 'MYR' }).map((item) => item.label).join(', ')}</p>
            <p className="text-sm mt-2 text-muted-foreground">SST 8% when the buyer is in Malaysia. Supplier TIN is entered here, not as an API secret.</p>
          </Panel>
        </div>
      )}

      {scene === 'integrations' && (
        <Panel>
          <PanelHeader title="Keys Harry still needs to add" meta={<span className="text-xs text-muted-foreground">{missing.length} required</span>} />
          <DataTable minWidth={640} head={<><th className="py-2 pr-4">Key</th><th className="py-2 pr-4">State</th><th className="py-2">Why</th></>}>
            {missing.map((slot) => (
              <tr key={slot.id}>
                <td className="py-3 pr-4 font-mono text-xs">{slot.envVar}</td>
                <td className="py-3 pr-4 text-sm">Missing</td>
                <td className="py-3 text-sm text-muted-foreground">{slot.why}</td>
              </tr>
            ))}
          </DataTable>
          <p className="text-xs text-muted-foreground mt-4">
            Flags off by default: {FEATURE_FLAGS.filter((flag) => !flag.defaultEnabled).map((flag) => flag.label).join(', ')}.
          </p>
        </Panel>
      )}

      {scene === 'finance' && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon={Landmark} label="MRR" value={formatMoney(finance.mrr)} index={0} />
          <StatCard icon={Landmark} label="ARR" value={formatMoney(finance.arr)} index={1} />
          <StatCard icon={Landmark} label="ARPU" value={formatMoney(finance.arpu)} badge={`${finance.activeSubscribers} active`} index={2} />
        </div>
      )}
    </DashPage>
  );
}
