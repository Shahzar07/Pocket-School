'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getTeacherCourses, Course } from '@/lib/db';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatMoney } from '@/lib/money';
import { authedFetch, ApiError } from '@/lib/api-client';

interface Sale {
  id: string;
  studentName: string;
  description: string;
  amount: number;
  currency: string;
  status: string;
  discount: number;
  when: string;
}

function saleDate(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  }
  if (typeof value === 'string') return value.slice(0, 10);
  return '';
}

export default function EarningsPage() {
  const { user } = useAuthSTORE();
  const [courses, setCourses] = useState<Course[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [notice, setNotice] = useState('');
  const [offer, setOffer] = useState({ title: '', price: '25', currency: 'USD', minutes: '60' });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const mine = await getTeacherCourses(user.uid);
      setCourses(mine);
      const snap = await getDocs(query(collection(db, 'invoices'), where('createdBy', '==', user.uid)));
      const rows = snap.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          studentName: typeof data.studentName === 'string' ? data.studentName : '',
          description: typeof data.description === 'string' ? data.description : '',
          amount: Number(data.amount) || 0,
          currency: typeof data.currency === 'string' ? data.currency : 'USD',
          status: typeof data.status === 'string' ? data.status : 'draft',
          discount: Number(data.discount) || 0,
          when: saleDate(data.paidAt) || saleDate(data.createdAt) || saleDate(data.dueDate),
        };
      });
      rows.sort((a, b) => b.when.localeCompare(a.when));
      setSales(rows);
    })().catch(() => {});
  }, [user]);

  const paidRows = sales.filter((row) => row.status === 'paid');
  const paid = paidRows.reduce((total, row) => total + row.amount, 0);
  const count = paidRows.length;
  const byStatus = ['paid', 'sent', 'draft', 'overdue', 'cancelled'].map((status) => ({
    status,
    count: sales.filter((row) => row.status === status).length,
    amount: sales.filter((row) => row.status === status).reduce((total, row) => total + row.amount, 0),
  })).filter((row) => row.count > 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-success">Earnings</p>
      <h1 className="font-heading text-4xl">Course sales</h1>
      <p className="text-muted-foreground text-sm">Sales recorded here. Payouts go to a Stripe Connect account. With no secret key, Connect stays in sandbox and nothing is sent to a bank.</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="h-11 px-5 rounded-full bg-primary text-primary-foreground text-sm font-bold"
          onClick={() => void authedFetch('/api/payments/connect', { method: 'POST', body: '{}' }).then((data) => {
            if (typeof data.url === 'string') window.location.assign(data.url);
            else setNotice(typeof data.message === 'string' ? data.message : 'Payout account updated.');
          }).catch((error: unknown) => setNotice(error instanceof ApiError ? error.message : 'Connect is unavailable.'))}
        >
          Set up payouts
        </button>
      </div>
      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
      <form
        className="rounded-3xl border border-border bg-card p-5 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void authedFetch('/api/payments/offer', {
            method: 'POST',
            body: JSON.stringify({ title: offer.title, price: Number(offer.price), currency: offer.currency, minutes: Number(offer.minutes) }),
          }).then(() => setNotice('Session listed. Learners pay it from checkout.')).catch((error: unknown) => {
            setNotice(error instanceof ApiError ? error.message : 'The session could not be listed.');
          });
        }}
      >
        <h2 className="font-semibold">Offer a tutoring session</h2>
        <input aria-label="Session title" value={offer.title} onChange={(event) => setOffer((current) => ({ ...current, title: event.target.value }))} placeholder="IGCSE Maths, one hour" className="h-10 w-full rounded-xl border border-border px-3 text-sm" />
        <div className="flex gap-2">
          <input aria-label="Session price" value={offer.price} onChange={(event) => setOffer((current) => ({ ...current, price: event.target.value }))} className="h-10 w-28 rounded-xl border border-border px-3 text-sm" />
          <select aria-label="Session currency" value={offer.currency} onChange={(event) => setOffer((current) => ({ ...current, currency: event.target.value }))} className="h-10 rounded-xl border border-border px-3 text-sm">
            <option value="USD">USD</option>
            <option value="MYR">MYR</option>
          </select>
        </div>
        <button type="submit" className="h-10 px-4 rounded-full border border-border text-sm font-semibold">List session</button>
      </form>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Paid sales</p>
          <p className="text-3xl font-bold">{formatMoney(paid)}</p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Paid invoices</p>
          <p className="text-3xl font-bold">{count}</p>
        </div>
      </div>
      <section className="rounded-3xl border border-border bg-card p-5" data-earnings-detail="yes">
        <h2 className="font-semibold">Invoice detail</h2>
        {byStatus.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
            {byStatus.map((row) => (
              <li key={row.status}>{row.status}: {row.count} · {formatMoney(row.amount)}</li>
            ))}
          </ul>
        )}
        {sales.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No invoices yet.</p> : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Student</th>
                  <th className="py-2 pr-3">Description</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Discount</th>
                  <th className="py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((row) => (
                  <tr key={row.id} data-invoice={row.id} className="border-t border-border">
                    <td className="py-2 pr-3">{row.studentName || 'Learner'}</td>
                    <td className="py-2 pr-3">{row.description || 'Course sale'}</td>
                    <td className="py-2 pr-3">{formatMoney(row.amount, row.currency)}</td>
                    <td className="py-2 pr-3">{row.status}</td>
                    <td className="py-2 pr-3">{row.discount ? formatMoney(row.discount, row.currency) : '—'}</td>
                    <td className="py-2">{row.when || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <ul className="space-y-2">
        {courses.length === 0 && <li className="text-sm text-muted-foreground">You have not published a course yet. Create one from Courses, then share the join code with your class.</li>}
        {courses.map((c) => (
          <li key={c.id} className="rounded-2xl border border-border px-4 py-3 flex justify-between text-sm">
            <span>{c.title || 'Untitled course'}</span>
            <span>{formatMoney(c.price ?? 0, c.currency)} · {c.enrollmentCount ?? 0} enrolled</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
