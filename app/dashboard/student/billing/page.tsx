'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getInvoicesForStudent, Invoice } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CreditCard, Printer, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';
import { formatMoney } from '@/lib/pricing';
import { DocumentDelivery } from '@/components/document-delivery';
import { billingDocument } from '@/lib/documents/packet';
import { PAYER_NOTE } from '@/lib/billing-model';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 },
  }),
};

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-primary/10 text-primary',
  paid: 'bg-emerald-500/10 text-emerald-600',
  overdue: 'bg-destructive/10 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  paid: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
  overdue: <AlertCircle className="w-4 h-4 text-destructive" />,
  sent: <Clock className="w-4 h-4 text-primary" />,
};

export default function StudentBillingPage() {
  const { user, profile } = useAuthSTORE();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payDialogInvoice, setPayDialogInvoice] = useState<Invoice | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const inv = await getInvoicesForStudent(user.uid);
      // Defensive client-side sort (newest first)
      inv.sort((a, b) => (b.createdAt?.toDate?.()?.getTime() ?? 0) - (a.createdAt?.toDate?.()?.getTime() ?? 0));
      setInvoices(inv);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Online card payment is not live yet — be honest about it instead of faking
  // a checkout. The Pay button opens an informational dialog with the invoice
  // reference so the student can pay via their school.
  const handlePay = (invoice: Invoice) => setPayDialogInvoice(invoice);

  const outstanding = invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
  const history = invoices.filter(i => i.status === 'paid' || i.status === 'cancelled');

  const totalOwed = outstanding.reduce((s, i) => s + i.amount, 0);

  if (loading) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10 pt-8">
      <div className="space-y-3">
        <div className="h-4 w-24 bg-muted animate-pulse rounded-full" />
        <div className="h-12 w-48 bg-muted animate-pulse rounded-3xl" />
      </div>
      {[1, 2].map(i => <div key={i} className="h-28 bg-muted animate-pulse rounded-3xl" />)}
    </div>
  );

  if (error) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 pt-16 flex justify-center">
      <div className="bg-card border border-border rounded-3xl p-8 text-center max-w-md w-full card-glow">
        <p className="font-heading text-xl text-foreground mb-2">Couldn&apos;t load this page.</p>
        <p className="text-sm text-muted-foreground mb-6 break-words">{error}</p>
        <Button onClick={load} className="rounded-full h-11 px-6 font-bold">Retry</Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">
      {/* Header */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
          PAYMENTS
        </p>
        <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-1.5">
          <span className="gradient-text italic">Billing</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{PAYER_NOTE}</p>
        {profile?.institutionId && (
          <p className="text-sm mt-3 max-w-2xl rounded-2xl border border-border bg-card px-4 py-3">
            Your institution pays this seat. Poket School does not charge you for it. Marketplace courses are a separate purchase with a card or the wallet. Sparks cannot buy them.
          </p>
        )}
        {user && invoices.length > 0 && (
          <div className="mt-4">
            <DocumentDelivery
              documents={invoices.map(inv => billingDocument({
                id: inv.id,
                description: inv.description,
                totalLabel: formatMoney(inv.amount, inv.currency || 'USD'),
                status: inv.status,
                studentName: inv.studentName,
                studentId: inv.studentId,
                holderEmail: user.email ?? undefined,
              }))}
              studentIds={[user.uid]}
            />
          </div>
        )}
      </motion.div>

      {/* Outstanding Balance Banner */}
      {totalOwed > 0 && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
          className="bg-card border border-border rounded-3xl p-6 card-glow relative overflow-hidden flex items-center justify-between gap-4"
        >
          <span className="absolute top-0 left-6 right-6 h-[3px] rounded-b-full bg-amber-500 opacity-80" />
          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Outstanding Balance
            </p>
            <p className="font-heading text-4xl sm:text-5xl text-foreground mt-1">
              {Object.entries(outstanding.reduce<Record<string, number>>((totals, inv) => {
                const code = inv.currency || 'USD';
                totals[code] = (totals[code] ?? 0) + inv.amount;
                return totals;
              }, {})).map(([code, amount]) => formatMoney(amount, code)).join(' · ')}
            </p>
          </div>
          <AlertCircle className="w-10 h-10 text-muted-foreground opacity-40" />
        </motion.div>
      )}

      {/* Empty State */}
      {invoices.length === 0 && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
          className="relative text-center py-20"
        >
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-primary/8 blur-[80px]" />
          <CreditCard className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" />
          <p className="font-heading text-2xl text-foreground">No invoices yet</p>
          <p className="text-sm text-muted-foreground mt-2">
            When your institution sends invoices, they will appear here.
          </p>
        </motion.div>
      )}

      {/* Outstanding Invoices */}
      {outstanding.length > 0 && (
        <motion.section
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={2}
          className="space-y-4"
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
              OUTSTANDING
            </p>
            <h2 className="font-heading text-3xl text-foreground mt-1.5">
              Due ({outstanding.length})
            </h2>
          </div>
          <div className="space-y-3">
            {outstanding.map((inv, i) => (
              <motion.div
                key={inv.id}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={3 + i}
                className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 card-glow"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {STATUS_ICONS[inv.status] ?? <CreditCard className="w-4 h-4 text-muted-foreground" />}
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{inv.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Due: {inv.dueDate?.toDate?.().toLocaleDateString() ?? '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="font-heading text-lg text-foreground">
                      {formatMoney(inv.amount, inv.currency || 'USD')}
                    </p>
                    <Badge className={`rounded-full text-[10px] ${STATUS_STYLES[inv.status]}`}>
                      {inv.status}
                    </Badge>
                    <DocumentDelivery
                      compact
                      documents={[billingDocument({
                        id: inv.id,
                        description: inv.description,
                        totalLabel: formatMoney(inv.amount, inv.currency || 'USD'),
                        status: inv.status,
                        studentName: inv.studentName,
                        studentId: inv.studentId,
                        holderEmail: user?.email ?? undefined,
                      })]}
                      studentIds={[user?.uid || inv.studentId]}
                    />
                  </div>
                  <Button
                    onClick={() => handlePay(inv)}
                    className="rounded-full h-11 px-5 font-bold bg-primary text-primary-foreground border-0 gap-2"
                  >
                    <CreditCard className="w-4 h-4" /> Pay
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* History */}
      {history.length > 0 && (
        <motion.section
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={4}
          className="space-y-4"
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
              COMPLETED
            </p>
            <h2 className="font-heading text-3xl text-foreground mt-1.5">
              History ({history.length})
            </h2>
          </div>
          <div className="bg-card border border-border rounded-3xl divide-y divide-border card-glow">
            {history.map((inv, i) => (
              <motion.div
                key={inv.id}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={5 + i}
                className="px-5 py-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {STATUS_ICONS[inv.status] ?? <CreditCard className="w-4 h-4 text-muted-foreground" />}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{inv.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {inv.paidAt?.toDate?.().toLocaleDateString() ?? '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <p className="font-semibold text-muted-foreground">
                    {formatMoney(inv.amount, inv.currency || 'USD')}
                  </p>
                  <Badge className={`rounded-full text-[10px] ${STATUS_STYLES[inv.status]}`}>
                    {inv.status}
                  </Badge>
                  <button
                    onClick={() => window.print()}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <DocumentDelivery
                    compact
                    documents={[billingDocument({
                      id: inv.id,
                      description: inv.description,
                      totalLabel: formatMoney(inv.amount, inv.currency || 'USD'),
                      status: inv.status,
                      studentName: inv.studentName,
                      studentId: inv.studentId,
                      holderEmail: user?.email ?? undefined,
                    })]}
                    studentIds={[user?.uid || inv.studentId]}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Pay dialog — honest about payment options */}
      <Dialog open={!!payDialogInvoice} onOpenChange={open => !open && setPayDialogInvoice(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">Pay this invoice</DialogTitle>
            <DialogDescription>
              Checkout charges the amount already on the invoice. School invoices are not taxed a second time.
            </DialogDescription>
          </DialogHeader>
          {payDialogInvoice && (
            <div className="bg-muted/50 border border-border rounded-2xl p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Invoice reference</span>
                <span className="font-mono font-semibold text-foreground break-all">{payDialogInvoice.id}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Description</span>
                <span className="font-semibold text-foreground text-right">{payDialogInvoice.description}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Amount due</span>
                <span className="font-heading text-lg text-foreground">
                  {formatMoney(payDialogInvoice.amount, payDialogInvoice.currency || 'USD')}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            {payDialogInvoice && (payDialogInvoice.status === 'sent' || payDialogInvoice.status === 'overdue') && (
              <Link href={`/dashboard/checkout?kind=invoice&sku=${payDialogInvoice.id}`} className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground">
                Pay this invoice
              </Link>
            )}
            <Button onClick={() => setPayDialogInvoice(null)} variant="outline" className="rounded-full h-11 px-6 font-bold">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
