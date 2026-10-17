'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { WidenAllStaff } from '@/components/alerts/all-staff';
import { DashHeader, DashPage } from '@/components/dash-ui';
import { authedFetch, postJSON } from '@/lib/authed-fetch';

interface Notice {
  id: string;
  studentName?: string;
  createdAt?: number;
  tracker?: string;
  location?: { lat: number; lng: number } | null;
  parentsExcluded?: boolean;
  canAck?: boolean;
  canDecideFamily?: boolean;
  canMarkFalse?: boolean;
  flagged?: boolean;
  flagReason?: string;
}

export default function SafetyNoticePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [notice, setNotice] = useState<Notice | null>(null);
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState<'now' | 'later' | 'not_now'>('not_now');
  const [when, setWhen] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    let gone = false;
    void authedFetch(`/api/safety/notice?id=${encodeURIComponent(id)}`).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (gone) return;
      if (!res.ok) setMessage(typeof data.error === 'string' ? data.error : 'You cannot open this alert.');
      else setNotice(data as Notice);
    });
    return () => { gone = true; };
  }, [id]);

  const ack = async () => {
    await postJSON('/api/safety/ack', { id });
    setMessage('Acknowledged.');
  };

  const family = async () => {
    await postJSON('/api/safety/family', { id, contact, when, reason });
    setMessage('Decision saved. Parents are not notified by this step.');
  };

  const markFalse = async () => {
    await postJSON('/api/safety/false-danger', { id });
    setMessage('Marked as a false trigger. A repeat is flagged and still goes through.');
  };

  const whenText = notice?.createdAt ? new Date(notice.createdAt).toISOString() : '';

  return (
    <DashPage>
      <DashHeader
        eyebrow="Safeguarding"
        title={notice?.studentName ? `${notice.studentName} needs help` : 'Safety alert'}
        description="This card has the name and the time. The report itself stays with the safeguarding lead."
      />
      {message ? <p className="text-sm font-semibold">{message}</p> : null}
      {notice ? (
        <section className="rounded-2xl border border-border bg-card p-4 grid gap-3">
          <p className="text-sm">Sent at {whenText}.</p>
          <p className="text-sm">{notice.location ? 'A location was shared once.' : 'Location was not shared.'}</p>
          <p className="text-sm">{notice.parentsExcluded ? 'Parents were not notified.' : 'Linked parents were included.'}</p>
          {notice.flagged ? <p className="text-sm">Flagged for staff: {notice.flagReason || 'review'}.</p> : null}
          {notice.canAck ? <button type="button" className="min-h-12 rounded-xl bg-primary text-primary-foreground font-bold" onClick={() => void ack()}>I have seen this</button> : null}
          {notice.canMarkFalse ? <button type="button" className="min-h-12 rounded-xl border font-bold" onClick={() => void markFalse()}>Mark as a false trigger</button> : null}
          {notice.canDecideFamily ? (
            <form className="grid gap-2" onSubmit={event => { event.preventDefault(); void family(); }}>
              <h2 className="font-bold">Family contact decision</h2>
              <label className="grid gap-1 text-sm font-semibold">Decision
                <select className="min-h-12 rounded-xl border px-3" value={contact} onChange={event => setContact(event.target.value as 'now' | 'later' | 'not_now')} aria-label="Family contact decision">
                  <option value="not_now">Not now</option>
                  <option value="later">Later</option>
                  <option value="now">Contact the family</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold">When
                <input className="min-h-12 rounded-xl border px-3" value={when} onChange={event => setWhen(event.target.value)} aria-label="When to contact the family" />
              </label>
              <label className="grid gap-1 text-sm font-semibold">Reason
                <textarea className="min-h-24 rounded-xl border p-3" value={reason} onChange={event => setReason(event.target.value)} aria-label="Reason for the family decision" />
              </label>
              <button type="submit" className="min-h-12 rounded-xl bg-primary text-primary-foreground font-bold">Save decision</button>
            </form>
          ) : null}
        </section>
      ) : null}
      <WidenAllStaff source="case" sourceId={id} />
    </DashPage>
  );
}
