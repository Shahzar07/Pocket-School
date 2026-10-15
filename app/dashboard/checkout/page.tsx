'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckoutPanel, type MethodChoice, type QuoteView } from '@/components/payments/checkout-panel';
import { DashHeader, DashPage } from '@/components/dash-ui';
import { ApiError, authedFetch } from '@/lib/api-client';

function CheckoutScreen() {
  const params = useSearchParams();
  const kind = params.get('kind') || 'subscription';
  const sku = params.get('sku') || '';
  const interval = params.get('interval') === 'year' ? 'year' : 'month';
  const currency = params.get('currency') || undefined;
  const sandboxId = params.get('sandbox') === '1' ? params.get('paid') : null;
  const [country, setCountry] = useState('MY');
  const [coupon, setCoupon] = useState('');
  const [seats, setSeats] = useState(1);
  const [method, setMethod] = useState('card');
  const [quote, setQuote] = useState<QuoteView | null>(null);
  const [methods, setMethods] = useState<MethodChoice[]>([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!sku) return;
    let cancel = false;
    authedFetch('/api/payments/quote', {
      method: 'POST',
      body: JSON.stringify({ kind, sku, country, coupon, seats, interval, currency }),
    }).then((data) => {
      if (cancel) return;
      const nextQuote = data.quote as QuoteView;
      const nextMethods = (data.methods as MethodChoice[]) ?? [];
      setQuote(nextQuote);
      setMethods(nextMethods);
      setMethod((current) => nextMethods.some((item) => item.id === current) ? current : nextMethods[0]?.id ?? 'card');
      setNotice('');
    }).catch((error: unknown) => {
      if (!cancel) setNotice(error instanceof ApiError ? error.message : 'The price could not be loaded.');
    });
    return () => { cancel = true; };
  }, [kind, sku, country, coupon, seats, interval, currency]);

  useEffect(() => {
    if (!sandboxId) return;
    setNotice('Payments are coming soon.');
  }, [sandboxId]);

  const pay = async () => {
    setBusy(true);
    try {
      const data = await authedFetch('/api/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({ kind, sku, country, coupon, seats, interval, currency, method, idempotencyKey: `${kind}:${sku}:${method}:${country}` }),
      });
      if (data.available === false) {
        setNotice(typeof data.message === 'string' ? data.message : 'Payments are coming soon.');
        return;
      }
      if (typeof data.url === 'string' && data.url) {
        window.location.assign(data.url);
        return;
      }
      if (data.alreadyPaid === true) setNotice('Paid from your wallet.');
      else setNotice('The provider did not return a payment page.');
    } catch (error) {
      setNotice(error instanceof ApiError ? error.message : 'Checkout failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashPage>
      <DashHeader eyebrow="Poket School" title="Checkout" description="One payment for a plan, Sparks, a book, a course, or a wallet top-up." />
      {!sku && <p className="text-sm text-muted-foreground">Choose a plan or a book first.</p>}
      {quote && (
        <CheckoutPanel
          quote={quote}
          methods={methods}
          method={method}
          onMethod={setMethod}
          country={country}
          onCountry={setCountry}
          coupon={coupon}
          onCoupon={setCoupon}
          seats={seats}
          onSeats={setSeats}
          showSeats={kind === 'subscription'}
          notice={notice}
          busy={busy}
          onPay={pay}
          payLabel={method === 'tng' ? 'Pay with Touch ’n Go' : 'Pay now'}
        />
      )}
      {!quote && notice && <p className="text-sm text-muted-foreground">{notice}</p>}
    </DashPage>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading checkout…</p>}>
      <CheckoutScreen />
    </Suspense>
  );
}
