'use client';

import { useEffect, useState } from 'react';
import { DashHeader, DashPage, DataTable, Panel, PanelHeader, StatCard } from '@/components/dash-ui';
import { ApiError, authedFetch } from '@/lib/api-client';
import { formatMoney } from '@/lib/money';
import { isSuperAdmin } from '@/lib/roles';
import { useAuthSTORE } from '@/hooks/use-auth';
import { Landmark } from 'lucide-react';
import { DocumentDelivery } from '@/components/document-delivery';
import { textDocument } from '@/lib/documents/packet';

interface Summary { mrr: number; arr: number; arpu: number; activeSubscribers: number }
interface Tx { id: string; title?: string; total?: number; currency?: string; status?: string; invoiceId?: string; userId?: string }

export default function FinancePage() {
  const { profile } = useAuthSTORE();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<Tx[]>([]);
  const [reconciliation, setReconciliation] = useState({ matched: 0, unmatched: 0, total: 0 });
  const [notice, setNotice] = useState('');
  const [refundId, setRefundId] = useState('');

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

  if (!isSuperAdmin(profile)) {
    return <DashPage><DashHeader title="Finance" description="This console is for a Poket School super admin." /></DashPage>;
  }

  return (
    <DashPage>
      <DashHeader eyebrow="Super admin" title="Finance" description="MRR counts the primary subscriber. Reconciliation is a transaction with an invoice against one without." />
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
        <StatCard icon={Landmark} label="MRR" value={formatMoney(summary?.mrr ?? 0)} index={0} />
        <StatCard icon={Landmark} label="ARR" value={formatMoney(summary?.arr ?? 0)} index={1} />
        <StatCard icon={Landmark} label="ARPU" value={formatMoney(summary?.arpu ?? 0)} badge={`${summary?.activeSubscribers ?? 0} active`} index={2} />
      </div>
      <Panel>
        <PanelHeader title="Reconciliation" meta={<span className="text-xs text-muted-foreground">{reconciliation.matched} matched · {reconciliation.unmatched} open</span>} />
        {rows.length > 0 && (
          <div className="mb-3">
            <DocumentDelivery
              documents={rows.map((row) => textDocument({
                id: row.id,
                title: row.title || row.invoiceId || 'Invoice',
                studentId: row.userId,
                lines: [
                  'Invoice',
                  row.title || row.id,
                  `Status: ${row.status || ''}`,
                  `Total: ${formatMoney(Number(row.total ?? 0), row.currency || 'USD')}`,
                  row.invoiceId ? `Invoice id: ${row.invoiceId}` : '',
                ],
              }))}
              studentIds={[]}
            />
          </div>
        )}
        <DataTable minWidth={720} head={<><th className="py-2 pr-4">Checkout</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Total</th><th className="py-2">File</th></>}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="py-3 pr-4 text-sm">{row.title || row.id}</td>
              <td className="py-3 pr-4 text-sm">{row.status}</td>
              <td className="py-3 pr-4 text-sm">{formatMoney(Number(row.total ?? 0), row.currency || 'USD')}</td>
              <td className="py-3">
                <DocumentDelivery
                  compact
                  documents={[textDocument({
                    id: row.id,
                    title: row.title || row.invoiceId || 'Invoice',
                    studentId: row.userId,
                    lines: [
                      'Invoice',
                      row.title || row.id,
                      `Status: ${row.status || ''}`,
                      `Total: ${formatMoney(Number(row.total ?? 0), row.currency || 'USD')}`,
                    ],
                  })]}
                  studentIds={[]}
                />
              </td>
            </tr>
          ))}
        </DataTable>
        {rows.length === 0 && <p className="text-sm text-muted-foreground mt-3">No transactions yet.</p>}
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
