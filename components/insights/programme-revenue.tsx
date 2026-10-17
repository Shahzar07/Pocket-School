'use client';

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/api-client';

interface RevenueRow {
  institutionId: string;
  name: string;
  itemId: string;
  title: string;
  currency: string;
  amount: number;
}

export function ProgrammeRevenue({
  institutionId = '',
  sample,
}: {
  institutionId?: string;
  sample?: RevenueRow[];
}) {
  const [rows, setRows] = useState<RevenueRow[]>(sample ?? []);

  useEffect(() => {
    if (sample) return;
    const query = institutionId ? `?institutionId=${encodeURIComponent(institutionId)}` : '';
    authedFetch(`/api/insights/programme-revenue${query}`)
      .then((data) => {
        const list = Array.isArray(data.rows) ? data.rows as RevenueRow[] : [];
        setRows(list);
      })
      .catch(() => setRows([]));
  }, [institutionId, sample]);

  return (
    <section className="rounded-3xl border border-[#1A3C34]/10 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-[#1A3C34]">Revenue by academy and programme</h2>
      <p className="mt-1 text-sm text-[#1A3C34]/70">Each row is the amount stored on that academy’s current bill for one programme or category.</p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-[#1A3C34]/70">No programme revenue is stored yet.</p>
      ) : (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-[#1A3C34]/70">
              <th className="py-2">Academy</th>
              <th>Programme</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.institutionId}-${row.itemId}-${row.currency}`} className="border-t border-[#1A3C34]/10">
                <td className="py-2">{row.name}</td>
                <td>{row.title}</td>
                <td className="tabular-nums">{row.currency} {row.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
