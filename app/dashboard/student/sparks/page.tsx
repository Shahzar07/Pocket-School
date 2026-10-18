'use client';

import Link from 'next/link';
import { SPARKS_EXPLAINER, FORMAT_COSTS, FORMAT_LABELS, monthlySparksForProfile } from '@/lib/sparks';
import { SPARK_PACKS } from '@/lib/payments/catalog';
import { formatMoney } from '@/lib/money';
import { TIERS } from '@/lib/entitlements';
import { useAuthSTORE } from '@/hooks/use-auth';
import { hasAccountRole } from '@/lib/account-modes';
import { getSparkTransactions, SparkTransaction } from '@/lib/db';
import { useEffect, useState } from 'react';
import { automationEnabled } from '@/lib/automation-status';

export default function SparksPage() {
  const { user, profile } = useAuthSTORE();
  const [rows, setRows] = useState<SparkTransaction[]>([]);
  const [packsOpen, setPacksOpen] = useState(true);
  useEffect(() => {
    if (!user) return;
    getSparkTransactions(user.uid, 40).then(setRows).catch(() => setRows([]));
  }, [user]);
  useEffect(() => {
    automationEnabled('sparks_topup').then(setPacksOpen).catch(() => setPacksOpen(true));
  }, []);
  const allowance = monthlySparksForProfile(profile);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--ps-cyan-text)]">Sparks</p>
      <h1 className="font-heading text-4xl text-foreground">{SPARKS_EXPLAINER.title}</h1>
      <p className="text-muted-foreground">{SPARKS_EXPLAINER.summary}</p>
      <div
        className="rounded-3xl border border-border p-6"
        style={{ background: 'linear-gradient(160deg, color-mix(in srgb, var(--ps-coral) 18%, var(--card)), color-mix(in srgb, var(--ps-cyan-text) 10%, var(--card)) 70%)' }}
      >
        <p className="text-sm text-muted-foreground" data-learner-sparks>
          {hasAccountRole(profile, 'teacher') || hasAccountRole(profile, 'parent')
            ? 'Your learning balance. Class spending and a child\'s limit are separate.'
            : 'Your balance'}
        </p>
        <p className="text-4xl font-bold" style={{ color: 'var(--ps-coral)' }}>⚡{profile?.sparksBalance ?? 0}</p>
        <p className="text-sm mt-2 inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--ps-cyan-text)' }}>↑ This plan adds ⚡{allowance} each month.</p>
      </div>
      <ul className="space-y-2 text-sm">
        {SPARKS_EXPLAINER.earn.map((line) => <li key={line}>{line}</li>)}
      </ul>
      <div>
        <h2 className="font-semibold mb-2">What a format costs</h2>
        <ul className="grid grid-cols-2 gap-2 text-sm">
          {Object.entries(FORMAT_COSTS).map(([key, cost]) => (
            <li key={key} className="rounded-xl border border-border px-3 py-2 flex justify-between">
              <span>{FORMAT_LABELS[key] ?? key}</span><span>⚡{cost}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="font-semibold mb-2">Monthly allowance by plan</h2>
        <ul className="space-y-1 text-sm">
          {TIERS.filter((t) => t.sparks > 0).map((t) => (
            <li key={t.id}>{t.name}: ⚡{t.sparks.toLocaleString()} a month, ⚡{t.sparksRollover.toLocaleString()} can roll over</li>
          ))}
        </ul>
      </div>
      {packsOpen ? (
        <div className="flex flex-wrap gap-2">
          {SPARK_PACKS.map((pack) => (
            <Link key={pack.id} href={`/dashboard/checkout?kind=sparks&sku=${pack.id}`} className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground">
              {pack.title} · {formatMoney(pack.usd)}
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm">Sparks packs are added by a super admin at the moment.</p>
      )}
      <div>
        <h2 className="font-semibold mb-2">History</h2>
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Nothing here yet. Finish a lesson to earn your first Sparks.</p>}
        <ul className="space-y-2">
          {rows.map((tx) => (
            <li key={tx.id} className="flex justify-between rounded-xl border border-border px-3 py-2 text-sm">
              <span>{tx.note || tx.type}</span>
              <span className={tx.amount >= 0 ? 'text-success' : 'text-[var(--ps-cyan-text)]'}>{tx.amount > 0 ? '+' : ''}{tx.amount}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
