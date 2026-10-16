'use client';

import { useEffect, useState } from 'react';
import { Download, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { downloadBytes, downloadText } from '@/components/insights/boards';
import { ApiError, authedFetch } from '@/lib/api-client';
import { SMTP_MISSING, type Deliverable } from '@/lib/documents/delivery';
import { documentPdf } from '@/lib/documents/packet';

let smtpPromise: Promise<boolean> | null = null;

function loadSmtp(): Promise<boolean> {
  if (!smtpPromise) {
    smtpPromise = authedFetch('/api/documents/send')
      .then((data) => data.configured === true)
      .catch(() => {
        smtpPromise = null;
        return false;
      });
  }
  return smtpPromise;
}

export function DocumentDelivery({
  documents,
  studentIds,
  institutionId,
  csv,
  compact,
}: {
  documents: Deliverable[];
  studentIds: string[];
  institutionId?: string;
  csv?: { filename: string; text: string };
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [includeHolder, setIncludeHolder] = useState(true);
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [picked, setPicked] = useState<string[]>(() => documents.map((doc) => doc.id));
  const documentKey = documents.map((doc) => doc.id).join('|');
  const many = documents.length > 1;
  const chosen = documents.filter((doc) => picked.includes(doc.id));

  useEffect(() => {
    setPicked(documentKey ? documentKey.split('|') : []);
  }, [documentKey]);

  if (!documents.length && !csv) return null;

  function saveFiles(list: Deliverable[]) {
    const year = new Date().getFullYear();
    for (const doc of list) downloadBytes(doc.filename, documentPdf(doc, year), 'application/pdf');
    if (csv) downloadText(csv.filename, csv.text, 'text/csv');
  }

  async function openEmail() {
    setOpen(true);
    if (configured === null) setConfigured(await loadSmtp());
  }

  async function send() {
    const payload = many ? chosen : documents;
    if (!payload.length && !csv) return;
    setSending(true);
    try {
      await authedFetch('/api/documents/send', {
        method: 'POST',
        body: JSON.stringify({
          documents: payload,
          includeHolder,
          to,
          message,
          studentIds,
          institutionId,
          csv,
        }),
      });
      toast.success(payload.length > 1 ? `Emailed ${payload.length} documents.` : 'Email sent.');
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not send that email.');
    } finally {
      setSending(false);
    }
  }

  const size = compact ? 'sm' : 'default';
  const pdfLabel = documents.length === 0 ? 'Download CSV' : many ? 'Download PDFs' : 'Download PDF';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size={size} onClick={() => saveFiles(documents)}>
        <Download />
        {pdfLabel}
      </Button>
      {csv && documents.length > 0 && (
        <Button type="button" variant="outline" size={size} onClick={() => downloadText(csv.filename, csv.text, 'text/csv')}>
          <Download />
          Download CSV
        </Button>
      )}
      <Button type="button" variant="outline" size={size} onClick={() => void openEmail()}>
        <Mail />
        {many ? `Email (${documents.length})` : 'Email'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{many ? 'Email documents' : 'Email document'}</DialogTitle>
            <DialogDescription>
              Send to the account holder, or type other addresses. An optional note is included in the email.
            </DialogDescription>
          </DialogHeader>
          {many && (
            <ul className="max-h-32 overflow-auto space-y-1">
              {documents.map((doc) => (
                <li key={doc.id}>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={picked.includes(doc.id)}
                      onChange={() => setPicked((current) => current.includes(doc.id) ? current.filter((id) => id !== doc.id) : [...current, doc.id])}
                    />
                    {doc.title}
                  </label>
                </li>
              ))}
            </ul>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={includeHolder} onChange={(event) => setIncludeHolder(event.target.checked)} />
            Send to the account holder
          </label>
          <textarea
            aria-label="Other email addresses"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            placeholder="Other addresses, separated by commas"
            className="min-h-16 w-full rounded-xl border border-border px-3 py-2 text-sm"
          />
          <textarea
            aria-label="Optional message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Optional message"
            className="min-h-16 w-full rounded-xl border border-border px-3 py-2 text-sm"
          />
          {configured === false && <p className="text-sm text-amber-700">{SMTP_MISSING}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => saveFiles(many ? chosen : documents)}>Download PDF</Button>
            <Button type="button" disabled={configured === false || sending || (chosen.length === 0 && !csv)} onClick={() => void send()}>
              {sending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
