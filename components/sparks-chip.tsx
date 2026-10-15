'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getSparkTransactions, SparkTransaction } from '@/lib/db';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Zap, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { SPARKS_EXPLAINER } from '@/lib/sparks';
import Link from 'next/link';

const TYPE_LABELS: Record<SparkTransaction['type'], string> = {
  allowance: 'Monthly allowance',
  unlock: 'Format unlocked',
  earn: 'Earned',
  admin_grant: 'Granted',
  ai_studio: 'AI Studio',
};

/**
 * Amber ⚡ wallet pill shown in the dashboard header for students.
 * Click opens the transaction ledger.
 */
export function SparksChip() {
  const { user, profile } = useAuthSTORE();
  const [open, setOpen] = useState(false);
  const [transactions, setTransactions] = useState<SparkTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('sparks-explainer-seen')) setShowTip(true);
  }, []);

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
      {showTip && (
        <div className="absolute right-4 top-16 z-50 w-72 rounded-2xl border border-amber-200 bg-white p-4 shadow-xl text-left">
          <p className="text-sm font-semibold text-foreground">{SPARKS_EXPLAINER.title}</p>
          <p className="text-xs text-muted-foreground mt-1">{SPARKS_EXPLAINER.summary}</p>
          <button
            className="mt-3 text-xs font-bold text-amber-700"
            onClick={() => { localStorage.setItem('sparks-explainer-seen', '1'); setShowTip(false); }}
          >
            Got it
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 h-9 rounded-full bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors"
        title="Sparks balance"
      >
        <Zap className="w-4 h-4 fill-amber-400 text-amber-500" />
        <span className="text-sm font-bold">{balance}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 fill-amber-400 text-amber-500" />
              {balance} Sparks
            </DialogTitle>
          </DialogHeader>

          <p className="text-xs text-muted-foreground -mt-2">{SPARKS_EXPLAINER.summary}</p>
          <div className="flex gap-3 text-xs font-semibold">
            <Link href="/dashboard/student/sparks" className="text-amber-700" onClick={() => setOpen(false)}>What are Sparks?</Link>
            <Link href="/dashboard/checkout?kind=sparks&sku=sparks_100" className="text-primary" onClick={() => setOpen(false)}>Get more Sparks</Link>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {loading && <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>}
            {!loading && transactions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                No transactions yet. Complete lessons to start earning Sparks!
              </p>
            )}
            {transactions.map(tx => (
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
                    {tx.note ?? TYPE_LABELS[tx.type] ?? tx.type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tx.format ? `${tx.format} · ` : ''}Balance: {tx.balanceAfter}
                  </p>
                </div>
                <span className={`text-sm font-bold shrink-0 ${tx.amount >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {tx.amount >= 0 ? '+' : ''}{tx.amount}⚡
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
