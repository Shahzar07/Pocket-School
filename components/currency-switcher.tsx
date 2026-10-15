'use client';

import { enabledCurrencies } from '@/lib/pricing';
import { usePricing } from '@/hooks/use-pricing';

export function CurrencySwitcher({ tone = 'default' }: { tone?: 'default' | 'onDark' }) {
  const { config, currency, setCurrency } = usePricing();
  const options = enabledCurrencies(config);

  return (
    <label className={`inline-flex items-center ${tone === 'onDark' ? 'text-white' : 'text-foreground'}`}>
      <span className="sr-only">Currency</span>
      <select
        data-currency-switcher
        aria-label="Currency"
        value={options.some(option => option.code === currency) ? currency : 'USD'}
        onChange={event => setCurrency(event.target.value)}
        className={`h-9 rounded-xl border bg-transparent px-2 text-sm font-semibold ${
          tone === 'onDark'
            ? 'border-white/25 text-white'
            : 'border-border text-foreground'
        }`}
      >
        {options.map(option => (
          <option key={option.code} value={option.code}>
            {option.code}
          </option>
        ))}
      </select>
    </label>
  );
}
