'use client';

import { FormEvent, useState } from 'react';
import { BRAND } from '@/lib/brand';

export function AckForm({ token }: { token: string }) {
  const [actionTaken, setActionTaken] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) {
      setMessage('This link is not available.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/school-notice/ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, actionTaken }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      setMessage(res.ok ? 'Receipt confirmed. Thank you.' : (data.error || 'Try again in a moment.'));
    } catch {
      setMessage('Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={event => void submit(event)} className="grid gap-3">
      <h2 className="text-xl font-semibold" style={{ color: BRAND.blueDeep }}>Confirm receipt</h2>
      <label className="grid gap-1 text-sm font-semibold">
        Action taken
        <textarea
          className="min-h-24 rounded-xl border p-3 font-normal"
          style={{ borderColor: '#D5E3E7', color: BRAND.ink }}
          value={actionTaken}
          onChange={event => setActionTaken(event.target.value)}
          aria-label="Action taken"
          placeholder="What the school did"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-12 items-center justify-center rounded-xl px-4 font-semibold"
        style={{ background: BRAND.cyan, color: BRAND.ink, border: `1px solid ${BRAND.blueDeep}` }}
      >
        Confirm receipt
      </button>
      {message ? <p className="text-sm font-semibold">{message}</p> : null}
    </form>
  );
}
