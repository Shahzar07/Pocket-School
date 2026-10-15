'use client';

import { useEffect, useState } from 'react';
import { Loader2, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthSTORE } from '@/hooks/use-auth';
import { ADDONS, TIERS } from '@/lib/entitlements';
import {
  annualFromMonthly,
  seedPricing,
  validatePricing,
  type CurrencyMode,
  type CurrencyPrice,
  type PricingConfig,
  type Rounding,
} from '@/lib/pricing';
import {
  loadPricingAudit,
  loadPricingConfig,
  savePricingConfig,
  type PricingAuditEntry,
} from '@/lib/pricing-store';

const SEEDED_CODES = new Set(seedPricing().currencies.map(currency => currency.code));

function labelFor(id: string): string {
  return TIERS.find(tier => tier.id === id)?.name
    ?? ADDONS.find(addon => addon.id === id)?.name
    ?? id;
}

function when(entry: PricingAuditEntry): string {
  const date = entry.at?.toDate?.();
  return date ? date.toLocaleString() : '';
}

export function AdminPricingPanel() {
  const { user, profile } = useAuthSTORE();
  const [draft, setDraft] = useState<PricingConfig>(seedPricing());
  const [audit, setAudit] = useState<PricingAuditEntry[]>([]);
  const [auditError, setAuditError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newCode, setNewCode] = useState('');

  const refreshAudit = () => {
    loadPricingAudit(20)
      .then(rows => {
        setAudit(rows);
        setAuditError(false);
      })
      .catch(() => setAuditError(true));
  };

  useEffect(() => {
    let cancelled = false;
    loadPricingConfig()
      .then(config => { if (!cancelled) setDraft(config); })
      .finally(() => { if (!cancelled) setLoading(false); });
    refreshAudit();
    return () => { cancelled = true; };
  }, []);

  const updatePlan = (id: string, field: 'monthlyUsd' | 'annualUsd' | 'sparks', value: string) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    setDraft(current => ({
      ...current,
      plans: current.plans.map(plan => plan.id === id ? { ...plan, [field]: number } : plan),
    }));
  };

  const applyDiscount = (id: string) => {
    setDraft(current => ({
      ...current,
      plans: current.plans.map(plan => plan.id === id
        ? { ...plan, annualUsd: annualFromMonthly(plan.monthlyUsd, current.annualDiscount) }
        : plan),
    }));
  };

  const updateCurrency = (code: string, patch: Partial<CurrencyPrice>) => {
    setDraft(current => ({
      ...current,
      currencies: current.currencies.map(currency =>
        currency.code === code ? { ...currency, ...patch } : currency),
    }));
  };

  const updateFixed = (
    code: string,
    interval: 'fixedMonthly' | 'fixedAnnual',
    id: string,
    value: string,
  ) => {
    const number = value.trim() === '' ? undefined : Number(value);
    setDraft(current => ({
      ...current,
      currencies: current.currencies.map(currency => {
        if (currency.code !== code) return currency;
        const next = { ...currency[interval] };
        if (number == null || !Number.isFinite(number)) delete next[id];
        else next[id] = number;
        return { ...currency, [interval]: next };
      }),
    }));
  };

  const addCurrency = () => {
    const code = newCode.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) {
      toast.error('Enter a three-letter currency code.');
      return;
    }
    if (draft.currencies.some(currency => currency.code === code)) {
      toast.error(`${code} is already listed.`);
      return;
    }
    setDraft(current => ({
      ...current,
      currencies: [
        ...current.currencies,
        { code, enabled: true, mode: 'rate', rate: 1, rounding: 'charm', fixedMonthly: {}, fixedAnnual: {} },
      ],
    }));
    setNewCode('');
  };

  const save = async () => {
    const problem = validatePricing(draft);
    if (problem) {
      toast.error(problem);
      return;
    }
    if (!user) {
      toast.error('Sign in as an admin to save pricing.');
      return;
    }
    setSaving(true);
    try {
      const summary = await savePricingConfig(draft, {
        actorId: user.uid,
        actorEmail: user.email ?? profile?.email ?? '',
        actorName: profile?.name ?? '',
      });
      if (summary.length === 0) toast.info('No pricing changes to save.');
      else toast.success('Pricing saved.');
      refreshAudit();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save pricing.';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-64 bg-muted animate-pulse rounded-3xl" />;
  }

  const percent = Math.round(draft.annualDiscount * 1000) / 10;

  return (
    <section className="bg-card border border-border rounded-3xl p-6 sm:p-7 relative overflow-hidden card-glow space-y-8">
      <span className="absolute top-0 left-6 right-6 h-[3px] rounded-b-full bg-amber-500 opacity-80" />
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
          <Receipt className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-heading text-2xl text-foreground">Pricing</h2>
          <p className="text-sm text-muted-foreground">
            USD is the base. Public pages and Stripe checkout read this document.
          </p>
        </div>
      </div>

      <div className="max-w-xs space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="annual-discount">
          Annual discount (%)
        </label>
        <Input
          id="annual-discount"
          type="number"
          min={0}
          max={100}
          step={0.1}
          value={percent}
          onChange={event => {
            const next = Number(event.target.value);
            if (!Number.isFinite(next)) return;
            setDraft(current => ({
              ...current,
              annualDiscount: Math.min(100, Math.max(0, next)) / 100,
            }));
          }}
          className="rounded-xl h-11 bg-muted/50"
        />
        <p className="text-xs text-muted-foreground">
          Apply discount writes each plan&apos;s annual price from its monthly USD price. A direct annual edit is what checkout charges.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-foreground">Plans, in USD</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-2 pe-3 font-medium">Plan</th>
                <th className="py-2 pe-3 font-medium">Monthly</th>
                <th className="py-2 pe-3 font-medium">Annual</th>
                <th className="py-2 pe-3 font-medium">Sparks / month</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {draft.plans.map(plan => (
                <tr key={plan.id} className="border-t border-border">
                  <td className="py-2 pe-3 font-medium">{labelFor(plan.id)}</td>
                  <td className="py-2 pe-3">
                    <Input type="number" min={0} step={0.01} value={plan.monthlyUsd}
                      onChange={event => updatePlan(plan.id, 'monthlyUsd', event.target.value)}
                      className="rounded-xl h-10 w-28 bg-muted/50" aria-label={`${plan.id} monthly USD`} />
                  </td>
                  <td className="py-2 pe-3">
                    <Input type="number" min={0} step={0.01} value={plan.annualUsd}
                      onChange={event => updatePlan(plan.id, 'annualUsd', event.target.value)}
                      className="rounded-xl h-10 w-28 bg-muted/50" aria-label={`${plan.id} annual USD`} />
                  </td>
                  <td className="py-2 pe-3">
                    <Input type="number" min={0} step={1} value={plan.sparks}
                      onChange={event => updatePlan(plan.id, 'sparks', event.target.value)}
                      className="rounded-xl h-10 w-28 bg-muted/50" aria-label={`${plan.id} sparks`} />
                  </td>
                  <td className="py-2">
                    <Button type="button" variant="outline" className="rounded-full h-10"
                      onClick={() => applyDiscount(plan.id)}>
                      Apply discount
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-foreground">Add-ons, monthly USD</h3>
        {draft.addons.map(addon => (
          <label key={addon.id} className="flex items-center gap-3 text-sm">
            <span className="w-40">{labelFor(addon.id)}</span>
            <Input type="number" min={0} step={0.01} value={addon.monthlyUsd}
              aria-label={`${addon.id} monthly USD`}
              onChange={event => {
                const number = Number(event.target.value);
                if (!Number.isFinite(number)) return;
                setDraft(current => ({
                  ...current,
                  addons: current.addons.map(item => item.id === addon.id ? { ...item, monthlyUsd: number } : item),
                }));
              }}
              className="rounded-xl h-10 w-28 bg-muted/50" />
          </label>
        ))}
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-foreground">Currencies</h3>
        {draft.currencies.map(currency => (
          <CurrencyRow
            key={currency.code}
            currency={currency}
            plans={draft.plans.map(plan => plan.id)}
            addons={draft.addons.map(addon => addon.id)}
            onChange={patch => updateCurrency(currency.code, patch)}
            onFixed={(interval, id, value) => updateFixed(currency.code, interval, id, value)}
            onRemove={SEEDED_CODES.has(currency.code) ? undefined : () => {
              setDraft(current => ({
                ...current,
                currencies: current.currencies.filter(item => item.code !== currency.code),
              }));
            }}
          />
        ))}
        <div className="flex gap-2 items-center">
          <Input value={newCode} onChange={event => setNewCode(event.target.value)}
            placeholder="EUR" maxLength={3} aria-label="New currency code"
            className="rounded-xl h-10 w-28 bg-muted/50 uppercase" />
          <Button type="button" variant="outline" className="rounded-full h-10" onClick={addCurrency}>
            Add currency
          </Button>
        </div>
      </div>

      <Button onClick={save} disabled={saving} className="rounded-full h-11 px-5 font-bold bg-gradient-to-r from-amber-500 to-orange-600 text-white gap-2">
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        Save pricing
      </Button>

      <div className="space-y-2">
        <h3 className="text-sm font-bold text-foreground">Audit log</h3>
        {auditError && (
          <p className="text-sm text-muted-foreground">The audit log is not readable from this session.</p>
        )}
        {!auditError && audit.length === 0 && (
          <p className="text-sm text-muted-foreground">No pricing changes recorded yet.</p>
        )}
        <ul className="space-y-3">
          {audit.map(entry => (
            <li key={entry.id} className="rounded-2xl border border-border px-4 py-3 text-sm">
              <p className="font-medium">
                {entry.actorName || entry.actorEmail || entry.actorId}
                {when(entry) ? ` · ${when(entry)}` : ''}
              </p>
              <ul className="mt-1 text-muted-foreground list-disc ps-4">
                {entry.summary.map(line => <li key={line}>{line}</li>)}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function CurrencyRow({
  currency,
  plans,
  addons,
  onChange,
  onFixed,
  onRemove,
}: {
  currency: CurrencyPrice;
  plans: string[];
  addons: string[];
  onChange: (patch: Partial<CurrencyPrice>) => void;
  onFixed: (interval: 'fixedMonthly' | 'fixedAnnual', id: string, value: string) => void;
  onRemove?: () => void;
}) {
  const locked = currency.code === 'USD';
  return (
    <div className="rounded-2xl border border-border p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-bold w-14">{currency.code}</p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={currency.enabled}
            disabled={locked}
            onChange={event => onChange({ enabled: event.target.checked })}
          />
          Shown
        </label>
        <label className="text-sm flex items-center gap-2">
          Mode
          <select
            aria-label={`${currency.code} mode`}
            value={currency.mode}
            disabled={locked}
            onChange={event => onChange({ mode: event.target.value as CurrencyMode })}
            className="h-10 rounded-xl border border-border bg-muted/50 px-2"
          >
            {locked && <option value="base">Base</option>}
            <option value="rate">Exchange rate</option>
            <option value="fixed">Fixed prices</option>
          </select>
        </label>
        <label className="text-sm flex items-center gap-2">
          Per 1 USD
          <Input type="number" min={0.0001} step={0.01} value={currency.rate} disabled={locked}
            aria-label={`${currency.code} rate`}
            onChange={event => {
              const rate = Number(event.target.value);
              if (Number.isFinite(rate)) onChange({ rate });
            }}
            className="rounded-xl h-10 w-28 bg-muted/50" />
        </label>
        <label className="text-sm flex items-center gap-2">
          Rounding
          <select
            aria-label={`${currency.code} rounding`}
            value={currency.rounding}
            disabled={locked}
            onChange={event => onChange({ rounding: event.target.value as Rounding })}
            className="h-10 rounded-xl border border-border bg-muted/50 px-2"
          >
            <option value="none">None</option>
            <option value="whole">Whole number</option>
            <option value="charm">Charm (.99)</option>
          </select>
        </label>
        {onRemove && (
          <Button type="button" variant="outline" className="rounded-full h-10" onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>
      {currency.mode === 'fixed' && !locked && (
        <div className="grid sm:grid-cols-2 gap-3">
          {plans.map(id => (
            <FixedPair key={id} code={currency.code} id={id} label={labelFor(id)}
              monthly={currency.fixedMonthly[id]} annual={currency.fixedAnnual[id]} onFixed={onFixed} />
          ))}
          {addons.map(id => (
            <label key={id} className="text-xs space-y-1">
              <span className="text-muted-foreground">{labelFor(id)} monthly</span>
              <Input type="number" min={0} step={0.01}
                value={currency.fixedMonthly[id] ?? ''}
                aria-label={`${currency.code} ${id} fixed monthly`}
                onChange={event => onFixed('fixedMonthly', id, event.target.value)}
                className="rounded-xl h-10 bg-muted/50" />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function FixedPair({
  code, id, label, monthly, annual, onFixed,
}: {
  code: string;
  id: string;
  label: string;
  monthly?: number;
  annual?: number;
  onFixed: (interval: 'fixedMonthly' | 'fixedAnnual', id: string, value: string) => void;
}) {
  return (
    <div className="text-xs space-y-1">
      <p className="text-muted-foreground">{label}</p>
      <div className="flex gap-2">
        <Input type="number" min={0} step={0.01} placeholder="Monthly" value={monthly ?? ''}
          aria-label={`${code} ${id} fixed monthly`}
          onChange={event => onFixed('fixedMonthly', id, event.target.value)}
          className="rounded-xl h-10 bg-muted/50" />
        <Input type="number" min={0} step={0.01} placeholder="Annual" value={annual ?? ''}
          aria-label={`${code} ${id} fixed annual`}
          onChange={event => onFixed('fixedAnnual', id, event.target.value)}
          className="rounded-xl h-10 bg-muted/50" />
      </div>
    </div>
  );
}
