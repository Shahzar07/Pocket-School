'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { readPublishedReport } from '@/lib/insights/client';
import { copyrightLine } from '@/lib/insights/copyright';

export default function VerifyReportPage() {
  const params = useParams<{ token: string }>();
  const [card, setCard] = useState<Record<string, unknown> | null | undefined>(undefined);

  useEffect(() => {
    const token = params.token;
    if (!token) return;
    readPublishedReport(token).then(data => setCard(data as Record<string, unknown> | null)).catch(() => setCard(null));
  }, [params.token]);

  return (
    <main className="max-w-lg mx-auto px-6 py-16">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Poket School</p>
      <h1 className="font-heading text-4xl mt-2">Report verification</h1>
      {card === undefined && <p className="mt-6 text-sm text-muted-foreground">Checking this card…</p>}
      {card === null && <p className="mt-6 text-sm">This link does not match a published report.</p>}
      {card && (
        <div className="mt-6 rounded-2xl border border-border p-5 space-y-2">
          <p className="text-sm text-muted-foreground">{String(card.heading ?? 'Report')}</p>
          <p className="text-2xl font-semibold">{String(card.studentName ?? '')}</p>
          <p>{String(card.courseTitle ?? '')}</p>
          <p className="text-lg">Grade {String(card.grade ?? '—')} · {String(card.termId ?? '')} {String(card.year ?? '')}</p>
          <p className="text-xs text-muted-foreground">Issued by {String(card.issuer ?? 'PoketSchool.Ai')}. Comments are not on this public card.</p>
        </div>
      )}
      <p className="mt-8 text-xs text-muted-foreground">{copyrightLine(new Date().getFullYear())}</p>
    </main>
  );
}
