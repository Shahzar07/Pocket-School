'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getSparkTransactions, SparkTransaction } from '@/lib/db';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from 'react-i18next';
import { Zap, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { formatAppDate, formatAppNumber } from '@/lib/i18n/detect';
import { SparksNote } from '@/components/shell/sparks-note';

/**
 * Amber ⚡ wallet pill shown in the dashboard header for students.
 * Click opens the transaction ledger.
 */
export function SparksChip() {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuthSTORE();
  const [open, setOpen] = useState(false);
  const [transactions, setTransactions] = useState<SparkTransaction[]>([]);
  const [loading, setLoading] = useState(false);

  const balance = profile?.sparksBalance ?? 0;

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    getSparkTransactions(user.uid).then(txs => {
      setTransactions(txs);
      setLoading(false);
    });
  }, [open, user]);

  if (!profile || profile.role !== 'student') return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 h-9 rounded-full bg-secondary border border-border text-secondary-foreground hover:bg-muted transition-colors"
        aria-label={`Sparks balance ${balance}. Opens your Sparks history.`}
        title={t('sparks.title')}
      >
        <Zap className="w-4 h-4 fill-amber-400 text-amber-500" />
        <span className="text-sm font-bold">{formatAppNumber(balance, i18n.language)}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 fill-amber-400 text-amber-500" />
              {t('sparks.heading', { count: formatAppNumber(balance, i18n.language) })}
            </DialogTitle>
          </DialogHeader>

          <SparksNote cost={0} balance={balance} />
          <p className="text-xs text-muted-foreground -mt-2">
            {t('sparks.spend')}
          </p>
          <div className="flex gap-3 text-xs font-semibold">
            <Link href="/dashboard/student/sparks" className="text-amber-700" onClick={() => setOpen(false)}>What are Sparks?</Link>
            <Link href="/dashboard/checkout?kind=sparks&sku=sparks_100" className="text-primary" onClick={() => setOpen(false)}>Get more Sparks</Link>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {loading && <p className="text-sm text-muted-foreground text-center py-6">{t('sparks.loading')}</p>}
            {!loading && transactions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                {t('sparks.empty')}
              </p>
            )}
            {transactions.map(tx => {
              const when = tx.createdAt?.toDate?.();
              return (
              <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  tx.amount >= 0 ? 'bg-emerald-100' : 'bg-amber-100'
                }`}>
                  {tx.amount >= 0
                    ? <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                    : <ArrowUpRight className="w-4 h-4 text-amber-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {tx.note ?? t(`sparks.types.${tx.type}`, { defaultValue: tx.type })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {when ? `${formatAppDate(when, i18n.language)} · ` : ''}
                    {tx.format ? `${tx.format} · ` : ''}
                    {t('sparks.balance', { count: formatAppNumber(tx.balanceAfter, i18n.language) })}
                  </p>
                </div>
                <span className={`text-sm font-bold shrink-0 ${tx.amount >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {tx.amount >= 0 ? '+' : ''}{formatAppNumber(tx.amount, i18n.language)}⚡
                </span>
              </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
