'use client';

import { useEffect, useState } from 'react';
import { DashHeader, DashPage, DataTable, Panel, PanelHeader, StatCard } from '@/components/dash-ui';
import { ApiError, authedFetch } from '@/lib/api-client';
import { formatMoney } from '@/lib/money';
import { isSuperAdmin } from '@/lib/roles';
import { useAuthSTORE } from '@/hooks/use-auth';
import { filterFinanceRows, invoiceLabel } from '@/lib/billing-model';
import { InvoiceDelivery } from '@/components/invoice-delivery';
import type { InvoiceFace } from '@/lib/documents/invoice-pdf';
import { Landmark } from 'lucide-react';
import { DocumentDelivery } from '@/components/document-delivery';
import { textDocument } from '@/lib/documents/packet';

interface Summary { mrr: number; arr: number; arpu: number; activeSubscribers: number }
interface Tx { id: string; title?: string; total?: number; currency?: string; status?: string; invoiceId?: string; userId?: string; email?: string; buyerName?: string }

export default function FinancePage() {
  const { profile } = useAuthSTORE();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<Tx[]>([]);
  const [reconciliation, setReconciliation] = useState({ matched: 0, unmatched: 0, total: 0 });
  const [notice, setNotice] = useState('');
  const [refundId, setRefundId] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState('');
  const [smtpConfigured, setSmtpConfigured] = useState<boolean | null>(null);

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
    authedFetch('/api/documents/send').then((data) => {
      setSmtpConfigured(data.configured === true);
    }).catch(() => setSmtpConfigured(false));
  }, [profile]);

  const visible = filterFinanceRows(rows, query);
  const face = (row: Tx): InvoiceFace => ({
    ...row,
    totalLabel: formatMoney(Number(row.total ?? 0), row.currency || 'USD'),
    holderEmail: row.email,
    holderName: row.buyerName,
  });
  const chosen = visible.filter((row) => selected.includes(row.id)).map(face);
  const detail = visible.find((row) => row.id === openId);

  if (!isSuperAdmin(profile)) {
    return <DashPage><DashHeader title="Finance" description="This console is for a Poket School super admin." /></DashPage>;
  }

  return (
    <DashPage>
      <DashHeader eyebrow="Super admin" title="Finance" description="Invoices are issued here and linked to the payment gateway. Search by person, invoice, or status. The payer can be a parent, an institution, or an adult learner. MRR counts the primary subscriber." />
      <DocumentDelivery
        documents={[textDocument({
          id: 'finance-statement',
          title: 'Finance statement',
          lines: [
            `MRR: ${formatMoney(summary?.mrr ?? 0)}`,
            `ARR: ${formatMoney(summary?.arr ?? 0)}`,
            `ARPU: ${formatMoney(summary?.arpu ?? 0)}`,
            `Active subscribers: ${summary?.activeSubscribers ?? 0}`,
            `Matched: ${reconciliation.matched}`,
            `Open: ${reconciliation.unmatched}`,
          ],
        })]}
        studentIds={[]}
      />
      {notice && <p className="text-sm">{notice}</p>}
      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard icon={Landmark} label="MRR" value={formatMoney(summary?.mrr ?? 0)} index={0} tone="teal" />
        <StatCard icon={Landmark} label="ARR" value={formatMoney(summary?.arr ?? 0)} index={1} tone="amber" />
        <StatCard icon={Landmark} label="ARPU" value={formatMoney(summary?.arpu ?? 0)} badge={`${summary?.activeSubscribers ?? 0} active`} index={2} tone="emerald" />
      </div>
      <Panel>
        <PanelHeader title="Invoices" meta={<span className="text-xs text-muted-foreground">{reconciliation.matched} matched · {reconciliation.unmatched} open</span>} />
        <input aria-label="Search invoices" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, invoice, or status" className="h-10 w-full max-w-sm rounded-xl border border-border px-3 text-sm mb-3" />
        <div className="mb-3">
          {chosen.length > 0 ? (
            <InvoiceDelivery invoices={chosen} smtpConfigured={smtpConfigured} bulk onDone={setNotice} />
          ) : (
            <p className="text-sm text-muted-foreground">Select invoices to email them together. Each row can also download or email on its own.</p>
          )}
        </div>
        <DataTable minWidth={860} head={<><th className="py-2 pr-4">Select</th><th className="py-2 pr-4">Invoice</th><th className="py-2 pr-4">Checkout</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Total</th><th className="py-2">Send</th></>}>
          {visible.map((row) => (
            <tr key={row.id}>
              <td className="py-3 pr-4">
                <input
                  aria-label={`Select ${invoiceLabel(row)}`}
                  type="checkbox"
                  checked={selected.includes(row.id)}
                  onChange={(event) => setSelected((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))}
                />
              </td>
              <td className="py-3 pr-4 text-sm font-medium">
                <button type="button" className="underline" onClick={() => setOpenId(row.id)}>{invoiceLabel(row)}</button>
              </td>
              <td className="py-3 pr-4 text-sm">{row.title || row.id}</td>
              <td className="py-3 pr-4 text-sm">{row.status}</td>
              <td className="py-3 pr-4 text-sm">{formatMoney(Number(row.total ?? 0), row.currency || 'USD')}</td>
              <td className="py-3 text-sm"><InvoiceDelivery invoices={[face(row)]} smtpConfigured={smtpConfigured} onDone={setNotice} /></td>
            </tr>
          ))}
        </DataTable>
        {visible.length === 0 && <p className="text-sm text-muted-foreground mt-3">No matching invoices.</p>}
        {detail && (
          <div className="mt-4 rounded-2xl border border-border p-4 space-y-2">
            <p className="font-semibold">{invoiceLabel(detail)}</p>
            <p className="text-sm text-muted-foreground">{detail.title || detail.id} · {detail.status} · {formatMoney(Number(detail.total ?? 0), detail.currency || 'USD')}</p>
            <p className="text-sm text-muted-foreground">The payer can be a parent, an institution, or an adult learner.</p>
            <InvoiceDelivery invoices={[face(detail)]} smtpConfigured={smtpConfigured} onDone={setNotice} />
          </div>
        )}
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
