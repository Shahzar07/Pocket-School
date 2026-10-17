'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { DashHeader, DashPage } from '@/components/dash-ui';
import { JoinByCode, type JoinStudentCard } from '@/components/join-by-code';
import { authedFetch } from '@/lib/api-client';
import { VOLUME_PLANS, type VolumePlanId } from '@/lib/institution-pricing';

interface ParentRequest {
  id: string;
  parentName: string;
  studentName: string;
  studentNumber: string;
}

export default function VerifyStudentPage() {
  const [card, setCard] = useState<JoinStudentCard | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState<VolumePlanId>('igcse_alevel');
  const [requests, setRequests] = useState<ParentRequest[]>([]);

  const loadRequests = () => {
    authedFetch('/api/join')
      .then((data) => setRequests(Array.isArray(data.requests) ? data.requests as ParentRequest[] : []))
      .catch(() => setRequests([]));
  };

  useEffect(loadRequests, []);

  const lookup = async (code: string) => {
    setBusy(true);
    try {
      const data = await authedFetch('/api/join', { method: 'POST', body: JSON.stringify({ action: 'lookup', code }) });
      const next = data.card as JoinStudentCard;
      setCard(next);
      setMessage(next?.membership === 'member'
        ? 'This student is already a member of your institution.'
        : next?.membership === 'elsewhere'
          ? 'This student already belongs to another institution.'
          : 'Check the name, level, and photo, then approve membership.');
    } catch (error) {
      setCard(null);
      setMessage(error instanceof Error ? error.message : 'That student number was not found.');
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    if (!card) return;
    setBusy(true);
    try {
      const data = await authedFetch('/api/join', {
        method: 'POST',
        body: JSON.stringify({ action: 'membership', code: card.studentNumber, level }),
      });
      setCard(data.card as JoinStudentCard);
      setMessage(typeof data.message === 'string' ? data.message : 'Membership approved.');
      toast.success('Membership approved.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not approve membership.');
    } finally {
      setBusy(false);
    }
  };

  const confirmLink = async (requestId: string) => {
    try {
      const data = await authedFetch('/api/join', { method: 'POST', body: JSON.stringify({ action: 'confirm', requestId }) });
      toast.success(typeof data.message === 'string' ? data.message : 'Link confirmed.');
      loadRequests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not confirm that link.');
    }
  };

  return (
    <DashPage className="max-w-3xl">
      <DashHeader eyebrow="Institution" title="Verify a student" description="Scan or enter a student number to see their name, level, and photo, then approve membership." />
      <JoinByCode
        title="Student number"
        body="The QR code on the student pass opens the same number."
        actionLabel={busy ? 'Checking…' : 'Look up'}
        onResolve={(code) => { void lookup(code); }}
        card={card}
        message={message}
        busy={busy}
        extra={card && card.membership !== 'member' && card.membership !== 'elsewhere' ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="block flex-1 text-sm font-medium text-[#1A3C34]">Level
              <select className="mt-1 h-11 w-full rounded-xl border border-[#1A3C34]/20 bg-background px-3" value={level} onChange={(event) => setLevel(event.target.value as VolumePlanId)} aria-label="Level">
                {VOLUME_PLANS.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => void approve()} disabled={busy} className="h-11 rounded-full bg-[#C8922A] px-5 text-sm font-semibold text-[#1A3C34]">Approve membership</button>
          </div>
        ) : null}
      />
      <section className="rounded-3xl border border-[#3C8DFF]/30 bg-[#E8F2FF] p-5">
        <h2 className="font-heading text-xl text-[#1A3C34]">Parent links for learners under 13</h2>
        <p className="mt-1 text-sm text-[#1A3C34]/70">The student confirms their own link from age 13. Younger learners wait for you.</p>
        {requests.length === 0 ? <p className="mt-3 text-sm text-[#1A3C34]/70">No parent link requests.</p> : (
          <ul className="mt-3 space-y-2">
            {requests.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3">
                <span className="text-sm text-[#1A3C34]">{row.parentName} wants to follow {row.studentName} · {row.studentNumber}</span>
                <button type="button" onClick={() => void confirmLink(row.id)} className="h-9 rounded-full bg-[#1A3C34] px-4 text-xs font-semibold text-white">Confirm link</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </DashPage>
  );
}
