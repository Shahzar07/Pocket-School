'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { authedFetch } from '@/lib/api-client';
import { EmptyState, ListCard, StatCard } from '@/components/dashboard';
import { ManageSubscription } from './manage-subscription';
import { FAMILY_BUNDLE_DISCOUNT } from '@/lib/billing/discount';

const PLANS = [
  { id: 'primary_secondary', name: 'Primary & Lower Secondary' },
  { id: 'igcse_alevel', name: 'IGCSE & A-Level' },
  { id: 'professional', name: 'Professional & Degrees' },
] as const;

interface ChildRow {
  uid: string;
  name: string;
  plan: string | null;
  status: string | null;
  currentPeriodEnd: number | null;
  source: string | null;
}

interface AskRow {
  id: string;
  childId?: string;
  kind?: string;
  tierId?: string;
  courseId?: string;
  status?: string;
  note?: string;
}

interface InvoiceRow {
  id: string;
  description?: string;
  amount?: number;
  currency?: string;
  status?: string;
  receiptNumber?: string | null;
  studentId?: string;
  myInvois?: { status?: string; typeCode?: string } | null;
}

interface FamilyPayload {
  subscription: {
    status?: string | null;
    currentPeriodEnd?: number | null;
    source?: string | null;
    spendingCapUsd?: number | null;
    beneficiaryUids?: string[];
  } | null;
  children: ChildRow[];
  requests: AskRow[];
  invoices: InvoiceRow[];
  placeholderDiscount?: boolean;
}

function when(value: number | null | undefined): string {
  if (!value) return 'No renewal date yet';
  return new Date(value).toISOString().slice(0, 10);
}

export function FamilyBoard({ preview }: { preview?: FamilyPayload }) {
  const [data, setData] = useState<FamilyPayload | null>(preview ?? null);
  const [childUid, setChildUid] = useState('');
  const [tierId, setTierId] = useState<string>(PLANS[0].id);
  const [method, setMethod] = useState('card');
  const [cap, setCap] = useState('');
  const [nextPayer, setNextPayer] = useState('');
  const [busy, setBusy] = useState(false);
  const [acknowledgeWarning, setAcknowledgeWarning] = useState(false);

  useEffect(() => {
    if (preview) return;
    void authedFetch('/api/billing/family').then((row) => setData(row as unknown as FamilyPayload)).catch(() => setData(null));
  }, [preview]);

  const reload = () => {
    if (preview) return;
    void authedFetch('/api/billing/family').then((row) => setData(row as unknown as FamilyPayload)).catch(() => undefined);
  };

  const run = async (body: Record<string, unknown>) => {
    if (preview) {
      toast.message('This preview does not charge a card.');
      return;
    }
    setBusy(true);
    try {
      const result = await authedFetch('/api/billing/family', { method: 'POST', body: JSON.stringify(body) });
      const checkout = result.checkout as { url?: string } | undefined;
      const url = typeof result.url === 'string' ? result.url : checkout?.url;
      if (url) {
        window.location.href = url;
        return;
      }
      if (result.code === 'DUPLICATE_WARN') {
        toast.message(typeof result.error === 'string' ? result.error : 'The school seat covers part of this plan.');
        return;
      }
      toast.success('Saved.');
      reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Billing could not be updated.');
    } finally {
      setBusy(false);
    }
  };

  const children = data?.children ?? [];
  const pending = (data?.requests ?? []).filter((row) => row.status === 'pending');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">{FAMILY_BUNDLE_DISCOUNT.label}</p>
        <ManageSubscription returnPath="/dashboard/parent/billing" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Children on the plan" value={String(children.length)} hint={data?.subscription?.status || 'No active plan'} />
        <StatCard label="Renews" value={when(data?.subscription?.currentPeriodEnd)} hint={data?.subscription?.source || 'Web and app stay in sync'} />
        <StatCard label="Spending cap" value={data?.subscription?.spendingCapUsd == null ? 'None' : `USD ${data.subscription.spendingCapUsd}`} />
      </div>
      {children.length === 0 ? (
        <EmptyState title="No child plans yet" detail="Add a linked child. The course unlocks on their account, not yours." />
      ) : (
        <ListCard
          title="Each child"
          rows={children.map((child) => ({
            id: child.uid,
            title: child.name || child.uid,
            detail: `${child.plan || 'Plan'} · ${child.status || 'pending'} · renews ${when(child.currentPeriodEnd)} · ${child.source || 'unpaid'}`,
          }))}
        />
      )}
      <section className="space-y-3 rounded-[24px] border border-border bg-card p-4">
        <h2 className="font-heading text-xl">Add or switch a child</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Child account id
            <input className="mt-1 h-12 w-full rounded-xl border border-border bg-background px-3" value={childUid} onChange={(event) => setChildUid(event.target.value)} />
          </label>
          <label className="text-sm">Plan
            <select className="mt-1 h-12 w-full rounded-xl border border-border bg-background px-3" value={tierId} onChange={(event) => setTierId(event.target.value)} aria-label="Plan">
              {PLANS.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Payment
            <select className="mt-1 h-12 w-full rounded-xl border border-border bg-background px-3" value={method} onChange={(event) => setMethod(event.target.value)} aria-label="Payment method">
              <option value="card">Card</option>
              <option value="fpx">FPX</option>
              <option value="tng">Touch ’n Go</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex min-h-12 items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={acknowledgeWarning} onChange={(event) => setAcknowledgeWarning(event.target.checked)} />
            The school seat does not cover this plan. Continue and keep the school records.
          </label>
          <button type="button" disabled={busy} className="inline-flex min-h-12 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60" onClick={() => void run({ action: 'checkout', lines: [{ uid: childUid.trim(), tierId }], method, country: 'MY', acknowledgeWarning, graduating: acknowledgeWarning })}>Pay for this child</button>
          <button type="button" disabled={busy} className="inline-flex min-h-12 items-center rounded-full border border-border px-5 text-sm font-semibold" onClick={() => void run({ action: 'remove', childUid: childUid.trim() })}>Remove child</button>
        </div>
      </section>
      <section className="space-y-3 rounded-[24px] border border-border bg-card p-4">
        <h2 className="font-heading text-xl">Spending cap and transfer</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Cap in USD
            <input className="mt-1 h-12 w-full rounded-xl border border-border bg-background px-3" inputMode="decimal" value={cap} onChange={(event) => setCap(event.target.value)} />
          </label>
          <label className="text-sm">New guardian id
            <input className="mt-1 h-12 w-full rounded-xl border border-border bg-background px-3" value={nextPayer} onChange={(event) => setNextPayer(event.target.value)} />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} className="inline-flex min-h-12 items-center rounded-full border border-border px-5 text-sm font-semibold" onClick={() => void run({ action: 'cap', capUsd: cap.trim() === '' ? null : Number(cap) })}>Save cap</button>
          <button type="button" disabled={busy} className="inline-flex min-h-12 items-center rounded-full border border-border px-5 text-sm font-semibold" onClick={() => void run({ action: 'transfer', childUid: childUid.trim(), nextPayerUid: nextPayer.trim() })}>Transfer sponsorship</button>
        </div>
      </section>
      <ListCard
        title="Requests from children"
        rows={pending.map((row) => ({
          id: row.id,
          title: row.kind === 'course' ? `Course ${row.courseId || ''}` : `Plan ${row.tierId || ''}`,
          detail: row.note || 'Waiting for you to approve and pay, or decline.',
        }))}
      />
      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} className="inline-flex min-h-12 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground" onClick={() => void run({ action: 'respond', requestId: pending[0].id, decision: 'approved', method })}>Approve and pay</button>
          <button type="button" disabled={busy} className="inline-flex min-h-12 items-center rounded-full border border-border px-5 text-sm font-semibold" onClick={() => void run({ action: 'respond', requestId: pending[0].id, decision: 'rejected' })}>Decline</button>
        </div>
      )}
      <ListCard
        title="Receipts and invoices"
        rows={(data?.invoices ?? []).map((row) => ({
          id: row.id,
          title: row.description || 'Invoice',
          detail: `${row.currency || 'USD'} ${row.amount ?? 0} · ${row.status || ''} · ${row.receiptNumber || 'receipt pending'} · MyInvois ${row.myInvois?.status || 'not ready'}`,
        }))}
      />
    </div>
  );
}

export function AskParent({ adult }: { adult: boolean }) {
  const [parentUid, setParentUid] = useState('');
  const [tierId, setTierId] = useState<string>(PLANS[1].id);
  const [courseId, setCourseId] = useState('');
  const [busy, setBusy] = useState(false);
  if (adult) return null;
  return (
    <section className="space-y-3 rounded-[24px] border border-border bg-card p-4">
      <h2 className="font-heading text-xl">Ask a parent</h2>
      <p className="text-sm text-muted-foreground">You cannot enter payment details. A parent approves the request and pays.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Parent account id
          <input className="mt-1 h-12 w-full rounded-xl border border-border bg-background px-3" value={parentUid} onChange={(event) => setParentUid(event.target.value)} />
        </label>
        <label className="text-sm">Plan
          <select className="mt-1 h-12 w-full rounded-xl border border-border bg-background px-3" value={tierId} onChange={(event) => setTierId(event.target.value)} aria-label="Requested plan">
            {PLANS.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
          </select>
        </label>
        <label className="text-sm sm:col-span-2">Or a course id
          <input className="mt-1 h-12 w-full rounded-xl border border-border bg-background px-3" value={courseId} onChange={(event) => setCourseId(event.target.value)} />
        </label>
      </div>
      <button
        type="button"
        disabled={busy}
        className="inline-flex min-h-12 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        onClick={() => {
          setBusy(true);
          const kind = courseId.trim() ? 'course' : 'plan';
          void authedFetch('/api/billing/family', {
            method: 'POST',
            body: JSON.stringify({ action: 'ask', parentUid: parentUid.trim(), kind, tierId, courseId: courseId.trim() }),
          }).then(() => toast.success('Request sent to your parent.')).catch((error: unknown) => {
            toast.error(error instanceof Error ? error.message : 'The request could not be sent.');
          }).finally(() => setBusy(false));
        }}
      >
        Send request
      </button>
    </section>
  );
}
