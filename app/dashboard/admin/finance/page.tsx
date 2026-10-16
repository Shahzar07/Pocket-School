'use client';

import { useEffect, useState } from 'react';
import { DashHeader, DashPage, DataTable, Panel, PanelHeader, StatCard } from '@/components/dash-ui';
import { ApiError, authedFetch } from '@/lib/api-client';
import { formatMoney } from '@/lib/money';
import { isSuperAdmin } from '@/lib/roles';
import { useAuthSTORE } from '@/hooks/use-auth';
import { filterFinanceRows, invoiceLabel } from '@/lib/billing-model';
import { Landmark } from 'lucide-react';

interface Summary { mrr: number; arr: number; arpu: number; activeSubscribers: number }
interface Tx { id: string; title?: string; total?: number; currency?: string; status?: string; invoiceId?: string }

export default function FinancePage() {
  const { profile } = useAuthSTORE();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<Tx[]>([]);
  const [reconciliation, setReconciliation] = useState({ matched: 0, unmatched: 0, total: 0 });
  const [notice, setNotice] = useState('');
  const [refundId, setRefundId] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isSuperAdmin(profile)) return;
    authedFetch('/api/payments/admin-finance').then((data) => {
      setSummary(data.summary as Summary);
      setRows(Array.isArray(data.transactions) ? data.transactions as Tx[] : []);
      const recon = data.reconciliation as { matched?: number; unmatched?: number; total?: number } | undefined;
      setReconciliation({
        matched: Number(recon?.matched ?? 0),
        unmatched: Number(recon?.unmatched ?? 0),
        total: Number(recon?.total ?? 0),
      });
    }).catch((error: unknown) => setNotice(error instanceof ApiError ? error.message : 'Finance is unavailable.'));
  }, [profile]);

  const visible = filterFinanceRows(rows, query);

  function printInvoice(row: Tx) {
    const label = invoiceLabel(row);
    const title = (row.title || 'Poket School checkout').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const total = formatMoney(Number(row.total ?? 0), row.currency || 'USD');
    const html = `<!doctype html><html><head><title>${label}</title>
      <style>body{font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 24px;color:#111}
      h1{font-size:22px}table{width:100%;border-collapse:collapse;margin-top:16px}
      td{padding:8px 0;border-bottom:1px solid #e5e5e5}td:last-child{text-align:right;font-weight:600}</style></head>
      <body><h1>Poket School — Invoice</h1><p>${label}</p>
      <table>
        <tr><td>Checkout</td><td>${title}</td></tr>
        <tr><td>Status</td><td>${row.status || 'open'}</td></tr>
        <tr><td>Total</td><td>${total}</td></tr>
      </table>
      <p>The payer can be a parent, an institution, or an adult learner.</p>
      </body></html>`;
    const win = window.open('', '_blank', 'width=720,height=800');
    if (!win) { setNotice('Allow pop-ups to print the invoice.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  if (!isSuperAdmin(profile)) {
    return <DashPage><DashHeader title="Finance" description="This console is for a Poket School super admin." /></DashPage>;
  }

  return (
    <DashPage>
      <DashHeader eyebrow="Super admin" title="Finance" description="Invoices are issued here and linked to the payment gateway. Search by person, invoice, or status. The payer can be a parent, an institution, or an adult learner." />
      {notice && <p className="text-sm">{notice}</p>}
      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard icon={Landmark} label="MRR" value={formatMoney(summary?.mrr ?? 0)} index={0} />
        <StatCard icon={Landmark} label="ARR" value={formatMoney(summary?.arr ?? 0)} index={1} />
        <StatCard icon={Landmark} label="ARPU" value={formatMoney(summary?.arpu ?? 0)} badge={`${summary?.activeSubscribers ?? 0} active`} index={2} />
      </div>
      <Panel>
        <PanelHeader title="Invoices" meta={<span className="text-xs text-muted-foreground">{reconciliation.matched} matched · {reconciliation.unmatched} open</span>} />
        <input aria-label="Search invoices" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, invoice, or status" className="h-10 w-full max-w-sm rounded-xl border border-border px-3 text-sm mb-3" />
        <DataTable minWidth={720} head={<><th className="py-2 pr-4">Invoice</th><th className="py-2 pr-4">Checkout</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Total</th><th className="py-2">Print</th></>}>
          {visible.map((row) => (
            <tr key={row.id}>
              <td className="py-3 pr-4 text-sm font-medium">{invoiceLabel(row)}</td>
              <td className="py-3 pr-4 text-sm">{row.title || row.id}</td>
              <td className="py-3 pr-4 text-sm">{row.status}</td>
              <td className="py-3 pr-4 text-sm">{formatMoney(Number(row.total ?? 0), row.currency || 'USD')}</td>
              <td className="py-3 text-sm"><button type="button" className="underline" onClick={() => printInvoice(row)}>PDF</button></td>
            </tr>
          ))}
        </DataTable>
        {visible.length === 0 && <p className="text-sm text-muted-foreground mt-3">No matching invoices.</p>}
      </Panel>
      <Panel className="flex flex-wrap gap-2 items-center">
        <input aria-label="Checkout to refund" value={refundId} onChange={(event) => setRefundId(event.target.value)} placeholder="chk_…" className="h-10 rounded-xl border border-border px-3 text-sm" />
        <button
          type="button"
          className="h-10 px-4 rounded-full bg-foreground text-background text-sm font-bold"
          onClick={() => void authedFetch('/api/payments/refund', {
            method: 'POST',
            body: JSON.stringify({ checkoutId: refundId }),
          }).then(() => setNotice('Refund recorded.')).catch((error: unknown) => {
            setNotice(error instanceof ApiError ? error.message : 'Refund failed.');
          })}
        >
          Refund
        </button>
      </Panel>
    </DashPage>
  );
}
