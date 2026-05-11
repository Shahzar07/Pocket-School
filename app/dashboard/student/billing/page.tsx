'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getInvoicesForStudent, Invoice } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditCard, Printer, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  paid: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  overdue: <AlertCircle className="w-4 h-4 text-red-500" />,
  sent: <Clock className="w-4 h-4 text-blue-500" />,
};

export default function StudentBillingPage() {
  const { user } = useAuthSTORE();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getInvoicesForStudent(user.uid).then(setInvoices).finally(() => setLoading(false));
  }, [user]);

  const handlePay = async (invoice: Invoice) => {
    if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
      toast.error('Stripe is not configured. Contact your institution to set up payments.');
      return;
    }
    setPaying(invoice.id!);
    try {
      const res = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id, amount: invoice.amount, currency: invoice.currency }),
      });
      if (!res.ok) throw new Error('Failed to create payment');
      toast.info('Stripe checkout would open here. Configure STRIPE_SECRET_KEY to enable live payments.');
    } catch {
      toast.error('Payment initiation failed. Please try again.');
    } finally {
      setPaying(null);
    }
  };

  const outstanding = invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
  const history = invoices.filter(i => i.status === 'paid' || i.status === 'cancelled');

  const totalOwed = outstanding.reduce((s, i) => s + i.amount, 0);

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
      {[1, 2].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-2xl" />)}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Billing</h1>
        <p className="text-muted-foreground text-sm mt-1">View and pay your outstanding invoices.</p>
      </div>

      {totalOwed > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 flex items-center justify-between gap-4"
        >
          <div>
            <p className="text-sm font-semibold text-amber-800">Outstanding Balance</p>
            <p className="text-3xl font-extrabold text-amber-900 mt-1">${totalOwed.toFixed(2)}</p>
          </div>
          <AlertCircle className="w-10 h-10 text-amber-500 opacity-60" />
        </motion.div>
      )}

      {invoices.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No invoices yet.</p>
        </div>
      )}

      {outstanding.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Due ({outstanding.length})</h2>
          {outstanding.map((inv, i) => (
            <motion.div key={inv.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                {STATUS_ICONS[inv.status] ?? <CreditCard className="w-4 h-4 text-muted-foreground" />}
                <div>
                  <p className="font-semibold text-foreground">{inv.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Due: {inv.dueDate?.toDate?.().toLocaleDateString() ?? '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="font-extrabold text-foreground">{inv.currency} {inv.amount.toFixed(2)}</p>
                  <Badge className={`rounded-full text-[10px] ${STATUS_STYLES[inv.status]}`}>{inv.status}</Badge>
                </div>
                <Button onClick={() => handlePay(inv)} disabled={paying === inv.id} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2">
                  <CreditCard className="w-4 h-4" /> Pay
                </Button>
              </div>
            </motion.div>
          ))}
        </section>
      )}

      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">History ({history.length})</h2>
          <div className="bg-card border border-border rounded-2xl divide-y divide-border">
            {history.map(inv => (
              <div key={inv.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {STATUS_ICONS[inv.status] ?? <CreditCard className="w-4 h-4 text-muted-foreground" />}
                  <div>
                    <p className="text-sm font-semibold text-foreground">{inv.description}</p>
                    <p className="text-xs text-muted-foreground">{inv.paidAt?.toDate?.().toLocaleDateString() ?? '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <p className="font-semibold text-muted-foreground">{inv.currency} {inv.amount.toFixed(2)}</p>
                  <Badge className={`rounded-full text-[10px] ${STATUS_STYLES[inv.status]}`}>{inv.status}</Badge>
                  <button onClick={() => window.print()} className="text-muted-foreground hover:text-foreground transition-colors">
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
