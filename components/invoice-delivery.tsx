'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { downloadBytes } from '@/components/insights/boards';
import { invoiceFilename, invoicePdfBytes, type InvoiceFace } from '@/lib/documents/invoice-pdf';
import { parseAddresses, SMTP_MISSING } from '@/lib/documents/delivery';
import { authedFetch } from '@/lib/api-client';

export function InvoiceDelivery({
  invoices,
  smtpConfigured,
  bulk = false,
  onDone,
}: {
  invoices: InvoiceFace[];
  smtpConfigured: boolean | null;
  bulk?: boolean;
  onDone: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [includeHolder, setIncludeHolder] = useState(true);
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const download = () => {
    const year = new Date().getFullYear();
    invoices.forEach((invoice) => downloadBytes(invoiceFilename(invoice), invoicePdfBytes(invoice, year), 'application/pdf'));
  };

  const send = async () => {
    const parsed = parseAddresses(to);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (!includeHolder && parsed.emails.length === 0) {
      setError('Choose the account holder or type an address.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await authedFetch('/api/documents/send', {
        method: 'POST',
        body: JSON.stringify({
          invoiceIds: invoices.map((invoice) => invoice.id),
          includeHolder,
          to,
          message,
        }),
      });
      const sent = Array.isArray(data.sent) ? data.sent.length : 0;
      const skipped = Array.isArray(data.skipped) ? data.skipped.length : 0;
      onDone(skipped ? `Sent ${sent}. Skipped ${skipped}.` : `Sent ${sent} invoice${sent === 1 ? '' : 's'}.`);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The invoice was not sent.');
    } finally {
      setBusy(false);
    }
  };

  if (!invoices.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="text-sm underline" onClick={download}>{bulk ? 'Download PDFs' : 'Download PDF'}</button>
      <button type="button" className="text-sm underline" onClick={() => { setError(''); setOpen(true); }}>{bulk ? 'Email selected' : 'Email'}</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{bulk ? `Email ${invoices.length} invoices` : `Email ${invoices[0]?.title || 'invoice'}`}</DialogTitle>
            <DialogDescription>The account holder is selected by default. Add other addresses if someone else should receive the PDF.</DialogDescription>
          </DialogHeader>
          {smtpConfigured === false && <p className="text-sm">{SMTP_MISSING}</p>}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={includeHolder} onChange={(event) => setIncludeHolder(event.target.checked)} />
            Send to the account holder
          </label>
          <textarea aria-label="Other email addresses" value={to} onChange={(event) => setTo(event.target.value)} rows={2} placeholder="Other addresses, separated by commas" className="w-full rounded-xl border border-border p-3 text-sm" />
          <textarea aria-label="Optional message" value={message} onChange={(event) => setMessage(event.target.value)} rows={3} placeholder="Optional message" className="w-full rounded-xl border border-border p-3 text-sm" />
          {error && <p className="text-sm text-[var(--ps-tile-ink)]">{error}</p>}
          <div className="flex gap-2">
            <button type="button" className="h-10 px-4 rounded-full border border-border text-sm font-semibold" onClick={download}>Download PDF</button>
            <button type="button" disabled={busy || smtpConfigured === false} className="h-10 px-4 rounded-full bg-foreground text-background text-sm font-bold" onClick={() => void send()}>
              {busy ? 'Sending…' : 'Send'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
