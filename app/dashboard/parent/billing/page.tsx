'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getInvoicesForStudent, getPaymentMethod, Invoice } from '@/lib/db';
import type { PaymentMethod } from '@/lib/parent-controls';
import { formatMoney } from '@/lib/money';
import { DocumentDelivery } from '@/components/document-delivery';
import { billingDocument } from '@/lib/documents/packet';
import { authedFetch } from '@/lib/api-client';

export default function ParentBillingPage() {
  const { user, profile } = useAuthSTORE();
  const [rows, setRows] = useState<Invoice[]>([]);
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  useEffect(() => {
    if (!user) return;
    getPaymentMethod(user.uid).then(setPayment).catch(() => setPayment(null));
    const own = getInvoicesForStudent(user.uid).catch(() => [] as Invoice[]);
    const children = Promise.all((profile?.childIds ?? []).map(async (id) => {
      try {
        return await getInvoicesForStudent(id);
      } catch {
        const overview = await authedFetch(`/api/platform/parent-overview?childId=${encodeURIComponent(id)}`).catch(() => ({ invoices: [] }));
        return Array.isArray(overview.invoices) ? overview.invoices as Invoice[] : [];
      }
    }));
    Promise.all([own, children])
      .then(([mine, groups]) => setRows([...mine, ...groups.flat()]))
      .catch(() => setRows([]));
  }, [user, profile]);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-600">Billing</p>
      <h1 className="font-heading text-4xl">Invoices</h1>
      <p className="text-sm text-muted-foreground">Invoices for your account and for children who have approved a link. Card details stay on your profile settings, and only the last four digits are kept.</p>
      {rows.length > 0 && (
        <DocumentDelivery
          documents={rows.map(inv => billingDocument({
            id: inv.id,
            description: inv.description,
            totalLabel: formatMoney(inv.amount, inv.currency),
            status: inv.status,
            studentName: inv.studentName,
            studentId: inv.studentId,
            holderEmail: user?.email ?? undefined,
          }))}
          studentIds={[...new Set(rows.map(inv => inv.studentId))]}
        />
      )}
      {payment?.last4 && (
        <p className="text-sm rounded-2xl border border-border px-4 py-3" data-payment-method>
          {payment.brand || 'Card'} ending {payment.last4}{payment.expiry ? ` · ${payment.expiry}` : ''} · {payment.holder}
        </p>
      )}
      {rows.length === 0 && <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-8 text-center">No invoices yet.</p>}
      <ul className="space-y-2">
        {rows.map((inv) => (
          <li key={inv.id} className="rounded-2xl border border-border px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>{inv.description}</span>
            <span className="flex items-center gap-3">
              <span>{formatMoney(inv.amount, inv.currency)} · {inv.status}</span>
              <DocumentDelivery
                compact
                documents={[billingDocument({
                  id: inv.id,
                  description: inv.description,
                  totalLabel: formatMoney(inv.amount, inv.currency),
                  status: inv.status,
                  studentName: inv.studentName,
                  studentId: inv.studentId,
                  holderEmail: user?.email ?? undefined,
                })]}
                studentIds={[inv.studentId]}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
