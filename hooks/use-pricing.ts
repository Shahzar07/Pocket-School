'use client';

import { useEffect, useRef, useState } from 'react';
import { GEO_COUNTRY_COOKIE } from '@/lib/languages';
import { loadPricingConfig } from '@/lib/pricing-store';
import {
  CURRENCY_EVENT,
  formatCoursePrice,
  formatMoney,
  quoteAddon,
  quotePlan,
  readCurrencyChoice,
  resolveDisplayCurrency,
  seedPricing,
  writeCurrencyChoice,
  type BillingInterval,
  type PricingConfig,
} from '@/lib/pricing';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  const row = document.cookie.split('; ').find(part => part.startsWith(prefix));
  if (!row) return null;
  try {
    return decodeURIComponent(row.slice(prefix.length));
  } catch {
    return row.slice(prefix.length);
  }
}

export function usePricing() {
  const [config, setConfig] = useState<PricingConfig>(seedPricing());
  const [currency, setCurrencyState] = useState('USD');
  const [ready, setReady] = useState(false);
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    let cancelled = false;
    const publish = (next: PricingConfig) => {
      if (cancelled) return;
      configRef.current = next;
      setConfig(next);
      const choice = readCurrencyChoice();
      setCurrencyState(resolveDisplayCurrency(next, {
        stored: choice.code,
        source: choice.source,
        country: readCookie(GEO_COUNTRY_COOKIE),
      }));
      setReady(true);
    };

    publish(seedPricing());
    loadPricingConfig().then(publish).catch(() => publish(seedPricing()));

    const onChange = () => publish(configRef.current);
    window.addEventListener(CURRENCY_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(CURRENCY_EVENT, onChange);
    };
  }, []);

  const setCurrency = (code: string) => {
    writeCurrencyChoice(code, true);
  };

  return {
    config,
    currency,
    ready,
    setCurrency,
    format: (amount: number, code = currency) => formatMoney(amount, code),
    planQuote: (id: string, interval: BillingInterval, code = currency) =>
      quotePlan(config, id, interval, code),
    addonQuote: (id: string, code = currency) => quoteAddon(config, id, code),
    courseLabel: (price: number | null | undefined, courseCurrency?: string | null) =>
      formatCoursePrice(config, price, courseCurrency, currency),
  };
}
