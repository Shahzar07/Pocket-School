'use client';

import { useState } from 'react';
import { Download, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { downloadBytes } from '@/components/insights/boards';
import { buildPdf } from '@/lib/insights/pdf';

/**
 * Download PDF always works. Email uses the shared document sender from the
 * delivery work when that route is available, and the mail app otherwise.
 */
export function EssayDelivery({
  title,
  lines,
  holderEmail,
}: {
  title: string;
  lines: string[];
  holderEmail?: string;
}) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [includeHolder, setIncludeHolder] = useState(Boolean(holderEmail));

  function download() {
    const year = new Date().getFullYear();
    downloadBytes('et-essays.pdf', buildPdf(title || 'ET Essays', lines, year), 'application/pdf');
  }

  async function send() {
    const documents = [{
      id: 'et-essay',
      title: title || 'ET Essays',
      filename: 'et-essays.pdf',
      lines,
      holderEmail: includeHolder ? holderEmail : undefined,
    }];
    try {
      const probe = await fetch('/api/documents/send');
      if (probe.ok) {
        const res = await fetch('/api/documents/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documents, includeHolder, to, message: note, studentIds: [] }),
        });
        if (res.ok) {
          toast.success('Email sent.');
          setOpen(false);
          return;
        }
      }
    } catch {
      // The shared sender is not on this branch yet.
    }
    const addresses = [includeHolder ? holderEmail : '', to].filter(Boolean).join(',');
    const body = [note.trim(), lines.join('\n')].filter(Boolean).join('\n\n').slice(0, 1800);
    window.location.href = `mailto:${encodeURIComponent(addresses)}?subject=${encodeURIComponent(title || 'ET Essays')}&body=${encodeURIComponent(body)}`;
    setOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={download} className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold">
        <Download className="h-4 w-4" /> Download PDF
      </button>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold">
        <Mail className="h-4 w-4" /> Email
      </button>
      {open && (
        <form
          className="basis-full space-y-2 rounded-2xl border border-border bg-card p-4"
          onSubmit={event => {
            event.preventDefault();
            void send();
          }}
        >
          <p className="text-sm font-semibold">Email this essay</p>
          <p className="text-[13px] text-muted-foreground">Send to the account holder, or type other addresses. An optional note is included.</p>
          {holderEmail && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={includeHolder} onChange={event => setIncludeHolder(event.target.checked)} />
              Send to the account holder
            </label>
          )}
          <textarea aria-label="Other email addresses" value={to} onChange={event => setTo(event.target.value)} placeholder="Other addresses, separated by commas" className="min-h-16 w-full rounded-xl border border-border px-3 py-2 text-sm" />
          <textarea aria-label="Optional message" value={note} onChange={event => setNote(event.target.value)} placeholder="Optional message" className="min-h-16 w-full rounded-xl border border-border px-3 py-2 text-sm" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-full px-4 text-sm font-semibold text-muted-foreground">Close</button>
            <button type="submit" className="h-10 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground">Send</button>
          </div>
        </form>
      )}
    </div>
  );
}
