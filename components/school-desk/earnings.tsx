'use client';

import { useMemo, useState } from 'react';
import { deskCopy as t } from '@/lib/school-desk/copy';
import { earningNet, refundEarning, type EarningRow } from '@/lib/school-desk/model';
import { DeskFrame, deskStyles, resetToDemo, useDesk } from './ui';

const SOURCES: Array<EarningRow['source'] | 'all'> = ['all', 'course', 'live', 'institution', 'share'];
const STATUSES: Array<EarningRow['status'] | 'all'> = ['all', 'pending', 'available', 'paid'];

export function EarningsDesk() {
  const { state, setState } = useDesk();
  const [source, setSource] = useState<(typeof SOURCES)[number]>('all');
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('all');
  const rows = state.earnings.filter((item) => (source === 'all' || item.source === source) && (status === 'all' || item.status === status));
  const sum = (kind: EarningRow['status']) => state.earnings.filter((item) => item.status === kind).reduce((total, item) => total + earningNet(item), 0);
  const months = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of state.earnings) map.set(row.month, (map.get(row.month) ?? 0) + earningNet(row));
    return [...map.entries()];
  }, [state.earnings]);
  const max = Math.max(...months.map((item) => item[1]), 1);
  const courses = state.earnings.filter((item) => item.source === 'course');

  return (
    <DeskFrame title={t.earningsTitle} lede={t.earningsLede} state={state} onReset={() => resetToDemo(setState)} syncs="Wallet, admin finance, MyInvois invoice fields. Nothing is paid out in this sample.">
      <div className="grid gap-3 sm:grid-cols-3">
        <p className="rounded-2xl bg-white p-4 text-sm">{t.pending}<span className="mt-1 block font-heading text-3xl">RM {sum('pending')}</span></p>
        <p className="rounded-2xl bg-white p-4 text-sm">{t.available}<span className="mt-1 block font-heading text-3xl">RM {sum('available')}</span></p>
        <p className="rounded-2xl bg-white p-4 text-sm">{t.paid}<span className="mt-1 block font-heading text-3xl">RM {sum('paid')}</span></p>
      </div>
      <section className="rounded-3xl bg-white p-5">
        <h2 className="font-heading text-2xl">{t.monthChart}</h2>
        <ul className="mt-3 space-y-2">
          {months.map(([month, amount]) => (
            <li key={month}>
              <div className="flex justify-between text-sm"><span>{month}</span><span>RM {amount}</span></div>
              <div className="mt-1 h-2 rounded-full bg-[#f4f7f8]"><div className="h-2 rounded-full bg-[#3FE0D0]" style={{ width: `${Math.round((amount / max) * 100)}%` }} /></div>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-3xl bg-white p-5">
        <h2 className="font-heading text-2xl">{t.topCourses}</h2>
        <ul className="mt-2 text-sm">
          {courses.map((item) => <li key={item.id}>{item.label} · RM {item.gross} · {t.demoBadge}</li>)}
        </ul>
      </section>
      <section className="rounded-3xl bg-white p-5">
        <h2 className="font-heading text-2xl">{t.payout}</h2>
        <p className="mt-2 text-sm text-[#1E6A83]">{state.payout.schedule}</p>
        <p className="text-sm text-[#1E6A83]">{state.payout.method}</p>
      </section>
      <section className="rounded-3xl bg-white p-5">
        <h2 className="font-heading text-2xl">{t.invoice}</h2>
        <p className="mt-2 text-sm">{state.payout.invoice}</p>
        <p className="text-sm text-[#1E6A83]">{state.payout.tin}</p>
        <p className="text-sm text-[#1E6A83]">{state.payout.sst}</p>
      </section>
      <section className="rounded-3xl bg-white p-5">
        <h2 className="font-heading text-2xl">{t.payoutHistory}</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {state.payouts.map((item) => (
            <li key={item.id}>{item.date} · RM {item.amount} · {item.status} · {item.note} · {t.demoBadge}</li>
          ))}
        </ul>
      </section>
      <div className="flex flex-wrap gap-2">
        <select className={deskStyles.field} value={source} onChange={(event) => setSource(event.target.value as (typeof SOURCES)[number])} aria-label={t.history}>
          {SOURCES.map((item) => <option key={item} value={item}>{t.sources[item]}</option>)}
        </select>
        <select className={deskStyles.field} value={status} onChange={(event) => setStatus(event.target.value as (typeof STATUSES)[number])} aria-label={t.flag}>
          {STATUSES.map((item) => <option key={item} value={item}>{item === 'all' ? t.all : t.pay[item]}</option>)}
        </select>
        <button type="button" className={deskStyles.ghost} onClick={() => {
          const csv = ['course,date,gross,split,fees,net,status', ...rows.map((item) => [item.label, item.date, item.gross, item.split, item.fee, earningNet(item), item.status].join(','))].join('\n');
          const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
          const link = document.createElement('a');
          link.href = url;
          link.download = 'earnings-sample.csv';
          link.click();
          URL.revokeObjectURL(url);
        }}>{t.exportCsv}</button>
      </div>
      <div className="overflow-x-auto rounded-3xl bg-white">
        <table className="w-full text-left text-sm">
          <thead className="text-[#1E6A83]">
            <tr>
              <th className="px-3 py-3">{t.saleCourse}</th>
              <th className="px-3 py-3">{t.saleDate}</th>
              <th className="px-3 py-3">{t.saleGross}</th>
              <th className="px-3 py-3">{t.saleSplit}</th>
              <th className="px-3 py-3">{t.saleFees}</th>
              <th className="px-3 py-3">{t.saleNet}</th>
              <th className="px-3 py-3">{t.flag}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id} className="border-t border-[#1E6A83]/10">
                <td className="px-3 py-3 font-semibold">{item.label}</td>
                <td className="px-3 py-3">{item.date}</td>
                <td className="px-3 py-3">RM {item.gross}</td>
                <td className="px-3 py-3">RM {item.split}</td>
                <td className="px-3 py-3">RM {item.fee}</td>
                <td className="px-3 py-3">RM {earningNet(item)}</td>
                <td className="px-3 py-3">
                  {t.pay[item.status]} · {t.demoBadge}
                  {item.refund ? <span> · {t.refund} {item.refund}</span> : null}
                  <button type="button" className={`${deskStyles.ghost} ml-2`} data-action="refund" onClick={() => setState(refundEarning(state, item.id, 10, state.actorName))}>{t.recordRefund}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DeskFrame>
  );
}
