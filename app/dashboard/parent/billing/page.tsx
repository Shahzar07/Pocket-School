'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getInvoicesForStudent, Invoice } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { authedFetch } from '@/lib/api-client';

export default function ParentBillingPage() {
  const { user, profile } = useAuthSTORE();
  const [rows, setRows] = useState<Invoice[]>([]);
  useEffect(() => {
    if (!user) return;
    const own = getInvoicesForStudent(user.uid).catch(() => [] as Invoice[]);
    const children = Promise.all((profile?.childIds ?? []).map((id) =>
      authedFetch(`/api/platform/parent-overview?childId=${encodeURIComponent(id)}`)
        .then((overview) => (Array.isArray(overview.invoices) ? overview.invoices as Invoice[] : []))
        .catch(() => [] as Invoice[]),
    ));
    Promise.all([own, children])
      .then(([mine, groups]) => setRows([...mine, ...groups.flat()]))
      .catch(() => setRows([]));
  }, [user, profile]);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-600">Billing</p>
      <h1 className="font-heading text-4xl">Invoices</h1>
      <p className="text-sm text-muted-foreground">Invoices for your account and for children who have approved a link.</p>
      {rows.length === 0 && <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-8 text-center">No invoices yet.</p>}
      <ul className="space-y-2">
        {rows.map((inv) => (
          <li key={inv.id} className="rounded-2xl border border-border px-4 py-3 flex justify-between text-sm">
            <span>{inv.description}</span>
            <span>{formatMoney(inv.amount, inv.currency)} · {inv.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
