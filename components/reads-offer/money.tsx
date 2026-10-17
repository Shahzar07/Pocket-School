'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CURRENCY_EVENT,
  enabledCurrencies,
  formatMoney,
  quoteCourse,
  readCurrencyChoice,
  seedPricing,
  writeCurrencyChoice,
} from '@/lib/pricing';

const config = seedPricing();

const CurrencyContext = createContext<{ currency: string; choose: (code: string) => void }>({
  currency: 'USD',
  choose: () => {},
});

export function OfferCurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState('USD');

  useEffect(() => {
    const apply = () => {
      const choice = readCurrencyChoice();
      const known = enabledCurrencies(config).some(item => item.code === choice.code);
      setCurrency(choice.source === 'user' && choice.code && known ? choice.code : 'USD');
    };
    apply();
    window.addEventListener(CURRENCY_EVENT, apply);
    return () => window.removeEventListener(CURRENCY_EVENT, apply);
  }, []);

  const choose = (code: string) => {
    writeCurrencyChoice(code, true);
    setCurrency(code);
  };

  const value = useMemo(() => ({ currency, choose }), [currency]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function OfferCurrencySelect() {
  const { currency, choose } = useContext(CurrencyContext);
  const options = enabledCurrencies(config);
  const value = options.some(option => option.code === currency) ? currency : 'USD';

  return (
    <label className="inline-flex items-center">
      <span className="sr-only">Currency</span>
      <select
        aria-label="Currency"
        value={value}
        onChange={event => choose(event.target.value)}
        className="h-11 rounded-full border border-border bg-card px-3 text-sm font-semibold text-foreground"
      >
        {options.map(option => (
          <option key={option.code} value={option.code}>{option.code}</option>
        ))}
      </select>
    </label>
  );
}

export function OfferMoney({ usd, cadence }: { usd: number; cadence?: string }) {
  const { currency } = useContext(CurrencyContext);
  const quote = quoteCourse(config, usd, 'USD', currency);
  const shown = formatMoney(quote.amount, quote.currency);
  const base = formatMoney(quote.usd, 'USD');

  return (
    <span className="inline-flex min-h-[3.25rem] flex-col justify-center">
      <span className="tabular-nums">
        {shown}
        {cadence ? <span className="text-[0.62em] font-semibold tracking-normal text-muted-foreground"> {cadence}</span> : null}
      </span>
      <span className="min-h-[1.25rem] text-sm font-medium text-muted-foreground tabular-nums">
        {quote.currency === 'USD' ? 'Priced in US dollars' : base}
      </span>
    </span>
  );
}
